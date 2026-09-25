/**
 * WIND FARM HILLS の背景: なだらかな緑の丘 (地形)・回る巨大な風車 (風力発電)・牧場の柵と羊・
 * 赤い納屋とサイロ・花畑・遠くの山並み。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { alongRoad, areaAround, centerOf, groundPlane, mountainRing, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 260;
const HUB_HEIGHT = 62;
const BLADE = 27;

export function buildWindfarmScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-windfarm';
  const env = track.def.environment;
  const rng = new SeededRandom(3300);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);

  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0x6ab84a,
    colorHigh: 0x5aa83e,
    colorRock: 0x8a9a6a,
    wallRise: 6,
    baseOffset: 0,
    noiseScale: 1.4,
    baseHeight: (x, z) => 14 + Math.sin(x * 0.011) * 9 + Math.cos(z * 0.013) * 8,
    palette: (y, steep) => (steep > 0.9 ? 0x8a9a6a : (Math.floor(y / 3) & 1) === 0 ? 0x6ab84a : 0x62b044),
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0x5aa83e })));
  group.add(mountainRing(bag, center, { count: 18, radius: 1700, height: [140, 300], width: [320, 520], color: 0x6a8aa0, snowCap: 0.2, y: env.groundLevel, seed: 77 }));

  // --- 風車 (道路から離れた丘の上。羽根の一番下も道路より十分高い) ---
  const towerGeo = bag.add(new THREE.CylinderGeometry(1.1, 2.2, HUB_HEIGHT, 10));
  towerGeo.translate(0, HUB_HEIGHT / 2, 0);
  const white = bag.add(new THREE.MeshLambertMaterial({ color: 0xf4f6f8 }));
  const nacelleGeo = bag.add(new THREE.BoxGeometry(3.4, 3.4, 8));
  const bladeGeo = bag.add(new THREE.BoxGeometry(1.6, BLADE, 0.4));
  bladeGeo.translate(0, BLADE / 2, 0);
  const hubs: THREE.Object3D[] = [];
  const area = areaAround(track, TERRAIN_MARGIN - 40);
  const turbineCount = Math.floor(22 * preset.sceneryDensity) + 6;
  const placed: { x: number; z: number }[] = [];
  const tryTurbine = (x: number, z: number): void => {
    if (!grid.isClear(x, z, 18) || placed.some((p) => Math.hypot(p.x - x, p.z - z) < 70)) return;
    const y = h(x, z);
    if (corridor.isNearRoad(x, y + HUB_HEIGHT, z, BLADE + 4, BLADE + 8)) return;
    placed.push({ x, z });
    const t = new THREE.Group();
    t.name = 'wind-turbine';
    t.add(new THREE.Mesh(towerGeo, white));
    const nacelle = new THREE.Mesh(nacelleGeo, white);
    nacelle.position.y = HUB_HEIGHT;
    t.add(nacelle);
    const hub = new THREE.Group();
    hub.position.set(0, HUB_HEIGHT, 4.4);
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.Mesh(bladeGeo, white);
      blade.rotation.z = (k * Math.PI * 2) / 3;
      hub.add(blade);
    }
    hub.rotation.z = rng.range(0, 6.28);
    hub.userData.speed = rng.range(0.6, 1);
    t.add(hub);
    t.position.set(x, y - 0.5, z);
    // 全部の風車が同じ向き (風上) を向く
    t.rotation.y = 0.6;
    group.add(t);
    hubs.push(hub);
  };
  // 尾根の道のそば (見せ場) に先に置く
  alongRoad(track, 60, 1, 34, (p) => tryTurbine(p.x, p.z), { from: 0.72, to: 0.92 });
  alongRoad(track, 60, -1, 34, (p) => tryTurbine(p.x, p.z), { from: 0.72, to: 0.92 });
  for (let tries = 0; hubs.length < turbineCount && tries < 800; tries++) {
    tryTurbine(rng.range(area.minX, area.maxX), rng.range(area.minZ, area.maxZ));
  }

  // --- 牧場の柵と羊 ---
  const fences: InstanceSpec[] = [];
  alongRoad(track, 4, 'both', 6.5, (p) => fences.push({ x: p.x, y: h(p.x, p.z) - 0.1, z: p.z, rotY: p.heading }), { from: 0.9, to: 1 });
  alongRoad(track, 4, 'both', 6.5, (p) => fences.push({ x: p.x, y: h(p.x, p.z) - 0.1, z: p.z, rotY: p.heading }), { from: 0, to: 0.12 });
  const fenceGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(0.2, 1.2, 0.2)), 0x8a6440).translate(0, 0.6, 0),
    paint(flatten(new THREE.BoxGeometry(0.12, 0.14, 4)), 0xa07850).translate(0, 0.9, 0),
    paint(flatten(new THREE.BoxGeometry(0.12, 0.14, 4)), 0xa07850).translate(0, 0.5, 0),
  ]);
  const fm = makeInstanced(fenceGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), fences, bag);
  if (fm) group.add(fm);
  const sheepGeo = mergeGeometries([
    paint(flatten(new THREE.IcosahedronGeometry(0.8, 0)), 0xf8f8f4).scale(1.3, 0.9, 1).translate(0, 1, 0),
    paint(flatten(new THREE.BoxGeometry(0.4, 0.45, 0.5)), 0x2a2a2a).translate(1.05, 1.2, 0),
  ]);
  const sheep: InstanceSpec[] = [];
  for (let tries = 0; sheep.length < 120 * preset.sceneryDensity && tries < 3000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 8)) continue;
    sheep.push({ x, y: h(x, z) - 0.2, z, rotY: rng.range(0, 6.28) });
  }
  const sm = makeInstanced(sheepGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), sheep, bag);
  if (sm) {
    sm.name = 'sheep';
    group.add(sm);
  }

  // --- 花畑 ---
  const flowers: InstanceSpec[] = [];
  for (let tries = 0; flowers.length < 900 * preset.sceneryDensity && tries < 9000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 3)) continue;
    flowers.push({ x, y: h(x, z) + 0.1, z, color: rng.pick([0xffd23f, 0xff6ab0, 0xffffff, 0xb98cff]) });
  }
  const flowerGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
  const flm = makeInstanced(flowerGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), flowers, bag);
  if (flm) group.add(flm);

  // --- 赤い納屋とサイロ (牧場) ---
  const bp = roadsidePoint(track, track.fracToS(0.97), -1, 30);
  const farm = new THREE.Group();
  farm.name = 'barn';
  const barn = new THREE.Mesh(bag.add(new THREE.BoxGeometry(16, 9, 22)), bag.add(new THREE.MeshLambertMaterial({ color: 0xb8322a })));
  barn.position.y = 4.5;
  const roof = new THREE.Mesh(bag.add(new THREE.ConeGeometry(12.5, 6, 4)), bag.add(new THREE.MeshLambertMaterial({ color: 0x4a4a52 })));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 1.5);
  roof.position.y = 12;
  const silo = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(3.4, 3.4, 18, 12)), bag.add(new THREE.MeshLambertMaterial({ color: 0xd8d8d0 })));
  silo.position.set(12, 9, 0);
  const dome = new THREE.Mesh(bag.add(new THREE.SphereGeometry(3.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), bag.add(new THREE.MeshLambertMaterial({ color: 0x8a8a92 })));
  dome.position.set(12, 18, 0);
  farm.add(barn, roof, silo, dome);
  farm.position.set(bp.x, h(bp.x, bp.z) - 0.3, bp.z);
  farm.rotation.y = bp.facingRoad;
  group.add(farm);

  const update = (dt: number): void => {
    for (const hub of hubs) hub.rotation.z += dt * (hub.userData.speed as number);
  };
  return { group, update };
}
