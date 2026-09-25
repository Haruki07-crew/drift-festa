/**
 * v3 で追加したギミックの見た目 (GimmickView から使う)。
 *
 *   加速ゲート (光るアーチ + 流れる矢印) / スリップストリーム区間 (路面の矢印) /
 *   水しぶき (水たまり・打ち寄せる波) / 動く足場 / 跳ね橋 / トンネル加速のライン照明
 *
 * すべて GimmickSystem の状態 (時刻の関数) を毎フレーム反映するだけで、物理には影響しない。
 */
import * as THREE from 'three';
import { gimmickConfig } from '../config/gimmicks';
import type { Track } from '../courses/Track';
import { GeometryBuilder } from '../render/GeometryBuilder';
import type { ResourceBag } from '../render/dispose';
import type { DrawbridgeZone, GimmickSystem, PlatformZone, SRange, SplashZone } from './GimmickSystem';

interface PlatformVisual {
  zone: PlatformZone;
  mesh: THREE.Mesh;
}

interface BridgeVisual {
  zone: DrawbridgeZone;
  /** 手前側・奥側の橋板 (回転の軸は橋の両端) */
  leaves: { pivot: THREE.Group; dir: number }[];
  lamp: THREE.MeshBasicMaterial;
}

interface SplashVisual {
  zone: SplashZone;
  mat: THREE.MeshStandardMaterial;
  spray: THREE.Mesh | null;
}

export class GimmickExtrasView {
  readonly group = new THREE.Group();
  private readonly track: Track;
  private readonly system: GimmickSystem;
  private readonly bag: ResourceBag;
  private readonly scroll: { tex: THREE.Texture; speed: number }[] = [];
  private readonly gateRings: THREE.MeshBasicMaterial[] = [];
  private readonly platforms: PlatformVisual[] = [];
  private readonly bridges: BridgeVisual[] = [];
  private readonly splashes: SplashVisual[] = [];
  private readonly tunnelLights: THREE.MeshBasicMaterial[] = [];
  private time = 0;

  constructor(track: Track, system: GimmickSystem, bag: ResourceBag) {
    this.track = track;
    this.system = system;
    this.bag = bag;
    this.group.name = 'gimmick-extras';
    this.buildSpeedGates();
    this.buildDraftZones();
    this.buildSplashes();
    this.buildPlatforms();
    this.buildDrawbridges();
    this.buildTunnelSpeedLights();
  }

  /** 範囲 r の中のサンプル番号 (開いた道の終点を越えない) */
  private samplesIn(r: SRange): number[] {
    const out: number[] = [];
    const n = this.track.samples.length;
    const start = this.track.sampleIndexAt(r.s);
    const count = Math.ceil(r.len / this.track.spacing);
    for (let k = 0; k <= count; k++) {
      const i = start + k;
      if (!this.track.closed && i >= n - 1) break;
      out.push(i % n);
    }
    return out;
  }

  // ------------------------------------------------------------------ 加速ゲート

