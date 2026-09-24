/**
 * Kage Touge の背景: 道に沿った山肌の地形 (壁側は岩肌がせり上がり、柵なし側は谷へ落ちる)・
 * 杉の木・岩・石灯籠・鳥居。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { buildTerrain } from './Terrain';
import { addBox } from './CircuitScenery';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec } from './SceneryUtils';

const TERRAIN_MARGIN = 230;
const TERRAIN_CELL = 7;

export function buildTougeScenery(track: Track, preset: QualityPreset, bag: ResourceBag): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scenery-touge';
  const env = track.def.environment;
  const rng = new SeededRandom(8801);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 120);
  const b = track.bounds;

  // --- 地形 (道に沿った山肌と谷) ---
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: TERRAIN_CELL,
    colorLow: env.groundColor,
    colorHigh: new THREE.Color(env.groundColor).multiplyScalar(0.8).getHex(),
    colorRock: 0x7a6e62,
    wallRise: 28,
    baseOffset: 8,
    noiseScale: 1,
  });
  group.add(terrain.mesh);
  const terrainHeight = terrain.heightAt;
  const minX = terrain.minX;
  const minZ = terrain.minZ;
  const grassDark = new THREE.Color(env.groundColor).multiplyScalar(0.8);

  // 外周の低地
  const outerGeo = bag.add(new THREE.PlaneGeometry(5000, 5000));
  outerGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(outerGeo, bag.add(new THREE.MeshLambertMaterial({ color: grassDark })));
  outer.position.set((b.minX + b.maxX) / 2, env.groundLevel - 3, (b.minZ + b.maxZ) / 2);
  group.add(outer);

  // --- 杉の木 ---
  const trunk = paint(flatten(new THREE.CylinderGeometry(0.25, 0.35, 2, 5)), 0x4a3322);
  trunk.translate(0, 1, 0);
  const cone1 = paint(flatten(new THREE.ConeGeometry(2.2, 4.5, 6)), 0x24472a);
  cone1.translate(0, 3.8, 0);
  const cone2 = paint(flatten(new THREE.ConeGeometry(1.6, 3.6, 6)), 0x2c5632);
  cone2.translate(0, 6.2, 0);
  const pineGeo = mergeGeometries([trunk, cone1, cone2]);
  const pines: InstanceSpec[] = [];
  const pineCount = Math.floor(900 * preset.sceneryDensity);
  const tints = [0xffffff, 0xd9e8d0, 0xc0d8b8, 0xe6f0d8];
  for (let tries = 0; pines.length < pineCount && tries < pineCount * 10; tries++) {
    const x = rng.range(minX + 10, minX + terrain.sizeX - 10);
    const z = rng.range(minZ + 10, minZ + terrain.sizeZ - 10);
    if (!grid.isClear(x, z, 5)) continue;
    const s = rng.range(0.9, 1.8);
    pines.push({ x, y: terrainHeight(x, z) - 0.3, z, sx: s, sy: s * rng.range(1, 1.5), sz: s, rotY: rng.range(0, 6.28), color: rng.pick(tints) });
  }
  const pineMesh = makeInstanced(pineGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), pines, bag, { castShadow: preset.shadows });
  if (pineMesh) group.add(pineMesh);

  // --- 岩 ---
  const rocks: InstanceSpec[] = [];
  for (let tries = 0; rocks.length < 120 * preset.sceneryDensity && tries < 2000; tries++) {
    const x = rng.range(b.minX - 80, b.maxX + 80);
    const z = rng.range(b.minZ - 80, b.maxZ + 80);
    if (!grid.isClear(x, z, 3)) continue;
    const s = rng.range(0.8, 3.2);
    rocks.push({ x, y: terrainHeight(x, z) - s * 0.3, z, sx: s * 1.3, sy: s, sz: s, rotY: rng.range(0, 6.28) });
  }
  const rockMesh = makeInstanced(flatten(new THREE.DodecahedronGeometry(1, 0)), new THREE.MeshLambertMaterial({ color: 0x8b8278 }), rocks, bag);
  if (rockMesh) group.add(rockMesh);

  // --- 石灯籠 (コーナー外側) と 鳥居 (頂上付近) ---
  const deco = new GeometryBuilder();
  let lastLantern = -100;
  for (const s of track.samples) {
    if (Math.abs(s.curvature) < 1 / 45 || s.s - lastLantern < 70) continue;
    lastLantern = s.s;
    const side = s.curvature > 0 ? 1 : -1; // カーブの外側
    const lateral = side * (s.halfWidth + 2.2);
    const x = s.x + s.rx * lateral;
    const z = s.z + s.rz * lateral;
    const y = s.y;
    const h = Math.atan2(s.tx, s.tz);
    addBox(deco, x, y, z, 0.9, 0.3, 0.9, h, 0x9a948a);
    addBox(deco, x, y + 0.3, z, 0.35, 1.0, 0.35, h, 0x9a948a);
    addBox(deco, x, y + 1.3, z, 0.8, 0.55, 0.8, h, 0xffd98a);
    addBox(deco, x, y + 1.85, z, 1.1, 0.25, 1.1, h, 0x857f75);
  }
  // 鳥居: 最も高い地点
  let top = track.samples[0]!;
  for (const s of track.samples) if (s.y > top.y) top = s;
  const th = Math.atan2(top.tx, top.tz);
  const tw = top.halfWidth + 1.5;
  for (const side of [-1, 1]) {
    addBox(deco, top.x + top.rx * tw * side, top.y, top.z + top.rz * tw * side, 0.7, 7.5, 0.7, th, 0xd8321f);
  }
  addBox(deco, top.x, top.y + 6.2, top.z, 0.6, 0.6, tw * 2 + 1, th, 0xd8321f);
  addBox(deco, top.x, top.y + 7.3, top.z, 0.9, 0.55, tw * 2 + 3.2, th, 0x1d1a18);
  const decoMesh = new THREE.Mesh(bag.add(deco.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x201008 })));
  decoMesh.castShadow = preset.shadows;
  group.add(decoMesh);

  return group;
}
