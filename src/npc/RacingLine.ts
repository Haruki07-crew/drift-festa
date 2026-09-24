/**
 * レーシングライン (コース中心線からの横オフセット列) と速度計画。
 *
 * 1. 理想ライン: 弾性バンド法で曲率が小さくなるよう各サンプルの横オフセットを反復調整
 * 2. NPCパターンごとの基本ライン: 中心線と理想ラインを lineBlend で混ぜ、lineOffset を加える
 * 3. 速度計画: ラインの曲率と車のグリップ・ステア性能からコーナー限界速度を求め、
 *    ブレーキ性能で後ろ向きに減速区間を作る
 */
import type { CarSpec } from '../config/cars';
import { npcConfig } from '../config/npc';
import { physicsConfig } from '../config/physics';
import { kmhToMs, wrapAngle } from '../core/math';
import type { Track } from '../courses/Track';

/** 理想ラインの横オフセット列を計算する (コースごとに1回) */
export function computeIdealOffsets(track: Track, cfg = npcConfig.racingLine): Float32Array {
  const n = track.samples.length;
  const off = new Float32Array(n);
  const px = new Float32Array(n);
  const pz = new Float32Array(n);
  const limit = (i: number): number => {
    const s = track.samples[i]!;
    return Math.max(0, s.halfWidth - cfg.edgeMargin);
  };
  const updatePos = (i: number): void => {
    const s = track.samples[i]!;
    px[i] = s.x + s.rx * off[i]!;
    pz[i] = s.z + s.rz * off[i]!;
  };
  for (let i = 0; i < n; i++) updatePos(i);

  for (let iter = 0; iter < cfg.iterations; iter++) {
    // 前半は2つ隣まで使う曲率最小化、後半は隣接点の中点 (長さ最小化) を少し混ぜる
    for (let parity = 0; parity < 2; parity++) {
      for (let i = parity; i < n; i += 2) {
        const im2 = (i - 2 + n) % n;
        const im1 = (i - 1 + n) % n;
        const ip1 = (i + 1) % n;
        const ip2 = (i + 2) % n;
        const mx = (-px[im2]! + 4 * px[im1]! + 4 * px[ip1]! - px[ip2]!) / 6;
        const mz = (-pz[im2]! + 4 * pz[im1]! + 4 * pz[ip1]! - pz[ip2]!) / 6;
        const s = track.samples[i]!;
        const desired = (mx - s.x) * s.rx + (mz - s.z) * s.rz;
        const lim = limit(i);
        let o = off[i]! + (desired - off[i]!) * cfg.relaxation;
        o = o < -lim ? -lim : o > lim ? lim : o;
        off[i] = o;
        updatePos(i);
      }
    }
  }
  return off;
}

export class RacingLine {
  readonly track: Track;
  readonly offsets: Float32Array;
  readonly xs: Float32Array;
  readonly zs: Float32Array;
  readonly curvature: Float32Array;

  constructor(track: Track, offsets: Float32Array) {
    this.track = track;
    this.offsets = offsets;
    const n = track.samples.length;
    this.xs = new Float32Array(n);
    this.zs = new Float32Array(n);
    this.curvature = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = track.samples[i]!;
      this.xs[i] = s.x + s.rx * offsets[i]!;
      this.zs[i] = s.z + s.rz * offsets[i]!;
    }
    // ライン自体の曲率
    const raw = new Float32Array(n);
    const step = 2;
    for (let i = 0; i < n; i++) {
      const a = (i - step + n) % n;
      const b = (i + step) % n;
      const h0 = Math.atan2(this.xs[i]! - this.xs[a]!, this.zs[i]! - this.zs[a]!);
      const h1 = Math.atan2(this.xs[b]! - this.xs[i]!, this.zs[b]! - this.zs[i]!);
      const d0 = Math.hypot(this.xs[i]! - this.xs[a]!, this.zs[i]! - this.zs[a]!);
      const d1 = Math.hypot(this.xs[b]! - this.xs[i]!, this.zs[b]! - this.zs[i]!);
      raw[i] = wrapAngle(h1 - h0) / Math.max(0.5, (d0 + d1) / 2);
    }
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) sum += raw[(i + k + n) % n]!;
      this.curvature[i] = sum / 5;
    }
  }

  /** 中心線と理想ラインを混ぜた基本ラインを作る */
  static blend(track: Track, ideal: Float32Array, blend: number, constantOffset: number): RacingLine {
    const n = track.samples.length;
    const off = new Float32Array(n);
    const margin = npcConfig.racingLine.edgeMargin;
    for (let i = 0; i < n; i++) {
      const lim = Math.max(0, track.samples[i]!.halfWidth - margin);
      let o = ideal[i]! * blend + constantOffset;
      o = o < -lim ? -lim : o > lim ? lim : o;
      off[i] = o;
    }
    return new RacingLine(track, off);
  }

  /** 距離 s でのライン横オフセット (線形補間) */
  offsetAt(s: number): number {
    const track = this.track;
    const ws = track.wrapS(s);
    const i = track.sampleIndexAt(ws);
    const n = this.offsets.length;
    const f = (ws - track.samples[i]!.s) / track.spacing;
    const a = this.offsets[i]!;
    const b = this.offsets[(i + 1) % n]!;
    return a + (b - a) * f;
  }

  curvatureAt(s: number): number {
    return this.curvature[this.track.sampleIndexAt(s)]!;
  }
}

