/**
 * メニュー画面の背景3D (ターンテーブルに載った車)。
 * 車選択画面ではフォーカス中の車を表示する。レース中は描画しない。
 */
import * as THREE from 'three';
import { findCarSpec } from '../config/cars';
import { ResourceBag } from '../render/dispose';
import type { RenderContext } from '../render/RenderContext';
import { VehicleBody } from '../physics/VehicleBody';
import { CarModel } from '../vehicles/CarModel';

export class MenuBackdrop {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
  private readonly bag = new ResourceBag();
  private readonly shadowTex: THREE.Texture;
  private model: CarModel | null = null;
  private body: VehicleBody | null = null;
  private carId: string | null = null;
  private angle = 0;
  private time = 0;
  private readonly turntable: THREE.Mesh;

  constructor() {
    this.scene.background = new THREE.Color(0x0d0f1c);
    this.scene.fog = new THREE.Fog(0x0d0f1c, 20, 60);
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x201830, 1.6);
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(5, 8, 6);
    const rim = new THREE.DirectionalLight(0xff4f79, 2.2);
    rim.position.set(-6, 3, -6);
    const rim2 = new THREE.DirectionalLight(0x39f3ff, 1.6);
    rim2.position.set(6, 2, -5);
    this.scene.add(hemi, key, rim, rim2);

    const ttGeo = this.bag.add(new THREE.CylinderGeometry(4.2, 4.4, 0.3, 40));
    const ttMat = this.bag.add(new THREE.MeshStandardMaterial({ color: 0x23263a, roughness: 0.35, metalness: 0.6 }));
    this.turntable = new THREE.Mesh(ttGeo, ttMat);
    this.turntable.position.y = -0.15;
    const ringGeo = this.bag.add(new THREE.TorusGeometry(4.35, 0.05, 6, 64));
    const ringMat = this.bag.add(new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    const floorGeo = this.bag.add(new THREE.CircleGeometry(60, 48));
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, this.bag.add(new THREE.MeshStandardMaterial({ color: 0x14162a, roughness: 0.9 })));
    floor.position.y = -0.3;
    this.scene.add(this.turntable, ring, floor);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    this.shadowTex = this.bag.add(new THREE.CanvasTexture(canvas));
  }

  showCar(carId: string | null): void {
    if (carId === this.carId) return;
    this.carId = carId;
    this.model?.dispose();
    this.model = null;
    this.body = null;
    const spec = findCarSpec(carId ?? undefined);
    if (!spec) return;
    this.model = new CarModel(spec, { ghost: false, castShadow: false }, this.shadowTex);
    this.body = new VehicleBody(spec);
    this.scene.add(this.model.root);
  }

  render(ctx: RenderContext, dt: number): void {
    this.time += dt;
    this.angle += dt * 0.45;
    if (this.model && this.body) {
      this.body.heading = this.angle;
      this.model.update(this.body, dt, false);
      this.model.root.position.y = 0.02;
    }
    this.turntable.rotation.y = this.angle;
    const r = 11;
    this.camera.position.set(Math.sin(0.6) * r, 3.4 + Math.sin(this.time * 0.3) * 0.2, Math.cos(0.6) * r);
    this.camera.lookAt(0, 0.9, 0);
    ctx.clear(0x0d0f1c);
    ctx.renderViewport(this.scene, this.camera, { x: 0, y: 0, width: 1, height: 1 });
  }

  dispose(): void {
    this.model?.dispose();
    this.bag.dispose();
    this.scene.clear();
  }
}
