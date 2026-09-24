/**
 * コースの幾何データ。
 *
 * 制御点 (CourseDef.controlPoints) を閉じた Centripetal Catmull-Rom スプラインで補間し、
 * 等間隔サンプル列 (中心線) を作る。物理・NPC・チェックポイント・順位計算・描画は
 * すべてこの中心線を基準にする。Three.js には依存しない (テスト可能)。
 */
import type { CourseDef, EdgeType } from '../config/courses';
import { gimmickConfig, type GimmickDef } from '../config/gimmicks';
import { physicsConfig } from '../config/physics';
import { wrapAngle } from '../core/math';

export interface TrackSample {
  x: number;
  y: number;
  z: number;
  /** 水平面での進行方向の単位ベクトル */
  tx: number;
  tz: number;
  /** 進行方向右向きの単位ベクトル (= (-tz, tx)) */
  rx: number;
  rz: number;
  /** スタートラインからの距離 [m] */
  s: number;
  halfWidth: number;
  left: EdgeType;
  right: EdgeType;
  /** 符号付き曲率 [1/m] (正 = 左カーブ) */
  curvature: number;
  /** 勾配 dy/ds */
  slope: number;
  /** バンク角 [rad] (正 = 右側が高い)。路面の高さ = y + lateral * tan(bank) */
  bank: number;
  /** 道路のない区間 (ジャンプで飛び越える) */
  gap: boolean;
}

export interface TrackProjection {
  /** 最も近い区間の開始サンプル番号 */
  index: number;
  /** 区間内の位置 0..1 */
  t: number;
  /** スタートラインからの距離 [m] */
  s: number;
  /** 中心線からの横方向距離 [m] (右が正) */
  lateral: number;
  /** 中心線上の最近点 */
  cx: number;
  cy: number;
  cz: number;
  tx: number;
  tz: number;
  halfWidth: number;
  left: EdgeType;
  right: EdgeType;
  /** バンク角 [rad] */
  bank: number;
  /** 道路のない区間か */
  gap: boolean;
  /** 車の横位置での路面の高さ (バンク込み) */
  groundY: number;
}

export function createProjection(): TrackProjection {
  return {
    index: 0,
    t: 0,
    s: 0,
    lateral: 0,
    cx: 0,
    cy: 0,
    cz: 0,
    tx: 0,
    tz: 1,
    halfWidth: 5,
    left: 'wall',
    right: 'wall',
    bank: 0,
    gap: false,
    groundY: 0,
  };
}

export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  halfWidth: number;
  /** バンク角 [rad] */
  bank: number;
}

export function createTrackPoint(): TrackPoint {
  return { x: 0, y: 0, z: 0, tx: 0, tz: 1, halfWidth: 5, bank: 0 };
}

/** 周回上の割合 f (0..1) が from..to の範囲に入るか (1 をまたぐ範囲に対応) */
export function inLapRange(f: number, from: number, to: number): boolean {
  return from <= to ? f >= from && f < to : f >= from || f < to;
}

interface DensePoint {
  x: number;
  y: number;
  z: number;
  seg: number;
  u: number;
}

const DENSE_STEPS_PER_SEGMENT = 48;
const gimmickDefaults = { jumpLength: gimmickConfig.jump.length };
const LOCAL_SEARCH_WINDOW = 14;

/** 路肩の種類ごとの横方向の限界 */
export interface EdgeLimits {
  /** 舗装路の端 (中心から) [m] */
  road: number;
  /** 壁の位置 (Infinity = 壁なし) [m] */
  wall: number;
  /** この距離を越えたら落下 (Infinity = 落下なし) [m] */
  fall: number;
}