export interface SpeedPlanParams {
  cornerSpeedFactor: number;
  brakingFactor: number;
  brakeMargin: number;
  straightSpeedFactor: number;
}

/**
 * 車とパターンに応じた目標速度 [m/s] の列。
 * @param gripAlong ライン上の各サンプルの路面グリップ倍率 (氷・雪・水中など。省略時はすべて 1)
 * @param surfaceAwareness 路面の理解度 0..1 (低いと滑る路面でも速度を落とし切れない)
 */
export function computeSpeedProfile(
  line: RacingLine,
  spec: CarSpec,
  params: SpeedPlanParams,
  gripAlong?: Float32Array,
  surfaceAwareness = 1,
): Float32Array {
  const track = line.track;
  const n = line.curvature.length;
  const ds = track.spacing;
  const out = new Float32Array(n);
  const vmax = kmhToMs(spec.maxSpeedKmh) * params.straightSpeedFactor;
  const latAccel = physicsConfig.grip.lateralGripAccel * spec.grip * npcConfig.speedPlan.lateralGripUsage;
  const steer = physicsConfig.steering;

  const gripEff = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = gripAlong ? gripAlong[i]! : 1;
    // 路面を理解していないほど、滑る路面でも普段どおりのグリップを想定してしまう
    gripEff[i] = g >= 1 ? g : 1 - (1 - g) * surfaceAwareness;
  }

  for (let i = 0; i < n; i++) {
    const k = Math.max(1e-4, Math.abs(line.curvature[i]!));
    // グリップ限界
    let v = Math.sqrt((latAccel * gripEff[i]!) / k);
    // ステア性能の限界: v*k <= maxYaw(v)
    let lo = 0;
    let hi = Math.min(v, vmax);
    for (let it = 0; it < 18; it++) {
      const mid = (lo + hi) / 2;
      const r = mid / steer.highSpeedHalfAuthority;
      const yawCap = steer.maxYawRate * spec.handling * Math.min(1, mid / steer.fullAuthoritySpeed) / (1 + r * r);
      if (mid * k <= yawCap * 0.92) lo = mid;
      else hi = mid;
    }
    v = Math.min(v, lo > 0 ? lo : v);
    v = Math.min(vmax, v * params.cornerSpeedFactor);
    out[i] = Math.max(npcConfig.speedPlan.minTargetSpeed, v);
  }

  // 後ろ向きパス: ブレーキで減速できる速度に制限 (周回を考慮して2周)
  const decel = spec.brake * params.brakingFactor;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const next = out[(i + 1) % n]!;
      const limit = Math.sqrt(next * next + 2 * decel * Math.min(1, gripEff[i]!) * ds);
      if (out[i]! > limit) out[i] = limit;
    }
  }

  // ブレーキ開始マージン: 前方 brakeMargin [m] 以内の最小値を採用
  const marginSamples = Math.max(0, Math.round(params.brakeMargin / ds));
  if (marginSamples > 0) {
    const src = out.slice();
    for (let i = 0; i < n; i++) {
      let m = src[i]!;
      for (let k = 1; k <= marginSamples; k++) {
        const v = src[(i + k) % n]!;
        if (v < m) m = v;
      }
      out[i] = m;
    }
  }
  return out;
}
