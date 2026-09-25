/**
 * SPACE STATION の背景: 宇宙 (星)・大きな地球と月・ステーションのモジュール (白い円筒)・
 * 太陽電池パネル・トラス (骨組み)・ゆっくり回る居住リング・行き交う宇宙船。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { areaAround, beamMatrix, beams, centerOf, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, makeInstanced, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildSpaceScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-space';
  const rng = new SeededRandom(1969);
  const grid = new TrackProximityGrid(track, 260, 8, 140);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);

  // --- 地球 (下に大きく) と月 ---
  const earth = new THREE.Mesh(bag.add(new THREE.SphereGeometry(900, 40, 24)), bag.add(new THREE.MeshLambertMaterial({ color: 0x2a6ae0, emissive: 0x0a1a40 })));
  earth.position.set(center.x + 300, -1150, center.z - 900);
  earth.name = 'earth';
  group.add(earth);
  // 陸と雲 (地球の表面に貼る少し大きい球の一部)
  const landMat = bag.add(new THREE.MeshLambertMaterial({ color: 0x3aa84a, emissive: 0x0a2a10 }));
  for (let k = 0; k < 14; k++) {
    const blob = new THREE.Mesh(bag.add(new THREE.SphereGeometry(rng.range(120, 260), 10, 8)), landMat);
    const dir = new THREE.Vector3(rng.range(-1, 1), rng.range(0.2, 1), rng.range(-1, 1)).normalize();
    blob.position.copy(earth.position).addScaledVector(dir, 820);
    blob.scale.set(1, 0.25, 1);
    blob.lookAt(earth.position);
    group.add(blob);
  }
  const cloudShell = new THREE.Mesh(bag.add(new THREE.SphereGeometry(915, 32, 20)), bag.add(new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })));
  cloudShell.position.copy(earth.position);
  group.add(cloudShell);
  const moon = new THREE.Mesh(bag.add(new THREE.SphereGeometry(70, 20, 14)), bag.add(new THREE.MeshLambertMaterial({ color: 0xd8d8d0, emissive: 0x202020 })));
  moon.position.set(center.x - 900, 350, center.z + 1300);
  group.add(moon);

  // --- ステーションのモジュール (道路から離れた白い円筒) と太陽電池パネル ---
  const area = areaAround(track, 200);
  const modules: InstanceSpec[] = [];
  const panels: InstanceSpec[] = [];
  const trusses: THREE.Matrix4[] = [];
  const moduleCount = Math.floor(28 * preset.sceneryDensity) + 8;
  for (let tries = 0; modules.length < moduleCount && tries < 3000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    const y = rng.range(10, 70);
    if (!grid.isClear(x, z, 16) || corridor.isNearRoad(x, y, z, 20, 20)) continue;
    const len = rng.range(20, 50);
    const rot = rng.range(0, 6.28);
    modules.push({ x, y, z, sx: 1, sy: len, sz: 1, rotY: rot });
    if (rng.next() < 0.7) {
      for (const side of [-1, 1]) {
        const px = x + Math.cos(rot) * side * 26;
        const pz = z - Math.sin(rot) * side * 26;
        panels.push({ x: px, y: y + len / 2, z: pz, sx: 34, sy: 0.4, sz: 12, rotY: rot });
        trusses.push(beamMatrix(new THREE.Vector3(x, y + len / 2, z), new THREE.Vector3(px, y + len / 2, pz), 0.8));
      }
    }
  }
  const moduleGeo = new THREE.CylinderGeometry(5, 5, 1, 14);
  moduleGeo.translate(0, 0.5, 0);
  moduleGeo.rotateZ(Math.PI / 2);
  const mm = makeInstanced(moduleGeo, new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }), modules.map((m) => ({ ...m, sx: m.sy, sy: 1, sz: 1 })), bag);
  if (mm) {
    mm.name = 'modules';
    group.add(mm);
  }
  const pm = makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x1a2a6a, emissive: 0x0a1030 }), panels, bag);
  if (pm) {
    pm.name = 'solar-panels';
    group.add(pm);
  }
  const tm = beams(bag, trusses, new THREE.MeshLambertMaterial({ color: 0xaab0bc }), 'trusses');
  if (tm) group.add(tm);

  // --- 回る居住リング (磁力道路のカーブの外側) ---
  const rp = roadsidePoint(track, track.fracToS(0.39), -1, 90);
  const ring = new THREE.Group();
  ring.name = 'habitat-ring';
  const ringMesh = new THREE.Mesh(bag.add(new THREE.TorusGeometry(70, 6, 10, 48)), bag.add(new THREE.MeshLambertMaterial({ color: 0xdfe4ec })));
  const windows = new THREE.Mesh(bag.add(new THREE.TorusGeometry(70, 6.2, 4, 48)), bag.add(new THREE.MeshBasicMaterial({ color: 0x9fe8ff, wireframe: true })));
  ring.add(ringMesh, windows);
  for (let k = 0; k < 4; k++) {
    const spoke = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(1.4, 1.4, 140, 8)), bag.add(new THREE.MeshLambertMaterial({ color: 0xb8c0cc })));
    spoke.rotation.z = (k * Math.PI) / 4;
    ring.add(spoke);
  }
  ring.position.set(rp.x, rp.y + 80, rp.z);
  ring.rotation.y = rp.heading;
  group.add(ring);

  // --- 行き交う宇宙船 ---
  const shipGeo = bag.add(new THREE.ConeGeometry(3, 12, 6));
  shipGeo.rotateX(Math.PI / 2);
  const ships: { mesh: THREE.Mesh; r: number; y: number; speed: number; phase: number }[] = [];
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(shipGeo, bag.add(new THREE.MeshLambertMaterial({ color: rng.pick([0xff8a3d, 0x39f3ff, 0xffffff]), emissive: 0x202020 })));
    group.add(m);
    ships.push({ mesh: m, r: rng.range(500, 800), y: rng.range(90, 180), speed: rng.range(0.03, 0.06) * (k % 2 ? 1 : -1), phase: rng.range(0, 6.28) });
  }

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    ring.rotation.x = time * 0.08;
    earth.rotation.y = time * 0.004;
    for (const s of ships) {
      const a = s.phase + time * s.speed;
      s.mesh.position.set(center.x + Math.cos(a) * s.r, s.y, center.z + Math.sin(a) * s.r);
      s.mesh.rotation.y = -a + (s.speed > 0 ? Math.PI : 0);
    }
  };
  update(0);
  return { group, update };
}