  private buildSpeedGates(): void {
    const gates = this.system.pads.filter((p) => p.kind === 'gate');
    if (gates.length === 0) return;
    const cfg = gimmickConfig.speedGate;
    const tex = this.bag.add(makeArrowTexture('#39f3ff', '#ffffff'));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.scroll.push({ tex, speed: 3 });
    const floorMat = this.bag.add(
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    const postMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x20242e }));
    for (const g of gates) {
      const p = this.track.worldAt(g.s, g.lateral);
      const heading = Math.atan2(p.tx, p.tz);
      const root = new THREE.Group();
      root.position.set(p.x, p.y, p.z);
      root.rotation.set(0, heading, 0, 'YXZ');
      root.rotateOnAxis(new THREE.Vector3(0, 0, 1), -p.bank);
      // 光るアーチ (半円のリングを3重)
      const ringMat = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x39f3ff, transparent: true, opacity: 0.9 }));
      this.gateRings.push(ringMat);
      const w = g.halfWidth + 0.6;
      for (let k = 0; k < 3; k++) {
        const ring = new THREE.Mesh(this.bag.add(new THREE.TorusGeometry(w, 0.22, 6, 24, Math.PI)), ringMat);
        ring.scale.set(1, cfg.height / w, 1);
        ring.position.z = (k - 1) * 1.4;
        root.add(ring);
      }
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(this.bag.add(new THREE.BoxGeometry(0.6, 1.2, 3.6)), postMat);
        post.position.set(side * w, 0.6, 0);
        root.add(post);
      }
      // 路面の矢印
      const floorGeo = this.bag.add(new THREE.PlaneGeometry(g.halfWidth * 2, 8));
      floorGeo.rotateX(-Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.set(0, 0.05, -2);
      root.add(floor);
      this.group.add(root);
    }
  }

  // ------------------------------------------------------------------ スリップストリーム区間

  private buildDraftZones(): void {
    if (this.system.draftZones.length === 0) return;
    const tex = this.bag.add(makeArrowTexture('#ffd23f', '#fff4c0'));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.scroll.push({ tex, speed: 1.5 });
    const mat = this.bag.add(
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    for (const z of this.system.draftZones) {
      // 路肩寄りの2本の帯 (中央のラインは空ける)
      for (const side of [-1, 1]) {
        const positions: number[] = [];
        const uvs: number[] = [];
        let v = 0;
        const idx = this.samplesIn(z);
        for (let k = 0; k < idx.length - 1; k++) {
          const s0 = this.track.sample(idx[k]!);
          const s1 = this.track.sample(idx[k]! + 1);
          if (s0.gap || s1.gap) continue;
          const a0 = side * (s0.halfWidth - 2.2);
          const b0 = side * (s0.halfWidth - 1.2);
          const pt = (s: typeof s0, l: number): number[] => [s.x + s.rx * l, s.y + 0.04 + l * Math.tan(s.bank), s.z + s.rz * l];
          const q = [pt(s0, a0), pt(s0, b0), pt(s1, b0), pt(s1, a0)];
          const v1 = v + this.track.spacing / 3;
          positions.push(...q[0]!, ...q[1]!, ...q[2]!, ...q[0]!, ...q[2]!, ...q[3]!);
          uvs.push(0, v, 1, v, 1, v1, 0, v, 1, v1, 0, v1);
          v = v1;
        }
        if (positions.length === 0) continue;
        const geo = this.bag.add(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        this.group.add(new THREE.Mesh(geo, mat));
      }
    }
  }

  // ------------------------------------------------------------------ 水しぶき

  private buildSplashes(): void {
    for (const z of this.system.splashes) {
      const gb = new GeometryBuilder();
      const idx = this.samplesIn(z);
      for (let k = 0; k < idx.length - 1; k++) {
        const s0 = this.track.sample(idx[k]!);
        const s1 = this.track.sample(idx[k]! + 1);
        if (s0.gap || s1.gap) continue;
        const la = Math.max(-s0.halfWidth, z.latMin);
        const lb = Math.min(s0.halfWidth, z.latMax);
        if (lb <= la) continue;
        const pt = (s: typeof s0, l: number): [number, number, number] => [s.x + s.rx * l, s.y + 0.03 + l * Math.tan(s.bank), s.z + s.rz * l];
        gb.quad(...pt(s0, la), ...pt(s0, lb), ...pt(s1, lb), ...pt(s1, la), k % 2 === 0 ? 0x4fb6e8 : 0x3a9fd4);
      }
      const mat = this.bag.add(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.7,
          roughness: 0.1,
          metalness: 0.2,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      const mesh = new THREE.Mesh(this.bag.add(gb.build()), mat);
      this.group.add(mesh);
      // 周期的な波: 道路の横から立ち上がる水の壁 (見た目のみ)
      let spray: THREE.Mesh | null = null;
      if (z.period > 0) {
        const mid = this.track.pointAt(z.s + z.len / 2);
        const sprayMat = this.bag.add(new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
        const sprayGeo = this.bag.add(new THREE.PlaneGeometry(z.len, 3, 12, 1));
        spray = new THREE.Mesh(sprayGeo, sprayMat);
        const side = z.latMin > -mid.halfWidth ? 1 : -1;
        const edge = this.track.worldAt(z.s + z.len / 2, side * (mid.halfWidth + 1));
        spray.position.set(edge.x, edge.y + 1.5, edge.z);
        spray.rotation.y = Math.atan2(mid.tx, mid.tz) + Math.PI / 2;
        this.group.add(spray);
      }
      this.splashes.push({ zone: z, mat, spray });
    }
  }

  // ------------------------------------------------------------------ 動く足場

  private buildPlatforms(): void {
    for (const z of this.system.platforms) {
      // 足場はコース中心 (横位置 0) に作り、毎フレーム横へずらす
      const gb = new GeometryBuilder();
      const idx = this.samplesIn(z);
      const hw = z.halfWidth;
      for (let k = 0; k < idx.length - 1; k++) {
        const s0 = this.track.sample(idx[k]!);
        const s1 = this.track.sample(idx[k]! + 1);
        const pt = (s: typeof s0, l: number, dy: number): [number, number, number] => [s.x + s.rx * l, s.y + dy, s.z + s.rz * l];
        // 雲 (白) と見分けやすいオレンジの足場
        const c = Math.floor(k / 2) % 2 === 0 ? 0xffc04a : 0xffa830;
        gb.quad(...pt(s0, -hw, 0), ...pt(s0, hw, 0), ...pt(s1, hw, 0), ...pt(s1, -hw, 0), c);
        gb.quad(...pt(s0, -hw, -0.9), ...pt(s0, -hw, 0), ...pt(s1, -hw, 0), ...pt(s1, -hw, -0.9), 0xb8601a);
        gb.quad(...pt(s0, hw, 0), ...pt(s0, hw, -0.9), ...pt(s1, hw, -0.9), ...pt(s1, hw, 0), 0xb8601a);
        // 縁の白いライン
        gb.quad(...pt(s0, -hw, 0.02), ...pt(s0, -hw + 0.4, 0.02), ...pt(s1, -hw + 0.4, 0.02), ...pt(s1, -hw, 0.02), 0xffffff);
        gb.quad(...pt(s0, hw - 0.4, 0.02), ...pt(s0, hw, 0.02), ...pt(s1, hw, 0.02), ...pt(s1, hw - 0.4, 0.02), 0xffffff);
      }
      const mesh = new THREE.Mesh(this.bag.add(gb.build()), this.bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.group.add(mesh);
      this.platforms.push({ zone: z, mesh });
    }
  }

  // ------------------------------------------------------------------ 跳ね橋

  private buildDrawbridges(): void {
    const leafMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x8a5a36 }));
    const railMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x2a2d36 }));
    for (const z of this.system.drawbridges) {
      const width = z.latMax - z.latMin;
      const mid = (z.latMin + z.latMax) / 2;
      const half = z.len / 2;
      const leaves: BridgeVisual['leaves'] = [];
      for (const dir of [1, -1]) {
        // dir = 1: 手前の端が軸、-1: 奥の端が軸
        const axisS = dir > 0 ? z.s : z.s + z.len;
        const p = this.track.worldAt(axisS, mid);
        const pivot = new THREE.Group();
        pivot.position.set(p.x, p.y, p.z);
        pivot.rotation.y = Math.atan2(p.tx, p.tz);
        const geo = this.bag.add(new THREE.BoxGeometry(width, 0.5, half));
        geo.translate(0, -0.25, (dir * half) / 2);
        const leaf = new THREE.Mesh(geo, leafMat);
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        pivot.add(leaf);
        for (const side of [-1, 1]) {
          const railGeo = this.bag.add(new THREE.BoxGeometry(0.2, 0.9, half));
          railGeo.translate(side * (width / 2 - 0.1), 0.45, (dir * half) / 2);
          pivot.add(new THREE.Mesh(railGeo, railMat));
        }
        this.group.add(pivot);
        leaves.push({ pivot, dir });
      }
      // 橋の信号 (上がる前に黄、上がっている間は赤)
      const lamp = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x113311 }));
      const lp = this.track.worldAt(z.s - 4, z.latMax + 2);
      const pole = new THREE.Mesh(this.bag.add(new THREE.CylinderGeometry(0.15, 0.15, 4.5, 6)), railMat);
      pole.position.set(lp.x, lp.y + 2.25, lp.z);
      const light = new THREE.Mesh(this.bag.add(new THREE.SphereGeometry(0.5, 10, 8)), lamp);
      light.position.set(lp.x, lp.y + 4.8, lp.z);
      this.group.add(pole, light);
      this.bridges.push({ zone: z, leaves, lamp });
    }
  }

  // ------------------------------------------------------------------ トンネル加速の照明

  private buildTunnelSpeedLights(): void {
    for (const t of this.system.tunnels) {
      if (t.speedBonus <= 0) continue;
      const gb = new GeometryBuilder();
      const idx = this.samplesIn(t);
      for (let k = 0; k < idx.length - 1; k += 3) {
        const s0 = this.track.sample(idx[k]!);
        for (const side of [-1, 1]) {
          const l = side * (s0.halfWidth + 1.1);
          const x = s0.x + s0.rx * l;
          const z = s0.z + s0.rz * l;
          const y = s0.y + 2.2 + l * Math.tan(s0.bank);
          gb.quad(x - s0.tx * 0.9, y, z - s0.tz * 0.9, x + s0.tx * 0.9, y, z + s0.tz * 0.9, x + s0.tx * 0.9, y + 0.3, z + s0.tz * 0.9, x - s0.tx * 0.9, y + 0.3, z - s0.tz * 0.9, 0xffffff);
        }
      }
      const mat = this.bag.add(new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x7fe8ff, side: THREE.DoubleSide }));
      this.tunnelLights.push(mat);
      this.group.add(new THREE.Mesh(this.bag.add(gb.build()), mat));
    }
  }

  // ------------------------------------------------------------------ 更新

  update(dt: number): void {
    this.time += dt;
    for (const st of this.scroll) st.tex.offset.y = (st.tex.offset.y - st.speed * dt) % 1;
    const pulse = 0.65 + 0.35 * Math.sin(this.time * 6);
    for (const m of this.gateRings) m.opacity = pulse;
    for (const m of this.tunnelLights) m.color.setHSL(0.52, 1, 0.55 + 0.2 * Math.sin(this.time * 8));
    for (const v of this.platforms) {
      const c = this.system.platformCenter(v.zone);
      // 足場の中心線方向の右ベクトルは区間でほぼ一定なので、区間中央の向きで平行移動する
      const mid = this.track.pointAt(v.zone.s + v.zone.len / 2);
      v.mesh.position.set(-mid.tz * c, 0, mid.tx * c);
    }
    for (const b of this.bridges) {
      const lift = this.system.drawbridgeLift(b.zone);
      const ang = (lift * gimmickConfig.drawbridge.maxAngleDeg * Math.PI) / 180;
      for (const leaf of b.leaves) leaf.pivot.children.forEach((c) => (c.rotation.x = -leaf.dir * ang));
      const gateWarn = b.zone.gate.state.warn || b.zone.gate.state.active;
      const blink = Math.floor(this.time * 5) % 2 === 0;
      b.lamp.color.setHex(lift > 0 ? 0xff2020 : gateWarn ? (blink ? 0xffd000 : 0x332200) : 0x20ff60);
    }
    for (const v of this.splashes) {
      const phase = this.system.splashPhase(v.zone);
      v.mat.opacity = phase === 'wave' ? 0.8 : phase === 'warn' ? 0.45 : 0.18;
      if (v.spray) {
        const h = phase === 'wave' ? 1 : phase === 'warn' ? 0.35 : 0.02;
        v.spray.scale.y = h;
        v.spray.visible = h > 0.05;
      }
    }
  }
}

/** 流れる矢印 (^) の模様 */
function makeArrowTexture(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = a;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(10, 46);
    ctx.lineTo(32, 20);
    ctx.lineTo(54, 46);
    ctx.stroke();
    ctx.strokeStyle = b;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
