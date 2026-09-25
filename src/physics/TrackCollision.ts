/**
 * 車両とコースの相互作用: 路面の高さ追従・壁・ランオフ (コース外)・落下判定。
 */
import { raceTypeConfig } from '../config/game';
import { physicsConfig } from '../config/physics';
import { createProjection, type EdgeLimits, type Track, type TrackProjection } from '../courses/Track';
import type { VehicleBody } from './VehicleBody';

const col = physicsConfig.collision;
const respawnCfg = physicsConfig.respawn;

export interface WallImpact {
  body: VehicleBody;
  speed: number;
}

export class TrackCollision {
  private readonly track: Track;
  private readonly proj: TrackProjection = createProjection();
  private readonly limits: EdgeLimits = { road: 0, wall: 0, fall: 0 };

  constructor(track: Track) {
    this.track = track;
  }

  /** 物理ステップ後に呼ぶ。壁に当たった場合は衝撃速度を返す (0 = 衝突なし) */
  resolve(body: VehicleBody): number {
    const track = this.track;
    const p = track.project(body.x, body.z, body.trackHint, this.proj);
    body.trackHint = p.index;
    body.trackS = p.s;
    body.trackLateral = p.lateral;
    body.landingSpeed = 0;

    body.bank = p.bank;
    const side = p.lateral >= 0 ? p.right : p.left;
    const limits = track.edgeLimits(p.halfWidth, side, this.limits);
    const absLat = Math.abs(p.lateral);
    const groundY = p.groundY + this.heightOffset(body, p.s);

    if (body.airborne) {
      // 路面の上 (道路のある区間・壁の内側) で地面より下に来たら着地
      const overRoad = !p.gap && absLat <= Math.min(limits.wall, limits.fall) && !this.dynamicGap(p.s, p.lateral);
      // 路面より大きく下 (谷へ落ちた後) からは着地しない
      if (overRoad && body.vy <= 0 && body.y <= groundY + 0.05 && body.y >= groundY - 1.2) {
        body.landingSpeed = -body.vy;
        body.airborne = false;
        body.airMode = 'none';
        body.airTime = 0;
        body.y = groundY;
        body.vy = 0;
      } else {
        const maxAir = body.airMode === 'jump' ? respawnCfg.maxJumpAirTime : respawnCfg.maxFallTime;
        if (body.y < groundY - respawnCfg.fallDepth || body.airTime > maxAir) {
          body.needsRespawn = true;
        }
        return 0;
      }
    }

    // --- 落下 (柵のない路肩の外 / 道路のない区間) ---
    if (absLat > limits.fall || p.gap || this.dynamicGap(p.s, p.lateral)) {
      body.airborne = true;
      body.airMode = 'fall';
      body.airTime = 0;
      body.vy = Math.min(0, body.vy);
      body.surface = 'road';
      return 0;
    }

    // --- 路面 ---
    body.y = groundY;
    body.vy = 0;
    const sample = track.sample(p.index);
    body.slope = sample.slope;
    body.surface = absLat > limits.road + 0.4 && side === 'grass' ? 'offroad' : 'road';

    // --- 開いた道 (Point to Point) の両端の壁 ---
    const endImpact = track.closed ? 0 : this.resolveRoadEnds(body, p);

    // --- 壁 ---
    const wallLimit = limits.wall - col.wallHalfWidth;
    if (absLat <= wallLimit) {
      return endImpact;
    }
    const sign = p.lateral >= 0 ? 1 : -1;
    // 外向き法線 = 右方向 × sign。右方向 = (-tz, tx)
    const nx = -p.tz * sign;
    const nz = p.tx * sign;
    const penetration = absLat - wallLimit;
    body.x -= nx * penetration;
    body.z -= nz * penetration;

    const vn = body.vx * nx + body.vz * nz;
    if (vn <= 0) {
      return 0;
    }
    // 法線方向の速度を反射 (反発係数)、接線方向は少し減速
    body.vx -= (1 + col.wallRestitution) * vn * nx;
    body.vz -= (1 + col.wallRestitution) * vn * nz;
    const keep = 1 - col.wallFriction * Math.min(1, vn / 10);
    body.vx *= keep;
    body.vz *= keep;

    // 車体が壁へ向いていれば、壁に沿う方向へ少し向きを戻す (壁に張り付いて止まるのを防ぐ)
    const fx = Math.sin(body.heading);
    const fz = Math.cos(body.heading);
    const intoWall = fx * nx + fz * nz;
    if (intoWall > 0.05) {
      const tangentHeading = Math.atan2(p.tx, p.tz);
      const forwardAlong = fx * p.tx + fz * p.tz;
      const target = forwardAlong >= 0 ? tangentHeading : tangentHeading + Math.PI;
      let diff = target - body.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      body.heading += diff * Math.min(1, 0.25 * intoWall + vn * 0.01);
      body.yawRate *= 0.5;
    }
    body.impactSpeed = Math.max(body.impactSpeed, vn);
    return vn;
  }

  /**
   * 道の始点・終点の壁。端から endWallInset [m] の位置より先へは進めない
   * (退避路で止まり切れなかった車・スタート後ろへ逆走した車)。
   */
  private resolveRoadEnds(body: VehicleBody, p: TrackProjection): number {
    const track = this.track;
    const inset = raceTypeConfig.pointToPoint.endWallInset;
    // 射影点からの進行方向の距離 (区間の外へはみ出した分も含む)
    const along = (body.x - p.cx) * p.tx + (body.z - p.cz) * p.tz;
    const sAhead = p.s + along;
    let over = 0;
    let dir = 0;
    if (sAhead > track.length - inset - col.wallHalfWidth) {
      over = sAhead - (track.length - inset - col.wallHalfWidth);
      dir = 1;
    } else if (sAhead < inset + col.wallHalfWidth) {
      over = inset + col.wallHalfWidth - sAhead;
      dir = -1;
    }
    if (dir === 0) return 0;
    const nx = p.tx * dir;
    const nz = p.tz * dir;
    body.x -= nx * over;
    body.z -= nz * over;
    const vn = body.vx * nx + body.vz * nz;
    if (vn <= 0) return 0;
    body.vx -= (1 + col.wallRestitution) * vn * nx;
    body.vz -= (1 + col.wallRestitution) * vn * nz;
    body.impactSpeed = Math.max(body.impactSpeed, vn);
    return vn;
  }

  /**
   * 路面の高さの追加オフセット (シーソーなど動くギミック用)。GimmickSystem が差し替える。
   */
  heightOffset: (body: VehicleBody, s: number) => number = () => 0;

  /**
   * その瞬間だけ道路がない場所か (上がった跳ね橋・動く足場の外)。GimmickSystem が差し替える。
   */
  dynamicGap: (s: number, lateral: number) => boolean = () => false;

  /** 位置 (x, z) を射影 (外部から参照用) */
  project(x: number, z: number, hint: number | undefined): TrackProjection {
    return this.track.project(x, z, hint, this.proj);
  }
}
