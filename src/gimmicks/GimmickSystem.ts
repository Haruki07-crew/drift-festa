/**
 * コースギミックの実行時処理 (描画非依存・テスト対象)。
 *
 * CourseDef.gimmicks の定義を読み込み、種類ごとに再利用できる仕組みで処理する:
 *   SurfaceModifier (路面) / BoostPad / JumpPad / TransformZone / WindZone / ConveyorZone /
 *   MovingObstacle / Seesaw
 * コース専用の if 文は書かない。新しいコースは定義を並べるだけでギミックが動く。
 *
 * NPC 向けの問い合わせ (前方の障害物の予測・ブーストパッドの位置・路面グリップ) も提供する。
 */
import {
  gimmickConfig,
  type GimmickDef,
  type SurfaceKind,
  type TransformMode,
} from '../config/gimmicks';
import type { Track } from '../courses/Track';
import type { VehicleBody } from '../physics/VehicleBody';
import { Obstacle, type LateralInterval, type ObstacleState } from './Obstacle';

/** 周回上の範囲 (s: 開始距離、len: 長さ) */
export interface SRange {
  s: number;
  len: number;
}

export interface SurfaceZone extends SRange {
  kind: SurfaceKind;
  latMin: number;
  latMax: number;
}

export interface BoostPad {
  index: number;
  s: number;
  lateral: number;
  halfWidth: number;
  halfLength: number;
}

export interface JumpPad extends SRange {
  launch: number;
  latMin: number;
  latMax: number;
}

export interface TransformZone extends SRange {
  mode: TransformMode;
}

export interface WindZone extends SRange {
  force: number;
  period: number;
  activeFraction: number;
  phase: number;
}

export interface ConveyorZone extends SRange {
  speed: number;
  latMin: number;
  latMax: number;
}

export interface SeesawZone extends SRange {
  tilt: number;
  period: number;
  phase: number;
}

export interface TunnelZone extends SRange {
  style: Extract<GimmickDef, { type: 'tunnel' }>['style'];
  height: number;
}

export type WindPhase = 'calm' | 'warn' | 'blow';

export interface GimmickEvents {
  onBoostPad?: (body: VehicleBody, pad: BoostPad) => void;
  onJump?: (body: VehicleBody) => void;
  onObstacleHit?: (body: VehicleBody, speed: number) => void;
}

/** NPC の障害物回避の判断結果 */
export interface ObstacleAdvice {
  /** 目標とする横位置 (null = 回避不要) */
  lateral: number | null;
  /** 速度上限 [m/s] (Infinity = 制限なし) */
  speedCap: number;
  /** 対象の障害物 (デバッグ用) */
  obstacle: Obstacle | null;
}

const WIDE = 1e6;

export class GimmickSystem {
  readonly track: Track;
  readonly surfaces: SurfaceZone[] = [];
  readonly pads: BoostPad[] = [];
  readonly jumps: JumpPad[] = [];
  readonly transforms: TransformZone[] = [];
  readonly winds: WindZone[] = [];
  readonly conveyors: ConveyorZone[] = [];
  readonly seesaws: SeesawZone[] = [];
  readonly tunnels: TunnelZone[] = [];
  readonly obstacles: Obstacle[] = [];
  events: GimmickEvents = {};
  /** ギミックの時計 [s] (レース開始前から進む。全車共通なので周期は予測可能) */
  time = 0;
  private readonly tmpState: ObstacleState = { lateral: 0, angle: 0, active: true, warn: false, closed: 1 };

