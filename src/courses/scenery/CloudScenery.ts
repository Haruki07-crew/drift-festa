/**
 * CLOUD KINGDOM の背景: 雲の海 (モコモコの雲)・道路を支える浮島 (岩と草)・お城・
 * 虹の橋の上にかかる大きな虹・ゆらゆら浮かぶ気球。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { areaAround, centerOf, groundPlane, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';

const CLOUD_FLOOR = 24;
const RAINBOW = [0xff4f4f, 0xff9a3d, 0xffe45c, 0x5ad86a, 0x4aa8ff, 0x8a6aff];

export function buildCloudScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-cloud';
  const rng = new SeededRandom(9191);
  const grid = new TrackProximityGrid(track, 300, 8, 140);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);

  // --- 雲の海 (下の雲の層 + モコモコの雲) ---
  group.add(groundPlane(bag, center, 9000, CLOUD_FLOOR, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x303040 })));
  const puffGeo = flatten(new THREE.IcosahedronGeometry(1, 1));
  const puffs: InstanceSpec[] = [];
  const area = areaAround(track, 380);
  const count = Math.floor(700 * preset.sceneryDensity) + 100;
  for (let k = 0; k < count; k++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    const s = rng.range(8, 22);
    // 道路の近くは低く (道路と重ならない)、遠くは高くまで
    const near = !grid.isClear(x, z, 30);
    const y = near ? rng.range(CLOUD_FLOOR, 40) : rng.range(CLOUD_FLOOR, 85);
    if (corridor.isNearRoad(x, y, z, s + 4, s + 6)) continue;
    puffs.push({ x, y, z, sx: s * rng.range(1, 1.6), sy: s * 0.6, sz: s, rotY: rng.range(0, 6.28), color: rng.pick([0xffffff, 0xfff4fa, 0xf4f4ff]) });
  }
  const pm = makeInstanced(puffGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x404050 }), puffs, bag);
  if (pm) {
    pm.name = 'clouds';
    group.add(pm);
  }

  // --- 浮島 (柵のある区間の下を支える岩と草) ---
  // 上面 (草) は厚みのない円にする: 高さ方向に拡大しても道路の上にはみ出さない
  const rockGeo = mergeGeometries([
    paint(flatten(new THREE.ConeGeometry(1, 1, 7)), 0x8a7a6a).rotateX(Math.PI).translate(0, -0.5, 0),
    paint(flatten(new THREE.CircleGeometry(1.02, 7)), 0x7ac84e).rotateX(-Math.PI / 2),
  ]);
  const islands: InstanceSpec[] = [];
  for (let i = 0; i < track.samples.length; i += 14) {
    const smp = track.samples[i]!;
    if (smp.gap || smp.left === 'fall' || smp.right === 'fall') continue;
    const r = smp.halfWidth + rng.range(6, 12);
    islands.push({ x: smp.x, y: smp.y - 1.2, z: smp.z, sx: r, sy: rng.range(18, 34), sz: r, rotY: rng.range(0, 6.28) });
  }
  const im = makeInstanced(rockGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), islands, bag);
  if (im) {
    im.name = 'floating-islands';
    group.add(im);
  }

  // --- お城 (スタートの島) ---
  const cp = roadsidePoint(track, track.fracToS(0.07), 1, 26);
  const castle = new THREE.Group();
  castle.name = 'sky-castle';
  const white = bag.add(new THREE.MeshLambertMaterial({ color: 0xfaf6ff }));
  const pink = bag.add(new THREE.MeshLambertMaterial({ color: 0xff8ac0 }));
  const hall = new THREE.Mesh(bag.add(new THREE.BoxGeometry(26, 18, 20)), white);
  hall.position.y = 9;
  castle.add(hall);
  for (const [tx, tz, th] of [[-14, -11, 30], [14, -11, 26], [-14, 11, 26], [14, 11, 34], [0, 0, 40]] as const) {
    const tower = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(3.6, 4, th, 12)), white);
    tower.position.set(tx, th / 2, tz);
    const roof = new THREE.Mesh(bag.add(new THREE.ConeGeometry(5, 11, 12)), pink);
    roof.position.set(tx, th + 5.5, tz);
    castle.add(tower, roof);
  }
  castle.position.set(cp.x, cp.y - 1, cp.z);
  castle.rotation.y = cp.facingRoad;
  group.add(castle);
  const castleIsland = new THREE.Mesh(bag.add(rockGeo.clone()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  castleIsland.scale.set(34, 40, 34);
  castleIsland.position.set(cp.x, cp.y - 1.2, cp.z);
  group.add(castleIsland);

  // --- 虹 (虹の橋の上に大きくかかる) ---
  const mid = track.pointAt(track.fracToS(0.29));
  const rainbow = new THREE.Group();
  rainbow.name = 'rainbow';
  RAINBOW.forEach((color, k) => {
    const arc = new THREE.Mesh(
      bag.add(new THREE.TorusGeometry(120 - k * 4, 2, 6, 48, Math.PI)),
      bag.add(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false })),
    );
    rainbow.add(arc);
  });
  rainbow.position.set(mid.x, mid.y - 30, mid.z);
  rainbow.rotation.y = Math.atan2(mid.tx, mid.tz);
  group.add(rainbow);

  // --- 浮島の巨大風車 (羽根が回る) ---
  const wp = roadsidePoint(track, track.fracToS(0.43), 1, 45);
  const windmill = new THREE.Group();
  windmill.name = 'giant-windmill';
  const millIsland = new THREE.Mesh(bag.add(rockGeo.clone()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  millIsland.scale.set(22, 30, 22);
  windmill.add(millIsland);
  const body = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(4, 6.5, 26, 8)), bag.add(new THREE.MeshLambertMaterial({ color: 0xfaf6ff })));
  body.position.y = 13;
  const cap = new THREE.Mesh(bag.add(new THREE.ConeGeometry(6, 7, 8)), bag.add(new THREE.MeshLambertMaterial({ color: 0x8ac0ff })));
  cap.position.y = 29.5;
  windmill.add(body, cap);
  const sails = new THREE.Group();
  sails.position.set(0, 24, 6.8);
  const sailGeo = bag.add(new THREE.BoxGeometry(3.2, 20, 0.3));
  sailGeo.translate(0, 10.5, 0);
  const sailMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xffe8f4, side: THREE.DoubleSide }));
  for (let k = 0; k < 4; k++) {
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.rotation.z = (k * Math.PI) / 2;
    sails.add(sail);
  }
  windmill.add(sails);
  windmill.position.set(wp.x, wp.y - 1.2, wp.z);
  windmill.rotation.y = wp.facingRoad;
  group.add(windmill);

  // --- 気球 (ゆらゆら浮かぶ) ---
  const balloonGeo = mergeGeometries([
    paint(flatten(new THREE.SphereGeometry(6, 10, 8)), 0xffffff).translate(0, 8, 0),
    paint(flatten(new THREE.BoxGeometry(2.4, 1.6, 2.4)), 0x8a5a3a).translate(0, 0.8, 0),
  ]);
  bag.add(balloonGeo);
  const balloons: { mesh: THREE.Mesh; y: number; phase: number }[] = [];
  const balloonColors = [0xff4f79, 0xffd23f, 0x39a8ff, 0x3ddc84, 0xb98cff, 0xff8a3d];
  for (let k = 0; k < 10; k++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    const y = rng.range(70, 120);
    if (corridor.isNearRoad(x, y, z, 20, 30)) continue;
    const m = new THREE.Mesh(balloonGeo, bag.add(new THREE.MeshLambertMaterial({ color: rng.pick(balloonColors), vertexColors: true })));
    m.position.set(x, y, z);
    group.add(m);
    balloons.push({ mesh: m, y, phase: rng.range(0, 6.28) });
  }

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    for (const b of balloons) b.mesh.position.y = b.y + Math.sin(time * 0.5 + b.phase) * 3;
    sails.rotation.z = time * 0.7;
  };
  return { group, update };
}
