/**
 * 弾丸 (オブジェクトプール)。
 *
 * - 発射速度 = 銃口速度 × 方向 + 車の速度ベクトル (慣性)
 * - 重力落下なし
 * - 最大飛行時間 / 最大射程で破棄
 * - 前フレーム位置→現在位置の線分と車の当たり球で判定 (高速でもすり抜けない)
 */
import * as THREE from 'three';
import { battleConfig } from '../config/battle';
import { createProjection, type Track } from '../courses/Track';
import type { RaceCar } from '../game/RaceCar';

const gun = battleConfig.gun;

export interface Bullet {
  alive: boolean;
  ownerId: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  distance: number;
  trackHint: number | undefined;
  /** デバッグ用: 発射位置 */
  ox: number;
  oy: number;
  oz: number;
}

export interface BulletHit {
  bullet: Bullet;
  target: RaceCar;
}

export class BulletSystem {
  readonly bullets: Bullet[] = [];
  private readonly track: Track;
  private readonly proj = createProjection();

  constructor(track: Track, poolSize = gun.poolSize) {
    this.track = track;
    for (let i = 0; i < poolSize; i++) {
      this.bullets.push({
        alive: false,
        ownerId: -1,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        distance: 0,
        trackHint: undefined,
        ox: 0,
        oy: 0,
        oz: 0,
      });
    }
  }

  /** 発射。プールが一杯なら最も古い弾を再利用 */
  fire(owner: RaceCar, dirX: number, dirY: number, dirZ: number, speedMul: number): Bullet {
    let b = this.bullets.find((x) => !x.alive);
    if (!b) {
      b = this.bullets.reduce((oldest, x) => (x.age > oldest.age ? x : oldest));
    }
    const body = owner.body;
    const len = Math.hypot(dirX, dirY, dirZ) || 1;
    const u = gun.muzzleVelocity * speedMul;
    b.alive = true;
    b.ownerId = owner.id;
    b.x = body.x + body.forwardX * 0.4;
    b.y = body.y + gun.muzzleHeight;
    b.z = body.z + body.forwardZ * 0.4;
    b.ox = b.x;
    b.oy = b.y;
    b.oz = b.z;
    // 車の速度ベクトルを加算 (慣性)
    b.vx = (dirX / len) * u + body.vx;
    b.vy = (dirY / len) * u + body.vy;
    b.vz = (dirZ / len) * u + body.vz;
    b.age = 0;
    b.distance = 0;
    b.trackHint = body.trackHint;
    return b;
  }

  update(dt: number, cars: readonly RaceCar[], hits: BulletHit[]): void {
    const hitR = gun.carHitRadius + gun.bulletRadius;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      const px = b.x;
      const py = b.y;
      const pz = b.z;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.age += dt;
      b.distance += Math.hypot(b.vx, b.vy, b.vz) * dt;

      // 車への命中 (線分 vs 球)
      let hit = false;
      for (const car of cars) {
        if (car.id === b.ownerId || !car.body.collidable || car.body.airborne) continue;
        const cx = car.body.x;
        const cy = car.body.y + 0.7;
        const cz = car.body.z;
        if (segmentSphere(px, py, pz, b.x, b.y, b.z, cx, cy, cz, hitR)) {
          hits.push({ bullet: b, target: car });
          b.alive = false;
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // 寿命・射程
      if (b.age > gun.maxLifetime || b.distance > gun.maxRange) {
        b.alive = false;
        continue;
      }
      // 路面に当たった
      const p = this.track.project(b.x, b.z, b.trackHint, this.proj);
      b.trackHint = p.index;
      if (Math.abs(p.lateral) < p.halfWidth + 2 && b.y < p.cy - 0.2) {
        b.alive = false;
      }
    }
  }

  clear(): void {
    for (const b of this.bullets) b.alive = false;
  }
}

/** 線分 p0→p1 が中心 c 半径 r の球に触れるか */
export function segmentSphere(
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  cx: number, cy: number, cz: number,
  r: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const len2 = dx * dx + dy * dy + dz * dz;
  let t = len2 > 1e-9 ? ((cx - x0) * dx + (cy - y0) * dy + (cz - z0) * dz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = x0 + dx * t - cx;
  const qy = y0 + dy * t - cy;
  const qz = z0 + dz * t - cz;
  return qx * qx + qy * qy + qz * qz <= r * r;
}

/** 弾丸の見た目 (InstancedMesh 1つで全弾を描画) */
export class BulletView {
  readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly dir = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3(0, 0, 1);

  constructor(capacity: number) {
    this.geometry = new THREE.BoxGeometry(0.16, 0.16, 1.6);
    this.material = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(system: BulletSystem): void {
    let n = 0;
    for (const b of system.bullets) {
      if (!b.alive) continue;
      this.p.set(b.x, b.y, b.z);
      this.dir.set(b.vx, b.vy, b.vz).normalize();
      this.q.setFromUnitVectors(this.fwd, this.dir);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
