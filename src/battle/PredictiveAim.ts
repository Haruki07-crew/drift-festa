/**
 * 偏差射撃 (未来位置予測) の計算。純粋関数・テスト対象。
 *
 * 弾の速度 = u × 方向 + 射手の速度 (慣性) なので、射手から見た相対運動で解く:
 *   D = 目標位置 - 銃口位置、W = 目標速度 - 射手速度
 *   |D + W t| = u t  を満たす最小の t > 0 を求め、方向 = normalize(D + W t)
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AimSolution {
  dir: Vec3;
  /** 予測命中時間 [s] (解がない場合は null) */
  time: number | null;
}

/**
 * @param accuracy 予測の精度 0..1。0 = 現在位置を直接狙う (射手の速度も考慮しない)、1 = 完全な偏差射撃
 */
export function solveIntercept(
  shooter: Vec3,
  shooterVel: Vec3,
  target: Vec3,
  targetVel: Vec3,
  bulletSpeed: number,
  accuracy = 1,
): AimSolution {
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const dz = target.z - shooter.z;
  const wx = (targetVel.x - shooterVel.x) * accuracy;
  const wy = (targetVel.y - shooterVel.y) * accuracy;
  const wz = (targetVel.z - shooterVel.z) * accuracy;
  const a = wx * wx + wy * wy + wz * wz - bulletSpeed * bulletSpeed;
  const b = 2 * (dx * wx + dy * wy + dz * wz);
  const c = dx * dx + dy * dy + dz * dz;
  let t: number | null = null;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) {
      const t0 = -c / b;
      if (t0 > 0) t = t0;
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a);
      const t2 = (-b + sq) / (2 * a);
      const candidates = [t1, t2].filter((v) => v > 0).sort((p, q) => p - q);
      t = candidates[0] ?? null;
    }
  }
  const tt = t ?? 0;
  const ax = dx + wx * tt;
  const ay = dy + wy * tt;
  const az = dz + wz * tt;
  const len = Math.hypot(ax, ay, az) || 1;
  return { dir: { x: ax / len, y: ay / len, z: az / len }, time: t };
}

/** 方向ベクトルを水平 (yaw) と垂直 (pitch) の角度だけ回転 */
export function perturbDirection(dir: Vec3, yawError: number, pitchError: number): Vec3 {
  const cy = Math.cos(yawError);
  const sy = Math.sin(yawError);
  let x = dir.x * cy + dir.z * sy;
  let z = -dir.x * sy + dir.z * cy;
  let y = dir.y + pitchError;
  const len = Math.hypot(x, y, z) || 1;
  x /= len;
  y /= len;
  z /= len;
  return { x, y, z };
}
