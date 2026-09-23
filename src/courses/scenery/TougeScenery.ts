/**
 * Kage Touge の背景: 道に沿った山肌の地形 (壁側は岩肌がせり上がり、柵なし側は谷へ落ちる)・
 * 杉の木・岩・石灯籠・鳥居。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import { createProjection, type Track } from '../Track';
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

  // --- 地形の高さ関数 ---
  const proj = createProjection();
  const noise = (x: number, z: number): number =>
    Math.sin(x * 0.021) * Math.cos(z * 0.017) * 6 + Math.sin(x * 0.053 + z * 0.041) * 2.5;
  const heightAt = (x: number, z: number): number => {
    const hint = grid.nearestSample(x, z);
    const base = env.groundLevel + 8 + noise(x, z) * 2;
    if (hint === undefined) return base;
    const p = track.project(x, z, hint, proj);
    const d = Math.abs(p.lateral) - p.halfWidth;
    const edge = p.lateral >= 0 ? p.right : p.left;
    let h: number;
    if (d < 0.5) {
      h = p.cy - 1.2;
    } else if (edge === 'wall') {
      // 山側: 岩肌がせり上がる
      h = p.cy + Math.min(28, (d - 0.5) * 1.1) + noise(x, z) * 0.6;
    } else if (edge === 'fall') {
      // 谷側: 急に落ちる
      h = p.cy - 3 - (d - 0.5) * 2.2 + noise(x, z) * 0.4;
    } else {
      // ガードレール: なだらかに下る
      h = p.cy - 1.5 - (d - 0.5) * 0.7 + noise(x, z) * 0.5;
    }
    // 道から離れるほど基本地形へ
    const far = Math.min(1, Math.max(0, (d - 40) / 70));
    h = h * (1 - far) + base * far;
    return Math.max(env.groundLevel - 4, h);
  };

  // --- 地形メッシュ ---
  const minX = b.minX - TERRAIN_MARGIN;
  const minZ = b.minZ - TERRAIN_MARGIN;
  const cols = Math.ceil((b.maxX - b.minX + TERRAIN_MARGIN * 2) / TERRAIN_CELL);
  const rows = Math.ceil((b.maxZ - b.minZ + TERRAIN_MARGIN * 2) / TERRAIN_CELL);
  const heights = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      heights[j * (cols + 1) + i] = heightAt(minX + i * TERRAIN_CELL, minZ + j * TERRAIN_CELL);
    }
  }
  const terrain = new GeometryBuilder();
  const grass = new THREE.Color(env.groundColor);
  const grassDark = grass.clone().multiplyScalar(0.8);
  const rock = new THREE.Color(0x7a6e62);
  const tmp = new THREE.Color();
  const colorFor = (y0: number, y1: number, y2: number): THREE.Color => {
    const steep = Math.max(Math.abs(y1 - y0), Math.abs(y2 - y0)) / TERRAIN_CELL;
    tmp.copy(steep > 0.9 ? rock : (Math.floor(y0) & 1) === 0 ? grass : grassDark);
    return tmp;
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = minX + i * TERRAIN_CELL;
      const z0 = minZ + j * TERRAIN_CELL;
      const x1 = x0 + TERRAIN_CELL;
      const z1 = z0 + TERRAIN_CELL;
      const h00 = heights[j * (cols + 1) + i]!;
      const h10 = heights[j * (cols + 1) + i + 1]!;
      const h01 = heights[(j + 1) * (cols + 1) + i]!;
      const h11 = heights[(j + 1) * (cols + 1) + i + 1]!;
      // 上向きの面になるよう z+ 方向を考慮した順序
      terrain.tri(x0, h00, z0, x0, h01, z1, x1, h11, z1, colorFor(h00, h01, h11));
      terrain.tri(x0, h00, z0, x1, h11, z1, x1, h10, z0, colorFor(h00, h11, h10));
    }
  }
  const terrainMesh = new THREE.Mesh(bag.add(terrain.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  group.add(terrainMesh);

  const terrainHeight = (x: number, z: number): number => {
    const fi = (x - minX) / TERRAIN_CELL;
    const fj = (z - minZ) / TERRAIN_CELL;
    const i = Math.max(0, Math.min(cols - 1, Math.floor(fi)));
    const j = Math.max(0, Math.min(rows - 1, Math.floor(fj)));
    const u = fi - i;
    const v = fj - j;
    const h00 = heights[j * (cols + 1) + i]!;
    const h10 = heights[j * (cols + 1) + i + 1]!;
    const h01 = heights[(j + 1) * (cols + 1) + i]!;
    const h11 = heights[(j + 1) * (cols + 1) + i + 1]!;
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  };

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
    const x = rng.range(minX + 10, minX + cols * TERRAIN_CELL - 10);
    const z = rng.range(minZ + 10, minZ + rows * TERRAIN_CELL - 10);
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
