/**
 * JUNGLE TEMPLE RUN の背景: 密林の地形・広葉樹とヤシ・階段ピラミッドの神殿・巨大な古代像・
 * 崩れた石柱・川・滝 (分岐ルートの左側を流れ落ちる)・吊り橋のロープ。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { addBox } from './CircuitScenery';
import { broadleafTree, palmTree, ruinPillar, statue } from './Props';
import { TrackProximityGrid, makeInstanced, scatter, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

export function buildJungleScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-jungle';
  const env = track.def.environment;
  const rng = new SeededRandom(5150);
  const grid = new TrackProximityGrid(track, 220, 8, 120);
  const b = track.bounds;

  const terrain = buildTerrain(track, grid, bag, {
    margin: 220,
    cell: 7,
    colorLow: env.groundColor,
    colorHigh: 0x356a26,
    colorRock: 0x6a6252,
    wallRise: 24,
    baseOffset: 14,
    noiseScale: 0.9,
  });
  group.add(terrain.mesh);
  const outerGeo = bag.add(new THREE.PlaneGeometry(5000, 5000));
  outerGeo.rotateX(-Math.PI / 2);
  const outer = new THREE.Mesh(outerGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0x2f5a20 })));
  outer.position.set((b.minX + b.maxX) / 2, env.groundLevel - 3, (b.minZ + b.maxZ) / 2);
  group.add(outer);

  const area = { minX: terrain.minX + 10, maxX: terrain.minX + terrain.sizeX - 10, minZ: terrain.minZ + 10, maxZ: terrain.minZ + terrain.sizeZ - 10 };
  const tints = [0xffffff, 0xd8f0c0, 0xb8e0a0, 0xe8ffd8];
  const trees = scatter(grid, rng, Math.floor(800 * preset.sceneryDensity), area, 4, terrain.heightAt).map<InstanceSpec>((p) => {
    const s = rng.range(1, 2.2);
    return { ...p, y: p.y - 0.3, sx: s, sy: s * rng.range(0.9, 1.4), sz: s, rotY: rng.range(0, 6.28), color: rng.pick(tints) };
  });
  const treeMesh = makeInstanced(broadleafTree(), new THREE.MeshLambertMaterial({ vertexColors: true }), trees, bag, { castShadow: preset.shadows });
  if (treeMesh) group.add(treeMesh);
  const palms = scatter(grid, rng, Math.floor(260 * preset.sceneryDensity), area, 3, terrain.heightAt).map<InstanceSpec>((p) => {
    const s = rng.range(0.9, 1.5);
    return { ...p, y: p.y - 0.2, sx: s, sy: s, sz: s, rotY: rng.range(0, 6.28) };
  });
  const palmMesh = makeInstanced(palmTree(), new THREE.MeshLambertMaterial({ vertexColors: true }), palms, bag);
  if (palmMesh) group.add(palmMesh);

  // --- 崩れた石柱 (コース脇) ---
  const pillars: InstanceSpec[] = [];
  for (let s = 20; s < track.length; s += 55) {
    const p = track.pointAt(s);
    const side = Math.floor(s / 55) % 2 === 0 ? 1 : -1;
    const lat = side * (p.halfWidth + 3.5);
    const x = p.x - p.tz * lat;
    const z = p.z + p.tx * lat;
    if (!grid.isClear(x, z, 0.5)) continue;
    pillars.push({ x, y: terrain.heightAt(x, z) - 0.5, z, sx: 1, sy: rng.range(0.4, 1.1), sz: 1, rotY: rng.range(0, 6.28) });
  }
  const pillarMesh = makeInstanced(ruinPillar(), new THREE.MeshLambertMaterial({ vertexColors: true }), pillars, bag, { castShadow: preset.shadows });
  if (pillarMesh) group.add(pillarMesh);

  // --- 神殿 (階段ピラミッド) と巨大な像 ---
  const temple = new GeometryBuilder();
  const plaza = track.pointAt(track.length * 0.2);
  const pSide = 1;
  const tLat = pSide * (plaza.halfWidth + 45);
  const tx = plaza.x - plaza.tz * tLat;
  const tz = plaza.z + plaza.tx * tLat;
  const ty = terrain.heightAt(tx, tz) - 1;
  for (let k = 0; k < 7; k++) {
    const w = 46 - k * 6;
    addBox(temple, tx, ty + k * 4, tz, w, 4, w, 0, k % 2 === 0 ? 0x8a8672 : 0x9a967e);
  }
  addBox(temple, tx, ty + 28, tz, 8, 6, 8, 0, 0x6a6452);
  const templeMesh = new THREE.Mesh(bag.add(temple.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  templeMesh.castShadow = preset.shadows;
  group.add(templeMesh);
  const statueGeo = bag.add(statue());
  const statueMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  for (const frac of [0.05, 0.55]) {
    const p = track.pointAt(track.length * frac);
    const lat = -(p.halfWidth + 30);
    const x = p.x - p.tz * lat;
    const z = p.z + p.tx * lat;
    const m = new THREE.Mesh(statueGeo, statueMat);
    m.position.set(x, terrain.heightAt(x, z) - 1, z);
    m.rotation.y = Math.atan2(p.x - x, p.z - z);
    m.castShadow = preset.shadows;
    group.add(m);
  }

  // --- 川 (浅瀬を横切る) ---
  const riverAt = track.length * 0.315;
  const rp = track.pointAt(riverAt);
  const riverGeo = bag.add(new THREE.PlaneGeometry(22, 260));
  riverGeo.rotateX(-Math.PI / 2);
  const riverTex = bag.add(makeWaterTexture());
  riverTex.wrapS = THREE.RepeatWrapping;
  riverTex.wrapT = THREE.RepeatWrapping;
  riverTex.repeat.set(1, 10);
  const river = new THREE.Mesh(riverGeo, bag.add(new THREE.MeshBasicMaterial({ map: riverTex, transparent: true, opacity: 0.85 })));
  river.position.set(rp.x, rp.y - 0.35, rp.z);
  river.rotation.y = Math.atan2(rp.tx, rp.tz) + Math.PI / 2;
  group.add(river);

  // --- 滝 (分岐ルートの左レーンの外側) ---
  const fallTex = bag.add(makeWaterTexture());
  fallTex.wrapS = THREE.RepeatWrapping;
  fallTex.wrapT = THREE.RepeatWrapping;
  fallTex.repeat.set(3, 2);
  const fallMat = bag.add(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  const s0 = track.length * 0.805;
  const s1 = track.length * 0.84;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let s = s0; s < s1; s += 4) {
    const pa = track.pointAt(s);
    const lat = -(pa.halfWidth - 0.5);
    const a2 = track.worldAt(s, lat);
    const c2 = track.worldAt(s + 4, lat);
    const top = 16;
    const u0 = (s - s0) / 12;
    const u1 = (s + 4 - s0) / 12;
    positions.push(a2.x, a2.y, a2.z, c2.x, c2.y, c2.z, c2.x, c2.y + top, c2.z, a2.x, a2.y, a2.z, c2.x, c2.y + top, c2.z, a2.x, a2.y + top, a2.z);
    uvs.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
  }
  const fallGeo = bag.add(new THREE.BufferGeometry());
  fallGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  fallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const waterfall = new THREE.Mesh(fallGeo, fallMat);
  waterfall.renderOrder = 4;
  group.add(waterfall);
  // 滝の上の岩の張り出し
  const cliff = new GeometryBuilder();
  for (let s = s0; s < s1; s += 8) {
    const p = track.pointAt(s);
    const lat = -(p.halfWidth + 2);
    addBox(cliff, p.x - p.tz * lat, p.y + 15, p.z + p.tx * lat, 9, 4, 8, Math.atan2(p.tx, p.tz), 0x6a6252);
  }
  group.add(new THREE.Mesh(bag.add(cliff.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }))));

  // --- 吊り橋のロープと支柱 ---
  const bridge = new GeometryBuilder();
  for (let s = track.length * 0.56; s < track.length * 0.61; s += 6) {
    const p = track.pointAt(s);
    const h = Math.atan2(p.tx, p.tz);
    for (const side of [-1, 1]) {
      const lat = side * (p.halfWidth + 0.2);
      addBox(bridge, p.x - p.tz * lat, p.y, p.z + p.tx * lat, 0.3, 1.4, 0.3, h, 0x6b4a2b);
      addBox(bridge, p.x - p.tz * lat, p.y + 1.2, p.z + p.tx * lat, 6, 0.12, 0.12, h, 0xc8b080);
    }
  }
  group.add(new THREE.Mesh(bag.add(bridge.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }))));

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    fallTex.offset.y = (time * 1.2) % 1;
    riverTex.offset.y = (time * 0.3) % 1;
  };
  return { group, update };
}

function makeWaterTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#3a9ac8';
    ctx.fillRect(0, 0, 32, 64);
    ctx.fillStyle = '#dff6ff';
    for (let k = 0; k < 14; k++) ctx.fillRect((k * 7) % 32, (k * 13) % 64, 2, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
