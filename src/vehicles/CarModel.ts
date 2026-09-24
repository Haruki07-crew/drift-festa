/**
 * 車のローポリ3Dモデル (外部モデルファイル不要。コードで生成)。
 *
 * - 車体スタイル (coupe / hatch / wedge / gt / muscle / suv) ごとに寸法とシルエットが変わる
 * - タイヤの回転・前輪の操舵・ロール/ピッチ・ブレーキランプ
 * - NPC はゴーストカー風の半透明表現 (物理的な実体はある)
 * - 復帰直後 (衝突無効中) は点滅
 */
import * as THREE from 'three';
import type { BodyStyle, CarSpec } from '../config/cars';
import { graphicsConfig } from '../config/graphics';
import { clamp, damp } from '../core/math';
import type { VehicleBody } from '../physics/VehicleBody';
import { GeometryBuilder } from '../render/GeometryBuilder';
import { ResourceBag } from '../render/dispose';

interface StyleDims {
  length: number;
  width: number;
  bodyHeight: number;
  clearance: number;
  cabinHeight: number;
  cabinLength: number;
  cabinOffset: number;
  noseTaper: number;
  wheelRadius: number;
}

const STYLES: Record<BodyStyle, StyleDims> = {
  coupe: { length: 4.3, width: 1.8, bodyHeight: 0.55, clearance: 0.28, cabinHeight: 0.5, cabinLength: 1.9, cabinOffset: -0.3, noseTaper: 0.55, wheelRadius: 0.34 },
  hatch: { length: 3.95, width: 1.76, bodyHeight: 0.6, clearance: 0.3, cabinHeight: 0.6, cabinLength: 2.1, cabinOffset: -0.45, noseTaper: 0.4, wheelRadius: 0.33 },
  wedge: { length: 4.3, width: 1.92, bodyHeight: 0.46, clearance: 0.24, cabinHeight: 0.46, cabinLength: 1.6, cabinOffset: 0.15, noseTaper: 0.8, wheelRadius: 0.35 },
  gt: { length: 4.7, width: 1.96, bodyHeight: 0.56, clearance: 0.26, cabinHeight: 0.5, cabinLength: 1.9, cabinOffset: -0.45, noseTaper: 0.65, wheelRadius: 0.37 },
  muscle: { length: 4.6, width: 1.9, bodyHeight: 0.66, clearance: 0.3, cabinHeight: 0.5, cabinLength: 1.8, cabinOffset: -0.55, noseTaper: 0.25, wheelRadius: 0.37 },
  suv: { length: 4.55, width: 2.0, bodyHeight: 0.8, clearance: 0.42, cabinHeight: 0.68, cabinLength: 2.6, cabinOffset: -0.4, noseTaper: 0.35, wheelRadius: 0.42 },
};

const GLASS = 0x18202c;
const WHEEL_DARK = 0x16171b;
const HUB = 0xb8bcc4;

export interface CarModelOptions {
  ghost: boolean;
  /** 頭上に表示するラベル (2人プレイ時の P1 / P2) */
  label?: string;
  labelColor?: string;
  castShadow: boolean;
}

export class CarModel {
  readonly root = new THREE.Group();
  private readonly chassis = new THREE.Group();
  private readonly wheels: { pivot: THREE.Group; spin: THREE.Object3D; front: boolean }[] = [];
  private readonly brakeMat: THREE.MeshStandardMaterial;
  private readonly materials: THREE.Material[] = [];
  private readonly bag = new ResourceBag();
  private readonly shadow: THREE.Mesh;
  private readonly dims: StyleDims;
  private wheelAngle = 0;
  private roll = 0;
  private pitch = 0;
  private blinkTime = 0;
  /** 水中変形の度合い 0 (通常) .. 1 (タイヤ格納・ヒレ展開) */
  private transform = 0;
  private readonly fins = new THREE.Group();
  private readonly propeller = new THREE.Group();
  readonly ghost: boolean;

