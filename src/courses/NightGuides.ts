/**
 * 夜コースの視認性を上げる道路の誘導表示 (v3)。
 *
 * - カーブ外側の誘導灯 (発光ポスト): 暗くてもカーブの形が先まで分かる
 * - 急カーブの矢印看板 (シェブロン): 曲がる向きが一目で分かる
 * - 路肩の反射材: 直線でも道幅が分かる
 *
 * 実際のライトは増やさず発光マテリアルで表現する (GPU 負荷を増やさない)。
 * すべて走れる範囲 (Road Safety Corridor) の外側 = 壁の上・路肩の外に置く。
 */
import * as THREE from 'three';
import { nightVisibilityConfig } from '../config/graphics';
import type { ResourceBag } from '../render/dispose';
import { drivableExtent } from './RoadClearance';
import type { Track } from './Track';

export function buildNightGuides(track: Track, bag: ResourceBag): THREE.Group {
  const cfg = nightVisibilityConfig;
  const group = new THREE.Group();
  group.name = 'night-guides';
  // 走れる範囲の外に置くが、路肩ぎりぎりなので安全帯検査の対象外にする
  group.userData.clearanceExempt = true;
  const n = track.samples.length;
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);

  const guides: THREE.Matrix4[] = [];
  const chevrons: { matrix: THREE.Matrix4; left: boolean }[] = [];
  const reflectors: THREE.Matrix4[] = [];
  let lastGuide = -Infinity;
  let lastChevron = -Infinity;
  let lastReflector = -Infinity;

  /** 路肩の外側 (走れる範囲のすぐ外) の位置 */
  const outside = (i: number, side: number, extra: number): THREE.Vector3 => {
    const s = track.samples[i]!;
    const edge = side > 0 ? s.right : s.left;
    const lat = side * (drivableExtent(track, s, edge) + extra);
    const clamped = Math.max(-s.halfWidth, Math.min(s.halfWidth, lat));
    return pos.set(s.x + s.rx * lat, s.y + clamped * Math.tan(s.bank), s.z + s.rz * lat);
  };

  for (let i = 0; i < n; i++) {
    const s = track.samples[i]!;
    if (s.gap) continue;
    const k = s.curvature;
    const heading = Math.atan2(s.tx, s.tz);
    // 左カーブ (k > 0) の外側は右
    const outer = k > 0 ? 1 : -1;
    if (Math.abs(k) >= cfg.guideLights.minCurvature && s.s - lastGuide >= cfg.guideLights.spacing) {
      lastGuide = s.s;
      outside(i, outer, 0.35);
      q.setFromAxisAngle(up, heading);
      guides.push(new THREE.Matrix4().compose(pos.clone(), q.clone(), scl));
    }
    if (Math.abs(k) >= cfg.chevrons.minCurvature && s.s - lastChevron >= cfg.chevrons.spacing) {
      lastChevron = s.s;
      outside(i, outer, 0.6);
      pos.y += 1.2;
      // 看板は向かってくる車の方を向く
      q.setFromAxisAngle(up, heading + Math.PI);
      chevrons.push({ matrix: new THREE.Matrix4().compose(pos.clone(), q.clone(), scl), left: k > 0 });
    }
    if (s.s - lastReflector >= cfg.reflectors.spacing) {
      lastReflector = s.s;
      for (const side of [-1, 1]) {
        outside(i, side, 0.25);
        q.setFromAxisAngle(up, heading);
        reflectors.push(new THREE.Matrix4().compose(pos.clone(), q.clone(), scl));
      }
    }
  }

  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], name: string): void => {
    if (list.length === 0) return;
    bag.add(geo);
    bag.add(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mm, idx) => mesh.setMatrixAt(idx, mm));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = name;
    group.add(mesh);
  };

  const guideGeo = new THREE.BoxGeometry(0.4, cfg.guideLights.height, 0.4);
  guideGeo.translate(0, cfg.guideLights.height / 2, 0);
  instanced(guideGeo, new THREE.MeshBasicMaterial({ color: cfg.guideLights.color }), guides, 'guide-lights');

  const reflGeo = new THREE.BoxGeometry(0.18, 0.25, 0.5);
  reflGeo.translate(0, 0.95, 0);
  instanced(reflGeo, new THREE.MeshBasicMaterial({ color: cfg.reflectors.color }), reflectors, 'reflectors');

  // シェブロン看板: 左カーブ用と右カーブ用 (テクスチャを左右反転)
  for (const left of [true, false]) {
    const list = chevrons.filter((c) => c.left === left).map((c) => c.matrix);
    if (list.length === 0) continue;
    const tex = bag.add(makeChevronSign(left));
    const geo = new THREE.PlaneGeometry(1.6, 1.1);
    instanced(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), list, left ? 'chevrons-left' : 'chevrons-right');
    // 看板の支柱
    const postGeo = new THREE.BoxGeometry(0.12, 1.2, 0.12);
    postGeo.translate(0, -0.6, 0);
    instanced(postGeo, new THREE.MeshBasicMaterial({ color: 0x555555 }), list, 'chevron-posts');
  }
  return group;
}

/** 曲がる向きを示す矢印看板のテクスチャ (実行時生成) */
function makeChevronSign(left: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 44;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffb21f';
    ctx.fillRect(0, 0, 64, 44);
    ctx.fillStyle = '#111111';
    for (const off of [0, 22]) {
      ctx.beginPath();
      // 左カーブ: 左向きの矢印 (<)。看板は車の方を向くので見たまま
      if (left) {
        ctx.moveTo(18 + off, 4);
        ctx.lineTo(4 + off, 22);
        ctx.lineTo(18 + off, 40);
        ctx.lineTo(26 + off, 40);
        ctx.lineTo(12 + off, 22);
        ctx.lineTo(26 + off, 4);
      } else {
        ctx.moveTo(8 + off, 4);
        ctx.lineTo(22 + off, 22);
        ctx.lineTo(8 + off, 40);
        ctx.lineTo(16 + off, 40);
        ctx.lineTo(30 + off, 22);
        ctx.lineTo(16 + off, 4);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
