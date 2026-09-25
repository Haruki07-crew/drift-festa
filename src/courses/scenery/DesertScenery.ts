/**
 * DESERT CANYON RUN の背景: 地層の縞がある赤い渓谷 (地形)・サボテン・遠くのビュート (岩山)・
 * 干上がった川の底・岩のアーチ・ハイウェイ沿いの電柱・ゴールのガソリンスタンド。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { alongRoad, areaAround, beamMatrix, beams, bridgePiers, centerOf, groundPlane, makeSignTexture, roadsidePoint } from './SceneryKit';
import { palmTree } from './Props';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 250;
/** 地層の色 (高さごとの縞) */
const STRATA = [0xc8703a, 0xd98a4a, 0xb85a30, 0xe0a060, 0xc46a3c];

export function buildDesertScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-desert';
  const env = track.def.environment;
  const rng = new SeededRandom(6161);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);
  const center = centerOf(track);

  // 干上がった川 (ジャンプで飛び越える道路の切れ目の真下を流れていた)
  let riverS = track.length * 0.55;
  for (const smp of track.samples) {
    if (smp.gap) {
      riverS = smp.s;
      break;
    }
  }
  const river = track.pointAt(riverS + 7);
  // 川は道路と直交する向き
  const riverDist = (x: number, z: number): number => Math.abs((x - river.x) * river.tx + (z - river.z) * river.tz);
  const highwayZ = track.pointAt(track.fracToS(0.8)).z;
  // 石橋がかかる谷 (下りのS字の途中)
  const ravine = track.pointAt(track.fracToS(0.221));
  const ravineDist = (x: number, z: number): number => Math.hypot(x - ravine.x, z - ravine.z);

  // 高原 (渓谷の外) は高く、ハイウェイの先は平らな砂漠、川は深い溝
  const base = (x: number, z: number): number => {
    const plateau = 72;
    const flat = 10;
    const t = Math.max(0, Math.min(1, (z - (highwayZ - 60)) / 160));
    let hgt = plateau * (1 - t) + flat * t;
    const rv = Math.max(0, 1 - riverDist(x, z) / 60);
    hgt = hgt * (1 - rv) + -6 * rv;
    const rav = Math.max(0, 1 - ravineDist(x, z) / 70);
    hgt = hgt * (1 - rav) + -4 * rav;
    return hgt;
  };
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0xd9a86a,
    colorHigh: 0xc8903a,
    colorRock: 0xb85a30,
    wallRise: 34,
    baseOffset: 0,
    noiseScale: 1.1,
    baseHeight: base,
    palette: (y) => (y < 8 ? 0xe6c080 : STRATA[Math.floor(y / 7) % STRATA.length]!),
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0xe0b878 })));

  // --- 干上がった川の底 (ひび割れた泥) ---
  const bedGeo = bag.add(new THREE.PlaneGeometry(36, 900));
  bedGeo.rotateX(-Math.PI / 2);
  const bed = new THREE.Mesh(bedGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0xa88a60 })));
  bed.position.set(river.x, -5, river.z);
  bed.rotation.y = Math.atan2(river.tx, river.tz) + Math.PI / 2;
  bed.name = 'riverbed';
  group.add(bed);

  // --- サボテン ---
  const cactusGeo = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(0.5, 0.6, 6, 6)), 0x3f8a3a).translate(0, 3, 0),
    paint(flatten(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6)), 0x3f8a3a).translate(1.1, 3.4, 0),
    paint(flatten(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 6)), 0x3f8a3a).rotateZ(Math.PI / 2).translate(0.6, 2.4, 0),
    paint(flatten(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 6)), 0x4a9a42).translate(-1, 4, 0),
    paint(flatten(new THREE.CylinderGeometry(0.3, 0.3, 1, 6)), 0x4a9a42).rotateZ(Math.PI / 2).translate(-0.5, 3.2, 0),
  ]);
  const area = areaAround(track, TERRAIN_MARGIN - 20);
  const cacti: InstanceSpec[] = [];
  const cactusCount = Math.floor(360 * preset.sceneryDensity);
  for (let tries = 0; cacti.length < cactusCount && tries < cactusCount * 10; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 6)) continue;
    const s = rng.range(0.7, 1.4);
    cacti.push({ x, y: h(x, z) - 0.3, z, sx: s, sy: s * rng.range(0.9, 1.3), sz: s, rotY: rng.range(0, 6.28) });
  }
  const cm = makeInstanced(cactusGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), cacti, bag, { castShadow: preset.shadows });
  if (cm) {
    cm.name = 'cacti';
    group.add(cm);
  }
  // 岩
  const rocks: InstanceSpec[] = [];
  for (let tries = 0; rocks.length < 160 * preset.sceneryDensity && tries < 3000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 4)) continue;
    const s = rng.range(1, 4);
    rocks.push({ x, y: h(x, z) - s * 0.3, z, sx: s * 1.4, sy: s, sz: s * 1.1, rotY: rng.range(0, 6.28), color: rng.pick([0xffffff, 0xf0d8c0, 0xe0c0a0]) });
  }
  const rm = makeInstanced(flatten(new THREE.DodecahedronGeometry(1, 0)), new THREE.MeshLambertMaterial({ color: 0xb86a40 }), rocks, bag);
  if (rm) group.add(rm);

  // --- 遠くのビュート (平らな頂上の岩山) ---
  const butteGeo = new THREE.CylinderGeometry(1, 1.25, 1, 7);
  butteGeo.translate(0, 0.5, 0);
  const buttes: InstanceSpec[] = [];
  for (let k = 0; k < 18; k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(1300, 2200);
    const w = rng.range(60, 160);
    buttes.push({ x: center.x + Math.cos(a) * r, y: env.groundLevel, z: center.z + Math.sin(a) * r, sx: w, sy: rng.range(90, 220), sz: w * rng.range(0.6, 1.1), rotY: rng.range(0, 6.28) });
  }
  const bm = makeInstanced(flatten(butteGeo), new THREE.MeshLambertMaterial({ color: 0xc0643a }), buttes, bag);
  if (bm) group.add(bm);

  // --- 岩のアーチ (落石の渓谷の出口。車の頭上高く) ---
  const archS = track.fracToS(0.752);
  const arch = new THREE.Group();
  arch.name = 'rock-arch';
  const archMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xb8603a, flatShading: true }));
  // 柱の内側と輪の内側が走れる範囲 (安全帯) にかからないよう、半径に余裕を持たせる
  const tube = 3.5;
  const lp = roadsidePoint(track, archS, -1, tube * 2 + 1.5);
  const rp = roadsidePoint(track, archS, 1, tube * 2 + 1.5);
  const radius = Math.hypot(rp.x - lp.x, rp.z - lp.z) / 2;
  const archGeo = bag.add(new THREE.TorusGeometry(radius, tube, 6, 16, Math.PI));
  const archMesh = new THREE.Mesh(archGeo, archMat);
  archMesh.scale.set(1, 1.3, 1);
  arch.add(archMesh);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(bag.add(new THREE.BoxGeometry(tube * 2, 14, tube * 2)), archMat);
    leg.position.set(side * radius, -7, 0);
    arch.add(leg);
  }
  arch.position.set((lp.x + rp.x) / 2, Math.max(lp.y, rp.y), (lp.z + rp.z) / 2);
  // アーチの面 (ローカル X) を道路の横方向に向ける
  arch.rotation.y = lp.heading;
  group.add(arch);

  // --- 谷をまたぐ石橋 (橋脚と橋桁) ---
  group.add(bridgePiers(track, bag, { from: 0.205, to: 0.24, spacing: 16, bottom: -6, color: 0xc89060, archColor: 0xb87850 }));

  // --- オアシス (ハイウェイの脇の池とヤシとテント) ---
  const op = roadsidePoint(track, track.fracToS(0.88), -1, 45);
  const oasis = new THREE.Group();
  oasis.name = 'oasis';
  const pond = new THREE.Mesh(bag.add(new THREE.CircleGeometry(22, 28)), bag.add(new THREE.MeshPhongMaterial({ color: 0x2aa8c8, shininess: 90 })));
  pond.rotation.x = -Math.PI / 2;
  pond.position.y = 0.3;
  oasis.add(pond);
  const palmGeo = bag.add(palmTree());
  const palmMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const palm = new THREE.Mesh(palmGeo, palmMat);
    palm.position.set(Math.cos(a) * 26, 0, Math.sin(a) * 26);
    palm.scale.setScalar(1.2 + (k % 3) * 0.2);
    oasis.add(palm);
  }
  const tentMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xf0e0c0 }));
  for (const [tx, tz] of [[34, 10], [36, -8]] as const) {
    const tent = new THREE.Mesh(bag.add(new THREE.ConeGeometry(5, 5, 4)), tentMat);
    tent.position.set(tx, 2.5, tz);
    oasis.add(tent);
  }
  oasis.position.set(op.x, h(op.x, op.z), op.z);
  group.add(oasis);

  // --- ハイウェイの電柱と電線 ---
  const poles: THREE.Matrix4[] = [];
  const wires: THREE.Matrix4[] = [];
  let prevTop: THREE.Vector3 | null = null;
  alongRoad(
    track,
    40,
    1,
    6,
    (p) => {
      const base3 = new THREE.Vector3(p.x, h(p.x, p.z) - 0.5, p.z);
      const top = new THREE.Vector3(p.x, p.y + 9, p.z);
      poles.push(beamMatrix(base3, top, 0.35));
      if (prevTop) wires.push(beamMatrix(prevTop, top, 0.08));
      prevTop = top;
    },
    { from: 0.8, to: 1 },
  );
  const pm = beams(bag, poles, new THREE.MeshLambertMaterial({ color: 0x6a4a30 }), 'poles');
  const wm = beams(bag, wires, new THREE.MeshBasicMaterial({ color: 0x2a2a2a }), 'wires');
  if (pm) group.add(pm);
  if (wm) group.add(wm);

  // --- ゴールのガソリンスタンド ---
  const gp = roadsidePoint(track, track.goalS + 30, -1, 14);
  const station = new THREE.Group();
  station.name = 'gas-station';
  const canopy = new THREE.Mesh(bag.add(new THREE.BoxGeometry(22, 1, 14)), bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })));
  canopy.position.y = 6;
  const stripe = new THREE.Mesh(bag.add(new THREE.BoxGeometry(22.2, 0.5, 14.2)), bag.add(new THREE.MeshBasicMaterial({ color: 0xe23b3b })));
  stripe.position.y = 6.4;
  station.add(canopy, stripe);
  for (const [px, pz] of [[-9, -5], [9, -5], [-9, 5], [9, 5]] as const) {
    const col = new THREE.Mesh(bag.add(new THREE.BoxGeometry(0.6, 6, 0.6)), bag.add(new THREE.MeshLambertMaterial({ color: 0xcccccc })));
    col.position.set(px, 3, pz);
    station.add(col);
  }
  const shop = new THREE.Mesh(bag.add(new THREE.BoxGeometry(14, 5, 8)), bag.add(new THREE.MeshLambertMaterial({ color: 0xf4e8d0 })));
  shop.position.set(0, 2.5, -14);
  station.add(shop);
  const sign = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(10, 3)), bag.add(new THREE.MeshBasicMaterial({ map: bag.add(makeSignTexture('GAS', '#e23b3b', '#ffffff')), side: THREE.DoubleSide })));
  sign.position.set(0, 10, 7);
  station.add(sign);
  station.position.set(gp.x, h(gp.x, gp.z), gp.z);
  station.rotation.y = gp.facingRoad;
  group.add(station);

  return { group };
}
