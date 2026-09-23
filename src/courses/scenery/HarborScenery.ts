/**
 * Neo Harbor の背景: 夜の海・埋立地・発光する高層ビル・ネオン・街灯・コンテナ・クレーン・ネオンゲート。
 * 実際のライトは増やさず (重いので)、発光マテリアルで夜景を表現する。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { TrackProximityGrid, makeInstanced, type InstanceSpec } from './SceneryUtils';

const LAND_CELL = 24;

export function buildHarborScenery(track: Track, preset: QualityPreset, bag: ResourceBag): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scenery-harbor';
  const env = track.def.environment;
  const rng = new SeededRandom(31337);
  const grid = new TrackProximityGrid(track, 260, 8, 140);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // --- 海 ---
  const waterGeo = bag.add(new THREE.PlaneGeometry(6000, 6000));
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(
    waterGeo,
    bag.add(new THREE.MeshPhongMaterial({ color: 0x0b1c3d, emissive: 0x040a1c, specular: 0x6c5cff, shininess: 80 })),
  );
  water.position.set(cx, env.groundLevel, cz);
  water.receiveShadow = true;
  group.add(water);

  // 落下区間のサンプル (近くは海のまま残す)
  const fallPoints = track.samples.filter((s, i) => i % 4 === 0 && (s.left === 'fall' || s.right === 'fall'));
  const nearFall = (x: number, z: number): boolean => fallPoints.some((s) => Math.hypot(s.x - x, s.z - z) < 70);

  // --- 埋立地 (コースから離れた場所) ---
  const land: InstanceSpec[] = [];
  const landTops: { x: number; z: number }[] = [];
  for (let x = b.minX - 240; x < b.maxX + 240; x += LAND_CELL) {
    for (let z = b.minZ - 240; z < b.maxZ + 240; z += LAND_CELL) {
      if (!grid.isClear(x, z, 14) || nearFall(x, z)) continue;
      land.push({ x, y: env.groundLevel, z, sx: LAND_CELL, sy: -env.groundLevel - 0.6, sz: LAND_CELL });
      landTops.push({ x, z });
    }
  }
  const landGeo = new THREE.BoxGeometry(1, 1, 1);
  landGeo.translate(0, 0.5, 0);
  const landMesh = makeInstanced(landGeo, new THREE.MeshLambertMaterial({ color: 0x22232f }), land, bag, { receiveShadow: true });
  if (landMesh) group.add(landMesh);

  // --- 高層ビル (窓の発光テクスチャ) ---
  const windowTex = bag.add(makeWindowTexture(rng));
  const buildingMat = new THREE.MeshLambertMaterial({
    color: 0x2a2d40,
    emissive: 0xffffff,
    emissiveMap: windowTex,
    emissiveIntensity: 0.9,
  });
  const buildings: InstanceSpec[] = [];
  const neons: InstanceSpec[] = [];
  const neonColors = [0xff2d95, 0x39f3ff, 0xb98cff, 0xffe45c, 0x39ff9e];
  const buildingCount = Math.floor(260 * preset.sceneryDensity);
  const tints = [0xffffff, 0xd0e0ff, 0xffd8f0, 0xd8fff4, 0xfff0c8];
  for (let tries = 0; buildings.length < buildingCount && tries < buildingCount * 8 && landTops.length > 0; tries++) {
    const cell = rng.pick(landTops);
    const x = cell.x + rng.range(-LAND_CELL * 0.35, LAND_CELL * 0.35);
    const z = cell.z + rng.range(-LAND_CELL * 0.35, LAND_CELL * 0.35);
    if (!grid.isClear(x, z, 20)) continue;
    const distFromCenter = Math.hypot(x - cx, z - cz);
    const tall = distFromCenter > 250 ? rng.range(30, 110) : rng.range(12, 55);
    const w = rng.range(9, 16);
    const d = rng.range(9, 16);
    const rot = rng.range(0, 0.4);
    buildings.push({ x, y: -0.6, z, sx: w, sy: tall, sz: d, rotY: rot, color: rng.pick(tints) });
    if (rng.next() < 0.55) {
      neons.push({ x, y: tall - 0.6, z, sx: w + 0.4, sy: 0.7, sz: d + 0.4, rotY: rot, color: rng.pick(neonColors) });
    }
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMesh = makeInstanced(bGeo, buildingMat, buildings, bag);
  if (bMesh) group.add(bMesh);

  // --- 街灯・ネオンゲート ---
  const poles: InstanceSpec[] = [];
  const lamps: InstanceSpec[] = [];
  for (let s = 0; s < track.length; s += 28) {
    const p = track.pointAt(s);
    const side = Math.floor(s / 28) % 2 === 0 ? 1 : -1;
    const lateral = side * (p.halfWidth + 1.2);
    const x = p.x - p.tz * lateral;
    const z = p.z + p.tx * lateral;
    poles.push({ x, y: p.y, z, sx: 0.25, sy: 7, sz: 0.25 });
    lamps.push({ x: x + p.tz * side * 1.4, y: p.y + 7, z: z - p.tx * side * 1.4, sx: 2.6, sy: 0.25, sz: 0.7, rotY: Math.atan2(p.tx, p.tz), color: s % 56 === 0 ? 0x39f3ff : 0xff9ad5 });
  }
  // ネオンゲート (数カ所)
  for (const frac of [0.02, 0.24, 0.47, 0.68, 0.88]) {
    const s = track.length * frac;
    const p = track.pointAt(s);
    const h = Math.atan2(p.tx, p.tz);
    const gw = p.halfWidth + 1.5;
    const color = neonColors[Math.floor(frac * 10) % neonColors.length]!;
    for (const side of [-1, 1]) {
      lamps.push({ x: p.x - p.tz * gw * side, y: p.y, z: p.z + p.tx * gw * side, sx: 0.6, sy: 9, sz: 0.6, rotY: h, color });
    }
    lamps.push({ x: p.x, y: p.y + 9, z: p.z, sx: gw * 2 + 0.6, sy: 0.6, sz: 0.6, rotY: h, color });
  }
  const poleGeo = new THREE.BoxGeometry(1, 1, 1);
  poleGeo.translate(0, 0.5, 0);
  const poleMesh = makeInstanced(poleGeo, new THREE.MeshLambertMaterial({ color: 0x3a3d52 }), poles, bag);
  if (poleMesh) group.add(poleMesh);
  const neonGeo = new THREE.BoxGeometry(1, 1, 1);
  neonGeo.translate(0, 0.5, 0);
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lampMesh = makeInstanced(neonGeo, neonMat, [...lamps, ...neons], bag);
  if (lampMesh) group.add(lampMesh);

  // --- コンテナとクレーン (海沿いの埋立地) ---
  const containers: InstanceSpec[] = [];
  const containerColors = [0xd8452b, 0x2b6cd8, 0x2bb86b, 0xd8b02b, 0x8a2bd8];
  const edgeCells = landTops.filter((c) => !grid.isClear(c.x, c.z, 30));
  for (const cell of edgeCells) {
    if (rng.next() > 0.45 * preset.sceneryDensity + 0.15) continue;
    const stacks = rng.int(1, 3);
    const rot = rng.next() < 0.5 ? 0 : Math.PI / 2;
    for (let k = 0; k < stacks; k++) {
      containers.push({
        x: cell.x + rng.range(-6, 6),
        y: -0.6 + k * 2.6,
        z: cell.z + rng.range(-6, 6),
        sx: 2.4,
        sy: 2.6,
        sz: 12,
        rotY: rot,
        color: rng.pick(containerColors),
      });
    }
  }
  const cGeo = new THREE.BoxGeometry(1, 1, 1);
  cGeo.translate(0, 0.5, 0);
  const cMesh = makeInstanced(cGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), containers, bag);
  if (cMesh) group.add(cMesh);

  const cranes: InstanceSpec[] = [];
  for (let i = 0; i < 6 && edgeCells.length > 0; i++) {
    const c = rng.pick(edgeCells);
    const rot = rng.range(0, 6.28);
    cranes.push({ x: c.x, y: -0.6, z: c.z, sx: 1.5, sy: 34, sz: 1.5, rotY: rot, color: 0xffb300 });
    cranes.push({ x: c.x + Math.sin(rot) * 10, y: 33, z: c.z + Math.cos(rot) * 10, sx: 1.2, sy: 1.2, sz: 34, rotY: rot, color: 0xffb300 });
  }
  const craneGeo = new THREE.BoxGeometry(1, 1, 1);
  craneGeo.translate(0, 0.5, 0);
  const craneMesh = makeInstanced(craneGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x221100 }), cranes, bag);
  if (craneMesh) group.add(craneMesh);

  return group;
}

/** 窓明かりのテクスチャを実行時に生成 (外部画像不要) */
function makeWindowTexture(rng: SeededRandom): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 128);
    const colors = ['#ffe9a8', '#a8e8ff', '#ffb8e8', '#ffffff'];
    for (let y = 2; y < 128; y += 6) {
      for (let x = 2; x < 64; x += 6) {
        if (rng.next() < 0.42) {
          ctx.fillStyle = colors[Math.floor(rng.next() * colors.length)]!;
          ctx.globalAlpha = 0.5 + rng.next() * 0.5;
          ctx.fillRect(x, y, 3, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
