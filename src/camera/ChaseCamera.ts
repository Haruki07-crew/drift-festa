/**
 * 後方追従3Dカメラ。
 *
 * - 加速時の軽い FOV 変化 / 高速時の速度感 (FOV拡大・後方距離・微振動)
 * - ドリフト中はカメラの向きの追従を遅くし、車が横を向いて滑る様子が見える
 * - 衝突時の軽いカメラシェイク (設定で OFF 可能)
 * - スタート前のイントロ演出 (車の周りを回り込む)
 */
import * as THREE from 'three';
import { gimmickConfig } from '../config/gimmicks';
import { cameraConfig } from '../config/graphics';
import { clamp, damp, dampAngle } from '../core/math';
import type { VehicleBody } from '../physics/VehicleBody';

const cfg = cameraConfig;

export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly smoothLook = new THREE.Vector3();
  private fov = cfg.baseFov;
  private shake = 0;
  private time = 0;
  private prevSpeed = 0;
  private accelSmoothed = 0;
  /** バンクに合わせたカメラの傾き [rad] */
  private roll = 0;
  shakeEnabled = true;

  constructor(far: number) {
    this.camera = new THREE.PerspectiveCamera(cfg.baseFov, 16 / 9, cfg.near, far);
  }

  /** 位置をすぐに車の後ろへ合わせる */
  snap(body: VehicleBody): void {
    this.yaw = body.heading;
    this.computeTarget(body, 0);
    this.camera.position.copy(this.pos);
    this.smoothLook.copy(this.look);
    this.camera.lookAt(this.smoothLook);
    this.prevSpeed = body.forwardSpeed;
  }

  addShake(amount: number): void {
    if (!this.shakeEnabled) return;
    this.shake = Math.min(cfg.shakeMaxAmplitude, this.shake + amount);
  }

  private computeTarget(body: VehicleBody, speedRatio: number): void {
    const dist = cfg.distance + cfg.speedDistanceBoost * speedRatio;
    const sx = Math.sin(this.yaw);
    const sz = Math.cos(this.yaw);
    this.pos.set(body.x - sx * dist, body.y + cfg.height, body.z - sz * dist);
    this.look.set(
      body.x + Math.sin(body.heading) * cfg.lookAhead * 0.5 + sx * cfg.lookAhead * 0.5,
      body.y + cfg.lookHeight,
      body.z + Math.cos(body.heading) * cfg.lookAhead * 0.5 + sz * cfg.lookAhead * 0.5,
    );
  }

  update(body: VehicleBody, dt: number): void {
    this.time += dt;
    const speed = Math.max(0, body.forwardSpeed);
    const speedRatio = clamp(speed / Math.max(1, body.maxSpeed), 0, 1.3);

    // 向きの追従 (ドリフト中はゆっくり)。落下中は追従しない
    if (body.airMode !== 'fall') {
      const response = body.isDrifting ? cfg.driftYawResponse : cfg.yawResponse;
      // 後退中でもカメラは車の後ろ
      this.yaw = dampAngle(this.yaw, body.heading, response, dt);
    }
    this.computeTarget(body, speedRatio);
    if (body.airMode === 'fall') {
      // コースアウトの落下中はその場から見下ろす
      this.pos.copy(this.camera.position);
    }

    const cam = this.camera;
    cam.position.x = damp(cam.position.x, this.pos.x, cfg.positionResponse * 1.6, dt);
    cam.position.y = damp(cam.position.y, this.pos.y, cfg.positionResponse, dt);
    cam.position.z = damp(cam.position.z, this.pos.z, cfg.positionResponse * 1.6, dt);
    this.smoothLook.x = damp(this.smoothLook.x, this.look.x, 14, dt);
    this.smoothLook.y = damp(this.smoothLook.y, this.look.y, 10, dt);
    this.smoothLook.z = damp(this.smoothLook.z, this.look.z, 14, dt);

    // シェイク + 高速時の微振動
    this.shake = damp(this.shake, 0, cfg.shakeDecay, dt);
    const rumble = this.shakeEnabled ? cfg.speedRumble * Math.max(0, speedRatio - 0.6) : 0;
    const amp = this.shake + rumble;
    const ox = amp > 0.001 ? (Math.sin(this.time * 47) + Math.sin(this.time * 31)) * 0.5 * amp : 0;
    const oy = amp > 0.001 ? Math.sin(this.time * 53) * amp : 0;
    cam.position.x += ox;
    cam.position.y += oy;
    cam.lookAt(this.smoothLook);
    // 強いバンク (壁走行風) ではカメラも傾けて路面を水平に近く見せる
    this.roll = damp(this.roll, body.airborne ? this.roll : body.bank * gimmickConfig.bank.cameraRoll, 4, dt);
    if (Math.abs(this.roll) > 1e-4) cam.rotateZ(this.roll);

    // FOV (速度感 + 加速時の一時的な変化)
    const accel = dt > 0 ? (speed - this.prevSpeed) / dt : 0;
    this.prevSpeed = speed;
    this.accelSmoothed = damp(this.accelSmoothed, clamp(accel / 10, 0, 1), 4, dt);
    const targetFov = cfg.baseFov + cfg.speedFovBoost * Math.min(1, speedRatio) + cfg.accelFovBoost * this.accelSmoothed;
    this.fov = damp(this.fov, targetFov, cfg.fovResponse, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  /** スタート前のイントロ: 車の周りを回り込みながら後方位置へ (t: 0..1) */
  intro(body: VehicleBody, t: number): void {
    const e = 1 - Math.pow(1 - clamp(t, 0, 1), 3);
    const angle = body.heading + Math.PI * (1 - e) * 0.9 + (1 - e) * 0.6;
    const radius = cfg.introRadius * (1 - e) + cfg.distance * e;
    const height = 5 * (1 - e) + cfg.height * e;
    const cam = this.camera;
    cam.position.set(body.x - Math.sin(angle) * radius, body.y + height, body.z - Math.cos(angle) * radius);
    this.smoothLook.set(body.x, body.y + cfg.lookHeight, body.z);
    cam.lookAt(this.smoothLook);
    this.yaw = body.heading;
    if (e >= 0.999) this.snap(body);
  }
}
