/**
 * VOLCANO ISLAND の背景: 南の島 (地形)・煙を上げる火山と光る火口・斜面を流れる溶岩の川・
 * 砂浜とヤシの木・ジャングルの木・海と小舟。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { broadleafTree, palmTree } from './Props';
import { areaAround, groundPlane, makeRoundSprite } from './SceneryKit';
import { TrackProximityGrid, makeInstanced, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 260;
const SEA_LEVEL = 0;
/** 火山の中心と大きさ */
const PEAK = { x: 60, z: 30, height: 150, crater: 36 };
const ISLAND_RADIUS = 430;

export function buildVolcanoScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-volcano';
  const rng = new SeededRandom(5150);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);

  // 溶岩の川: 火口からジャンプ台の切れ目の下を通って海へ流れる
  let gapPoint = track.pointAt(track.fracToS(0.82));
  for (const smp of track.samples) {
    if (smp.gap) {
      gapPoint = track.pointAt(smp.s + 6);
      break;
    }
  }
  const riverDir = new THREE.Vector2(gapPoint.x - PEAK.x, gapPoint.z - PEAK.z).normalize();
  const riverDist = (x: number, z: number): number => {
    // 火口から溶岩の川の線までの距離 (火口より先の半直線)
    const dx = x - PEAK.x;
    const dz = z - PEAK.z;
    const along = dx * riverDir.x + dz * riverDir.y;
    if (along < PEAK.crater) return Infinity;
    return Math.abs(dx * -riverDir.y + dz * riverDir.x);
  };

  const island = (x: number, z: number): number => {
    const d = Math.hypot(x - PEAK.x, z - PEAK.z);
    let h = Math.max(0, PEAK.height - Math.max(0, d - PEAK.crater) * 0.62);
    if (d < PEAK.crater) h = PEAK.height - (PEAK.crater - d) * 0.9;
    const shore = Math.max(0, Math.min(1, (ISLAND_RADIUS - d) / 60));
    h = Math.max(h, 4) * shore + -14 * (1 - shore);
    // 溶岩の川の谷
    const r = riverDist(x, z);
    if (r < 16) h -= (1 - r / 16) * 7;
    return h;
  };
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0x5a8a3a,
    colorHigh: 0x4a7a32,
    colorRock: 0x4a403a,
    wallRise: 26,
    baseOffset: 0,
    noiseScale: 1,
    baseHeight: island,
    palette: (y, steep) => (steep > 1 ? 0x4a403a : y < SEA_LEVEL + 3.5 ? 0xe8d49a : y < 32 ? ((Math.floor(y / 4) & 1) === 0 ? 0x5a8a3a : 0x4e7e34) : y < 80 ? 0x5a4e48 : 0x3e3634),
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;
  const center = { x: PEAK.x, z: PEAK.z };

  // --- 海 ---
  group.add(groundPlane(bag, center, 9000, SEA_LEVEL, new THREE.MeshPhongMaterial({ color: 0x1a8ac0, emissive: 0x04203a, specular: 0xffffff, shininess: 70 })));

  // --- 火口 (光る溶岩) と煙 ---
  const craterGeo = bag.add(new THREE.CircleGeometry(PEAK.crater * 0.9, 24));
  craterGeo.rotateX(-Math.PI / 2);
  const crater = new THREE.Mesh(craterGeo, bag.add(new THREE.MeshBasicMaterial({ color: 0xff5a1a })));
  crater.position.set(PEAK.x, PEAK.height - PEAK.crater * 0.9 * 0.9 + 3, PEAK.z);
  crater.name = 'crater-lava';
  group.add(crater);
  const smokeCount = 320;
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeLife = new Float32Array(smokeCount);
  const resetSmoke = (i: number, life = rng.range(0, 1)): void => {
    smokePos[i * 3] = PEAK.x + rng.range(-12, 12);
    smokePos[i * 3 + 1] = PEAK.height + rng.range(0, 6);
    smokePos[i * 3 + 2] = PEAK.z + rng.range(-12, 12);
    smokeLife[i] = life;
  };
  for (let i = 0; i < smokeCount; i++) resetSmoke(i);
  const smokeGeo = bag.add(new THREE.BufferGeometry());
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3).setUsage(THREE.DynamicDrawUsage));
  const smoke = new THREE.Points(smokeGeo, bag.add(new THREE.PointsMaterial({ color: 0x5a5450, size: 30, map: bag.add(makeRoundSprite()), alphaTest: 0.05, transparent: true, opacity: 0.55, depthWrite: false })));
  smoke.frustumCulled = false;
  smoke.name = 'volcano-smoke';
  group.add(smoke);

  // --- 溶岩の川 (火口から海へ。光る帯) ---
  const lava = new THREE.Group();
  lava.name = 'lava-river';
  const lavaMat = bag.add(new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  const segs: THREE.Vector3[] = [];
  for (let d = PEAK.crater; d < ISLAND_RADIUS + 20; d += 12) {
    const x = PEAK.x + riverDir.x * d;
    const z = PEAK.z + riverDir.y * d;
    segs.push(new THREE.Vector3(x, h(x, z) + 0.4, z));
  }
  for (let k = 0; k + 1 < segs.length; k++) {
    const a = segs[k]!;
    const b = segs[k + 1]!;
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(bag.add(new THREE.BoxGeometry(10, 0.6, len + 0.5)), lavaMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    lava.add(m);
  }
  group.add(lava);

  // --- ヤシ (砂浜) とジャングルの木 (斜面の下の方) ---
  const area = areaAround(track, TERRAIN_MARGIN - 20);
  const palms: InstanceSpec[] = [];
  const trees: InstanceSpec[] = [];
  const count = Math.floor(900 * preset.sceneryDensity);
  for (let tries = 0; palms.length + trees.length < count && tries < count * 10; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 6) || riverDist(x, z) < 14) continue;
    const y = h(x, z);
    if (y < SEA_LEVEL + 0.6 || y > 40) continue;
    const s = rng.range(0.9, 1.6);
    const spec = { x, y: y - 0.2, z, sx: s, sy: s * rng.range(0.9, 1.3), sz: s, rotY: rng.range(0, 6.28) };
    (y < 8 ? palms : trees).push(spec);
  }
  const pm = makeInstanced(palmTree(), new THREE.MeshLambertMaterial({ vertexColors: true }), palms, bag, { castShadow: preset.shadows });
  const tm = makeInstanced(broadleafTree(0x5a3d24, 0x2f7a2a), new THREE.MeshLambertMaterial({ vertexColors: true }), trees, bag, { castShadow: preset.shadows });
  if (pm) group.add(pm);
  if (tm) group.add(tm);

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    for (let i = 0; i < smokeCount; i++) {
      smokeLife[i] = smokeLife[i]! + dt * 0.06;
      if (smokeLife[i]! > 1) resetSmoke(i, 0);
      smokePos[i * 3 + 1] = smokePos[i * 3 + 1]! + dt * 11;
      smokePos[i * 3] = smokePos[i * 3]! + dt * 3;
    }
    (smokeGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    lavaMat.color.setHSL(0.05, 1, 0.5 + 0.08 * Math.sin(time * 2));
  };
  return { group, update };
}
