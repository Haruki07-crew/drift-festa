/**
 * TOKYO MIDNIGHT EXPRESS の背景: 夜の東京。
 * 摩天楼 (窓の発光)・ネオン看板・高速道路の街灯・東京湾・吊り橋 (主塔とケーブル)・
 * 観覧車・東京タワー (ゴール付近)・月。実際のライトは使わず発光マテリアルで夜景を作る。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import {
  alongRoad,
  areaAround,
  beamMatrix,
  beams,
  buildings,
  centerOf,
  groundPlane,
  groundTiles,
  makeSignTexture,
  roadsidePoint,
  streetLights,
} from './SceneryKit';
import { TrackProximityGrid, type SceneryResult } from './SceneryUtils';

/** 湾 (海) になっている区間 (周回上の割合)。トンネル〜吊り橋 */
const BAY_FROM = 0.3;
const BAY_TO = 0.6;
const BAY_RADIUS = 260;

export function buildTokyoScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-tokyo';
  const env = track.def.environment;
  const rng = new SeededRandom(1964);
  const grid = new TrackProximityGrid(track, 320, 8, 140);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);

  // 湾の判定: 湾の区間の道路から BAY_RADIUS 以内
  const baySamples = track.samples.filter((s, i) => i % 8 === 0 && s.s >= BAY_FROM * track.length && s.s <= BAY_TO * track.length);
  const inBay = (x: number, z: number): boolean => baySamples.some((s) => Math.hypot(s.x - x, s.z - z) < BAY_RADIUS);

  // --- 地面 (街) と 海 ---
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0x0b0b12 })));
  const land = groundTiles(track, bag, {
    cell: 20,
    margin: 320,
    top: 0,
    bottom: env.groundLevel,
    material: new THREE.MeshLambertMaterial({ color: 0x1a1a24 }),
    where: (x, z) => !inBay(x, z),
    limit: (x, z) => corridor.terrainLimit(x, z),
    name: 'city-ground',
  });
  if (land) group.add(land);
  const sea = groundTiles(track, bag, {
    cell: 20,
    margin: 320,
    top: -1,
    bottom: env.groundLevel,
    material: new THREE.MeshPhongMaterial({ color: 0x0a1838, emissive: 0x03081a, specular: 0x8a7aff, shininess: 90 }),
    where: (x, z) => inBay(x, z),
    limit: (x, z) => corridor.terrainLimit(x, z),
    name: 'bay',
  });
  if (sea) group.add(sea);

  // --- 摩天楼 (湾の外) ---
  const spots: { x: number; z: number }[] = [];
  const area = areaAround(track, 300);
  for (let k = 0; k < 4000; k++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!inBay(x, z) && grid.isClear(x, z, 14)) spots.push({ x, z });
  }
  group.add(
    buildings(bag, {
      count: Math.floor(520 * preset.sceneryDensity) + 60,
      spots,
      jitter: 4,
      height: [22, 140],
      width: [12, 26],
      night: true,
      baseColor: 0x252838,
      neonColors: [0xff2d95, 0x39f3ff, 0xffe45c, 0xb98cff, 0xff8a3d],
      windowColors: ['#ffe9a8', '#bfe8ff', '#ffffff', '#ffc8a0'],
      grid,
      clearance: 14,
      yAt: () => 0,
      seed: 7,
    }),
  );
  // 湾の向こう岸の街明かり (遠景)
  const farSpots: { x: number; z: number }[] = [];
  for (let k = 0; k < 400; k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(1700, 2300);
    farSpots.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r });
  }
  group.add(
    buildings(bag, {
      count: Math.floor(260 * preset.sceneryDensity) + 40,
      spots: farSpots,
      jitter: 30,
      height: [30, 180],
      width: [20, 40],
      night: true,
      baseColor: 0x1a1c2a,
      grid,
      clearance: 0,
      yAt: () => env.groundLevel,
      seed: 8,
    }),
  );

  // --- 高速道路の街灯 (オレンジのナトリウム灯) ---
  group.add(streetLights(track, bag, { spacing: 34, side: 'both', color: 0xffc070, height: 8.5, arm: 2.2 }));

  // --- ネオン看板 (道路沿いのビルの上) ---
  const words = ['TOKYO', 'DRIFT', 'FESTA', '首都高', 'NEON', 'SPEED', '夜景', 'GO!', 'EXPRESS', '東京'];
  const signColors = [
    ['#ff2d95', '#ffffff'],
    ['#39f3ff', '#0a0a1a'],
    ['#ffe45c', '#1a0a2a'],
    ['#b98cff', '#ffffff'],
  ];
  const signGeo = bag.add(new THREE.PlaneGeometry(16, 4));
  let signIndex = 0;
  alongRoad(track, 160, 'both', 16, (p, k) => {
    if (inBay(p.x, p.z) || k % 2 === 1) return;
    const [bg, fg] = signColors[signIndex % signColors.length]!;
    const tex = bag.add(makeSignTexture(words[signIndex % words.length]!, bg!, fg!));
    signIndex++;
    const m = new THREE.Mesh(signGeo, bag.add(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    m.position.set(p.x, p.y + 11, p.z);
    m.rotation.y = p.facingRoad;
    group.add(m);
  });

  // --- 吊り橋 (主塔2本 + メインケーブル + ハンガー) ---
  buildSuspensionBridge(track, bag, group);

  // --- 観覧車 (湾岸) ---
  const wheel = buildFerrisWheel(bag);
  const wp = roadsidePoint(track, track.length * 0.47, -1, 70);
  wheel.position.set(wp.x, 0, wp.z);
  wheel.rotation.y = wp.heading;
  group.add(wheel);

  // --- 東京タワー (ゴールの先) ---
  const tower = buildTower(bag);
  const tp = roadsidePoint(track, track.goalS - 40, 1, 55);
  tower.position.set(tp.x, 0, tp.z);
  group.add(tower);

  // --- 月 ---
  const moon = new THREE.Mesh(bag.add(new THREE.CircleGeometry(40, 24)), bag.add(new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false })));
  moon.position.set(center.x + 900, 420, center.z + 1400);
  moon.lookAt(center.x, 0, center.z);
  group.add(moon);

  let time = 0;
  const hub = wheel.getObjectByName('wheel-hub');
  const update = (dt: number): void => {
    time += dt;
    if (hub) hub.rotation.z = time * 0.08;
  };
  return { group, update };
}

