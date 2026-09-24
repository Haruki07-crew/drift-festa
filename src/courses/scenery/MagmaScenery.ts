/**
 * MAGMA FACTORY の背景: 煮えたぎる溶岩の海・工場の建屋・煙突・巨大パイプ・蒸気・火の粉。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { chimney } from './Props';
import { TrackProximityGrid, landCells, makeInstanced, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildMagmaScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-magma';
  const env = track.def.environment;
  const rng = new SeededRandom(6606);
  const grid = new TrackProximityGrid(track, 220, 8, 120);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // --- 溶岩 (発光・ゆっくり脈打つ) ---
  const lavaTex = bag.add(makeLavaTexture(rng));
  lavaTex.wrapS = THREE.RepeatWrapping;
  lavaTex.wrapT = THREE.RepeatWrapping;
  lavaTex.repeat.set(40, 40);
  const lavaMat = bag.add(new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xffffff }));
  const lavaGeo = bag.add(new THREE.PlaneGeometry(4000, 4000));
  lavaGeo.rotateX(-Math.PI / 2);
  const lava = new THREE.Mesh(lavaGeo, lavaMat);
  lava.position.set(cx, env.groundLevel, cz);
  group.add(lava);

  // --- 岩の足場 (落下区間の下は溶岩のまま) ---
  const fallPts = track.samples.filter((s, i) => i % 4 === 0 && (s.left === 'fall' || s.right === 'fall' || s.gap));
  const cells = landCells(track, grid, 22, 200, 10, fallPts, 60);
  const land: InstanceSpec[] = cells.map((c) => ({ x: c.x, y: env.groundLevel, z: c.z, sx: 22, sy: -env.groundLevel - 0.5, sz: 22, color: rng.next() < 0.5 ? 0x2a1c18 : 0x33221c }));
  const landGeo = new THREE.BoxGeometry(1, 1, 1);
  landGeo.translate(0, 0.5, 0);
  const landMesh = makeInstanced(landGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), land, bag, { receiveShadow: true });
  if (landMesh) group.add(landMesh);

  // --- 工場の建屋 ---
  const buildings: InstanceSpec[] = [];
  const chimneys: InstanceSpec[] = [];
  for (const c of cells) {
    if (rng.next() > 0.5 * preset.sceneryDensity + 0.1) continue;
    if (!grid.isClear(c.x, c.z, 18)) continue;
    const h = rng.range(10, 36);
    buildings.push({ x: c.x, y: -0.5, z: c.z, sx: rng.range(12, 20), sy: h, sz: rng.range(12, 20), rotY: rng.range(0, 0.3), color: [0x4a4240, 0x5a5048, 0x3a3634][Math.floor(rng.next() * 3)]! });
    if (rng.next() < 0.35) chimneys.push({ x: c.x + rng.range(-6, 6), y: -0.5, z: c.z + rng.range(-6, 6), sx: 1, sy: rng.range(0.8, 1.6), sz: 1 });
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMesh = makeInstanced(bGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1a0800 }), buildings, bag, { castShadow: preset.shadows });
  if (bMesh) group.add(bMesh);
  const cMesh = makeInstanced(chimney(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x100400 }), chimneys, bag);
  if (cMesh) group.add(cMesh);

  // --- 巨大パイプ (道路の上をまたぐ) ---
  const pipes: InstanceSpec[] = [];
  for (let s = 60; s < track.length; s += 150) {
    const p = track.pointAt(s);
    pipes.push({ x: p.x, y: p.y + 12, z: p.z, sx: 1, sy: 1, sz: 1, rotY: Math.atan2(p.tx, p.tz) + Math.PI / 2 });
  }
  const pipeGeo = new THREE.CylinderGeometry(1.4, 1.4, 60, 10);
  pipeGeo.rotateZ(Math.PI / 2);
  pipeGeo.rotateY(Math.PI / 2);
  const pipeMesh = makeInstanced(pipeGeo, new THREE.MeshLambertMaterial({ color: 0x8a5a3a, emissive: 0x200800 }), pipes, bag);
  if (pipeMesh) group.add(pipeMesh);

  // --- 蒸気 (脈打つ半透明の柱) ---
  const steamGeo = bag.add(new THREE.CylinderGeometry(2, 4, 1, 8, 1, true));
  steamGeo.translate(0, 0.5, 0);
  const steamMat = bag.add(new THREE.MeshBasicMaterial({ color: 0xffd8c0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  const steams: { mesh: THREE.Mesh; phase: number }[] = [];
  for (const c of chimneys.slice(0, 16)) {
    const m = new THREE.Mesh(steamGeo, steamMat);
    m.position.set(c.x, -0.5 + 30 * (c.sy ?? 1), c.z);
    group.add(m);
    steams.push({ mesh: m, phase: rng.range(0, 6.28) });
  }

  // --- 火の粉 (舞い上がる光の点) ---
  const emberCount = Math.floor(500 * preset.sceneryDensity);
  const embers = new Float32Array(emberCount * 3);
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 60;
  for (let i = 0; i < emberCount; i++) {
    embers[i * 3] = cx + rng.range(-span, span);
    embers[i * 3 + 1] = env.groundLevel + rng.range(0, 40);
    embers[i * 3 + 2] = cz + rng.range(-span, span);
  }
  const emberGeo = bag.add(new THREE.BufferGeometry());
  emberGeo.setAttribute('position', new THREE.BufferAttribute(embers, 3).setUsage(THREE.DynamicDrawUsage));
  const emberPts = new THREE.Points(emberGeo, bag.add(new THREE.PointsMaterial({ color: 0xffa040, size: 0.6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  emberPts.frustumCulled = false;
  group.add(emberPts);

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    lavaTex.offset.set(time * 0.01, time * 0.006);
    const pulse = 0.85 + Math.sin(time * 1.3) * 0.15;
    lavaMat.color.setRGB(pulse, pulse * 0.95, pulse * 0.9);
    for (const st of steams) {
      const k = (Math.sin(time * 1.5 + st.phase) + 1) / 2;
      st.mesh.scale.set(1 + k * 0.6, 8 + k * 14, 1 + k * 0.6);
    }
    for (let i = 0; i < emberCount; i++) {
      let y = embers[i * 3 + 1]! + dt * 4;
      if (y > env.groundLevel + 45) y = env.groundLevel;
      embers[i * 3 + 1] = y;
    }
    (emberGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };
  update(0);
  return { group, update };
}

function makeLavaTexture(rng: SeededRandom): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff5a10';
    ctx.fillRect(0, 0, 64, 64);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = rng.next() < 0.5 ? '#ffb020' : '#b82a08';
      ctx.beginPath();
      ctx.arc(rng.range(0, 64), rng.range(0, 64), rng.range(2, 8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#3a0a04';
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(rng.range(0, 64), rng.range(0, 64));
      ctx.lineTo(rng.range(0, 64), rng.range(0, 64));
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
