/**
 * コースギミックの見た目。GimmickSystem の状態を毎フレーム反映する。
 * テクスチャは Canvas で実行時生成 (外部画像なし)。dispose() で全リソースを解放する。
 */
import * as THREE from 'three';
import { gimmickConfig, surfaceProps, type SurfaceKind, type TunnelStyle } from '../config/gimmicks';
import type { Track } from '../courses/Track';
import { GeometryBuilder } from '../render/GeometryBuilder';
import { ResourceBag } from '../render/dispose';
import type { GimmickSystem, SRange, TunnelZone, WindZone } from './GimmickSystem';
import { GimmickExtrasView } from './GimmickExtrasView';
import type { Obstacle } from './Obstacle';

interface ObstacleVisual {
  obstacle: Obstacle;
  root: THREE.Group;
  lamp: THREE.MeshBasicMaterial | null;
  bar: THREE.Object3D | null;
  /** 落下物の予告の影 (道路に固定) */
  shadow: THREE.Mesh | null;
  /** 落下物の本体 (高さを動かす) */
  body: THREE.Object3D | null;
}

export class GimmickView {
  readonly group = new THREE.Group();
  private readonly bag = new ResourceBag();
  private readonly track: Track;
  private readonly system: GimmickSystem;
  private readonly scrollTextures: { tex: THREE.Texture; speed: number }[] = [];
  private readonly obstacleVisuals: ObstacleVisual[] = [];
  private readonly windArrows: { mat: THREE.MeshBasicMaterial; zone: number }[] = [];
  private readonly fans: THREE.Object3D[] = [];
  private readonly windsocks: THREE.Object3D[] = [];
  private seesaw: { mesh: THREE.Mesh; positions: Float32Array; base: Float32Array; sIdx: Float32Array } | null = null;
  private readonly extras: GimmickExtrasView;
  private time = 0;

  constructor(track: Track, system: GimmickSystem) {
    this.track = track;
    this.system = system;
    this.group.name = 'gimmicks';
    // ギミックは道路上に置く物なので安全帯の検査対象外
    this.group.userData.clearanceExempt = true;
    this.buildSurfaces();
    this.buildBoostPads();
    this.buildJumps();
    this.buildConveyors();
    this.buildWinds();
    this.buildObstacles();
    this.buildSeesaw();
    this.buildTunnels();
    this.extras = new GimmickExtrasView(track, system, this.bag);
    this.group.add(this.extras.group);
  }

  // ------------------------------------------------------------------ 共通

  /** 範囲 r の中のサンプル番号を順に返す */
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

  /** サンプル i→i+1 の路面に沿った帯 (la..lb) */
  private stripAt(gb: GeometryBuilder, i: number, la: number, lb: number, dy: number, color: THREE.Color | number): void {
    const t = this.track;
    const s0 = t.sample(i);
    const s1 = t.sample(i + 1);
    if (s0.gap || s1.gap) return;
    const p = (s: typeof s0, l: number): [number, number, number] => {
      const c = Math.max(-s.halfWidth, Math.min(s.halfWidth, l));
      return [s.x + s.rx * c, s.y + dy + c * Math.tan(s.bank), s.z + s.rz * c];
    };
    gb.quad(...p(s0, la), ...p(s0, lb), ...p(s1, lb), ...p(s1, la), color);
  }

  // ------------------------------------------------------------------ 路面

