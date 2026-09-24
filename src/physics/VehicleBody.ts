/**
 * 車両の物理状態。描画 (Three.js) からは独立している。
 *
 * 座標系: 向き heading = 0 のとき +Z 方向を向く。
 *   前方ベクトル  f = ( sin h, cos h)
 *   右方向ベクトル r = (-cos h, sin h)
 *   heading が増える = 左旋回
 */
import type { CarSpec } from '../config/cars';
import { gimmickConfig, type SurfaceKind, type TransformMode } from '../config/gimmicks';
import { physicsConfig, type DrivetrainTraits } from '../config/physics';
import { kmhToMs } from '../core/math';

export type Surface = 'road' | 'offroad';

/** 空中にいる理由: jump = ジャンプ台 (着地できる)、fall = コースアウト (復帰へ) */
export type AirMode = 'none' | 'jump' | 'fall';

export class VehicleBody {
  readonly spec: CarSpec;
  readonly traits: DrivetrainTraits;
  readonly invMass: number;

  x = 0;
  y = 0;
  z = 0;
  heading = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  yawRate = 0;

  /** 平滑化されたステアリング -1..1 */
  steer = 0;
  /** ドリフトによるグリップ低下の度合い 0..1 */
  driftAmount = 0;

  airborne = false;
  airTime = 0;
  airMode: AirMode = 'none';
  /** 着地した瞬間の縦方向の速度 (演出用。0 = 着地なし) */
  landingSpeed = 0;
  /** 現在地の路面バンク角 [rad] */
  bank = 0;

  // --- コースギミックによる状態 (GimmickSystem が毎ステップ設定) ---
  /** 路面の種類 */
  surfaceKind: SurfaceKind = 'road';
  /** 変形モード (水中など)。null = 通常 */
  transformMode: TransformMode | null = null;
  /** ブーストパッドの残り時間 [s] */
  padBoostTimer = 0;
  surface: Surface = 'road';
  /** コース中心線探索のヒント (前回のサンプル番号) */
  trackHint: number | undefined = undefined;
  /** 最後に射影した中心線上の距離 */
  trackS = 0;
  trackLateral = 0;
  /** 路面の勾配 (見た目のピッチ用) */
  slope = 0;

  /** 最高速度倍率 (Boost, タイヤHP0 など) */
  maxSpeedMul = 1;
  accelMul = 1;

  /** 操作不能 (コースアウト復帰直後) */
  controlsLocked = false;
  /** 他車との衝突が有効か (復帰直後は無効) */
  collidable = true;

  /** 落下して復帰が必要 */
  needsRespawn = false;

  // --- デバッグ・音・演出用に毎ステップ更新される値 ---
  forwardSpeed = 0;
  lateralSpeed = 0;
  /** 横滑り角 [rad] */
  slipAngle = 0;
  /** 現在の横グリップ [m/s^2] */
  currentGrip = 0;
  longitudinalAccel = 0;
  lateralAccel = 0;
  /** このフレームで受けた最大の衝撃速度 [m/s] */
  impactSpeed = 0;
  /** 入力されているブレーキ量 (デバッグ・ブレーキランプ用) */
  brakeInput = 0;
  throttleInput = 0;

  constructor(spec: CarSpec) {
    this.spec = spec;
    this.traits = physicsConfig.drivetrains[spec.drivetrain];
    this.invMass = 1 / spec.mass;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /** 最高速度 (アイテム・タイヤHP・ブーストパッド・路面・変形の倍率込み) */
  get maxSpeed(): number {
    const surf = gimmickConfig.surfaces[this.surfaceKind].maxSpeedMul;
    const pad = this.padBoostTimer > 0 ? gimmickConfig.boostPad.maxSpeedMul : 1;
    const tr = this.transformMode ? gimmickConfig.transform[this.transformMode].maxSpeedMul : 1;
    return kmhToMs(this.spec.maxSpeedKmh) * this.maxSpeedMul * surf * pad * tr;
  }

  get forwardX(): number {
    return Math.sin(this.heading);
  }

  get forwardZ(): number {
    return Math.cos(this.heading);
  }

  get rightX(): number {
    return -Math.cos(this.heading);
  }

  get rightZ(): number {
    return Math.sin(this.heading);
  }

  get isDrifting(): boolean {
    return this.driftAmount > 0.35;
  }

  /** 位置・向きを設定し、速度をリセット */
  place(x: number, y: number, z: number, heading: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.heading = heading;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.driftAmount = 0;
    this.airborne = false;
    this.airTime = 0;
    this.airMode = 'none';
    this.landingSpeed = 0;
    this.padBoostTimer = 0;
    this.needsRespawn = false;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.slipAngle = 0;
    this.trackHint = undefined;
  }
}
