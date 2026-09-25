/**
 * Circuit Aurora の背景: 芝生・木・グランドスタンド・スタートゲート・ピット・看板・雲。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec } from './SceneryUtils';

export function buildCircuitScenery(track: Track, preset: QualityPreset, bag: ResourceBag): THREE.Group {
  const group = new THREE.Group();
  group.name = 'scenery-circuit';
  const env = track.def.environment;
  const rng = new SeededRandom(2024);
  const grid = new TrackProximityGrid(track, 220);
  const b = track.bounds;

  // --- 地面 ---
  const groundGeo = bag.add(new THREE.PlaneGeometry(5000, 5000, 1, 1));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, bag.add(new THREE.MeshLambertMaterial({ color: env.groundColor })));
  ground.position.set((b.minX + b.maxX) / 2, env.groundLevel - 0.12, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // --- 木 ---
  const trunk = paint(flatten(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 5)), 0x6b4a2b);
  trunk.translate(0, 1.1, 0);
  const crown = paint(flatten(new THREE.IcosahedronGeometry(2.4, 0)), 0x3f8f3a);
  crown.translate(0, 4.2, 0);
  const treeGeo = mergeGeometries([trunk, crown]);
  const trees: InstanceSpec[] = [];
  const treeCount = Math.floor(420 * preset.sceneryDensity);
  const tint = [0xffffff, 0xd8f0c8, 0xbfe0a8, 0xe8ffd0, 0xa8d090];
  for (let tries = 0; trees.length < treeCount && tries < treeCount * 12; tries++) {
    const x = rng.range(b.minX - 200, b.maxX + 200);
    const z = rng.range(b.minZ - 200, b.maxZ + 200);
    if (!grid.isClear(x, z, 12)) continue;
    const s = rng.range(0.8, 1.6);
    trees.push({ x, y: env.groundLevel, z, sx: s, sy: s * rng.range(0.9, 1.3), sz: s, rotY: rng.range(0, 6.28), color: rng.pick(tint) });
  }
  const treeMesh = makeInstanced(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), trees, bag, { castShadow: preset.shadows });
  if (treeMesh) group.add(treeMesh);

  // --- グランドスタンド (メインストレート沿い) ---
  const stands = new GeometryBuilder();
  const seatColors = [0xe23b3b, 0x2b6cff, 0xffd21f, 0xf5f5f5];
  for (let s = track.length - 170; s < track.length + 90; s += 30) {
    const p = track.pointAt(s);
    const side = -1; // 左側
    const hw = p.halfWidth;
    const rx = -p.tz;
    const rz = p.tx;
    const base = hw + (track.def.runoffWidth > 0 ? track.def.runoffWidth : 0) + 5;
    for (let tier = 0; tier < 5; tier++) {
      const lateral = side * (base + tier * 2.2);
      const h = 1.2 + tier * 1.4;
      addBox(stands, p.x + rx * lateral, env.groundLevel, p.z + rz * lateral, 26, h, 2.2, Math.atan2(p.tx, p.tz), seatColors[(tier + Math.floor(s / 30)) % seatColors.length]!);
    }
    // 屋根
    const lr = side * (base + 5.5);
    addBox(stands, p.x + rx * lr, env.groundLevel + 9.5, p.z + rz * lr, 27, 0.5, 13, Math.atan2(p.tx, p.tz), 0xdfe3ea);
  }
  // ピットビル (右側)
  for (let s = 40; s < 200; s += 40) {
    const p = track.pointAt(s);
    const lateral = p.halfWidth + track.def.runoffWidth + 10;
    addBox(stands, p.x - p.tz * lateral, env.groundLevel, p.z + p.tx * lateral, 38, 7, 12, Math.atan2(p.tx, p.tz), 0xeef1f6);
    addBox(stands, p.x - p.tz * lateral, env.groundLevel + 7, p.z + p.tx * lateral, 38, 1.2, 12.5, Math.atan2(p.tx, p.tz), 0x2b6cff);
  }
  // スタートゲート
  const s0 = track.samples[0]!;
  const gateH = 8;
  // 支柱は芝のランオフ (走れる範囲) の外に立てる
  const gw = s0.halfWidth + track.def.runoffWidth + 1.2;
  const heading = Math.atan2(s0.tx, s0.tz);
  for (const side of [-1, 1]) {
    addBox(stands, s0.x + s0.rx * gw * side, s0.y, s0.z + s0.rz * gw * side, 1.2, gateH, 1.2, heading, 0x30343c);
  }
  addBox(stands, s0.x, s0.y + gateH, s0.z, 1.6, 2.2, gw * 2 + 1.2, heading, 0x1b1d22);
  const standMesh = new THREE.Mesh(bag.add(stands.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  standMesh.castShadow = preset.shadows;
  standMesh.receiveShadow = true;
  group.add(standMesh);

  // --- 看板 ---
  const boards: InstanceSpec[] = [];
  const boardColors = [0xff4f79, 0x2b86c5, 0xffc371, 0x3ddc84, 0xb98cff];
  for (let s = 60; s < track.length; s += 110) {
    const p = track.pointAt(s);
    const side = Math.floor(s / 110) % 2 === 0 ? 1 : -1;
    const lateral = side * (p.halfWidth + track.def.runoffWidth + 3.5);
    const x = p.x - p.tz * lateral;
    const z = p.z + p.tx * lateral;
    if (!grid.isClear(x, z, 1.5)) continue;
    boards.push({ x, y: env.groundLevel, z, rotY: Math.atan2(p.tx, p.tz) + Math.PI / 2, color: rng.pick(boardColors) });
  }
  const boardGeo = new THREE.BoxGeometry(10, 3, 0.4);
  boardGeo.translate(0, 2.4, 0);
  const boardMesh = makeInstanced(boardGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), boards, bag);
  if (boardMesh) group.add(boardMesh);

  // --- 雲 ---
  const clouds: InstanceSpec[] = [];
  const cloudCount = Math.floor(28 * preset.sceneryDensity) + 6;
  for (let i = 0; i < cloudCount; i++) {
    const s = rng.range(10, 26);
    clouds.push({
      x: rng.range(b.minX - 400, b.maxX + 400),
      y: rng.range(110, 170),
      z: rng.range(b.minZ - 400, b.maxZ + 400),
      sx: s * rng.range(1.5, 2.6),
      sy: s * 0.5,
      sz: s,
      rotY: rng.range(0, 6.28),
    });
  }
  const cloudGeo = flatten(new THREE.IcosahedronGeometry(1, 0));
  const cloudMesh = makeInstanced(
    cloudGeo,
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9aa6b8, fog: false }),
    clouds,
    bag,
  );
  if (cloudMesh) group.add(cloudMesh);

  return group;
}

/** 回転付きの箱を GeometryBuilder へ追加 (底面中心が x,y,z) */
export function addBox(
  gb: GeometryBuilder,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  rotY: number,
  color: number,
): void {
  // ローカル: 幅 = 進行方向 (z)、奥行き = 横方向 (x)
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const hw = depth / 2;
  const hl = width / 2;
  const corner = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  const p = [corner(-hw, -hl), corner(hw, -hl), corner(hw, hl), corner(-hw, hl)];
  const y0 = y;
  const y1 = y + height;
  const col = new THREE.Color(color);
  const top = col.clone().multiplyScalar(1.1);
  // 側面
  for (let i = 0; i < 4; i++) {
    const a = p[i]!;
    const bb = p[(i + 1) % 4]!;
    gb.quad(a[0], y0, a[1], a[0], y1, a[1], bb[0], y1, bb[1], bb[0], y0, bb[1], col);
  }
  // 上面
  gb.quad(p[0]![0], y1, p[0]![1], p[3]![0], y1, p[3]![1], p[2]![0], y1, p[2]![1], p[1]![0], y1, p[1]![1], top);
}