  private buildSurfaces(): void {
    const byKind = new Map<SurfaceKind, GeometryBuilder>();
    for (const z of this.system.surfaces) {
      if (z.kind === 'road') continue;
      let gb = byKind.get(z.kind);
      if (!gb) {
        gb = new GeometryBuilder();
        byKind.set(z.kind, gb);
      }
      const props = gimmickConfig.surfaces[z.kind];
      const c = new THREE.Color(props.color);
      const c2 = c.clone().multiplyScalar(0.92);
      for (const i of this.samplesIn(z)) {
        const smp = this.track.sample(i);
        const la = Math.max(-smp.halfWidth, z.latMin);
        const lb = Math.min(smp.halfWidth, z.latMax);
        if (lb <= la) continue;
        this.stripAt(gb, i, la, lb, z.kind === 'glass' ? 0 : 0.012, Math.floor(i / 3) % 2 === 0 ? c : c2);
      }
    }
    for (const [kind, gb] of byKind) {
      const props = surfaceProps(kind);
      const mat = this.bag.add(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1 - props.shine * 0.9,
          metalness: props.shine * 0.35,
          transparent: props.transparent === true || kind === 'water',
          opacity: props.transparent ? 0.38 : kind === 'water' ? 0.82 : 1,
          side: props.transparent ? THREE.DoubleSide : THREE.FrontSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          // ガラスは少し光る、磁力道路は青く光る
          emissive: new THREE.Color(kind === 'glass' ? 0x2a6a88 : kind === 'magnet' ? 0x1a3aff : 0x000000),
        }),
      );
      const mesh = new THREE.Mesh(this.bag.add(gb.build()), mat);
      mesh.receiveShadow = true;
      mesh.renderOrder = props.transparent ? 2 : 0;
      this.group.add(mesh);
    }
  }

  // ------------------------------------------------------------------ ブーストパッド

  private buildBoostPads(): void {
    // 加速ゲート (kind 'gate') は GimmickExtrasView が描く
    const pads = this.system.pads.filter((p) => p.kind === 'pad');
    if (pads.length === 0) return;
    const tex = this.bag.add(makeChevronTexture('#ff2d95', '#ffd23f'));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.scrollTextures.push({ tex, speed: 2.5 });
    const mat = this.bag.add(
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    );
    for (const pad of pads) {
      const geo = this.bag.add(new THREE.PlaneGeometry(pad.halfWidth * 2, pad.halfLength * 2));
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      const p = this.track.worldAt(pad.s, pad.lateral);
      m.position.set(p.x, p.y + 0.05, p.z);
      m.rotation.set(0, Math.atan2(p.tx, p.tz), 0, 'YXZ');
      m.rotateOnAxis(new THREE.Vector3(0, 0, 1), -p.bank);
      this.group.add(m);
    }
  }

  // ------------------------------------------------------------------ ジャンプ台

  private buildJumps(): void {
    if (this.system.jumps.length === 0) return;
    const gb = new GeometryBuilder();
    const yellow = new THREE.Color(0xffd23f);
    const black = new THREE.Color(0x1a1a1a);
    for (const j of this.system.jumps) {
      const smp = this.track.pointAt(j.s);
      const hw = smp.halfWidth;
      const la = Math.max(-hw, j.latMin);
      const lb = Math.min(hw, j.latMax);
      // 傾いた板 (見た目のみ): 手前 0 → 奥 0.6m
      const steps = 6;
      for (let k = 0; k < steps; k++) {
        const s0 = j.s + (j.len * k) / steps;
        const s1 = j.s + (j.len * (k + 1)) / steps;
        const h0 = (0.6 * k) / steps;
        const h1 = (0.6 * (k + 1)) / steps;
        const a0 = this.track.worldAt(s0, la);
        const b0 = this.track.worldAt(s0, lb);
        const b1 = this.track.worldAt(s1, lb);
        const a1 = this.track.worldAt(s1, la);
        gb.quad(a0.x, a0.y + h0 + 0.02, a0.z, b0.x, b0.y + h0 + 0.02, b0.z, b1.x, b1.y + h1 + 0.02, b1.z, a1.x, a1.y + h1 + 0.02, a1.z, k % 2 === 0 ? yellow : black);
      }
    }
    const mesh = new THREE.Mesh(this.bag.add(gb.build()), this.bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    this.group.add(mesh);
  }

  // ------------------------------------------------------------------ コンベア

  private buildConveyors(): void {
    for (const c of this.system.conveyors) {
      const tex = this.bag.add(makeStripeTexture(c.speed >= 0 ? '#39f3ff' : '#ff6a3d'));
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      this.scrollTextures.push({ tex, speed: c.speed / 6 });
      const idx = this.samplesIn(c);
      const positions: number[] = [];
      const uvs: number[] = [];
      let v = 0;
      for (let k = 0; k < idx.length - 1; k++) {
        const s0 = this.track.sample(idx[k]!);
        const s1 = this.track.sample(idx[k]! + 1);
        if (s0.gap || s1.gap) continue;
        const la0 = Math.max(-s0.halfWidth, c.latMin);
        const lb0 = Math.min(s0.halfWidth, c.latMax);
        const p = (s: typeof s0, l: number): number[] => [s.x + s.rx * l, s.y + 0.03 + l * Math.tan(s.bank), s.z + s.rz * l];
        const q = [p(s0, la0), p(s0, lb0), p(s1, lb0), p(s1, la0)];
        const v1 = v + this.track.spacing / 6;
        positions.push(...q[0]!, ...q[1]!, ...q[2]!, ...q[0]!, ...q[2]!, ...q[3]!);
        uvs.push(0, v, 1, v, 1, v1, 0, v, 1, v1, 0, v1);
        v = v1;
      }
      const geo = this.bag.add(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.computeVertexNormals();
      const mat = this.bag.add(
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      );
      this.group.add(new THREE.Mesh(geo, mat));
    }
  }

  // ------------------------------------------------------------------ 横風

  private buildWinds(): void {
    this.system.winds.forEach((w, zi) => {
      const mat = this.bag.add(
        new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
      );
      this.windArrows.push({ mat, zone: zi });
      const gb = new GeometryBuilder();
      const dir = Math.sign(w.force) || 1;
      for (let d = 4; d < w.len; d += 14) {
        const s = w.s + d;
        const smp = this.track.pointAt(s);
        for (const lat0 of [-smp.halfWidth * 0.5, smp.halfWidth * 0.3]) {
          // 矢印 (風の向き = 右が正)
          const tip = this.track.worldAt(s, lat0 + dir * 3);
          const l = this.track.worldAt(s - 1.4, lat0);
          const r = this.track.worldAt(s + 1.4, lat0);
          gb.tri(l.x, l.y + 0.06, l.z, tip.x, tip.y + 0.06, tip.z, r.x, r.y + 0.06, r.z, 0xffffff);
        }
      }
      const mesh = new THREE.Mesh(this.bag.add(gb.build()), mat);
      this.group.add(mesh);
      if (w.style === 'windsock') {
        this.buildWindsocks(w, zi);
        return;
      }
      // 扇風機 (風上側の道路脇)
      const mid = this.track.pointAt(w.s + w.len / 2);
      const side = -dir;
      const fanPos = this.track.worldAt(w.s + w.len / 2, side * (mid.halfWidth + 9));
      const fan = new THREE.Group();
      const pole = new THREE.Mesh(this.bag.add(new THREE.CylinderGeometry(0.6, 1.2, 12, 8)), this.bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e8f0 })));
      pole.position.y = 6;
      const hub = new THREE.Group();
      hub.position.y = 12;
      const bladeGeo = this.bag.add(new THREE.BoxGeometry(0.5, 7, 1.4));
      bladeGeo.translate(0, 3.8, 0);
      const bladeMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x5ab0ff }));
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(bladeGeo, bladeMat);
        b.rotation.x = (k * Math.PI) / 2;
        hub.add(b);
      }
      // 羽根の回転軸を道路の横方向へ向ける
      fan.add(pole, hub);
      fan.position.set(fanPos.x, fanPos.y, fanPos.z);
      fan.rotation.y = Math.atan2(mid.tx, mid.tz);
      hub.userData.zone = zi;
      this.fans.push(hub);
      this.group.add(fan);
    });
  }

  /** 吹き流し (屋外の風)。風が吹くと風下へ伸び、止むとしぼむ */
  private buildWindsocks(w: WindZone, zi: number): void {
    const poleGeo = this.bag.add(new THREE.CylinderGeometry(0.12, 0.16, 6, 6));
    poleGeo.translate(0, 3, 0);
    const poleMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    const sockGeo = this.bag.add(new THREE.CylinderGeometry(0.25, 0.7, 3.2, 8, 1, true));
    // 付け根 (太い側) を原点に、+Z (風下) へ伸びる形にする
    sockGeo.translate(0, -1.6, 0);
    sockGeo.rotateX(-Math.PI / 2);
    const sockMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0xff6a1f, side: THREE.DoubleSide }));
    for (let d = 10; d < w.len; d += 45) {
      const mid = this.track.pointAt(w.s + d);
      const side = d % 90 < 45 ? -1 : 1;
      const p = this.track.worldAt(w.s + d, side * (mid.halfWidth + 3.5));
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      g.add(new THREE.Mesh(poleGeo, poleMat));
      const sock = new THREE.Mesh(sockGeo, sockMat);
      sock.position.y = 5.8;
      // 風の向き (道路の右方向 × 符号) を向く
      sock.rotation.y = Math.atan2(mid.tx, mid.tz) + (w.force >= 0 ? -Math.PI / 2 : Math.PI / 2);
      sock.userData.zone = zi;
      g.add(sock);
      this.windsocks.push(sock);
      this.group.add(g);
    }
  }

  // ------------------------------------------------------------------ 障害物

  private buildObstacles(): void {
    const colorFor: Record<string, number> = {
      gate: 0xff3b3b,
      piston: 0x9aa0aa,
      train: 0x2b6cff,
      spinner: 0xffd23f,
      log: 0x6b4a2b,
      pillar: 0x9a948a,
      block: 0x3ddc84,
      rock: 0x6a5a4a,
      crate: 0xc98a3c,
      turnstile: 0xff7a1a,
      cart: 0x3a8fe8,
      divider: 0xe8e8e8,
    };
    for (const o of this.system.obstacles) {
      const root = new THREE.Group();
      let lamp: THREE.MeshBasicMaterial | null = null;
      let bar: THREE.Object3D | null = null;
      let shadow: THREE.Mesh | null = null;
      let body: THREE.Object3D | null = null;
      const color = colorFor[o.style] ?? 0xffffff;
      const mat = this.bag.add(new THREE.MeshLambertMaterial({ color, emissive: o.style === 'gate' ? 0x220000 : 0x000000 }));
      if (o.style === 'log') {
        const geo = this.bag.add(new THREE.CylinderGeometry(o.height / 2, o.height / 2, o.halfWidth * 2, 8));
        geo.rotateZ(Math.PI / 2);
        const m = new THREE.Mesh(geo, mat);
        m.position.y = o.height / 2;
        root.add(m);
      } else if (o.style === 'gate') {
        const geo = this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2, o.height, o.halfLength * 2));
        const m = new THREE.Mesh(geo, mat);
        m.position.y = o.height / 2;
        bar = m;
        root.add(m);
        // 閉まる予告ランプ
        lamp = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x331100 }));
        const lampGeo = this.bag.add(new THREE.SphereGeometry(0.5, 10, 8));
        for (const side of [-1, 1]) {
          const l = new THREE.Mesh(lampGeo, lamp);
          l.position.set(side * (o.halfWidth + 0.4), o.height + 1.2, 0);
          root.add(l);
        }
        const frameGeo = this.bag.add(new THREE.BoxGeometry(0.5, o.height + 1.6, 0.5));
        const frameMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x3a3634 }));
        for (const side of [-1, 1]) {
          const f = new THREE.Mesh(frameGeo, frameMat);
          f.position.set(side * (o.halfWidth + 0.4), (o.height + 1.6) / 2, 0);
          root.add(f);
        }
      } else if (o.style === 'train') {
        const carGeo = this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2 / 3 - 0.3, o.height, o.halfLength * 2));
        const colors = [0xe23b3b, 0x2b6cff, 0xffd23f];
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(carGeo, this.bag.add(new THREE.MeshLambertMaterial({ color: colors[k]! })));
          m.position.set(-o.halfWidth + (k + 0.5) * ((o.halfWidth * 2) / 3), o.height / 2 + 0.3, 0);
          root.add(m);
        }
        lamp = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x331100 }));
        const lampGeo = this.bag.add(new THREE.SphereGeometry(0.6, 10, 8));
        for (const side of [-1, 1]) {
          const l = new THREE.Mesh(lampGeo, lamp);
          // 警告ランプは道路脇 (障害物と一緒には動かない位置に置くため後で親を変える)
          l.userData.fixedLateral = side * (o.roadHalfWidth + 1.5);
          l.position.y = 3;
          root.add(l);
        }
      } else if (o.style === 'rock' || o.style === 'crate') {
        // 落下物 (岩・木箱)。落ちる前は道路に赤い影 (予告) を出す
        const geo = this.bag.add(
          o.style === 'rock' ? new THREE.DodecahedronGeometry(Math.max(o.halfWidth, o.halfLength), 0) : new THREE.BoxGeometry(o.halfWidth * 2, o.height, o.halfLength * 2),
        );
        const m = new THREE.Mesh(geo, mat);
        m.position.y = o.style === 'rock' ? Math.max(o.halfWidth, o.halfLength) * 0.7 : o.height / 2;
        const holder = new THREE.Group();
        holder.add(m);
        root.add(holder);
        body = holder;
        const ringGeo = this.bag.add(new THREE.RingGeometry(Math.max(o.halfWidth, o.halfLength) * 0.6, Math.max(o.halfWidth, o.halfLength) * 1.25, 24));
        ringGeo.rotateX(-Math.PI / 2);
        shadow = new THREE.Mesh(ringGeo, this.bag.add(new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.7, depthWrite: false })));
        shadow.position.y = 0.08;
        root.add(shadow);
      } else if (o.style === 'cart') {
        // 手荷物カートの列 (トラクター + カート3台に荷物)
        const n = 4;
        const w = (o.halfWidth * 2) / n;
        const colors = [0xffd23f, 0x3a8fe8, 0x3a8fe8, 0x3a8fe8];
        const luggage = [0xe23b3b, 0x3ddc84, 0xff8a3d, 0xb98cff];
        for (let k = 0; k < n; k++) {
          const cx = -o.halfWidth + (k + 0.5) * w;
          const cart = new THREE.Mesh(this.bag.add(new THREE.BoxGeometry(w - 0.4, 0.8, o.halfLength * 2)), this.bag.add(new THREE.MeshLambertMaterial({ color: colors[k]! })));
          cart.position.set(cx, 0.7, 0);
          root.add(cart);
          const load = new THREE.Mesh(this.bag.add(new THREE.BoxGeometry(w - 0.9, 0.9, o.halfLength * 1.5)), this.bag.add(new THREE.MeshLambertMaterial({ color: luggage[k]! })));
          load.position.set(cx, k === 0 ? 1.6 : 1.55, 0);
          root.add(load);
        }
        lamp = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x331100 }));
        const lampGeo = this.bag.add(new THREE.SphereGeometry(0.6, 10, 8));
        for (const side of [-1, 1]) {
          const l = new THREE.Mesh(lampGeo, lamp);
          l.userData.fixedLateral = side * (o.roadHalfWidth + 1.5);
          l.position.y = 3;
          root.add(l);
        }
      } else if (o.style === 'float') {
        // 文化祭のパレードの山車 (台車 + 大きなマスコットの顔 + 旗)
        const deck = new THREE.Mesh(this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2, 1.2, o.halfLength * 2)), this.bag.add(new THREE.MeshLambertMaterial({ color: 0xff4f79 })));
        deck.position.y = 0.9;
        root.add(deck);
        const skirt = new THREE.Mesh(this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2 + 0.1, 0.5, o.halfLength * 2 + 0.1)), this.bag.add(new THREE.MeshLambertMaterial({ color: 0xffd23f })));
        skirt.position.y = 1.4;
        root.add(skirt);
        const head = new THREE.Mesh(this.bag.add(new THREE.SphereGeometry(1.8, 14, 10)), this.bag.add(new THREE.MeshLambertMaterial({ color: 0xffe8c8 })));
        head.position.set(0, 3.4, 0);
        root.add(head);
        const eyeGeo = this.bag.add(new THREE.SphereGeometry(0.28, 8, 6));
        const eyeMat = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x111111 }));
        for (const side of [-1, 1]) {
          for (const face of [-1, 1]) {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(side * 0.6, 3.7, face * 1.65);
            root.add(eye);
          }
        }
        const flagMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x39a8ff, side: THREE.DoubleSide }));
        for (const side of [-1, 1]) {
          const pole = new THREE.Mesh(this.bag.add(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 5)), this.bag.add(new THREE.MeshLambertMaterial({ color: 0xffffff })));
          pole.position.set(side * (o.halfWidth - 0.5), 3.2, 0);
          const flag = new THREE.Mesh(this.bag.add(new THREE.PlaneGeometry(1.2, 0.8)), flagMat);
          flag.position.set(side * (o.halfWidth - 0.5) + 0.6, 4.5, 0);
          root.add(pole, flag);
        }
        lamp = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x331100 }));
        const lampGeo = this.bag.add(new THREE.SphereGeometry(0.6, 10, 8));
        for (const side of [-1, 1]) {
          const l = new THREE.Mesh(lampGeo, lamp);
          l.userData.fixedLateral = side * (o.roadHalfWidth + 1.5);
          l.position.y = 3;
          root.add(l);
        }
      } else if (o.style === 'reindeer') {
        // トナカイの群れ (横断する障害物の箱の中に3頭)
        const fur = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x8a6440 }));
        const light = this.bag.add(new THREE.MeshLambertMaterial({ color: 0xe8dcc8 }));
        const antlerMat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0xd8c8a0 }));
        const bodyGeo = this.bag.add(new THREE.BoxGeometry(1.1, 1, 2));
        const legGeo = this.bag.add(new THREE.BoxGeometry(0.2, 1.1, 0.2));
        const headGeo = this.bag.add(new THREE.BoxGeometry(0.6, 0.6, 0.9));
        const antlerGeo = this.bag.add(new THREE.BoxGeometry(0.9, 0.7, 0.12));
        const herd = new THREE.Group();
        const spots: [number, number][] = [[-o.halfWidth * 0.55, -0.8], [0.2, 0.9], [o.halfWidth * 0.55, -0.4]];
        for (const [lx, lz] of spots) {
          const deer = new THREE.Group();
          const body = new THREE.Mesh(bodyGeo, fur);
          body.position.y = 1.5;
          deer.add(body);
          for (const [x, z] of [[-0.35, -0.7], [0.35, -0.7], [-0.35, 0.7], [0.35, 0.7]] as const) {
            const leg = new THREE.Mesh(legGeo, fur);
            leg.position.set(x, 0.55, z);
            deer.add(leg);
          }
          const head = new THREE.Mesh(headGeo, light);
          head.position.set(0, 2.2, 1.2);
          deer.add(head);
          const antler = new THREE.Mesh(antlerGeo, antlerMat);
          antler.position.set(0, 2.8, 1.05);
          deer.add(antler);
          deer.position.set(lx, 0, lz);
          // 道路を横切る向き (ローカル X) を向く
          deer.rotation.y = Math.PI / 2;
          herd.add(deer);
        }
        root.add(herd);
        lamp = this.bag.add(new THREE.MeshBasicMaterial({ color: 0x331100 }));
        const lampGeo = this.bag.add(new THREE.SphereGeometry(0.6, 10, 8));
        for (const side of [-1, 1]) {
          const l = new THREE.Mesh(lampGeo, lamp);
          l.userData.fixedLateral = side * (o.roadHalfWidth + 1.5);
          l.position.y = 3;
          root.add(l);
        }
      } else if (o.style === 'turnstile') {
        // 回転ゲート: 中央の柱 + 回る腕
        const postGeo = this.bag.add(new THREE.CylinderGeometry(0.6, 0.8, o.height + 1, 10));
        const post = new THREE.Mesh(postGeo, this.bag.add(new THREE.MeshLambertMaterial({ color: 0x3a3d46 })));
        post.position.y = (o.height + 1) / 2;
        root.add(post);
        const armGeo = this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2, 0.8, o.halfLength * 2));
        const arm = new THREE.Mesh(armGeo, mat);
        arm.position.y = o.height * 0.6;
        root.add(arm);
        const stripeGeo = this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2 + 0.05, 0.3, o.halfLength * 2 + 0.05));
        const stripe = new THREE.Mesh(stripeGeo, this.bag.add(new THREE.MeshBasicMaterial({ color: 0xffffff })));
        stripe.position.y = o.height * 0.6;
        root.add(stripe);
      } else {
        const geo = this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2, o.height, o.halfLength * 2));
        const m = new THREE.Mesh(geo, mat);
        m.position.y = o.height / 2;
        root.add(m);
        if (o.style === 'divider') {
          // 中央分離帯の上の反射材
          const topGeo = this.bag.add(new THREE.BoxGeometry(o.halfWidth * 2 + 0.05, 0.25, o.halfLength * 2 + 0.05));
          const top = new THREE.Mesh(topGeo, this.bag.add(new THREE.MeshBasicMaterial({ color: 0xffb21f })));
          top.position.y = o.height - 0.15;
          root.add(top);
        }
      }
      root.traverse((c) => {
        if (c instanceof THREE.Mesh && c !== shadow) c.castShadow = true;
      });
      this.group.add(root);
      this.obstacleVisuals.push({ obstacle: o, root, lamp, bar, shadow, body });
    }
  }

  // ------------------------------------------------------------------ シーソー

  private buildSeesaw(): void {
    if (this.system.seesaws.length === 0) return;
    const positions: number[] = [];
    const sIdx: number[] = [];
    for (const z of this.system.seesaws) {
      const idx = this.samplesIn(z);
      for (let k = 0; k < idx.length - 1; k++) {
        const s0 = this.track.sample(idx[k]!);
        const s1 = this.track.sample(idx[k]! + 1);
        const p = (s: typeof s0, l: number): number[] => [s.x + s.rx * l, s.y + 0.02, s.z + s.rz * l];
        const q = [p(s0, -s0.halfWidth), p(s0, s0.halfWidth), p(s1, s1.halfWidth), p(s1, -s1.halfWidth)];
        positions.push(...q[0]!, ...q[1]!, ...q[2]!, ...q[0]!, ...q[2]!, ...q[3]!);
        const sa = s0.s;
        const sb = s1.s;
        sIdx.push(sa, sa, sb, sa, sb, sb);
      }
    }
    const pos = new Float32Array(positions);
    const geo = this.bag.add(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.computeVertexNormals();
    const mat = this.bag.add(new THREE.MeshLambertMaterial({ color: 0x39b54a, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.seesaw = { mesh, positions: pos, base: pos.slice(), sIdx: new Float32Array(sIdx) };
  }

  // ------------------------------------------------------------------ トンネル

  private buildTunnels(): void {
    const styles: Record<TunnelStyle, { color: number; opacity: number; emissive: number }> = {
      glass: { color: 0x7fd8ff, opacity: 0.28, emissive: 0x0a3050 },
      rock: { color: 0x6a5a48, opacity: 1, emissive: 0x000000 },
      ice: { color: 0xbfe8ff, opacity: 0.55, emissive: 0x1a3a50 },
      neon: { color: 0x1a0a30, opacity: 0.85, emissive: 0x000000 },
      metal: { color: 0x5a5a62, opacity: 1, emissive: 0x100804 },
      city: { color: 0xb8b4a8, opacity: 1, emissive: 0x151410 },
      // 宇宙ステーションのチューブは大きな窓 (ガラス) で、外の地球が見える
      space: { color: 0xbfe0ff, opacity: 0.3, emissive: 0x0a1a30 },
      school: { color: 0xf2ecd8, opacity: 1, emissive: 0x141410 },
    };
    for (const t of this.system.tunnels) {
      const st = styles[t.style];
      const gb = new GeometryBuilder();
      const segs = 9;
      const idx = this.samplesIn(t);
      for (let k = 0; k < idx.length - 1; k++) {
        const s0 = this.track.sample(idx[k]!);
        const s1 = this.track.sample(idx[k]! + 1);
        if (s0.gap || s1.gap) continue;
        const arc = (s: typeof s0, a: number): [number, number, number] => {
          const r = s.halfWidth + 1.5;
          const l = -Math.cos(a) * r;
          const h = Math.sin(a) * t.height;
          return [s.x + s.rx * l, s.y + h + l * Math.tan(s.bank), s.z + s.rz * l];
        };
        const shadeK = k % 2 === 0 ? 1 : 0.9;
        for (let a = 0; a < segs; a++) {
          const a0 = (Math.PI * a) / segs;
          const a1 = (Math.PI * (a + 1)) / segs;
          const c = new THREE.Color(st.color).multiplyScalar(shadeK);
          gb.quad(...arc(s0, a0), ...arc(s1, a0), ...arc(s1, a1), ...arc(s0, a1), c);
        }
      }
      const mat = this.bag.add(
        new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
          transparent: st.opacity < 1,
          opacity: st.opacity,
          depthWrite: st.opacity >= 1,
          emissive: new THREE.Color(st.emissive),
        }),
      );
      const mesh = new THREE.Mesh(this.bag.add(gb.build()), mat);
      mesh.renderOrder = st.opacity < 1 ? 3 : 0;
      this.group.add(mesh);
      if (t.style === 'space' || t.style === 'school') this.buildTunnelFrames(t, idx, segs);
      if (t.style === 'neon') {
        // 光るリングを一定間隔で置く
        const rings = new GeometryBuilder();
        for (let k = 0; k < idx.length - 1; k += 6) {
          const s0 = this.track.sample(idx[k]!);
          for (let a = 0; a < segs; a++) {
            const a0 = (Math.PI * a) / segs;
            const a1 = (Math.PI * (a + 1)) / segs;
            const r = s0.halfWidth + 1.3;
            const pt = (ang: number, off: number): [number, number, number] => {
              const l = -Math.cos(ang) * r;
              const h = Math.sin(ang) * (t.height - 0.2);
              return [s0.x + s0.rx * l + s0.tx * off, s0.y + h, s0.z + s0.rz * l + s0.tz * off];
            };
            rings.quad(...pt(a0, -0.4), ...pt(a0, 0.4), ...pt(a1, 0.4), ...pt(a1, -0.4), a % 2 === 0 ? 0xff2d95 : 0x39f3ff);
          }
        }
        const rm = new THREE.Mesh(this.bag.add(rings.build()), this.bag.add(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
        this.group.add(rm);
      }
    }
  }

  /**
   * トンネルの骨組み: 宇宙ステーションは大きな窓の窓枠 (白)、学校の廊下は窓と掲示板 (色つき) を一定間隔で置く
   */
  private buildTunnelFrames(t: TunnelZone, idx: number[], segs: number): void {
    const gb = new GeometryBuilder();
    const school = t.style === 'school';
    for (let k = 0; k < idx.length - 1; k += school ? 4 : 5) {
      const s0 = this.track.sample(idx[k]!);
      for (let a = 0; a < segs; a++) {
        const a0 = (Math.PI * a) / segs;
        const a1 = (Math.PI * (a + 1)) / segs;
        const r = s0.halfWidth + 1.3;
        const pt = (ang: number, off: number): [number, number, number] => {
          const l = -Math.cos(ang) * r;
          const hh = Math.sin(ang) * (t.height - 0.15);
          return [s0.x + s0.rx * l + s0.tx * off, s0.y + hh + l * Math.tan(s0.bank), s0.z + s0.rz * l + s0.tz * off];
        };
        const color = school ? (a === 1 || a === segs - 2 ? 0x8ac8f0 : a % 3 === 0 ? 0xff8a8a : 0xd8c8a8) : 0xf4f6fa;
        gb.quad(...pt(a0, -0.35), ...pt(a0, 0.35), ...pt(a1, 0.35), ...pt(a1, -0.35), color);
      }
    }
    const mat = this.bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.group.add(new THREE.Mesh(this.bag.add(gb.build()), mat));
  }

  // ------------------------------------------------------------------ 更新

  update(dt: number): void {
    this.time += dt;
    this.extras.update(dt);
    for (const st of this.scrollTextures) {
      st.tex.offset.y = (st.tex.offset.y - st.speed * dt) % 1;
    }
    for (const v of this.obstacleVisuals) {
      const o = v.obstacle;
      const s = o.state;
      v.root.position.set(o.x, o.baseY, o.z);
      v.root.rotation.y = o.heading;
      if (v.bar) {
        // ゲート: 開くと上へ上がる
        v.bar.position.y = o.height / 2 + (1 - s.closed) * (o.height + 0.8);
      }
      if (v.body) {
        v.body.visible = s.shown;
        v.body.position.y = s.lift * gimmickConfig.drop.height;
        v.body.rotation.x = s.lift * 4;
      }
      if (v.shadow) {
        const blink = Math.floor(this.time * 8) % 2 === 0;
        v.shadow.visible = s.warn && (s.lift > 0.5 ? blink : true);
      }
      if (v.lamp) {
        const blink = Math.floor(this.time * 6) % 2 === 0;
        v.lamp.color.setHex(s.warn && blink ? 0xffe000 : s.active ? 0xff2020 : 0x331100);
      }
      // 列車・トナカイの警告ランプは道路脇に固定
      if (o.style === 'train' || o.style === 'reindeer' || o.style === 'cart' || o.style === 'float') {
        for (const c of v.root.children) {
          const fl = c.userData.fixedLateral as number | undefined;
          if (fl !== undefined) c.position.x = -(fl - s.lateral);
        }
      }
    }
    for (const w of this.windArrows) {
      const zone = this.system.winds[w.zone]!;
      const phase = this.system.windPhase(zone);
      const blink = Math.floor(this.time * 5) % 2 === 0;
      w.mat.opacity = phase === 'blow' ? 0.75 : phase === 'warn' ? (blink ? 0.6 : 0.15) : 0.12;
    }
    for (const sock of this.windsocks) {
      const phase = this.system.windPhase(this.system.winds[sock.userData.zone as number]!);
      const target = phase === 'blow' ? 1 : phase === 'warn' ? 0.55 : 0.25;
      // 伸び (長さ) と垂れ下がり
      sock.scale.z += (target - sock.scale.z) * Math.min(1, dt * 4);
      sock.rotation.x = (1 - sock.scale.z) * 0.9 + Math.sin(this.time * 9 + sock.id) * 0.04 * sock.scale.z;
    }
    for (const hub of this.fans) {
      const zone = this.system.winds[hub.userData.zone as number]!;
      const speed = this.system.windPhase(zone) === 'blow' ? 14 : this.system.windPhase(zone) === 'warn' ? 5 : 1;
      hub.rotation.z += speed * dt;
    }
    if (this.seesaw) {
      const { positions, base, sIdx, mesh } = this.seesaw;
      for (let k = 0; k < sIdx.length; k++) {
        positions[k * 3 + 1] = base[k * 3 + 1]! + this.system.heightOffsetAt(sIdx[k]!);
      }
      const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.bag.dispose();
  }
}

/** 山形 (>>>) の模様 */
function makeChevronTexture(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = a;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(8, 44);
    ctx.lineTo(32, 20);
    ctx.lineTo(56, 44);
    ctx.stroke();
    ctx.strokeStyle = b;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStripeTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