  constructor(track: Track) {
    this.track = track;
    const range = (from: number, to: number): SRange => {
      const s = track.fracToS(from);
      let len = track.fracToS(to) - s;
      if (len <= 0) len += track.length;
      return { s, len };
    };
    for (const g of track.gimmicks) {
      switch (g.type) {
        case 'surface':
          this.surfaces.push({ ...range(g.from, g.to), kind: g.surface, latMin: g.lateralMin ?? -WIDE, latMax: g.lateralMax ?? WIDE });
          break;
        case 'boostPad':
          this.pads.push({
            index: this.pads.length,
            s: track.fracToS(g.at),
            lateral: g.lateral,
            halfWidth: (g.width ?? gimmickConfig.boostPad.width) / 2,
            halfLength: (g.length ?? gimmickConfig.boostPad.length) / 2,
          });
          break;
        case 'jump': {
          const len = g.length ?? gimmickConfig.jump.length;
          this.jumps.push({ s: track.fracToS(g.at), len, launch: g.launch, latMin: g.lateralMin ?? -WIDE, latMax: g.lateralMax ?? WIDE });
          break;
        }
        case 'transform':
          this.transforms.push({ ...range(g.from, g.to), mode: g.mode });
          break;
        case 'wind':
          this.winds.push({ ...range(g.from, g.to), force: g.force, period: g.period, activeFraction: g.activeFraction, phase: g.phase ?? 0 });
          break;
        case 'conveyor':
          this.conveyors.push({ ...range(g.from, g.to), speed: g.speed, latMin: g.lateralMin ?? -WIDE, latMax: g.lateralMax ?? WIDE });
          break;
        case 'obstacle':
          this.obstacles.push(new Obstacle(g, this.obstacles.length, track));
          break;
        case 'seesaw':
          this.seesaws.push({ ...range(g.from, g.to), tilt: g.tilt, period: g.period, phase: g.phase ?? 0 });
          break;
        case 'tunnel':
          this.tunnels.push({ ...range(g.from, g.to), style: g.style, height: g.height ?? 7 });
          break;
        case 'gap':
          // 道路の有無は Track が管理
          break;
      }
    }
  }

  /** s が範囲内か (周回をまたぐ範囲に対応) */
  inRange(r: SRange, s: number): boolean {
    return this.track.wrapS(s - r.s) < r.len;
  }

  // ------------------------------------------------------------------ 状態の問い合わせ

  surfaceAt(s: number, lateral: number): SurfaceKind {
    // 後に定義したものを優先 (部分的な上書きがしやすい)
    for (let i = this.surfaces.length - 1; i >= 0; i--) {
      const z = this.surfaces[i]!;
      if (lateral >= z.latMin && lateral <= z.latMax && this.inRange(z, s)) return z.kind;
    }
    return 'road';
  }

  transformAt(s: number): TransformMode | null {
    for (const z of this.transforms) if (this.inRange(z, s)) return z.mode;
    return null;
  }

  windPhase(w: WindZone, t = this.time): WindPhase {
    const u = (((t / w.period + w.phase) % 1) + 1) % 1;
    if (u < w.activeFraction) return 'blow';
    if (u > 1 - gimmickConfig.wind.warnSeconds / w.period) return 'warn';
    return 'calm';
  }

  /** シーソーの傾き -1..1 */
  seesawTilt(z: SeesawZone, t = this.time): number {
    return Math.tanh(gimmickConfig.seesaw.sharpness * Math.sin(2 * Math.PI * (t / z.period + z.phase)));
  }

  /** 動く路面による高さの追加 [m] (シーソー)。両端は 0 で道路とつながる */
  heightOffsetAt(s: number, t = this.time): number {
    for (const z of this.seesaws) {
      const d = this.track.wrapS(s - z.s);
      if (d < z.len) {
        const u = d / z.len;
        return z.tilt * this.seesawTilt(z, t) * Math.sin(2 * Math.PI * u);
      }
    }
    return 0;
  }

  /** 車の横位置での路面グリップ倍率 (路面 × 変形)。NPC の速度計画用 */
  gripAt(s: number, lateral: number): number {
    const surf = gimmickConfig.surfaces[this.surfaceAt(s, lateral)].grip;
    const tr = this.transformAt(s);
    return surf * (tr ? gimmickConfig.transform[tr].gripMul * gimmickConfig.transform[tr].yawMul : 1);
  }

  // ------------------------------------------------------------------ 更新

  update(dt: number): void {
    this.time += dt;
    for (const o of this.obstacles) o.update(this.time, dt);
  }