  constructor(spec: CarSpec, opts: CarModelOptions, shadowTexture: THREE.Texture) {
    this.ghost = opts.ghost;
    const d = STYLES[spec.visual.style];
    this.dims = d;
    const v = spec.visual;

    const ghostProps = opts.ghost
      ? { transparent: true, opacity: graphicsConfig.ghost.opacity, depthWrite: true }
      : {};

    const bodyMat = this.track(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.42,
        metalness: 0.25,
        flatShading: true,
        ...ghostProps,
        emissive: opts.ghost ? new THREE.Color(v.bodyColor) : new THREE.Color(0x000000),
        emissiveIntensity: opts.ghost ? graphicsConfig.ghost.emissiveIntensity : 0,
      }),
    );
    const wheelMat = this.track(new THREE.MeshStandardMaterial({ color: WHEEL_DARK, roughness: 0.8, flatShading: true, ...ghostProps }));
    const hubMat = this.track(new THREE.MeshStandardMaterial({ color: HUB, roughness: 0.3, metalness: 0.7, ...ghostProps }));
    const headMat = this.track(new THREE.MeshBasicMaterial({ color: 0xfff6d8, ...ghostProps }));
    this.brakeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.4, ...ghostProps }),
    );

    // --- 車体 ---
    const gb = new GeometryBuilder();
    const L = d.length;
    const W = d.width;
    const y0 = d.clearance;
    const y1 = y0 + d.bodyHeight;
    const accent = v.accentColor;
    // 下部ボディ: ノーズに向けて上面が下がる形
    prism(gb, {
      y0,
      y1,
      bottom: { back: -L / 2, front: L / 2, halfW: W / 2 },
      top: { back: -L / 2 + 0.1, front: L / 2 - d.noseTaper, halfW: W / 2 - 0.06 },
      frontDrop: d.noseTaper * 0.35,
      color: v.bodyColor,
    });
    // キャビン (ガラス) + ルーフ
    const cb = d.cabinOffset - d.cabinLength / 2;
    const cf = d.cabinOffset + d.cabinLength / 2;
    prism(gb, {
      y0: y1,
      y1: y1 + d.cabinHeight,
      bottom: { back: cb, front: cf, halfW: W / 2 - 0.1 },
      top: { back: cb + 0.3, front: cf - 0.55, halfW: W / 2 - 0.26 },
      frontDrop: 0,
      color: GLASS,
      topColor: v.bodyColor,
    });
    // ボンネット〜ルーフのストライプ
    stripe(gb, 0.22, y1 + 0.005, -L / 2 + 0.1, cb, accent);
    stripe(gb, 0.22, y1 + d.cabinHeight + 0.005, cb + 0.3, cf - 0.55, accent);
    // サイドスカート
    prism(gb, {
      y0: y0 - 0.05,
      y1: y0 + 0.12,
      bottom: { back: -L / 2 + 0.25, front: L / 2 - 0.3, halfW: W / 2 + 0.02 },
      top: { back: -L / 2 + 0.25, front: L / 2 - 0.3, halfW: W / 2 + 0.02 },
      frontDrop: 0,
      color: accent,
    });
    // リアウイング
    if (v.spoiler) {
      const wy = y1 + 0.35;
      prism(gb, {
        y0: wy,
        y1: wy + 0.08,
        bottom: { back: -L / 2 + 0.02, front: -L / 2 + 0.42, halfW: W / 2 - 0.05 },
        top: { back: -L / 2 + 0.02, front: -L / 2 + 0.42, halfW: W / 2 - 0.05 },
        frontDrop: 0,
        color: accent,
      });
      for (const side of [-1, 1]) {
        prismAt(gb, side * (W / 2 - 0.35), y1, -L / 2 + 0.22, 0.08, 0.36, 0.12, accent);
      }
    }
    const bodyGeo = this.bag.add(gb.build());
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = opts.castShadow;
    this.chassis.add(bodyMesh);

    // --- ライト ---
    const lightGeo = this.bag.add(new THREE.BoxGeometry(0.42, 0.14, 0.06));
    const lightY = y0 + d.bodyHeight * 0.55 - d.noseTaper * 0.2;
    for (const side of [-1, 1]) {
      const head = new THREE.Mesh(lightGeo, headMat);
      head.position.set(side * (W / 2 - 0.32), lightY, L / 2 + 0.01);
      const tail = new THREE.Mesh(lightGeo, this.brakeMat);
      tail.position.set(side * (W / 2 - 0.32), y0 + d.bodyHeight * 0.7, -L / 2 - 0.01);
      this.chassis.add(head, tail);
    }

    // --- タイヤ ---
    const wheelGeo = this.bag.add(new THREE.CylinderGeometry(d.wheelRadius, d.wheelRadius, 0.3, 10));
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = this.bag.add(new THREE.CylinderGeometry(d.wheelRadius * 0.55, d.wheelRadius * 0.55, 0.32, 6));
    hubGeo.rotateZ(Math.PI / 2);
    const axleF = L / 2 - 0.85;
    const axleR = -L / 2 + 0.8;
    for (const [z, front] of [[axleF, true], [axleR, false]] as const) {
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * (W / 2 - 0.12), d.wheelRadius, z);
        const spin = new THREE.Group();
        const tire = new THREE.Mesh(wheelGeo, wheelMat);
        tire.castShadow = opts.castShadow;
        const hub = new THREE.Mesh(hubGeo, hubMat);
        spin.add(tire, hub);
        pivot.add(spin);
        this.root.add(pivot);
        this.wheels.push({ pivot, spin, front });
      }
    }

    // --- 水中走行モード用のヒレとプロペラ (通常は非表示) ---
    const finMat = this.track(new THREE.MeshStandardMaterial({ color: v.accentColor, roughness: 0.4, metalness: 0.3, flatShading: true, ...ghostProps }));
    const sideFinGeo = this.bag.add(new THREE.BoxGeometry(0.9, 0.08, 1.6));
    for (const side of [-1, 1]) {
      const f = new THREE.Mesh(sideFinGeo, finMat);
      f.position.set(side * (W / 2 + 0.4), y0 + 0.25, 0);
      f.rotation.z = side * 0.25;
      this.fins.add(f);
    }
    const dorsal = new THREE.Mesh(this.bag.add(new THREE.BoxGeometry(0.08, 0.7, 1.2)), finMat);
    dorsal.position.set(0, y1 + d.cabinHeight + 0.3, -0.4);
    this.fins.add(dorsal);
    const bladeGeo = this.bag.add(new THREE.BoxGeometry(0.12, 0.9, 0.08));
    for (let k = 0; k < 3; k++) {
      const bl = new THREE.Mesh(bladeGeo, finMat);
      bl.rotation.z = (k * Math.PI * 2) / 3;
      this.propeller.add(bl);
    }
    this.propeller.position.set(0, y0 + d.bodyHeight * 0.5, -L / 2 - 0.15);
    this.fins.add(this.propeller);
    this.fins.visible = false;
    this.chassis.add(this.fins);

    // --- 丸影 (影OFFでも接地感を出す) ---
    const shadowGeo = this.bag.add(new THREE.PlaneGeometry(W * 1.35, L * 1.2));
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = this.track(
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.55 }),
    );
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.position.y = 0.04;
    this.shadow.renderOrder = 1;
    this.root.add(this.shadow);

    // --- ラベル ---
    if (opts.label) {
      const sprite = this.makeLabel(opts.label, opts.labelColor ?? '#ffd23f');
      sprite.position.set(0, y1 + d.cabinHeight + 1.3, 0);
      this.root.add(sprite);
    }

    this.root.add(this.chassis);
  }

  private track<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private makeLabel(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(8, 4, 112, 44, 12);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 27);
      ctx.beginPath();
      ctx.moveTo(52, 48);
      ctx.lineTo(76, 48);
      ctx.lineTo(64, 62);
      ctx.fill();
    }
    const tex = this.bag.add(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.2, 1.1, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  /** 物理状態を見た目へ反映 */
  update(body: VehicleBody, dt: number, ghostBlink: boolean): void {
    const d = this.dims;
    this.root.position.set(body.x, body.y, body.z);
    // バンクした路面に合わせて車体ごと傾ける (右側が高い = 左へ傾く)
    this.root.rotation.set(0, body.heading, -body.bank, 'YXZ');

    // ロール (横G) とピッチ (加減速 + 勾配)
    const targetRoll = clamp(body.lateralAccel * 0.0045, -0.09, 0.09);
    const targetPitch = clamp(-body.longitudinalAccel * 0.004, -0.05, 0.05) - Math.atan(body.slope);
    this.roll = damp(this.roll, body.airborne ? this.roll : targetRoll, 8, dt);
    this.pitch = damp(this.pitch, targetPitch, 8, dt);
    this.chassis.rotation.set(this.pitch, 0, this.roll, 'YXZ');
    this.chassis.position.y = Math.abs(this.roll) * 0.4;

    // 水中変形: タイヤを格納してヒレとプロペラを出す
    this.transform = damp(this.transform, body.transformMode === 'underwater' ? 1 : 0, 5, dt);
    const tr = this.transform;
    this.fins.visible = tr > 0.05;
    this.fins.scale.setScalar(Math.max(0.001, tr));
    this.propeller.rotation.z += body.forwardSpeed * dt * 0.8;

    // タイヤ
    this.wheelAngle += (body.forwardSpeed / d.wheelRadius) * dt;
    const wheelScale = 1 - tr * 0.75;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelAngle;
      w.pivot.rotation.y = w.front ? -body.steer * 0.45 : 0;
      w.pivot.rotation.x = this.pitch;
      w.spin.scale.setScalar(Math.max(0.05, wheelScale));
      w.spin.position.set(-Math.sign(w.pivot.position.x) * tr * 0.25, tr * 0.25, 0);
    }

    // ブレーキランプ
    this.brakeMat.emissiveIntensity = body.brakeInput > 0 && body.forwardSpeed > 0.5 ? 3.2 : 0.4;

    // 影は路面に貼り付け (ジャンプ・落下中は薄く)
    this.shadow.visible = !body.airborne;

    // 復帰直後の点滅
    if (ghostBlink) {
      this.blinkTime += dt;
      this.root.visible = Math.floor(this.blinkTime / graphicsConfig.ghost.respawnBlinkPeriod) % 2 === 0;
    } else {
      this.blinkTime = 0;
      this.root.visible = true;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const m of this.materials) {
      // 丸影テクスチャは全車で共有しているので破棄しない (material.dispose はテクスチャを破棄しない)
      m.dispose();
    }
    this.bag.dispose();
  }
}