/** 吊り橋: 橋の区間 (湾の後半) の両端に主塔、上にメインケーブルとハンガー */
function buildSuspensionBridge(track: Track, bag: ResourceBag, group: THREE.Group): void {
  const s0 = track.length * 0.475;
  const s1 = track.length * 0.575;
  const towerH = 58;
  const legs: THREE.Matrix4[] = [];
  const cables: THREE.Matrix4[] = [];
  const topPoint = (s: number, side: -1 | 1): THREE.Vector3 => {
    const p = roadsidePoint(track, s, side, 1.6);
    return new THREE.Vector3(p.x, p.y + towerH, p.z);
  };
  for (const s of [s0, s1]) {
    for (const side of [-1, 1] as const) {
      const p = roadsidePoint(track, s, side, 1.6);
      legs.push(beamMatrix(new THREE.Vector3(p.x, -1, p.z), new THREE.Vector3(p.x, p.y + towerH, p.z), 2.6));
    }
    // 主塔の横梁 (車の頭上高く)
    const l = topPoint(s, -1);
    const r = topPoint(s, 1);
    legs.push(beamMatrix(l.clone().setY(l.y - 18), r.clone().setY(r.y - 18), 2));
    legs.push(beamMatrix(l.clone().setY(l.y - 2), r.clone().setY(r.y - 2), 2));
  }
  // メインケーブル (放物線) とハンガー
  const steps = 24;
  for (const side of [-1, 1] as const) {
    let prev: THREE.Vector3 | null = null;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const s = s0 + (s1 - s0) * u;
      const p = roadsidePoint(track, s, side, 1.6);
      const sag = 4 * u * (1 - u);
      const y = p.y + towerH - sag * (towerH - 7);
      const cur = new THREE.Vector3(p.x, y, p.z);
      if (prev) cables.push(beamMatrix(prev, cur, 0.7));
      if (k > 0 && k < steps) cables.push(beamMatrix(new THREE.Vector3(p.x, p.y + 1.2, p.z), cur, 0.25));
      prev = cur;
    }
  }
  const legMesh = beams(bag, legs, new THREE.MeshLambertMaterial({ color: 0xd8dce8, emissive: 0x20242e }), 'bridge-towers');
  const cableMesh = beams(bag, cables, new THREE.MeshBasicMaterial({ color: 0xa8e8ff }), 'bridge-cables');
  if (legMesh) group.add(legMesh);
  if (cableMesh) group.add(cableMesh);
}

