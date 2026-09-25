/**
 * AIRPORT RUSH の背景: 芝生と駐機場のエプロン・滑走路の端の灯火・ターミナルビル・管制塔・
 * 駐機中の旅客機・格納庫・吹き流し・隣の滑走路から離陸する旅客機 (周期的に飛び立つ)。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { alongRoad, centerOf, groundPlane, makeSignTexture, mountainRing } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';

/** 旅客機 (機首 = +Z)。胴体色 body、尾翼の色 tail */
export function airliner(body = 0xf4f6fa, tail = 0x2b6cd8): THREE.BufferGeometry {
  const fuselage = paint(flatten(new THREE.CylinderGeometry(2, 2, 34, 12)), body);
  fuselage.rotateX(Math.PI / 2);
  fuselage.translate(0, 4, 0);
  const nose = paint(flatten(new THREE.ConeGeometry(2, 5, 12)), body);
  nose.rotateX(Math.PI / 2);
  nose.translate(0, 4, 19.5);
  const tailCone = paint(flatten(new THREE.ConeGeometry(2, 6, 12)), body);
  tailCone.rotateX(-Math.PI / 2);
  tailCone.translate(0, 4.4, -20);
  const wings = paint(flatten(new THREE.BoxGeometry(36, 0.5, 6)), 0xd8dce4).translate(0, 3.2, 1);
  const stab = paint(flatten(new THREE.BoxGeometry(12, 0.4, 3)), 0xd8dce4).translate(0, 5, -19);
  const fin = paint(flatten(new THREE.BoxGeometry(0.5, 7, 4.5)), tail).translate(0, 8.5, -19);
  const engL = paint(flatten(new THREE.CylinderGeometry(1.1, 1.1, 4.4, 10)), 0x9aa0aa);
  engL.rotateX(Math.PI / 2);
  const engR = engL.clone();
  engL.translate(-8, 2.3, 3);
  engR.translate(8, 2.3, 3);
  const stripe = paint(flatten(new THREE.BoxGeometry(4.05, 0.5, 30)), tail).translate(0, 3.2, 0);
  const gear = paint(flatten(new THREE.BoxGeometry(0.5, 2.2, 0.5)), 0x333333).translate(0, 1.1, 14);
  return mergeGeometries([fuselage, nose, tailCone, wings, stab, fin, engL, engR, stripe, gear]);
}

