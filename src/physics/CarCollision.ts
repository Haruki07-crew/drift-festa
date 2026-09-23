/**
 * 車同士の接触。車体を前後2つの円で近似し、質量比で押し合う。
 * 重い車は軽い車を押しやすいが、速度変化量に上限を設けて不自然に吹き飛ばさない。
 */
import { physicsConfig } from '../config/physics';
import type { VehicleBody } from './VehicleBody';

const col = physicsConfig.collision;
const MAX_HEIGHT_DIFF = 2.5;

export interface CarContact {
  a: VehicleBody;
  b: VehicleBody;
  speed: number;
}

/** 全ペアの衝突を解決する。発生した接触を out に追加する */
export function resolveCarCollisions(bodies: readonly VehicleBody[], out: CarContact[]): void {
  const n = bodies.length;
  const r2 = col.carRadius * 2;
  const broad = (col.circleOffset + col.carRadius) * 2;
  for (let i = 0; i < n; i++) {
    const a = bodies[i]!;
    if (!a.collidable || a.airborne) continue;
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j]!;
      if (!b.collidable || b.airborne) continue;
      if (Math.abs(a.y - b.y) > MAX_HEIGHT_DIFF) continue;
      const dxc = a.x - b.x;
      const dzc = a.z - b.z;
      if (dxc * dxc + dzc * dzc > broad * broad) continue;

      // 最も深く重なっている円のペアを探す
      let best = 0;
      let bnx = 0;
      let bnz = 0;
      let cax = 0;
      let caz = 0;
      let cbx = 0;
      let cbz = 0;
      for (let ia = -1; ia <= 1; ia += 2) {
        const ax = a.x + Math.sin(a.heading) * col.circleOffset * ia;
        const az = a.z + Math.cos(a.heading) * col.circleOffset * ia;
        for (let ib = -1; ib <= 1; ib += 2) {
          const bx = b.x + Math.sin(b.heading) * col.circleOffset * ib;
          const bz = b.z + Math.cos(b.heading) * col.circleOffset * ib;
          const dx = ax - bx;
          const dz = az - bz;
          const d = Math.hypot(dx, dz);
          const pen = r2 - d;
          if (pen > best) {
            best = pen;
            bnx = d > 1e-6 ? dx / d : 1;
            bnz = d > 1e-6 ? dz / d : 0;
            cax = ax;
            caz = az;
            cbx = bx;
            cbz = bz;
          }
        }
      }
      if (best <= 0) continue;

      // 位置の分離 (質量の逆数に比例)
      const totalInv = a.invMass + b.invMass;
      const wa = a.invMass / totalInv;
      const wb = b.invMass / totalInv;
      a.x += bnx * best * wa;
      a.z += bnz * best * wa;
      b.x -= bnx * best * wb;
      b.z -= bnz * best * wb;

      // 速度の衝突応答
      const vrel = (a.vx - b.vx) * bnx + (a.vz - b.vz) * bnz;
      if (vrel >= 0) continue;
      const impulse = (-(1 + col.carRestitution) * vrel) / totalInv;
      let dva = impulse * a.invMass;
      let dvb = impulse * b.invMass;
      dva = Math.min(dva, col.maxImpulseSpeed);
      dvb = Math.min(dvb, col.maxImpulseSpeed);
      a.vx += bnx * dva;
      a.vz += bnz * dva;
      b.vx -= bnx * dvb;
      b.vz -= bnz * dvb;

      // 中心からずれた位置で当たると車体が回る
      const contactX = (cax + cbx) / 2;
      const contactZ = (caz + cbz) / 2;
      a.yawRate += torque(a, contactX, contactZ, bnx, bnz) * dva * col.carSpinFactor;
      b.yawRate += torque(b, contactX, contactZ, -bnx, -bnz) * dvb * col.carSpinFactor;

      const speed = -vrel;
      a.impactSpeed = Math.max(a.impactSpeed, speed);
      b.impactSpeed = Math.max(b.impactSpeed, speed);
      out.push({ a, b, speed });
    }
  }
}

/** 接触点と力の向きから、ヨー方向の回転量 (符号付き) を求める */
function torque(body: VehicleBody, px: number, pz: number, nx: number, nz: number): number {
  const rx = px - body.x;
  const rz = pz - body.z;
  // y軸まわりの外積 (r × n)_y = rz*nx - rx*nz
  return rz * nx - rx * nz;
}
