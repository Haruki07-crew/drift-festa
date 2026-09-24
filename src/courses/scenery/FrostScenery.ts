/**
 * FROSTBITE PASS の背景: 雪山の地形・雪をかぶった杉・氷の結晶・凍った湖面・降る雪。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { iceCrystal, snowPine } from './Props';
import { TrackProximityGrid, flatten, makeInstanced, scatter, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

export function buildFrostScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-frost';
  const env = track.def.environment;
  const rng = new SeededRandom(9119);
  const grid = new TrackProximityGrid(track, 230, 8, 120);
  const b = track.bounds;

  const terrain = buildTerrain(track, grid, bag, {
    margin: 230,
    cell: 7,
    colorLow: 0xf2f6fb,
    colorHigh: 0xe2eaf4,
    colorRock: 0x8a96a8,
    wallRise: 30,
    baseOffset: 6,
    noiseScale: 1.2,
  });
  group.add(terrain.mesh);
  const outerGeo = bag.add(new THREE.PlaneGeometry(5000, 5000));
  outerGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(outerGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0xe6eef8 })));
  outer.position.set((b.minX + b.maxX) / 2, env.groundLevel - 3, (b.minZ + b.maxZ) / 2);
  group.add(outer);

  const area = { minX: terrain.minX + 10, maxX: terrain.minX + terrain.sizeX - 10, minZ: terrain.minZ + 10, maxZ: terrain.minZ + terrain.sizeZ - 10 };
  const pines = scatter(grid, rng, Math.floor(700 * preset.sceneryDensity), area, 5, terrain.heightAt).map<InstanceSpec>((p) => {
    const s = rng.range(0.9, 1.9);
    return { ...p, y: p.y - 0.3, sx: s, sy: s * rng.range(1, 1.4), sz: s, rotY: rng.range(0, 6.28) };
  });
  const pineMesh = makeInstanced(snowPine(), new THREE.MeshLambertMaterial({ vertexColors: true }), pines, bag, { castShadow: preset.shadows });
  if (pineMesh) group.add(pineMesh);

  // 氷の結晶 (氷の洞窟・湖の周り)
  const icy = track.samples.filter((_, i) => i % 5 === 0).filter((smp) => smp.y < 12 || smp.y > 44);
  const crystals: InstanceSpec[] = [];
  for (const smp of icy) {
    if (rng.next() > 0.5) continue;
    const side = rng.next() < 0.5 ? -1 : 1;
    const lat = side * (smp.halfWidth + rng.range(3, 14));
    const x = smp.x + smp.rx * lat;
    const z = smp.z + smp.rz * lat;
    if (!grid.isClear(x, z, 1.5)) continue;
    const s = rng.range(0.7, 2.2);
    crystals.push({ x, y: terrain.heightAt(x, z) - 0.2, z, sx: s, sy: s * rng.range(0.8, 1.6), sz: s, rotY: rng.range(0, 6.28) });
  }
  const crystalMesh = makeInstanced(
    iceCrystal(),
    new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.3, emissive: 0x204060 }),
    crystals,
    bag,
  );
  if (crystalMesh) group.add(crystalMesh);

  // 岩
  const rocks = scatter(grid, rng, Math.floor(100 * preset.sceneryDensity), area, 3, terrain.heightAt).map<InstanceSpec>((p) => {
    const s = rng.range(1, 4);
    return { ...p, y: p.y - s * 0.3, sx: s * 1.3, sy: s, sz: s, rotY: rng.range(0, 6.28) };
  });
  const rockMesh = makeInstanced(flatten(new THREE.DodecahedronGeometry(1, 0)), new THREE.MeshLambertMaterial({ color: 0x8a96a8 }), rocks, bag);
  if (rockMesh) group.add(rockMesh);

  // --- 凍った湖面 (低い区間の周り) ---
  const low = track.samples.filter((smp) => smp.y < 6);
  if (low.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minY = Infinity;
    for (const smp of low) {
      minX = Math.min(minX, smp.x);
      maxX = Math.max(maxX, smp.x);
      minZ = Math.min(minZ, smp.z);
      maxZ = Math.max(maxZ, smp.z);
      minY = Math.min(minY, smp.y);
    }
    const lakeGeo = bag.add(new THREE.CircleGeometry(1, 32));
    lakeGeo.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lakeGeo, bag.add(new THREE.MeshStandardMaterial({ color: 0xbfe4ff, roughness: 0.05, metalness: 0.4, emissive: 0x16283a })));
    lake.position.set((minX + maxX) / 2, minY - 1.1, (minZ + maxZ) / 2);
    lake.scale.set((maxX - minX) / 2 + 70, 1, (maxZ - minZ) / 2 + 70);
    lake.receiveShadow = true;
    group.add(lake);
  }

  // --- 降る雪 ---
  const flakeCount = Math.floor(1200 * preset.sceneryDensity);
  const flakes = new Float32Array(flakeCount * 3);
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 80;
  for (let i = 0; i < flakeCount; i++) {
    flakes[i * 3] = cx + rng.range(-span, span);
    flakes[i * 3 + 1] = rng.range(0, 90);
    flakes[i * 3 + 2] = cz + rng.range(-span, span);
  }
  const flakeGeo = bag.add(new THREE.BufferGeometry());
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3).setUsage(THREE.DynamicDrawUsage));
  const snow = new THREE.Points(flakeGeo, bag.add(new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.85 })));
  snow.frustumCulled = false;
  group.add(snow);
  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    for (let i = 0; i < flakeCount; i++) {
      let y = flakes[i * 3 + 1]! - dt * 3;
      if (y < 0) y += 90;
      flakes[i * 3 + 1] = y;
      flakes[i * 3] = flakes[i * 3]! + Math.sin(time + i) * dt * 0.8;
    }
    (flakeGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };
  return { group, update: flakeCount > 0 ? update : undefined };
}