export function buildAirportScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-airport';
  const env = track.def.environment;
  const rng = new SeededRandom(7474);
  const grid = new TrackProximityGrid(track, 260, 8, 140);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);
  const b = track.bounds;

  // --- 芝生と駐機場のエプロン (道路より低い平らな板) ---
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0x6aa84a })));
  const apron: InstanceSpec[] = [];
  for (let x = b.minX - 120; x < b.maxX + 120; x += 20) {
    for (let z = b.minZ + 40; z < b.maxZ + 140; z += 20) {
      if (corridor.isNearRoad(x, 0, z, 2, 5)) continue;
      apron.push({ x, y: -0.04, z, sx: 20, sy: 0.02, sz: 20 });
    }
  }
  const apronGeo = new THREE.BoxGeometry(1, 1, 1);
  const am = makeInstanced(apronGeo, new THREE.MeshLambertMaterial({ color: 0x8a8e96 }), apron, bag, { receiveShadow: true });
  if (am) {
    am.name = 'apron';
    group.add(am);
  }

  // --- 滑走路の灯火 (路肩の外) ---
  const lights: InstanceSpec[] = [];
  alongRoad(track, 12, 'both', 0.6, (p, k) => lights.push({ x: p.x, y: p.y, z: p.z, color: k % 4 < 2 ? 0xffffff : 0x4a8aff }), { from: 0, to: 0.31 });
  alongRoad(track, 18, 'both', 0.6, (p) => lights.push({ x: p.x, y: p.y, z: p.z, color: 0x3ddc84 }), { from: 0.31, to: 1 });
  const lightGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.6, 6);
  lightGeo.translate(0, 0.3, 0);
  const lm = makeInstanced(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), lights, bag);
  if (lm) group.add(lm);

  // --- 隣の (離陸用) 滑走路 ---
  const runwayZ = b.minZ - 120;
  const runway = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(1400, 45)), bag.add(new THREE.MeshLambertMaterial({ color: 0x4a4e58 })));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set((b.minX + b.maxX) / 2, 0.01, runwayZ);
  group.add(runway);
  const marks: InstanceSpec[] = [];
  for (let x = b.minX - 600; x < b.maxX + 600; x += 30) marks.push({ x, y: 0.03, z: runwayZ, sx: 14, sy: 0.02, sz: 1 });
  const mm = makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), marks, bag);
  if (mm) group.add(mm);

  // --- 離陸する旅客機 ---
  const takeoff = new THREE.Mesh(bag.add(airliner(0xf6f6fa, 0xe23b3b)), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  takeoff.name = 'takeoff-plane';
  takeoff.rotation.y = Math.PI / 2;
  group.add(takeoff);

  // --- ターミナル・管制塔・格納庫 (コースの内側と外側の空き地) ---
  const findSpot = (x0: number, z0: number, clearance: number): { x: number; z: number } => {
    for (let r = 0; r < 300; r += 10) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = x0 + Math.cos(a) * r;
        const z = z0 + Math.sin(a) * r;
        if (grid.isClear(x, z, clearance)) return { x, z };
      }
    }
    return { x: x0, z: z0 };
  };
  const glass = bag.add(new THREE.MeshLambertMaterial({ color: 0x8ac8f0, emissive: 0x0a2a44 }));
  const concrete = bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e8ec }));
  const term = findSpot(150, 230, 26);
  const terminal = new THREE.Group();
  terminal.name = 'terminal';
  const tBody = new THREE.Mesh(bag.add(new THREE.BoxGeometry(110, 14, 30)), glass);
  tBody.position.y = 7;
  const tRoof = new THREE.Mesh(bag.add(new THREE.BoxGeometry(116, 2, 34)), concrete);
  tRoof.position.y = 15;
  const sign = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(40, 6)),
    bag.add(new THREE.MeshBasicMaterial({ map: bag.add(makeSignTexture('DRIFT FESTA AIRPORT', '#1a2a4a', '#ffffff', 512, 64)), side: THREE.DoubleSide })),
  );
  sign.position.set(0, 19, 0);
  terminal.add(tBody, tRoof, sign);
  terminal.position.set(term.x, 0, term.z);
  group.add(terminal);

  const towerSpot = findSpot(360, 110, 14);
  const tower = new THREE.Group();
  tower.name = 'control-tower';
  const shaft = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(3.4, 4.4, 46, 10)), concrete);
  shaft.position.y = 23;
  const cab = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(8, 6, 7, 10)), glass);
  cab.position.y = 49;
  const capTop = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(8.6, 8.6, 1.5, 10)), concrete);
  capTop.position.y = 53;
  const radar = new THREE.Mesh(bag.add(new THREE.BoxGeometry(6, 0.8, 1)), bag.add(new THREE.MeshLambertMaterial({ color: 0xe23b3b })));
  radar.position.y = 56;
  tower.add(shaft, cab, capTop, radar);
  tower.position.set(towerSpot.x, 0, towerSpot.z);
  group.add(tower);

  const hangarGeo = bag.add(new THREE.CylinderGeometry(22, 22, 50, 16, 1, false, 0, Math.PI));
  hangarGeo.rotateZ(Math.PI / 2);
  hangarGeo.rotateY(Math.PI / 2);
  const hangarMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xb8bcc6, side: THREE.DoubleSide }));
  for (const [hx, hz] of [[520, 330], [640, 340], [760, 320]] as const) {
    const spot = findSpot(hx, hz, 26);
    const hangar = new THREE.Mesh(hangarGeo, hangarMat);
    hangar.position.set(spot.x, 0, spot.z);
    hangar.name = 'hangar';
    group.add(hangar);
  }

  // --- 駐機中の旅客機 (ターミナルと駐機場) ---
  // 尾翼の色違い (インスタンスの色で塗ると機体全体の色が変わるので、色ごとに形を分ける)
  const tails = [0x2b6cd8, 0xe23b3b, 0x3ddc84, 0xffb300];
  const parked: InstanceSpec[][] = tails.map(() => []);
  for (let k = 0, tries = 0; k < 10 && tries < 400; tries++) {
    const x = rng.range(b.minX - 60, b.maxX + 60);
    const z = rng.range(b.minZ + 60, b.maxZ + 120);
    if (!grid.isClear(x, z, 26)) continue;
    parked[k % tails.length]!.push({ x, y: 0, z, rotY: rng.range(0, 6.28) });
    k++;
  }
  tails.forEach((tail, i) => {
    const pm = makeInstanced(airliner(0xf6f6fa, tail), new THREE.MeshLambertMaterial({ vertexColors: true }), parked[i]!, bag, { castShadow: preset.shadows });
    if (pm) {
      pm.name = 'parked-planes';
      group.add(pm);
    }
  });

  // --- 遠くの山 ---
  group.add(mountainRing(bag, center, { count: 16, radius: 1700, height: [120, 260], width: [300, 500], color: 0x7a9a8a, y: 0, seed: 31 }));

  let time = 0;
  const cycle = 22;
  const update = (dt: number): void => {
    time += dt;
    radar.rotation.y = time * 1.5;
    // 離陸: 静止 → 加速 → 浮上 → 上昇して消える を繰り返す
    const u = (time % cycle) / cycle;
    const startX = b.minX - 350;
    const d = 1500 * u * u;
    const x = startX + d;
    const lift = Math.max(0, d - 900);
    takeoff.position.set(x, lift * 0.28, runwayZ);
    takeoff.rotation.x = -Math.min(0.22, lift * 0.002);
    takeoff.visible = u < 0.97;
  };
  update(0);
  return { group, update };
}
