/**
 * BATTLE DUEL の照準操作。
 *
 * マウスはカメラ操作ではなく照準専用。画面上の照準カーソルをマウス移動で動かし、
 * 右クリックで画面中央へ戻す。ゲーム画面をクリックするとポインターロックし、
 * カーソルが画面外へ出ないようにする (ロックできない環境では絶対座標で動作)。
 */
import * as THREE from 'three';
import { battleConfig } from '../config/battle';
import type { VehicleBody } from '../physics/VehicleBody';
import type { InputManager } from '../input/InputManager';
import type { Vec3 } from './PredictiveAim';

const gun = battleConfig.gun;

export class AimController {
  /** ビューポート内のカーソル位置 (px) */
  x = 0;
  y = 0;
  private width = 1;
  private height = 1;
  private readonly input: InputManager;
  private readonly canvas: HTMLCanvasElement;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly sphere = new THREE.Sphere();
  private readonly hitPoint = new THREE.Vector3();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly onMouseDown = (): void => this.requestLock();
  /** ポインターロックが外れた (Esc 等) 時のコールバック */
  onLockLost: (() => void) | null = null;
  private readonly onLockChange = (): void => {
    if (!this.locked && this.onLockLost) this.onLockLost();
  };

  constructor(input: InputManager, canvas: HTMLCanvasElement) {
    this.input = input;
    this.canvas = canvas;
    canvas.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    if (this.locked) return;
    try {
      const result = this.canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) {
        result.catch(() => {
          // ロック不可の環境では絶対座標で動作する
        });
      }
    } catch {
      // 同上
    }
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  setViewport(width: number, height: number): void {
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.center();
    }
  }

  center(): void {
    this.x = this.width / 2;
    this.y = this.height * 0.45;
  }

  update(sensitivity: number): void {
    const d = this.input.consumeMouseDelta();
    if (this.locked) {
      const k = sensitivity * battleConfig.aim.baseSpeed;
      this.x += d.dx * k;
      this.y += d.dy * k;
    } else {
      const rect = this.canvas.getBoundingClientRect();
      this.x = this.input.mouseX - rect.left;
      this.y = this.input.mouseY - rect.top;
    }
    this.x = Math.max(0, Math.min(this.width, this.x));
    this.y = Math.max(0, Math.min(this.height, this.y));
  }

  /** カーソル方向へ撃つための方向ベクトル (銃口から照準点へ) */
  computeAimDirection(camera: THREE.PerspectiveCamera, shooter: VehicleBody, target: VehicleBody | null, out: Vec3): Vec3 {
    this.ndc.set((this.x / this.width) * 2 - 1, -(this.y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    const ray = this.raycaster.ray;
    let aim: THREE.Vector3 | null = null;
    if (target && target.collidable) {
      this.sphere.center.set(target.x, target.y + 0.7, target.z);
      this.sphere.radius = gun.carHitRadius * 1.1;
      aim = ray.intersectSphere(this.sphere, this.hitPoint);
    }
    if (!aim) {
      this.plane.constant = -(shooter.y + 0.8);
      const p = ray.intersectPlane(this.plane, this.hitPoint);
      if (p && p.distanceTo(ray.origin) < gun.aimMaxDistance && p.distanceTo(ray.origin) > 4) {
        aim = p;
      } else {
        aim = this.hitPoint.copy(ray.origin).addScaledVector(ray.direction, gun.aimMaxDistance);
      }
    }
    const mx = shooter.x;
    const my = shooter.y + gun.muzzleHeight;
    const mz = shooter.z;
    const dx = aim.x - mx;
    const dy = aim.y - my;
    const dz = aim.z - mz;
    const len = Math.hypot(dx, dy, dz) || 1;
    out.x = dx / len;
    out.y = dy / len;
    out.z = dz / len;
    return out;
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.onLockLost = null;
    this.releaseLock();
  }
}