/** 観覧車 (輪がゆっくり回る) */
function buildFerrisWheel(bag: ResourceBag): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ferris-wheel';
  const r = 45;
  const legMat = bag.add(new THREE.MeshLambertMaterial({ color: 0x8a90a0 }));
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(0.8, 1.2, r + 6, 6)), legMat);
    leg.position.set(side * 3, (r + 6) / 2, 0);
    leg.rotation.z = side * 0.12;
    g.add(leg);
  }
  const hub = new THREE.Group();
  hub.name = 'wheel-hub';
  hub.position.y = r + 6;
  hub.rotation.y = Math.PI / 2;
  const ring = new THREE.Mesh(bag.add(new THREE.TorusGeometry(r, 0.7, 6, 48)), bag.add(new THREE.MeshBasicMaterial({ color: 0x39f3ff })));
  hub.add(ring);
  const spokeMat = bag.add(new THREE.MeshBasicMaterial({ color: 0xff9ad5 }));
  const spokeGeo = bag.add(new THREE.BoxGeometry(0.3, r * 2, 0.3));
  for (let k = 0; k < 8; k++) {
    const sp = new THREE.Mesh(spokeGeo, spokeMat);
    sp.rotation.z = (k / 8) * Math.PI;
    hub.add(sp);
  }
  const cabGeo = bag.add(new THREE.BoxGeometry(3, 3, 3));
  const cabColors = [0xffe45c, 0xff2d95, 0x39ff9e, 0xb98cff];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const cab = new THREE.Mesh(cabGeo, bag.add(new THREE.MeshBasicMaterial({ color: cabColors[k % cabColors.length]! })));
    cab.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    hub.add(cab);
  }
  g.add(hub);
  return g;
}

/** 東京タワー風の赤白の鉄塔 (格子状のフレーム + 展望台。夜はライトアップ) */
function buildTower(bag: ResourceBag): THREE.Group {
  const g = new THREE.Group();
  g.name = 'tower';
  const red = bag.add(new THREE.MeshBasicMaterial({ color: 0xff6a1f, wireframe: true }));
  const white = bag.add(new THREE.MeshBasicMaterial({ color: 0xfff0e0, wireframe: true }));
  const solid = bag.add(new THREE.MeshBasicMaterial({ color: 0xffe0b0 }));
  const legMat = bag.add(new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
  // 4本の脚 (下部は大きく開く)
  const legs: THREE.Matrix4[] = [];
  const base = 18;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    legs.push(beamMatrix(new THREE.Vector3(sx * base, 0, sz * base), new THREE.Vector3(sx * 6, 46, sz * 6), 1.4));
    legs.push(beamMatrix(new THREE.Vector3(sx * 6, 46, sz * 6), new THREE.Vector3(sx * 2.2, 110, sz * 2.2), 1));
  }
  const legMesh = beams(bag, legs, legMat);
  if (legMesh) g.add(legMesh);
  // 格子 (ワイヤーフレームの四角錐台を積む)
  const levels = 10;
  let y = 0;
  for (let k = 0; k < levels; k++) {
    const h = 11;
    const w0 = k < 4 ? base * 2 - k * 7 : Math.max(4, 12 - (k - 4) * 1.4);
    const w1 = k < 4 ? base * 2 - (k + 1) * 7 : Math.max(3.5, 12 - (k - 3) * 1.4);
    const geo = bag.add(new THREE.CylinderGeometry((w1 / 2) * Math.SQRT2, (w0 / 2) * Math.SQRT2, h, 4, 3, true));
    geo.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(geo, k % 2 === 0 ? red : white);
    m.position.y = y + h / 2;
    g.add(m);
    y += h;
  }
  // 展望台
  for (const [dy, w] of [[46, 15], [82, 8]] as const) {
    const deck = new THREE.Mesh(bag.add(new THREE.BoxGeometry(w, 4, w)), solid);
    deck.position.y = dy;
    g.add(deck);
  }
  const antenna = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(0.4, 0.9, 30, 6)), legMat);
  antenna.position.y = y + 15;
  g.add(antenna);
  return g;
}
