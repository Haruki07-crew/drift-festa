/**
 * 動く障害物 (純粋ロジック・テスト対象)。
 *
 * すべて時刻 t の関数として決定的に動く (乱数なし) ので、プレイヤーは周期を覚えられ、
 * NPC は到達時刻の位置を予測できる。閉まるゲート・横断列車には予告 (warn) がある。
 * 当たり判定は向きのある箱 (OBB) と車の前後2円。
 */
import { gimmickConfig, type GimmickDef, type ObstacleMotion, type ObstacleStyle } from '../config/gimmicks';
import { physicsConfig } from '../config/physics';
import type { Track } from '../courses/Track';
import type { VehicleBody } from '../physics/VehicleBody';

type ObstacleDef = Extract<GimmickDef, { type: 'obstacle' }>;

export interface ObstacleState {
  /** 中心の横位置 [m] */
  lateral: number;
  /** 追加の回転 [rad] (spin) */
  angle: number;
  /** 当たり判定が有効 (ゲートが閉まっている等) */
  active: boolean;
  /** 予告中 (まもなく閉まる・列車が来る) */
  warn: boolean;
  /** ゲートの閉まり具合 0 (開) .. 1 (閉) (見た目用) */
  closed: number;
}

export interface LateralInterval {
  min: number;
  max: number;
}

function frac(x: number): number {
  return x - Math.floor(x);
}

export class Obstacle {
  readonly index: number;
  readonly style: ObstacleStyle;
  readonly motion: ObstacleMotion;
  /** コース上の位置 */
  readonly s: number;
  readonly halfLength: number;
  readonly halfWidth: number;
  readonly height: number;
  /** 路面の半幅 (列車が道路上にいるかの判定用) */
  readonly roadHalfWidth: number;
  private readonly tx: number;
  private readonly tz: number;
  private readonly cx: number;
  private readonly cz: number;
  readonly baseY: number;

  // 現在の状態 (update で更新)
  readonly state: ObstacleState = { lateral: 0, angle: 0, active: true, warn: false, closed: 1 };
  x = 0;
  z = 0;
  heading = 0;
  private prevX = 0;
  private prevZ = 0;
  vx = 0;
  vz = 0;

  constructor(def: ObstacleDef, index: number, track: Track) {
    this.index = index;
    this.style = def.style;
    this.motion = def.motion;
    this.s = track.fracToS(def.at);
    this.halfLength = def.length / 2;
    this.halfWidth = def.width / 2;
    this.height = def.height;
    const p = track.pointAt(this.s);
    this.tx = p.tx;
    this.tz = p.tz;
    this.cx = p.x;
    this.cz = p.z;
    this.baseY = p.y;
    this.roadHalfWidth = p.halfWidth;
    this.update(0, 0);
    this.prevX = this.x;
    this.prevZ = this.z;
  }

  /** 時刻 t の状態 (予測にも使う) */
  stateAt(t: number, out: ObstacleState = { lateral: 0, angle: 0, active: true, warn: false, closed: 1 }): ObstacleState {
    const m = this.motion;
    out.angle = 0;
    out.warn = false;
    out.active = true;
    out.closed = 1;
    switch (m.kind) {
      case 'static':
        out.lateral = m.lateral;
        break;
      case 'slide':
        out.lateral = m.center + m.amplitude * Math.sin(2 * Math.PI * (t / m.period + (m.phase ?? 0)));
        break;
      case 'gate': {
        const u = frac(t / m.period + (m.phase ?? 0));
        const warnU = gimmickConfig.obstacle.gateWarnSeconds / m.period;
        out.lateral = m.lateral;
        out.warn = u >= m.closedFraction && u > 1 - warnU;
        // 開閉アニメーション (0.3 秒): 周期の先頭で閉まり、closedFraction で開く
        const anim = 0.3 / m.period;
        if (u < anim) out.closed = u / anim;
        else if (u < m.closedFraction - anim) out.closed = 1;
        else if (u < m.closedFraction) out.closed = (m.closedFraction - u) / anim;
        else out.closed = 0;
        // 半分以上閉まっている間だけ当たる
        out.active = out.closed > 0.5;
        break;
      }
      case 'spin':
        out.lateral = m.lateral;
        out.angle = 2 * Math.PI * (t / m.period + (m.phase ?? 0));
        break;
      case 'cross': {
        const cycle = t / m.period + (m.phase ?? 0);
        const u = frac(cycle);
        const dir = Math.floor(cycle) % 2 === 0 ? 1 : -1;
        if (u < m.crossFraction) {
          out.lateral = dir * (-m.amplitude + (2 * m.amplitude * u) / m.crossFraction);
        } else {
          out.lateral = dir * m.amplitude;
        }
        const warnU = gimmickConfig.obstacle.crossWarnSeconds / m.period;
        out.warn = u > 1 - warnU;
        out.active = Math.abs(out.lateral) < this.roadHalfWidth + this.halfWidth + 1;
        break;
      }
    }
    return out;
  }

