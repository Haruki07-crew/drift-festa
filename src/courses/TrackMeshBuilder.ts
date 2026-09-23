/**
 * コース中心線 (Track) から路面・白線・縁石・ランオフ・壁・ガードレール・崖の側面を生成する。
 * 全て頂点カラーのローポリメッシュ。テクスチャ不要 (オフライン・軽量)。
 */
import * as THREE from 'three';
import type { EdgeType } from '../config/courses';
import { GeometryBuilder, shade } from '../render/GeometryBuilder';
import type { ResourceBag } from '../render/dispose';
import type { Track, TrackSample } from './Track';

const CURB_CURVATURE = 1 / 90;
const CURB_WIDTH = 0.9;
const CURB_SEGMENT = 3;
const LINE_WIDTH = 0.28;
const DASH_LENGTH = 6;
const GUARDRAIL_POST_SPACING = 4;

export interface TrackMeshes {
  group: THREE.Group;
  /** 衝突判定デバッグ等で使う壁の位置情報は Track 側にあるので、ここでは描画のみ */
}

export function buildTrackMeshes(track: Track, bag: ResourceBag): TrackMeshes {
  const env = track.def.environment;
  const group = new THREE.Group();
  group.name = 'track';

  const road = new GeometryBuilder();
  const deco = new GeometryBuilder();
  const walls = new GeometryBuilder();
  const n = track.samples.length;
  const wallH = track.def.wallHeight;
  const runoff = track.def.runoffWidth;
  const skirtBottom = env.groundLevel - 2;
  const guardrailPosts: THREE.Matrix4[] = [];

  const roadA = shade(env.roadColor, 1);
  const roadB = shade(env.roadColor, 1.06);
  const grassA = shade(env.groundColor, 1.12);
  const grassB = shade(env.groundColor, 1.02);
  const wallA = shade(env.wallColor, 1);
  const wallB = shade(env.wallColor, 0.9);
  const wallTop = shade(env.wallColor, 1.15);
  const skirt = shade(env.night ? 0x2a2c3a : 0x6b5a48, 1);
  const rail = new THREE.Color(0xc9ced6);
  const lineColor = new THREE.Color(env.lineColor);

  const at = (s: TrackSample, lateral: number, dy: number): [number, number, number] => [
    s.x + s.rx * lateral,
    s.y + dy,
    s.z + s.rz * lateral,
  ];

  /** サンプル i→i+1 の間に、横位置 a..b (a<b) の水平な帯を張る */
  const strip = (b: GeometryBuilder, i: number, la: number, lb: number, dy: number, color: THREE.Color, laNext = la, lbNext = lb): void => {
    const s0 = track.samples[i]!;
    const s1 = track.samples[(i + 1) % n]!;
    const p0 = at(s0, la, dy);
    const p1 = at(s0, lb, dy);
    const p2 = at(s1, lbNext, dy);
    const p3 = at(s1, laNext, dy);
    b.quad(...p0, ...p1, ...p2, ...p3, color);
  };

  /** サンプル i→i+1 の横位置 l に垂直な面 (y0..y1 は路面からの相対高さ) */
  const vertical = (b: GeometryBuilder, i: number, l: number, lNext: number, y0: number, y1: number, color: THREE.Color, absoluteBottom?: number): void => {
    const s0 = track.samples[i]!;
    const s1 = track.samples[(i + 1) % n]!;
    const b0 = at(s0, l, y0);
    const b1 = at(s1, lNext, y0);
    if (absoluteBottom !== undefined) {
      b0[1] = absoluteBottom;
      b1[1] = absoluteBottom;
    }
    const t1 = at(s1, lNext, y1);
    const t0 = at(s0, l, y1);
    b.quad(...b0, ...b1, ...t1, ...t0, color);
  };

  const outerExtent = (edge: EdgeType, hw: number): number => {
    switch (edge) {
      case 'wall':
      case 'guardrail':
        return hw + 0.6;
      case 'grass':
        return hw + runoff;
      case 'fall':
        return hw;
    }
  };

  for (let i = 0; i < n; i++) {
    const s0 = track.samples[i]!;
    const s1 = track.samples[(i + 1) % n]!;
    const hw0 = s0.halfWidth;
    const hw1 = s1.halfWidth;
    const band = Math.floor(s0.s / 8) % 2 === 0;

    // --- 路面 ---
    strip(road, i, -hw0, hw0, 0, band ? roadA : roadB, -hw1, hw1);

    // --- 路肩 (左右) ---
    for (const side of [-1, 1] as const) {
      const edge = side < 0 ? s0.left : s0.right;
      const outer0 = outerExtent(edge, hw0);
      const outer1 = outerExtent(edge, hw1);
      // 路面と壁の間の舗装 / ランオフ
      if (edge === 'grass') {
        const g = band ? grassA : grassB;
        if (side < 0) strip(road, i, -outer0, -hw0, -0.03, g, -outer1, -hw1);
        else strip(road, i, hw0, outer0, -0.03, g, hw1, outer1);
      } else if (edge === 'wall' || edge === 'guardrail') {
        if (side < 0) strip(road, i, -outer0, -hw0, 0, roadB, -outer1, -hw1);
        else strip(road, i, hw0, outer0, 0, roadB, hw1, outer1);
      }

      // 壁
      if (edge === 'wall' || edge === 'grass') {
        const l0 = side * outer0;
        const l1 = side * outer1;
        const panel = Math.floor(s0.s / 4) % 2 === 0 ? wallA : wallB;
        vertical(walls, i, l0, l1, -0.05, wallH, panel);
        const t0 = side * (outer0 + 0.5);
        const t1 = side * (outer1 + 0.5);
        if (side < 0) strip(walls, i, t0, l0, wallH, wallTop, t1, l1);
        else strip(walls, i, l0, t0, wallH, wallTop, l1, t1);
        vertical(walls, i, t0, t1, -0.05, wallH, wallB);
        // 外側の崖 (高低差のあるコース)
        if (s0.y - skirtBottom > 1.5) {
          vertical(walls, i, t0, t1, 0, 0, skirt, skirtBottom);
        }
      } else if (edge === 'guardrail') {
        const l0 = side * outer0;
        const l1 = side * outer1;
        vertical(walls, i, l0, l1, 0.42, 0.82, rail);
        if (Math.floor((s0.s + track.spacing) / GUARDRAIL_POST_SPACING) !== Math.floor(s0.s / GUARDRAIL_POST_SPACING)) {
          const p = at(s0, side * (outer0 + 0.05), 0);
          guardrailPosts.push(new THREE.Matrix4().makeTranslation(p[0], p[1] + 0.45, p[2]));
        }
        if (s0.y - skirtBottom > 0.5) {
          vertical(walls, i, l0, l1, 0, 0, skirt, skirtBottom);
        }
      } else if (edge === 'fall') {
        // 柵なし: 路面の縁から下へ崖
        const l0 = side * hw0;
        const l1 = side * hw1;
        vertical(walls, i, l0, l1, 0, 0, skirt, skirtBottom);
      }
    }

    // --- 縁石 (コーナーの両側) ---
    if (Math.abs(s0.curvature) > CURB_CURVATURE) {
      const red = Math.floor(s0.s / CURB_SEGMENT) % 2 === 0;
      const c = new THREE.Color(red ? env.curbColorA : env.curbColorB);
      strip(deco, i, -hw0, -hw0 + CURB_WIDTH, 0.03, c, -hw1, -hw1 + CURB_WIDTH);
      strip(deco, i, hw0 - CURB_WIDTH, hw0, 0.03, c, hw1 - CURB_WIDTH, hw1);
    }

    // --- 白線 (両端) ---
    const e0 = hw0 - CURB_WIDTH - 0.25;
    const e1 = hw1 - CURB_WIDTH - 0.25;
    strip(deco, i, -e0 - LINE_WIDTH, -e0, 0.02, lineColor, -e1 - LINE_WIDTH, -e1);
    strip(deco, i, e0, e0 + LINE_WIDTH, 0.02, lineColor, e1, e1 + LINE_WIDTH);
    // --- 中央の破線 ---
    if (Math.floor(s0.s / DASH_LENGTH) % 2 === 0) {
      strip(deco, i, -LINE_WIDTH / 2, LINE_WIDTH / 2, 0.02, lineColor);
    }
  }

  // --- スタート/ゴールライン (市松模様) ---
  const s0 = track.samples[0]!;
  const cols = 12;
  const rows = 3;
  const cell = (s0.halfWidth * 2) / cols;
  const depth = 1.1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = (r + c) % 2 === 0 ? 0xffffff : 0x111111;
      const la = -s0.halfWidth + c * cell;
      const lb = la + cell;
      const f0 = (r - rows / 2) * depth;
      const f1 = f0 + depth;
      const p = (l: number, f: number): [number, number, number] => [
        s0.x + s0.rx * l + s0.tx * f,
        s0.y + 0.035,
        s0.z + s0.rz * l + s0.tz * f,
      ];
      deco.quad(...p(la, f0), ...p(lb, f0), ...p(lb, f1), ...p(la, f1), color);
    }
  }

  const roadMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const decoMat = bag.add(
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      emissive: env.night ? new THREE.Color(0x222233) : new THREE.Color(0x000000),
    }),
  );
  const wallMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));

  const roadMesh = new THREE.Mesh(bag.add(road.build()), roadMat);
  roadMesh.receiveShadow = true;
  roadMesh.name = 'road';
  const decoMesh = new THREE.Mesh(bag.add(deco.build()), decoMat);
  decoMesh.receiveShadow = true;
  const wallMesh = new THREE.Mesh(bag.add(walls.build()), wallMat);
  wallMesh.receiveShadow = true;
  wallMesh.castShadow = true;
  group.add(roadMesh, decoMesh, wallMesh);

  if (guardrailPosts.length > 0) {
    const postGeo = bag.add(new THREE.BoxGeometry(0.14, 0.9, 0.14));
    const postMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xa8adb5 }));
    const posts = new THREE.InstancedMesh(postGeo, postMat, guardrailPosts.length);
    guardrailPosts.forEach((m, k) => posts.setMatrixAt(k, m));
    posts.instanceMatrix.needsUpdate = true;
    posts.computeBoundingSphere();
    group.add(posts);
  }

  return { group };
}
