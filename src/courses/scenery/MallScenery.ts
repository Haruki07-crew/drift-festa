/**
 * MEGA MALL の背景: 巨大ショッピングモールの中。
 * タイルの床・天井 (天窓の格子)・外壁・道路沿いのお店 (看板つき)・吹き抜けのガラスのドームと噴水・
 * ヤシの鉢植え・風船・立体駐車場の柱と駐車中の車。天井は影を落とさない (屋内でも明るく)。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { palmTree } from './Props';
import { alongRoad, centerOf, groundPlane, makeSignTexture } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';

const CEILING = 30;
/** 屋上駐車場 (らせん) の上の屋根のない範囲の半径 [m] */
const OPEN_ROOF_RADIUS = 80;
const MARGIN = 70;

export function buildMallScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-mall';
  const rng = new SeededRandom(8181);
  const grid = new TrackProximityGrid(track, 120, 6, 80);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);
  const b = track.bounds;
  const w = b.maxX - b.minX + MARGIN * 2;
  const d = b.maxZ - b.minZ + MARGIN * 2;

  // --- タイルの床 ---
  const floorTex = bag.add(makeTileTexture());
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(w / 8, d / 8);
  const floor = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(w, d)), bag.add(new THREE.MeshLambertMaterial({ map: floorTex })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);
  group.add(groundPlane(bag, center, 9000, -0.5, new THREE.MeshLambertMaterial({ color: 0x9a9690 })));

  // --- 天井 (天窓の格子) と外壁 ---
  const ceilTex = bag.add(makeSkylightTexture());
  ceilTex.wrapS = THREE.RepeatWrapping;
  ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set(w / 30, d / 30);
  // 天井は板を並べる。立体駐車場のらせんの上は屋根なし (屋上駐車場から空が見える)
  const spiralCenter = track.pointAt(track.fracToS(0.86));
  ceilTex.repeat.set(1, 1);
  const tiles: InstanceSpec[] = [];
  const tile = 30;
  for (let x = b.minX - MARGIN; x < b.maxX + MARGIN; x += tile) {
    for (let z = b.minZ - MARGIN; z < b.maxZ + MARGIN; z += tile) {
      if (Math.hypot(x + tile / 2 - spiralCenter.x, z + tile / 2 - spiralCenter.z) < OPEN_ROOF_RADIUS) continue;
      tiles.push({ x: x + tile / 2, y: CEILING, z: z + tile / 2, sx: tile, sy: 0.4, sz: tile });
    }
  }
  const ceiling = makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: ceilTex }), tiles, bag);
  if (ceiling) {
    ceiling.name = 'ceiling';
    group.add(ceiling);
  }
  const parkingSign = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(8, 8)),
    bag.add(new THREE.MeshBasicMaterial({ map: bag.add(makeSignTexture('P', '#2b6cd8', '#ffffff', 64, 64)), side: THREE.DoubleSide })),
  );
  parkingSign.position.set(spiralCenter.x, 20, spiralCenter.z);
  parkingSign.name = 'parking-sign';
  group.add(parkingSign);
  const wallMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xf0ebe2 }));
  const outer: [number, number, number, number][] = [
    [center.x, b.minZ - MARGIN, w, 1],
    [center.x, b.maxZ + MARGIN, w, 1],
    [b.minX - MARGIN, center.z, 1, d],
    [b.maxX + MARGIN, center.z, 1, d],
  ];
  for (const [x, z, sx, sz] of outer) {
    const wall = new THREE.Mesh(bag.add(new THREE.BoxGeometry(sx, CEILING, sz)), wallMat);
    wall.position.set(x, CEILING / 2, z);
    group.add(wall);
  }

  // --- 道路沿いのお店 (壁の外側。看板が道路を向く) ---
  const shopNames = ['CAFE', 'TOYS', 'BOOKS', 'SHOES', 'GAMES', 'PIZZA', 'ICE CREAM', 'FASHION', 'SPORTS', 'MUSIC', 'SUSHI', 'CANDY', 'PETS', 'CINEMA'];
  const shopColors = ['#ff4f79', '#39a8ff', '#ffb300', '#3ddc84', '#b98cff', '#ff8a3d', '#2ad4c0'];
  const signGeo = bag.add(new THREE.PlaneGeometry(7, 1.7));
  const shopGeo = bag.add(new THREE.BoxGeometry(12, 7, 8));
  const glassMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xbfe0f8, emissive: 0x1a3a50 }));
  let shopIndex = 0;
  alongRoad(track, 26, 'both', 6, (p) => {
    // 別の区間の道路 (2階・らせん) にかからない所だけ
    if (corridor.isNearRoad(p.x, p.y + 3, p.z, 5, 6)) return;
    const shop = new THREE.Mesh(shopGeo, glassMat);
    shop.position.set(p.x, p.y + 3.5, p.z);
    shop.rotation.y = p.facingRoad;
    group.add(shop);
    const color = shopColors[shopIndex % shopColors.length]!;
    const tex = bag.add(makeSignTexture(shopNames[shopIndex % shopNames.length]!, color, '#ffffff'));
    shopIndex++;
    const sign = new THREE.Mesh(signGeo, bag.add(new THREE.MeshBasicMaterial({ map: tex })));
    sign.position.set(p.x + Math.sin(p.facingRoad) * 4.1, p.y + 8.6, p.z + Math.cos(p.facingRoad) * 4.1);
    sign.rotation.y = p.facingRoad;
    group.add(sign);
  });

  // --- 吹き抜けのガラスドームと噴水 (コースの内側の空き地) ---
  let atrium = { x: center.x, z: center.z };
  for (let tries = 0; tries < 200; tries++) {
    const x = center.x + rng.range(-120, 120);
    const z = center.z + rng.range(-80, 80);
    if (grid.isClear(x, z, 30)) {
      atrium = { x, z };
      break;
    }
  }
  const dome = new THREE.Mesh(
    bag.add(new THREE.SphereGeometry(26, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    bag.add(new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })),
  );
  dome.position.set(atrium.x, CEILING - 0.5, atrium.z);
  group.add(dome);
  const basin = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(12, 12.5, 1.2, 24)), bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })));
  basin.position.set(atrium.x, 0.6, atrium.z);
  const water = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(11.4, 11.4, 0.3, 24)), bag.add(new THREE.MeshPhongMaterial({ color: 0x5ab0e8, shininess: 100 })));
  water.position.set(atrium.x, 1.1, atrium.z);
  const jet = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(0.4, 1.4, 9, 10, 1, true)), bag.add(new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6 })));
  jet.position.set(atrium.x, 5.5, atrium.z);
  group.add(basin, water, jet);

  // --- フードコート (吹き抜けの近く。テーブルとパラソルと屋台の看板) ---
  const fc = findSpotNear(grid, atrium.x + 40, atrium.z, 18);
  const tableGeo = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(1.4, 1.4, 0.15, 10)), 0xf4f0e6).translate(0, 1.1, 0),
    paint(flatten(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 6)), 0x888888).translate(0, 0.55, 0),
    paint(flatten(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5)), 0xdddddd).translate(0, 2.3, 0),
    paint(flatten(new THREE.ConeGeometry(2, 0.8, 8)), 0xffffff).translate(0, 3.6, 0),
  ]);
  const tables: InstanceSpec[] = [];
  const umbrella = [0xff4f79, 0xffd23f, 0x39a8ff, 0x3ddc84];
  for (let i = -2; i <= 2; i++) {
    for (let j = -1; j <= 1; j++) {
      tables.push({ x: fc.x + i * 6, y: 0, z: fc.z + j * 6, color: umbrella[(i + j + 8) % umbrella.length]! });
    }
  }
  const tbl = makeInstanced(tableGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), tables, bag);
  if (tbl) {
    tbl.name = 'food-court';
    group.add(tbl);
  }
  const foods = ['BURGER', 'RAMEN', 'CREPE', 'TACO'];
  foods.forEach((name, k) => {
    const stand = new THREE.Mesh(bag.add(new THREE.BoxGeometry(8, 4, 3)), bag.add(new THREE.MeshLambertMaterial({ color: 0xf8f4ec })));
    stand.position.set(fc.x - 12 + k * 8, 2, fc.z - 12);
    const sign = new THREE.Mesh(signGeo, bag.add(new THREE.MeshBasicMaterial({ map: bag.add(makeSignTexture(name, shopColors[k]!, '#ffffff')) })));
    sign.position.set(fc.x - 12 + k * 8, 5, fc.z - 10.4);
    group.add(stand, sign);
  });

  // --- ヤシの鉢植えと風船 ---
  const potGeo = mergeGeometries([paint(flatten(new THREE.CylinderGeometry(1.2, 0.9, 1.4, 8)), 0xb86a3a).translate(0, 0.7, 0)]);
  const palms: InstanceSpec[] = [];
  const pots: InstanceSpec[] = [];
  alongRoad(track, 38, 'both', 3, (p, k) => {
    if (k % 3 !== 0 || corridor.isNearRoad(p.x, p.y + 2, p.z, 1.5, 6)) return;
    palms.push({ x: p.x, y: p.y + 1.2, z: p.z, sx: 0.6, sy: 0.6, sz: 0.6 });
    pots.push({ x: p.x, y: p.y, z: p.z });
  });
  const pm = makeInstanced(palmTree(), new THREE.MeshLambertMaterial({ vertexColors: true }), palms, bag);
  const potm = makeInstanced(potGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), pots, bag);
  if (pm) group.add(pm);
  if (potm) group.add(potm);
  const balloons: InstanceSpec[] = [];
  const balloonColors = [0xff4f79, 0xffd23f, 0x39a8ff, 0x3ddc84, 0xb98cff];
  for (let k = 0; k < 90 * preset.sceneryDensity + 20; k++) {
    const x = rng.range(b.minX - 40, b.maxX + 40);
    const z = rng.range(b.minZ - 40, b.maxZ + 40);
    balloons.push({ x, y: rng.range(20, CEILING - 1.5), z, color: rng.pick(balloonColors) });
  }
  const balloonMesh = makeInstanced(flatten(new THREE.SphereGeometry(1, 8, 6)), new THREE.MeshLambertMaterial({ color: 0xffffff }), balloons, bag);
  if (balloonMesh) {
    balloonMesh.name = 'balloons';
    group.add(balloonMesh);
  }

  // --- 立体駐車場の車 (らせんの周り) ---
  const carGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(2, 0.9, 4.2)), 0xffffff).translate(0, 0.75, 0),
    paint(flatten(new THREE.BoxGeometry(1.8, 0.7, 2.2)), 0x2a3440).translate(0, 1.5, -0.2),
  ]);
  const cars: InstanceSpec[] = [];
  const carColors = [0xe23b3b, 0x2b6cd8, 0xf2f2f2, 0x2a2a2a, 0xffd23f, 0x3ddc84];
  for (let tries = 0; cars.length < 60 && tries < 2000; tries++) {
    const x = rng.range(b.minX - 50, b.minX + 160);
    const z = rng.range(b.minZ - 50, b.minZ + 120);
    if (!grid.isClear(x, z, 4)) continue;
    cars.push({ x, y: 0, z, rotY: rng.next() < 0.5 ? 0 : Math.PI / 2, color: rng.pick(carColors) });
  }
  const cm = makeInstanced(carGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), cars, bag);
  if (cm) {
    cm.name = 'parked-cars';
    group.add(cm);
  }

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    jet.scale.y = 0.9 + Math.sin(time * 3) * 0.1;
  };
  return { group, update };
}

function makeTileTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e8e2d8';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#d8d0c4';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSkylightTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#dff0ff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#9aa4b0';
    ctx.fillRect(0, 0, 64, 4);
    ctx.fillRect(0, 0, 4, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 道路から clearance 以上離れた、(x0, z0) に一番近い場所 */
function findSpotNear(grid: TrackProximityGrid, x0: number, z0: number, clearance: number): { x: number; z: number } {
  for (let r = 0; r < 300; r += 6) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = x0 + Math.cos(a) * r;
      const z = z0 + Math.sin(a) * r;
      if (grid.isClear(x, z, clearance)) return { x, z };
    }
  }
  return { x: x0, z: z0 };
}