interface Rect {
  back: number;
  front: number;
  halfW: number;
}

/** 下面と上面の矩形を結んだ柱体 (台形の車体パーツ) */
function prism(
  gb: GeometryBuilder,
  o: { y0: number; y1: number; bottom: Rect; top: Rect; frontDrop: number; color: number; topColor?: number },
): void {
  const { y0, y1, bottom: b, top: t } = o;
  const c = new THREE.Color(o.color);
  const side = c.clone().multiplyScalar(0.92);
  const topC = new THREE.Color(o.topColor ?? o.color).multiplyScalar(1.05);
  // 頂点: 下面 (x: ±halfW, z: back/front)、上面
  const B = {
    lb: [-b.halfW, y0, b.back],
    rb: [b.halfW, y0, b.back],
    rf: [b.halfW, y0, b.front],
    lf: [-b.halfW, y0, b.front],
  } as const;
  const yf = y1 - o.frontDrop;
  const T = {
    lb: [-t.halfW, y1, t.back],
    rb: [t.halfW, y1, t.back],
    rf: [t.halfW, yf, t.front],
    lf: [-t.halfW, yf, t.front],
  } as const;
  // 上面
  gb.quad(...T.lb, ...T.lf, ...T.rf, ...T.rb, topC);
  // 前面
  gb.quad(...B.lf, ...B.rf, ...T.rf, ...T.lf, c);
  // 後面
  gb.quad(...B.rb, ...B.lb, ...T.lb, ...T.rb, side);
  // 左面 (+x 側が左)
  gb.quad(...B.rb, ...T.rb, ...T.rf, ...B.rf, side);
  // 右面
  gb.quad(...B.lf, ...T.lf, ...T.lb, ...B.lb, side);
  // 底面
  gb.quad(...B.lb, ...B.rb, ...B.rf, ...B.lf, 0x111111);
}

function prismAt(gb: GeometryBuilder, x: number, y: number, z: number, w: number, h: number, dpt: number, color: number): void {
  const r = { back: z - dpt / 2, front: z + dpt / 2 };
  const c = new THREE.Color(color);
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y1 = y + h;
  gb.quad(x0, y1, r.back, x0, y1, r.front, x1, y1, r.front, x1, y1, r.back, c);
  gb.quad(x0, y, r.front, x1, y, r.front, x1, y1, r.front, x0, y1, r.front, c);
  gb.quad(x1, y, r.back, x0, y, r.back, x0, y1, r.back, x1, y1, r.back, c);
  gb.quad(x1, y, r.back, x1, y1, r.back, x1, y1, r.front, x1, y, r.front, c);
  gb.quad(x0, y, r.front, x0, y1, r.front, x0, y1, r.back, x0, y, r.back, c);
}

function stripe(gb: GeometryBuilder, width: number, y: number, z0: number, z1: number, color: number): void {
  if (z1 <= z0) return;
  const hw = width / 2;
  gb.quad(-hw, y, z0, -hw, y, z1, hw, y, z1, hw, y, z0, color);
}