export class Track {
  readonly def: CourseDef;
  readonly samples: TrackSample[];
  readonly length: number;
  readonly spacing: number;
  /** チェックポイントの s 位置 (0番 = スタートライン) */
  readonly checkpoints: number[];
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };

  private constructor(def: CourseDef, samples: TrackSample[], length: number, spacing: number) {
    this.def = def;
    this.samples = samples;
    this.length = length;
    this.spacing = spacing;
    this.checkpoints = [];
    for (let k = 0; k < def.checkpointCount; k++) {
      this.checkpoints.push((k * length) / def.checkpointCount);
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of samples) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    this.bounds = { minX, maxX, minZ, maxZ, minY, maxY };
  }

  static build(def: CourseDef): Track {
    const cps = def.controlPoints;
    const n = cps.length;
    if (n < 4) {
      throw new Error(`Course ${def.id}: at least 4 control points are required`);
    }

    // 路肩の種類は省略時に直前の制御点を引き継ぐ
    const lefts: EdgeType[] = [];
    const rights: EdgeType[] = [];
    let curLeft: EdgeType = cps[0]?.left ?? 'wall';
    let curRight: EdgeType = cps[0]?.right ?? 'wall';
    for (const cp of cps) {
      curLeft = cp.left ?? curLeft;
      curRight = cp.right ?? curRight;
      lefts.push(curLeft);
      rights.push(curRight);
    }

    const pts = cps.map((cp) => ({ x: cp.x, y: cp.y ?? 0, z: cp.z }));
    const widths = cps.map((cp) => cp.width ?? def.defaultWidth);
    const banks = cps.map((cp) => ((cp.bank ?? 0) * Math.PI) / 180);

    // 1) 密なポリラインを作る
    const dense: DensePoint[] = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n]!;
      const p1 = pts[i]!;
      const p2 = pts[(i + 1) % n]!;
      const p3 = pts[(i + 2) % n]!;
      for (let k = 0; k < DENSE_STEPS_PER_SEGMENT; k++) {
        const u = k / DENSE_STEPS_PER_SEGMENT;
        const p = centripetalCatmullRom(p0, p1, p2, p3, u);
        dense.push({ x: p.x, y: p.y, z: p.z, seg: i, u });
      }
    }

    // 2) 水平距離で累積長を計算
    const cum: number[] = [0];
    for (let i = 1; i <= dense.length; i++) {
      const a = dense[i - 1]!;
      const b = dense[i % dense.length]!;
      cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
    }
    const totalLength = cum[dense.length]!;

    // 3) 等間隔に再サンプリング
    const count = Math.max(16, Math.round(totalLength / def.sampleSpacing));
    const spacing = totalLength / count;
    const samples: TrackSample[] = [];
    let j = 0;
    for (let i = 0; i < count; i++) {
      const s = i * spacing;
      while (j < dense.length - 1 && cum[j + 1]! < s) j++;
      const a = dense[j]!;
      const b = dense[(j + 1) % dense.length]!;
      const segLen = cum[j + 1]! - cum[j]!;
      const f = segLen > 1e-9 ? (s - cum[j]!) / segLen : 0;
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      const z = a.z + (b.z - a.z) * f;
      const seg = a.seg;
      const u = a.u + (b.seg === a.seg ? (b.u - a.u) * f : ((1 - a.u) * f));
      const w0 = widths[seg]!;
      const w1 = widths[(seg + 1) % n]!;
      const width = w0 + (w1 - w0) * smooth(u);
      const bank = banks[seg]! + (banks[(seg + 1) % n]! - banks[seg]!) * smooth(u);
      samples.push({
        x,
        y,
        z,
        tx: 0,
        tz: 1,
        rx: -1,
        rz: 0,
        s,
        halfWidth: width / 2,
        left: lefts[seg]!,
        right: rights[seg]!,
        curvature: 0,
        slope: 0,
        bank,
        gap: false,
      });
    }

    // 4) 接線・右方向・勾配
    for (let i = 0; i < count; i++) {
      const prev = samples[(i - 1 + count) % count]!;
      const next = samples[(i + 1) % count]!;
      const cur = samples[i]!;
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      cur.tx = dx;
      cur.tz = dz;
      cur.rx = -dz;
      cur.rz = dx;
      cur.slope = (next.y - prev.y) / (2 * spacing);
    }

    // 5) 曲率 (進行方向角の変化率)。少し平滑化する
    const raw: number[] = [];
    for (let i = 0; i < count; i++) {
      const prev = samples[(i - 1 + count) % count]!;
      const next = samples[(i + 1) % count]!;
      const a0 = Math.atan2(prev.tx, prev.tz);
      const a1 = Math.atan2(next.tx, next.tz);
      raw.push(wrapAngle(a1 - a0) / (2 * spacing));
    }
    const smoothRadius = 2;
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = -smoothRadius; k <= smoothRadius; k++) {
        sum += raw[(i + k + count) % count]!;
      }
      samples[i]!.curvature = sum / (smoothRadius * 2 + 1);
    }

    // 6) バンク: 大きさは制御点から、向きは周辺の曲率 (カーブの内側へ傾ける)
    const bankSign: number[] = [];
    let lastSign = 1;
    for (let i = 0; i < count; i++) {
      let k = 0;
      for (let d = -15; d <= 15; d++) k += samples[(i + d + count) % count]!.curvature;
      if (Math.abs(k) > 1e-4) lastSign = k > 0 ? 1 : -1;
      bankSign.push(lastSign);
    }
    for (let i = 0; i < count; i++) {
      // 左カーブ (曲率 > 0) では外側 = 右側を高くする → 正のバンク
      samples[i]!.bank = Math.abs(samples[i]!.bank) * bankSign[i]!;
    }

    // 7) 道路のない区間 (gap)。ジャンプ台の gap 指定は台の直後から自動で作る
    for (const g of def.gimmicks ?? []) {
      if (g.type === 'gap') {
        for (const smp of samples) {
          if (inLapRange(smp.s / totalLength, g.from, g.to)) smp.gap = true;
        }
      } else if (g.type === 'jump' && g.gap !== undefined && g.gap > 0) {
        const start = g.at * totalLength + (g.length ?? gimmickDefaults.jumpLength) + 1;
        for (const smp of samples) {
          const d = (((smp.s - start) % totalLength) + totalLength) % totalLength;
          if (d < g.gap) smp.gap = true;
        }
      }
    }

    return new Track(def, samples, totalLength, spacing);
  }

  /** このコースのギミック定義 */
  get gimmicks(): readonly GimmickDef[] {
    return this.def.gimmicks ?? [];
  }

  /** 周回上の割合 (0..1) → 距離 s */
  fracToS(f: number): number {
    return this.wrapS(f * this.length);
  }

  /** 距離 s → 周回上の割合 */
  sToFrac(s: number): number {
    return this.wrapS(s) / this.length;
  }

  /** s を 0..length に正規化 */
  wrapS(s: number): number {
    const L = this.length;
    return ((s % L) + L) % L;
  }

  /** a から b への最短の符号付き距離 (周回を考慮) */
  deltaS(from: number, to: number): number {
    const L = this.length;
    let d = (to - from) % L;
    if (d > L / 2) d -= L;
    else if (d < -L / 2) d += L;
    return d;
  }

  sampleIndexAt(s: number): number {
    const idx = Math.floor(this.wrapS(s) / this.spacing);
    return Math.min(idx, this.samples.length - 1);
  }

  sample(index: number): TrackSample {
    const n = this.samples.length;
    return this.samples[((index % n) + n) % n]!;
  }

  /** 距離 s の中心線上の点 (線形補間) */
  pointAt(s: number, out: TrackPoint = createTrackPoint()): TrackPoint {
    const ws = this.wrapS(s);
    const i = this.sampleIndexAt(ws);
    const a = this.sample(i);
    const b = this.sample(i + 1);
    const f = (ws - a.s) / this.spacing;
    out.x = a.x + (b.x - a.x) * f;
    out.y = a.y + (b.y - a.y) * f;
    out.z = a.z + (b.z - a.z) * f;
    const tx = a.tx + (b.tx - a.tx) * f;
    const tz = a.tz + (b.tz - a.tz) * f;
    const len = Math.hypot(tx, tz) || 1;
    out.tx = tx / len;
    out.tz = tz / len;
    out.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * f;
    out.bank = a.bank + (b.bank - a.bank) * f;
    return out;
  }

  /** 距離 s、横オフセット lateral (右が正) のワールド座標 (y はバンク込みの路面高さ) */
  worldAt(s: number, lateral: number, out: TrackPoint = createTrackPoint()): TrackPoint {
    this.pointAt(s, out);
    // 右方向 = (-tz, tx)
    out.x += -out.tz * lateral;
    out.z += out.tx * lateral;
    out.y += lateral * Math.tan(out.bank);
    return out;
  }

  /** s が道路のない区間か */
  isGap(s: number): boolean {
    return this.sample(this.sampleIndexAt(s)).gap;
  }

  /** 距離 s の曲率 */
  curvatureAt(s: number): number {
    return this.sample(this.sampleIndexAt(s)).curvature;
  }

  /**
   * 位置 (x, z) をコース中心線へ射影する。
   * hint (前回のサンプル番号) があれば近傍のみ探索するので高速。
   */
  project(x: number, z: number, hint: number | undefined, out: TrackProjection = createProjection()): TrackProjection {
    const n = this.samples.length;
    let bestIndex = 0;
    let bestT = 0;
    let bestD2 = Infinity;

    const test = (i: number): void => {
      const a = this.samples[i]!;
      const b = this.samples[(i + 1) % n]!;
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1e-9;
      let t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + abx * t - x;
      const pz = a.z + abz * t - z;
      const d2 = px * px + pz * pz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIndex = i;
        bestT = t;
      }
    };

    let needGlobal = hint === undefined;
    if (hint !== undefined) {
      for (let k = -LOCAL_SEARCH_WINDOW; k <= LOCAL_SEARCH_WINDOW; k++) {
        test((((hint + k) % n) + n) % n);
      }
      // 探索窓の端が最良 = 窓の外にもっと近い点がある可能性 → 全体探索
      const offset = ((bestIndex - hint + n + n / 2) % n) - n / 2;
      if (Math.abs(offset) >= LOCAL_SEARCH_WINDOW - 1) {
        needGlobal = true;
      }
    }
    if (needGlobal) {
      bestD2 = Infinity;
      for (let i = 0; i < n; i++) test(i);
    }

    const a = this.samples[bestIndex]!;
    const b = this.samples[(bestIndex + 1) % n]!;
    const t = bestT;
    out.index = bestIndex;
    out.t = t;
    out.cx = a.x + (b.x - a.x) * t;
    out.cy = a.y + (b.y - a.y) * t;
    out.cz = a.z + (b.z - a.z) * t;
    const tx = a.tx + (b.tx - a.tx) * t;
    const tz = a.tz + (b.tz - a.tz) * t;
    const len = Math.hypot(tx, tz) || 1;
    out.tx = tx / len;
    out.tz = tz / len;
    out.s = this.wrapS(a.s + this.spacing * t);
    // 右方向 = (-tz, tx)
    out.lateral = (x - out.cx) * -out.tz + (z - out.cz) * out.tx;
    out.halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
    out.left = a.left;
    out.right = a.right;
    out.bank = a.bank + (b.bank - a.bank) * t;
    out.gap = a.gap && b.gap;
    out.groundY = out.cy + out.lateral * Math.tan(out.bank);
    return out;
  }

  /** 横方向の限界 (right = true なら右側) */
  edgeLimits(halfWidth: number, edge: EdgeType, out: EdgeLimits = { road: 0, wall: 0, fall: 0 }): EdgeLimits {
    out.road = halfWidth;
    switch (edge) {
      case 'wall':
      case 'guardrail':
        out.wall = halfWidth + 0.6;
        out.fall = Infinity;
        break;
      case 'grass':
        out.wall = halfWidth + this.def.runoffWidth;
        out.fall = Infinity;
        break;
      case 'fall':
        out.wall = Infinity;
        out.fall = halfWidth + physicsConfig.respawn.fallEdgeMargin;
        break;
    }
    return out;
  }
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

interface V3 {
  x: number;
  y: number;
  z: number;
}

/** Centripetal Catmull-Rom (alpha = 0.5)。ループやカスプが出にくい */
function centripetalCatmullRom(p0: V3, p1: V3, p2: V3, p3: V3, u: number): V3 {
  const alpha = 0.5;
  const t0 = 0;
  const t1 = t0 + Math.pow(dist(p0, p1), alpha) + 1e-6;
  const t2 = t1 + Math.pow(dist(p1, p2), alpha) + 1e-6;
  const t3 = t2 + Math.pow(dist(p2, p3), alpha) + 1e-6;
  const t = t1 + (t2 - t1) * u;
  const a1 = mix(p0, p1, (t - t0) / (t1 - t0));
  const a2 = mix(p1, p2, (t - t1) / (t2 - t1));
  const a3 = mix(p2, p3, (t - t2) / (t3 - t2));
  const b1 = mix(a1, a2, (t - t0) / (t2 - t0));
  const b2 = mix(a2, a3, (t - t1) / (t3 - t1));
  return mix(b1, b2, (t - t1) / (t2 - t1));
}

function dist(a: V3, b: V3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function mix(a: V3, b: V3, t: number): V3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