  update(t: number, dt: number): void {
    this.stateAt(t, this.state);
    // 右方向 = (-tz, tx)
    this.x = this.cx - this.tz * this.state.lateral;
    this.z = this.cz + this.tx * this.state.lateral;
    this.heading = Math.atan2(this.tx, this.tz) + this.state.angle;
    if (dt > 0) {
      this.vx = (this.x - this.prevX) / dt;
      this.vz = (this.z - this.prevZ) / dt;
    }
    this.prevX = this.x;
    this.prevZ = this.z;
  }

  /**
   * 時刻 t に道路上で塞いでいる横方向の範囲 (塞いでいなければ null)。
   * 回転物は回転半径の円として保守的に扱う。
   */
  occupancyAt(t: number, margin: number, tmp?: ObstacleState): LateralInterval | null {
    const st = this.stateAt(t, tmp);
    if (!st.active) return null;
    const half = this.motion.kind === 'spin' ? Math.hypot(this.halfLength, this.halfWidth) : this.halfWidth;
    return { min: st.lateral - half - margin, max: st.lateral + half + margin };
  }

  /** ゲートが次に開くまでの時間 (ゲート以外・開いている時は 0) */
  timeUntilClear(t: number): number {
    const m = this.motion;
    if (m.kind === 'gate') {
      const u = frac(t / m.period + (m.phase ?? 0));
      return u < m.closedFraction ? (m.closedFraction - u) * m.period : 0;
    }
    if (m.kind === 'cross') {
      const u = frac(t / m.period + (m.phase ?? 0));
      return u < m.crossFraction ? (m.crossFraction - u) * m.period : 0;
    }
    return 0;
  }

  /**
   * 車との衝突を解決する。衝突した場合は衝撃速度 [m/s] を返す。
   * 障害物は動かない (無限質量)。速度は落ちるが恒久的なダメージはない。
   */
  collide(body: VehicleBody): number {
    if (!this.state.active || body.airborne) return 0;
    if (body.y > this.baseY + this.height + 0.5 || body.y < this.baseY - 3) return 0;
    const col = physicsConfig.collision;
    const r = col.carRadius;
    const ax = Math.sin(this.heading);
    const az = Math.cos(this.heading);
    // 障害物の右方向
    const nxAxis = -az;
    const nzAxis = ax;
    let impact = 0;
    for (const side of [-1, 1]) {
      const px = body.x + body.forwardX * col.circleOffset * side;
      const pz = body.z + body.forwardZ * col.circleOffset * side;
      const dx = px - this.x;
      const dz = pz - this.z;
      const localL = dx * ax + dz * az;
      const localW = dx * nxAxis + dz * nzAxis;
      const cl = Math.max(-this.halfLength, Math.min(this.halfLength, localL));
      const cw = Math.max(-this.halfWidth, Math.min(this.halfWidth, localW));
      let ddl = localL - cl;
      let ddw = localW - cw;
      let dist = Math.hypot(ddl, ddw);
      let pen: number;
      if (dist < 1e-6) {
        // 円の中心が箱の中: 最も近い面へ押し出す
        const outL = this.halfLength - Math.abs(localL);
        const outW = this.halfWidth - Math.abs(localW);
        if (outL < outW) {
          ddl = Math.sign(localL) || 1;
          ddw = 0;
          pen = outL + r;
        } else {
          ddl = 0;
          ddw = Math.sign(localW) || 1;
          pen = outW + r;
        }
        dist = 1;
      } else {
        pen = r - dist;
      }
      if (pen <= 0) continue;
      const nl = ddl / dist;
      const nw = ddw / dist;
      const nx = nl * ax + nw * nxAxis;
      const nz = nl * az + nw * nzAxis;
      body.x += nx * pen;
      body.z += nz * pen;
      const relVn = (body.vx - this.vx) * nx + (body.vz - this.vz) * nz;
      if (relVn < 0) {
        const o = gimmickConfig.obstacle;
        body.vx -= (1 + o.restitution) * relVn * nx;
        body.vz -= (1 + o.restitution) * relVn * nz;
        const loss = 1 - o.speedLoss * Math.min(1, -relVn / 15);
        body.vx *= loss;
        body.vz *= loss;
        body.yawRate *= 0.5;
        impact = Math.max(impact, -relVn);
      }
    }
    if (impact > 0) body.impactSpeed = Math.max(body.impactSpeed, impact);
    return impact;
  }
}
