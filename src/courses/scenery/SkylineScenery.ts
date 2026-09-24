/**
 * SKYLINE ZERO の背景: はるか下の地上から伸びる超高層ビル群・雲海・空に浮かぶ飛行船。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { airship } from './Props';
import { TrackProximityGrid, makeInstanced, makeWindowTexture, scatter, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildSkylineScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-skyline';
  const env = track.def.environment;
  const rng = new SeededRandom(7707);
  const grid = new TrackProximityGrid(track, 400, 10, 160);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // --- 地上 ---
  const groundGeo = bag.add(new THREE.PlaneGeometry(5000, 5000));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0x8a94a4 })));
  ground.position.set(cx, env.groundLevel, cz);
  group.add(ground);

  // --- 超高層ビル ---
  const winTex = bag.add(makeWindowTexture(rng, ['#bfe8ff', '#ffffff', '#ffe9c0'], 0.55, '#3a4a60'));
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: winTex, emissive: 0x223044, emissiveIntensity: 0.4 });
  const area = { minX: b.minX - 350, maxX: b.maxX + 350, minZ: b.minZ - 350, maxZ: b.maxZ + 350 };
  const specs: InstanceSpec[] = scatter(grid, rng, Math.floor(260 * preset.sceneryDensity) + 40, area, 14, () => env.groundLevel).map((p) => {
    const near = grid.clearanceAt(p.x, p.z) < 70;
    const h = near ? rng.range(70, 150) : rng.range(40, 200);
    const w = rng.range(14, 30);
    return { ...p, sx: w, sy: h, sz: w * rng.range(0.7, 1.3), rotY: rng.range(0, 0.5), color: [0xffffff, 0xd8e8ff, 0xfff0e0, 0xe0fff4][Math.floor(rng.next() * 4)]! };
  });
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMesh = makeInstanced(bGeo, mat, specs, bag);
  if (bMesh) group.add(bMesh);
  // 屋上のアンテナ・発光
  const tops: InstanceSpec[] = specs.filter((_, i) => i % 3 === 0).map((sp) => ({ x: sp.x, y: sp.y + (sp.sy ?? 0), z: sp.z, sx: 0.6, sy: 14, sz: 0.6, color: 0xff4f79 }));
  const tGeo = new THREE.BoxGeometry(1, 1, 1);
  tGeo.translate(0, 0.5, 0);
  const tMesh = makeInstanced(tGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), tops, bag);
  if (tMesh) group.add(tMesh);

  // --- 雲海 ---
  const clouds: InstanceSpec[] = [];
  for (let i = 0; i < 70 * preset.sceneryDensity + 20; i++) {
    const s = rng.range(25, 60);
    clouds.push({ x: rng.range(area.minX, area.maxX), y: rng.range(38, 58), z: rng.range(area.minZ, area.maxZ), sx: s * 2, sy: s * 0.35, sz: s, rotY: rng.range(0, 6.28) });
  }
  const cloudGeo = new THREE.IcosahedronGeometry(1, 1);
  const cloudMesh = makeInstanced(cloudGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8090a0, transparent: true, opacity: 0.85 }), clouds, bag);
  if (cloudMesh) group.add(cloudMesh);

  // --- 飛行船 ---
  const shipGeo = bag.add(airship());
  const shipMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const ships: { mesh: THREE.Mesh; r: number; a: number; y: number; speed: number }[] = [];
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(shipGeo, shipMat);
    m.scale.setScalar(rng.range(1.2, 2.2));
    group.add(m);
    ships.push({ mesh: m, r: rng.range(250, 480), a: rng.range(0, 6.28), y: rng.range(110, 170), speed: rng.range(0.012, 0.025) });
  }
  const update = (dt: number): void => {
    for (const sh of ships) {
      sh.a += sh.speed * dt;
      sh.mesh.position.set(cx + Math.cos(sh.a) * sh.r, sh.y, cz + Math.sin(sh.a) * sh.r);
      sh.mesh.rotation.y = -sh.a;
    }
  };
  update(0);
  return { group, update };
}