  /**
   * 1台の車にギミックを適用する (車両物理とコース衝突の後に呼ぶ)。
   * 路面・変形は次のステップの物理で使われる。
   */
  applyToBody(body: VehicleBody, dt: number): void {
    const s = body.trackS;
    const lat = body.trackLateral;
    body.transformMode = this.transformAt(s);
    if (body.airborne) {
      if (body.airMode === 'jump') this.airAssist(body, dt);
      return;
    }
    body.surfaceKind = this.surfaceAt(s, lat);

    // ブーストパッド
    for (const pad of this.pads) {
      if (Math.abs(lat - pad.lateral) > pad.halfWidth) continue;
      const ds = this.track.deltaS(pad.s, s);
      if (ds < -pad.halfLength || ds > pad.halfLength) continue;
      const fresh = body.padBoostTimer < gimmickConfig.boostPad.duration * 0.5;
      body.padBoostTimer = gimmickConfig.boostPad.duration;
      if (fresh) {
        // 前方向へ加速 (最高速度を超えない範囲で)
        const kick = Math.max(0, Math.min(gimmickConfig.boostPad.kick, body.maxSpeed - body.forwardSpeed));
        body.vx += body.forwardX * kick;
        body.vz += body.forwardZ * kick;
        this.events.onBoostPad?.(body, pad);
      }
    }

    // ジャンプ台
    for (const j of this.jumps) {
      if (lat < j.latMin || lat > j.latMax) continue;
      const ds = this.track.deltaS(j.s, s);
      if (ds < 0 || ds > j.len) continue;
      if (body.forwardSpeed < gimmickConfig.jump.minSpeed) continue;
      body.airborne = true;
      body.airMode = 'jump';
      body.airTime = 0;
      body.vy = j.launch;
      body.y += 0.05;
      this.events.onJump?.(body);
      return;
    }

    // 横風
    const tx = this.track.sample(this.track.sampleIndexAt(s)).tx;
    const tz = this.track.sample(this.track.sampleIndexAt(s)).tz;
    for (const w of this.winds) {
      if (!this.inRange(w, s) || this.windPhase(w) !== 'blow') continue;
      // 右方向 = (-tz, tx)
      body.vx += -tz * w.force * dt;
      body.vz += tx * w.force * dt;
    }

    // コンベア: 路面ごと運ぶ
    for (const c of this.conveyors) {
      if (lat < c.latMin || lat > c.latMax || !this.inRange(c, s)) continue;
      body.x += tx * c.speed * dt;
      body.z += tz * c.speed * dt;
    }
  }

  /** ジャンプ中の空中補正: 進行方向を道路の向き (と中央) へ少しずつ寄せる */
  private airAssist(body: VehicleBody, dt: number): void {
    const cfg = gimmickConfig.jump;
    const smp = this.track.sample(this.track.sampleIndexAt(body.trackS));
    const speed = Math.hypot(body.vx, body.vz);
    if (speed < 1) return;
    const velAngle = Math.atan2(body.vx, body.vz);
    let target = Math.atan2(smp.tx, smp.tz);
    // 道路の端に近いほど中央へ向ける (右にずれている → 左へ = 角度を増やす)
    const edge = Math.max(0, Math.abs(body.trackLateral) - smp.halfWidth * 0.4) / Math.max(1, smp.halfWidth);
    target += Math.sign(body.trackLateral) * Math.min(0.5, edge * cfg.airCenterRate);
    let diff = target - velAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const step = Math.max(-cfg.airAlignRate * dt, Math.min(cfg.airAlignRate * dt, diff));
    const a = velAngle + step;
    body.vx = Math.sin(a) * speed;
    body.vz = Math.cos(a) * speed;
    body.heading += step;
  }

  /** 障害物との衝突 */
  resolveObstacles(bodies: readonly VehicleBody[]): void {
    for (const o of this.obstacles) {
      for (const b of bodies) {
        if (Math.abs(this.track.deltaS(o.s, b.trackS)) > o.halfLength + o.halfWidth + 6) continue;
        const impact = o.collide(b);
        if (impact > 0) this.events.onObstacleHit?.(b, impact);
      }
    }
  }

