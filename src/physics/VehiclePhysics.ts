/**
 * 車両の運動計算 (アーケード寄りのリアル挙動)。
 *
 * モデルの考え方:
 *  1. 前後方向: エンジン加速 (最高速付近で減衰)、ブレーキ、後退、転がり抵抗
 *  2. 回頭: ステア入力から目標ヨーレートを作る。速度が高いほど効きが落ちる
 *  3. 横方向: 車体の向きが変わってもワールド速度は慣性で残る → 横滑りが発生。
 *     横滑りはグリップ (摩擦上限つき) で打ち消される。
 *     ドリフト中はグリップを下げるので滑り続け、カウンターステアで角度を保てる。
 *  4. 駆動方式 (FF/FR/MR/AWD) でドリフト時のグリップ・回頭・安定性・加速が変わる。
 */
import { physicsConfig } from '../config/physics';
import { approach, clamp, kmhToMs, lerp } from '../core/math';
import type { VehicleControls } from '../vehicles/VehicleControls';
import type { VehicleBody } from './VehicleBody';

const cfg = physicsConfig;
const minDriftSpeed = kmhToMs(cfg.drift.minSpeedKmh);
const reverseMaxSpeed = kmhToMs(cfg.engine.reverseMaxSpeedKmh);

export function stepVehicle(body: VehicleBody, input: VehicleControls, dt: number): void {
  body.impactSpeed = 0;

  if (body.airborne) {
    stepAirborne(body, dt);
    return;
  }

  const locked = body.controlsLocked;
  const throttle = locked ? 0 : clamp(input.throttle, 0, 1);
  const brake = locked ? 0 : clamp(input.brake, 0, 1);
  const steerInput = locked ? 0 : clamp(input.steer, -1, 1);
  const driftKey = locked ? false : input.drift;
  body.throttleInput = throttle;
  body.brakeInput = brake;

  const spec = body.spec;
  const traits = body.traits;
  const offroad = body.surface === 'offroad';

  // --- 車体座標系の速度 ---
  let fx = Math.sin(body.heading);
  let fz = Math.cos(body.heading);
  let rx = -fz;
  let rz = fx;
  let fwd = body.vx * fx + body.vz * fz;
  let lat = body.vx * rx + body.vz * rz;

  const maxSpeed = body.maxSpeed * (offroad ? cfg.offroad.maxSpeedMul : 1);

  // --- ステアリング入力の平滑化 (キーボードのON/OFFを滑らかに) ---
  const rising = Math.abs(steerInput) > Math.abs(body.steer) && Math.sign(steerInput) === Math.sign(body.steer || steerInput);
  const steerRate = rising ? cfg.steering.inputRiseRate : cfg.steering.inputFallRate;
  body.steer = approach(body.steer, steerInput, steerRate * dt);

  // --- ドリフト状態 ---
  const wantDrift = driftKey && Math.abs(fwd) > minDriftSpeed;
  body.driftAmount = wantDrift
    ? approach(body.driftAmount, 1, cfg.drift.gripDropRate * dt)
    : approach(body.driftAmount, 0, cfg.drift.gripRecoveryRate * dt);
  const drift = body.driftAmount;

  // --- 前後方向 ---
  let accel = 0;
  const speedRatio = clamp(fwd / Math.max(1, maxSpeed), 0, 1);
  if (brake > 0) {
    if (fwd > cfg.engine.reverseSwitchSpeed) {
      accel -= spec.brake * brake;
    } else if (throttle <= 0) {
      // 停止付近でブレーキ → 後退
      if (fwd > -reverseMaxSpeed) {
        accel -= cfg.engine.reverseAccel * brake;
      }
    }
  }
  if (throttle > 0 && brake <= 0) {
    if (fwd < -0.5) {
      // 後退中にアクセル → まず止める
      accel += spec.brake * throttle;
    } else {
      const power = 1 - Math.pow(speedRatio, cfg.engine.powerCurveExponent);
      const driftAccel = lerp(1, traits.driftAccelMul, drift);
      accel += spec.accel * body.accelMul * power * throttle * driftAccel;
    }
  }
  if (throttle <= 0 && brake <= 0) {
    accel -= Math.sign(fwd) * cfg.engine.coastDecel;
  }
  accel -= Math.sign(fwd) * cfg.engine.rollingResistance;
  if (offroad) {
    accel -= Math.sign(fwd) * cfg.offroad.extraDrag * clamp(Math.abs(fwd) / 10, 0, 1);
  }
  if (drift > 0) {
    accel -= Math.sign(fwd) * cfg.drift.speedLoss * (1 - spec.drift * 0.6) * drift;
  }
  // 最高速度を超えている (タイヤHP0になった直後・コース外など) → 滑らかに落とす
  if (fwd > maxSpeed) {
    accel -= (fwd - maxSpeed) * 1.5 + 2;
  }

  const prevFwd = fwd;
  fwd += accel * dt;
  // ブレーキ・惰性で速度の符号が反転しないようにする (後退はブレーキキーの意図がある場合のみ)
  const intendsReverse = brake > 0 && prevFwd <= cfg.engine.reverseSwitchSpeed;
  if (!intendsReverse && prevFwd > 0 && fwd < 0) fwd = 0;
  if (prevFwd < 0 && fwd > 0 && !(throttle > 0)) fwd = 0;
  if (fwd < -reverseMaxSpeed) fwd = approach(fwd, -reverseMaxSpeed, 20 * dt);
  body.longitudinalAccel = (fwd - prevFwd) / dt;

  // --- 回頭 ---
  const absFwd = Math.abs(fwd);
  const lowSpeedFactor = Math.min(1, absFwd / cfg.steering.fullAuthoritySpeed);
  const highSpeedRatio = absFwd / cfg.steering.highSpeedHalfAuthority;
  const highSpeedFactor = 1 / (1 + highSpeedRatio * highSpeedRatio);
  const direction = fwd >= 0 ? 1 : -1;
  let targetYaw = -body.steer * cfg.steering.maxYawRate * spec.handling * lowSpeedFactor * highSpeedFactor * direction;

  const slipAngle = Math.atan2(lat, Math.max(absFwd, 2));
  if (drift > 0) {
    const boost = lerp(1, cfg.drift.yawBoost * traits.driftYawMul, drift);
    // カウンターステア: 横滑り方向にステアを切る → 回頭を穏やかに
    // lat > 0 (右へ流れている) で右ステア (steer > 0) がカウンター
    const counter = body.steer * lat > 0;
    targetYaw *= counter ? boost * cfg.drift.counterSteerDamping : boost;
    // パワーオーバー: アクセルでリアが流れて回り込む (FR/MR が強い)
    targetYaw += -body.steer * traits.powerOversteer * throttle * drift;
  }
  // 姿勢安定アシスト: 横滑り角を減らす方向へ車体を向ける (ドリフト中は弱まる)
  const assist = traits.stabilityAssist * (1 - drift) * lowSpeedFactor;
  targetYaw += -slipAngle * assist;

  body.yawRate = lerp(targetYaw, body.yawRate, Math.exp(-traits.yawResponse * dt));
  body.heading += body.yawRate * dt;

  // --- 新しい向きで速度を分解し直す (慣性で横滑りが発生) ---
  const worldVx = fx * fwd + rx * lat;
  const worldVz = fz * fwd + rz * lat;
  fx = Math.sin(body.heading);
  fz = Math.cos(body.heading);
  rx = -fz;
  rz = fx;
  fwd = worldVx * fx + worldVz * fz;
  lat = worldVx * rx + worldVz * rz;

  // --- 横グリップ ---
  const driftGripMul = Math.max(
    0.08,
    (cfg.drift.baseGripMul - cfg.drift.driftStatGripReduction * spec.drift) * traits.driftGripMul,
  );
  const grip =
    cfg.grip.lateralGripAccel * spec.grip * (offroad ? cfg.offroad.gripMul : 1) * lerp(1, driftGripMul, drift);
  const newLat = approach(lat, 0, grip * dt);
  const removed = Math.abs(lat) - Math.abs(newLat);
  if (fwd > 0 && fwd < maxSpeed) {
    // 横滑りが収まる時に速度の一部を前方向へ (ドリフトからの立ち上がり)
    fwd = Math.min(maxSpeed, fwd + removed * cfg.grip.slideToForwardRetention * (0.5 + spec.drift * 0.5));
  }
  body.lateralAccel = (newLat - lat) / dt;
  lat = newLat;

  body.vx = fx * fwd + rx * lat;
  body.vz = fz * fwd + rz * lat;
  body.x += body.vx * dt;
  body.z += body.vz * dt;

  body.forwardSpeed = fwd;
  body.lateralSpeed = lat;
  body.slipAngle = slipAngle;
  body.currentGrip = grip;
}

function stepAirborne(body: VehicleBody, dt: number): void {
  body.airTime += dt;
  body.vy -= cfg.gravity * dt;
  // 空中ではわずかに空気抵抗のみ
  body.vx *= 1 - 0.1 * dt;
  body.vz *= 1 - 0.1 * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.z += body.vz * dt;
  body.heading += body.yawRate * dt;
  body.yawRate *= 1 - 0.5 * dt;
  body.throttleInput = 0;
  body.brakeInput = 0;
}
