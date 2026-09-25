/**
 * RAIN CITY の背景: 雨の夜の街。
 * 濡れて光る歩道と地面・窓の明かりのビル・ネオン看板・街灯・信号機・傘をさした人の列 (歩道)。
 * 雨の粒は Weather (environment.weather = rain) が描く。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { alongRoad, areaAround, buildings, centerOf, groundPlane, groundTiles, makeSignTexture, streetLights } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildRainScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-rain';
  const env = track.def.environment;
  const rng = new SeededRandom(1225);
  const grid = new TrackProximityGrid(track, 300, 8, 140);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);

  // --- 濡れた地面 (道路より低い所だけ) ---
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0x101218 })));
  // 道路の高さに合わせた歩道の段 (各所の道路の高さより少し下)
  const wet = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 0.15, metalness: 0.4 });
  const tiles = groundTiles(track, bag, {
    cell: 16,
    margin: 300,
    top: 9.5,
    bottom: env.groundLevel,
    material: wet,
    limit: (x, z) => corridor.terrainLimit(x, z),
    name: 'wet-ground',
  });
  if (tiles) group.add(tiles);
  const low = groundTiles(track, bag, {
    cell: 16,
    margin: 300,
    top: -0.8,
    bottom: env.groundLevel,
    material: wet.clone(),
    where: (x, z) => corridor.terrainLimit(x, z) < 9.5,
    limit: (x, z) => corridor.terrainLimit(x, z),
    name: 'wet-ground-low',
  });
  if (low) group.add(low);

  // --- ビル (窓の明かりとネオン) ---
  const spots: { x: number; z: number }[] = [];
  const area = areaAround(track, 280);
  for (let k = 0; k < 3000; k++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (grid.isClear(x, z, 14)) spots.push({ x, z });
  }
  group.add(
    buildings(bag, {
      count: Math.floor(380 * preset.sceneryDensity) + 50,
      spots,
      jitter: 4,
      height: [18, 110],
      width: [12, 24],
      night: true,
      baseColor: 0x20242e,
      neonColors: [0xff2d95, 0x39f3ff, 0xffe45c, 0x39ff9e],
      windowColors: ['#ffd89a', '#9ad8ff', '#ffffff'],
      grid,
      clearance: 14,
      yAt: (x, z) => Math.min(9.5, corridor.terrainLimit(x, z)),
      seed: 44,
    }),
  );

  // --- 街灯 (道路の両側) ---
  group.add(streetLights(track, bag, { spacing: 30, side: 'both', color: 0xfff0c8, height: 8, arm: 2 }));

  // --- ネオン看板 ---
  const words = ['RAIN', 'NEON', 'CAFE', 'HOTEL', 'BAR', 'ラーメン', 'KARAOKE', '24H', 'PIZZA', 'BOOKS'];
  const colors = [
    ['#ff2d95', '#ffffff'],
    ['#39f3ff', '#0a0a1a'],
    ['#ffe45c', '#1a0a2a'],
    ['#39ff9e', '#0a1a0a'],
  ];
  const signGeo = bag.add(new THREE.PlaneGeometry(10, 3));
  let k = 0;
  alongRoad(track, 55, 'both', 10, (p) => {
    if (corridor.isNearRoad(p.x, p.y + 8, p.z, 4, 6)) return;
    const [bg, fg] = colors[k % colors.length]!;
    const tex = bag.add(makeSignTexture(words[k % words.length]!, bg!, fg!));
    k++;
    const m = new THREE.Mesh(signGeo, bag.add(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    m.position.set(p.x, p.y + 9, p.z);
    m.rotation.y = p.facingRoad;
    group.add(m);
  });

  // --- 傘をさした人 (歩道) ---
  const personGeo = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(0.25, 0.3, 1.5, 6)), 0x2a2e3a).translate(0, 0.75, 0),
    paint(flatten(new THREE.SphereGeometry(0.22, 6, 5)), 0xe8c8a8).translate(0, 1.7, 0),
    paint(flatten(new THREE.ConeGeometry(0.9, 0.5, 8)), 0xffffff).translate(0, 2.3, 0),
  ]);
  const people: InstanceSpec[] = [];
  alongRoad(track, 14, 'both', 2.2, (p) => {
    if (rng.next() < 0.5 || corridor.isNearRoad(p.x, p.y + 1, p.z, 1, 3)) return;
    people.push({ x: p.x, y: p.y, z: p.z, rotY: rng.range(0, 6.28), color: rng.pick([0xff4f79, 0x39a8ff, 0xffd23f, 0xffffff, 0x3ddc84]) });
  });
  const pm = makeInstanced(personGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), people, bag);
  if (pm) {
    pm.name = 'pedestrians';
    group.add(pm);
  }

  // --- 雷 (時々空が光る) ---
  const flash = new THREE.Mesh(
    bag.add(new THREE.SphereGeometry(1400, 12, 8)),
    bag.add(new THREE.MeshBasicMaterial({ color: 0xc8d8ff, side: THREE.BackSide, transparent: true, opacity: 0, fog: false, depthWrite: false })),
  );
  flash.position.set(center.x, 0, center.z);
  flash.renderOrder = -8;
  group.add(flash);
  const flashMat = flash.material as THREE.MeshBasicMaterial;
  let time = 0;
  let nextFlash = 6;
  const update = (dt: number): void => {
    time += dt;
    nextFlash -= dt;
    if (nextFlash <= 0) {
      flashMat.opacity = 0.35;
      nextFlash = 7 + rng.range(0, 8);
    }
    flashMat.opacity = Math.max(0, flashMat.opacity - dt * 1.6);
  };
  return { group, update };
}