  /**
   * 復帰位置として安全な s。道路のない区間・障害物の近くを避けて手前へずらす。
   * 道路の切れ目を飛び越えるジャンプの手前では、止まった状態から加速できる助走距離を確保する。
   */
  safeRespawnS(s: number): number {
    let cand = s;
    const runway = gimmickConfig.jump.respawnRunway;
    for (const j of this.jumps) {
      if (!this.jumpHasGap(j)) continue;
      const ds = this.track.deltaS(cand, j.s);
      // ジャンプ台の手前 runway m 以内、またはジャンプ台〜切れ目の中 → 助走できる位置まで戻す
      if ((ds >= 0 && ds < runway) || (ds < 0 && ds > -40)) cand = j.s - runway;
    }
    for (let i = 0; i < 40; i++) {
      const nearObstacle = this.obstacles.some((o) => Math.abs(this.track.deltaS(o.s, cand)) < o.halfLength + 6);
      const nearJump = this.jumps.some((j) => Math.abs(this.track.deltaS(j.s, cand)) < 12);
      if (!this.track.isGap(cand) && !this.track.isGap(cand + 8) && !nearObstacle && !nearJump) return this.track.wrapS(cand);
      cand -= 4;
    }
    return this.track.wrapS(cand);
  }

  // ------------------------------------------------------------------ NPC 向け

  /**
   * 前方の障害物を避けるための判断。
   * @param anticipation 0 = 今の位置だけを見る、1 = 到達時刻の位置を正確に予測
   */
  adviseObstacles(
    s: number,
    speed: number,
    plannedLateral: number,
    roadLimit: number,
    anticipation: number,
    out: ObstacleAdvice,
    preferSide = 0,
  ): ObstacleAdvice {
    out.lateral = null;
    out.speedCap = Infinity;
    out.obstacle = null;
    const look = gimmickConfig.npc.obstacleLookahead;
    const margin = gimmickConfig.obstacle.npcClearance + 1;
    let nearest = Infinity;
    for (const o of this.obstacles) {
      const ds = this.track.deltaS(s, o.s);
      if (ds < -o.halfLength - 2 || ds > look) continue;
      const arrive = Math.max(0, ds) / Math.max(4, speed);
      const tPred = this.time + arrive * anticipation;
      const occ = o.occupancyAt(tPred, margin, this.tmpState);
      if (!occ || plannedLateral < occ.min || plannedLateral > occ.max) continue;
      if (ds >= nearest) continue;
      nearest = ds;
      out.obstacle = o;
      const choice = chooseSide(occ, plannedLateral, roadLimit, preferSide);
      if (choice !== null) {
        out.lateral = choice;
        out.speedCap = Infinity;
      } else {
        // 抜けられない (ゲートが閉じている等) → 開くタイミングに合わせて減速
        out.lateral = null;
        const wait = o.timeUntilClear(tPred);
        out.speedCap = Math.max(5, Math.max(0, ds - o.halfLength - 4) / Math.max(0.3, arrive + wait));
      }
    }
    return out;
  }

  /** 前方で一番近いブーストパッド (なければ null) */
  padAhead(s: number, minDist: number, maxDist: number): { pad: BoostPad; ds: number } | null {
    let best: { pad: BoostPad; ds: number } | null = null;
    for (const pad of this.pads) {
      const ds = this.track.deltaS(s, pad.s);
      if (ds < minDist || ds > maxDist) continue;
      if (!best || ds < best.ds) best = { pad, ds };
    }
    return best;
  }

  /** ジャンプ台のすぐ先 (40m 以内) に道路のない区間があるか */
  jumpHasGap(j: JumpPad): boolean {
    for (let d = 0; d < 40; d += 2) if (this.track.isGap(j.s + d)) return true;
    return false;
  }

  /** 前方のジャンプ台 (道路のない区間の手前) までの距離 (なければ Infinity) */
  jumpAhead(s: number, maxDist: number): number {
    let best = Infinity;
    for (const j of this.jumps) {
      const ds = this.track.deltaS(s, j.s);
      if (ds >= 0 && ds < maxDist && ds < best) best = ds;
    }
    return best;
  }
}

/** 塞がれた範囲の左右どちらへ避けるか。道路内に収まらなければ null */
export function chooseSide(occ: LateralInterval, planned: number, roadLimit: number, preferSide = 0): number | null {
  const left = occ.min;
  const right = occ.max;
  const leftOk = left >= -roadLimit;
  const rightOk = right <= roadLimit;
  if (leftOk && rightOk) {
    // 一度決めた側を優先 (障害物の間で左右にふらつかない)
    if (preferSide < 0) return left;
    if (preferSide > 0) return right;
    return Math.abs(planned - left) <= Math.abs(right - planned) ? left : right;
  }
  if (leftOk) return left;
  if (rightOk) return right;
  return null;
}
