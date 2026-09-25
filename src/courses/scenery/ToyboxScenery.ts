/**
 * TOYBOX MAYHEM の背景: ミニカー目線の巨大なおもちゃ部屋。木の床・壁・窓・机の天板と脚・
 * 巨大な積み木・本の山・鉛筆 (鉛筆の橋の下にも)・クレヨン・ボール。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { addBox } from './CircuitScenery';
import { pencil, toyBlock } from './Props';
import { TrackProximityGrid, landCells, makeInstanced, scatter, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildToyboxScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-toybox';
  const env = track.def.environment;
  const rng = new SeededRandom(3303);
  const grid = new TrackProximityGrid(track, 220, 8, 120);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 320;

  // --- 部屋 (床・壁・窓) ---
  const floorGeo = bag.add(new THREE.PlaneGeometry(span * 2, span * 2));
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0xb07a48 })));
  floor.position.set(cx, env.groundLevel, cz);
  group.add(floor);
  const room = new GeometryBuilder();
  const wallColors = [0xfff0d8, 0xe8f4ff, 0xfff0d8, 0xffe8f0];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const x = cx + Math.sin(a) * span;
    const z = cz + Math.cos(a) * span;
    addBox(room, x, env.groundLevel, z, span * 2, 320, 4, a + Math.PI / 2, wallColors[k]!);
  }
  const roomMesh = new THREE.Mesh(bag.add(room.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  group.add(roomMesh);
  const winGeo = bag.add(new THREE.PlaneGeometry(260, 150));
  const win = new THREE.Mesh(winGeo, bag.add(new THREE.MeshBasicMaterial({ color: 0xcfeeff, fog: false })));
  win.position.set(cx, env.groundLevel + 170, cz + span - 3);
  win.rotation.y = Math.PI;
  group.add(win);

  // --- 机の天板 (鉛筆の橋など落下区間の下は空ける) ---
  const fallPts = track.samples.filter((s, i) => i % 4 === 0 && (s.left === 'fall' || s.right === 'fall' || s.gap));
  const cells = landCells(track, grid, 20, 90, 6, fallPts, 45);
  const desk: InstanceSpec[] = cells.map((c) => ({ x: c.x, y: -2.6, z: c.z, sx: 20, sy: 2.1, sz: 20 }));
  const deskGeo = new THREE.BoxGeometry(1, 1, 1);
  deskGeo.translate(0, 0.5, 0);
  const deskMesh = makeInstanced(deskGeo, new THREE.MeshLambertMaterial({ color: 0xe8c48a }), desk, bag, { receiveShadow: true });
  if (deskMesh) group.add(deskMesh);
  // 机の脚
  const legs: InstanceSpec[] = cells.filter((_, i) => i % 9 === 0).map((c) => ({ x: c.x, y: env.groundLevel, z: c.z, sx: 3, sy: -env.groundLevel - 2.6, sz: 3 }));
  const legGeo = new THREE.BoxGeometry(1, 1, 1);
  legGeo.translate(0, 0.5, 0);
  const legMesh = makeInstanced(legGeo, new THREE.MeshLambertMaterial({ color: 0xa87a48 }), legs, bag);
  if (legMesh) group.add(legMesh);

  // --- 巨大な積み木 ---
  const area = { minX: b.minX - 60, maxX: b.maxX + 60, minZ: b.minZ - 60, maxZ: b.maxZ + 60 };
  const colors = [0xe23b3b, 0x2b86c5, 0xffd23f, 0x39b54a, 0xff7ac8, 0xff8a1a];
  const onDesk = (x: number, z: number): boolean => cells.some((c) => Math.abs(c.x - x) < 10 && Math.abs(c.z - z) < 10);
  const blocks = scatter(grid, rng, Math.floor(160 * preset.sceneryDensity) + 20, area, 3, () => -0.5)
    .filter((p) => onDesk(p.x, p.z))
    .map<InstanceSpec>((p) => {
      const s = rng.range(3, 8);
      return { ...p, sx: s, sy: s, sz: s, rotY: rng.range(0, 6.28), color: rng.pick(colors) };
    });
  const blockMesh = makeInstanced(toyBlock(0xffffff), new THREE.MeshLambertMaterial({ vertexColors: true }), blocks, bag, { castShadow: preset.shadows });
  if (blockMesh) group.add(blockMesh);

  // --- 本の山 ---
  const books: InstanceSpec[] = [];
  scatter(grid, rng, 30, area, 6, () => -0.5)
    .filter((p) => onDesk(p.x, p.z))
    .forEach((p) => {
      const stack = rng.int(2, 5);
      let y = p.y;
      for (let k = 0; k < stack; k++) {
        const h = rng.range(2, 3.5);
        books.push({ x: p.x + rng.range(-1, 1), y, z: p.z + rng.range(-1, 1), sx: rng.range(14, 20), sy: h, sz: rng.range(10, 14), rotY: rng.range(0, 6.28), color: rng.pick(colors) });
        y += h;
      }
    });
  // 高くなった区間の下に巨大な本を積む (本から本へのジャンプ台)
  // 本の上面が路面より上に出ないよう、本がかかる区間の一番低い路面に合わせる
  for (let i = 0; i < track.samples.length; i += 5) {
    const smp = track.samples[i]!;
    if (smp.y < 1.2 || smp.gap) continue;
    let minY = smp.y;
    for (let k = -3; k <= 3; k++) minY = Math.min(minY, track.sample(i + k).y);
    books.push({ x: smp.x, y: -0.5, z: smp.z, sx: smp.halfWidth * 2 + 3, sy: minY - 0.4 + 0.5, sz: 10, rotY: Math.atan2(smp.tx, smp.tz), color: colors[Math.floor(i / 40) % colors.length]! });
  }

  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  bookGeo.translate(0, 0.5, 0);
  const bookMesh = makeInstanced(bookGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), books, bag, { castShadow: preset.shadows });
  if (bookMesh) group.add(bookMesh);

  // --- 鉛筆 (転がっている物と、鉛筆の橋の下の巨大な鉛筆) ---
  const pencils: InstanceSpec[] = scatter(grid, rng, 16, area, 4, () => -0.5)
    .filter((p) => onDesk(p.x, p.z))
    .map((p) => ({ ...p, rotY: rng.range(0, 6.28), color: rng.pick([0xffc21a, 0x39b54a, 0x2b86c5, 0xe23b3b]) }));
  const bridgeSamples = track.samples.filter((s) => s.left === 'fall' && s.right === 'fall' && s.halfWidth < 6);
  if (bridgeSamples.length > 4) {
    const mid = bridgeSamples[Math.floor(bridgeSamples.length / 2)]!;
    const len = bridgeSamples.length * track.spacing;
    pencils.push({ x: mid.x, y: mid.y - 6.7, z: mid.z, sx: 3.2, sy: 3.2, sz: len / 34, rotY: Math.atan2(mid.tx, mid.tz), color: 0xffc21a });
  }
  const pencilMesh = makeInstanced(pencil(0xffffff), new THREE.MeshLambertMaterial({ vertexColors: true }), pencils, bag);
  if (pencilMesh) group.add(pencilMesh);

  // --- ボール (ゆっくり転がる) ---
  const ballGeo = bag.add(new THREE.IcosahedronGeometry(9, 1));
  const ballMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xff4f79, flatShading: true }));
  const ball = new THREE.Mesh(ballGeo, ballMat);
  const bp = cells[Math.floor(cells.length / 2)] ?? { x: cx, z: cz };
  ball.position.set(bp.x, 8.5, bp.z);
  ball.castShadow = preset.shadows;
  group.add(ball);

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    ball.rotation.x = time * 0.3;
    ball.rotation.z = Math.sin(time * 0.2) * 0.5;
  };
  return { group, update };
}
