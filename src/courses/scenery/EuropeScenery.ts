/**
 * EUROPE GRAND TOUR の背景: 旧市街のカラフルな街並み (三角屋根)・噴水の広場・運河とゴンドラ・
 * ぶどう畑の丘・オランダ風の風車 (羽根が回る)・丘の上の古城・ポプラ並木・ゴールの凱旋門。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { alongRoad, areaAround, centerOf, groundPlane, mountainRing, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, makeWindowTexture, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 230;
/** 旧市街・運河・田園の区間 (割合) */
const TOWN_TO = 0.36;
const CANAL_AT = 0.418;

export function buildEuropeScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-europe';
  const env = track.def.environment;
  const rng = new SeededRandom(1889);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);
  const center = centerOf(track);

  // 運河は道路と直交して東西に流れる
  const canal = track.pointAt(CANAL_AT * track.length);
  const canalDist = (x: number, z: number): number => Math.abs((x - canal.x) * canal.tx + (z - canal.z) * canal.tz);
  const townEnd = track.pointAt(TOWN_TO * track.length);
  // ぶどう畑の谷の湖 (地形をくぼませる)
  const lakeRng = new SeededRandom(314);
  const lakeArea = areaAround(track, TERRAIN_MARGIN - 60);
  let lakeSpot = { x: center.x + 250, z: center.z + 300 };
  for (let tries = 0; tries < 600; tries++) {
    const x = lakeRng.range(lakeArea.minX, lakeArea.maxX);
    const z = lakeRng.range(townEnd.z + 200, lakeArea.maxZ);
    if (grid.isClear(x, z, 80)) {
      lakeSpot = { x, z };
      break;
    }
  }
  const lakeDip = (x: number, z: number): number => Math.max(0, 1 - Math.hypot(x - lakeSpot.x, z - lakeSpot.z) / 75);
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0x7aa84e,
    colorHigh: 0x6a9a44,
    colorRock: 0x9a8a6a,
    wallRise: 3,
    baseOffset: 0,
    noiseScale: 0.9,
    baseHeight: (x, z) => {
      // 町は平ら、田園 (町より北) はなだらかな丘、運河は深い溝
      const hill = Math.min(1, Math.max(0, (z - townEnd.z - 120) / 700)) * 24;
      const c = Math.max(0, 1 - canalDist(x, z) / 26);
      return (2.4 + hill) * (1 - c) + -3 * c - Math.min(1, lakeDip(x, z) * 2.5) * 6;
    },
    // 町の石畳の広場 (低い所) は灰色、丘は緑
    palette: (y, steep) => (steep > 0.8 ? 0x9a8a6a : y < 3.2 ? 0xa8a296 : (Math.floor(y / 5) & 1) === 0 ? 0x7aa84e : 0x6e9c46),
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0x6a9a44 })));

  // --- 運河の水とゴンドラ ---
  const water = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(1400, 30)), bag.add(new THREE.MeshPhongMaterial({ color: 0x3a7aa8, shininess: 90, specular: 0xffffff })));
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = -Math.atan2(canal.tx, canal.tz);
  water.position.set(canal.x, 0.4, canal.z);
  water.name = 'canal';
  group.add(water);
  const boatGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(1.4, 0.7, 9)), 0x1a1a22).translate(0, 0.35, 0),
    paint(flatten(new THREE.BoxGeometry(0.5, 1.6, 0.5)), 0x1a1a22).translate(0, 1.1, 4.2),
  ]);
  bag.add(boatGeo);
  const boatMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const boats: { mesh: THREE.Mesh; offset: number; speed: number }[] = [];
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(boatGeo, boatMat);
    group.add(m);
    boats.push({ mesh: m, offset: rng.range(-500, 500), speed: rng.range(3, 6) * (k % 2 === 0 ? 1 : -1) });
  }
  // 運河の向き (道路と直交) の単位ベクトル
  const canalDirX = -canal.tz;
  const canalDirZ = canal.tx;

  // --- 旧市街の街並み (カラフルな壁 + 三角屋根) ---
  const winTex = bag.add(makeWindowTexture(rng, ['#3a4a60', '#5a6a80', '#2a3440'], 0.55, '#ffffff'));
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  houseGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.ConeGeometry(0.72, 1, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 0.5, 0);
  const houses: InstanceSpec[] = [];
  const roofs: InstanceSpec[] = [];
  const pastel = [0xffe0c0, 0xffd0d8, 0xd8f0ff, 0xfff4c0, 0xe0ffd8, 0xf0d8ff, 0xffffff];
  const addHouse = (x: number, z: number, rot: number, far = false): void => {
    const w = rng.range(7, 11);
    const d = rng.range(7, 10);
    const hh = far ? rng.range(8, 14) : rng.range(9, 16);
    const y = h(x, z) - 0.3;
    houses.push({ x, y, z, sx: w, sy: hh, sz: d, rotY: rot, color: rng.pick(pastel) });
    roofs.push({ x, y: y + hh, z, sx: w * 1.02, sy: rng.range(3.5, 5.5), sz: d * 1.02, rotY: rot, color: rng.pick([0xb84a2a, 0xa83a22, 0x8a4a3a, 0x5a4a5a]) });
  };
  // 通り沿いの家: 走れる範囲 (安全帯) の外端から 7m (家の奥行きの半分 + 余裕) の所に建てる。
  // 別の区間の道路に近すぎる場所は corridor で除外する
  const corridor = new RoadCorridor(track);
  for (const side of [-1, 1] as const) {
    alongRoad(
      track,
      11,
      side,
      7,
      (p) => {
        if (corridor.isNearRoad(p.x, p.y + 2, p.z, 5.5, 20)) return;
        addHouse(p.x, p.z, p.heading);
      },
      { from: 0, to: TOWN_TO },
    );
  }
  // 町の奥にも家を並べる
  const area = areaAround(track, TERRAIN_MARGIN - 30);
  for (let tries = 0; tries < 900 * preset.sceneryDensity; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, townEnd.z + 60);
    if (!grid.isClear(x, z, 16) || canalDist(x, z) < 22) continue;
    addHouse(x, z, rng.range(0, 6.28), true);
  }
  const hm = makeInstanced(houseGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, map: winTex }), houses, bag, { castShadow: preset.shadows });
  const rm = makeInstanced(roofGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), roofs, bag);
  if (hm) {
    hm.name = 'houses';
    group.add(hm);
  }
  if (rm) group.add(rm);

  // --- 噴水の広場 (カーブの内側) ---
  let plazaS = 0.27 * track.length;
  let maxK = 0;
  for (const smp of track.samples) {
    if (smp.s > 0.23 * track.length && smp.s < 0.31 * track.length && Math.abs(smp.curvature) > maxK) {
      maxK = Math.abs(smp.curvature);
      plazaS = smp.s;
    }
  }
  const plazaSmp = track.sample(track.sampleIndexAt(plazaS));
  const inner = plazaSmp.curvature > 0 ? -1 : 1;
  const fp = roadsidePoint(track, plazaS, inner as -1 | 1, 22);
  const fountain = new THREE.Group();
  fountain.name = 'fountain';
  const stone = bag.add(new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
  const basin = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(9, 9.5, 1.2, 20)), stone);
  basin.position.y = 0.6;
  const pool = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(8.4, 8.4, 0.2, 20)), bag.add(new THREE.MeshPhongMaterial({ color: 0x5ab0e8, shininess: 100 })));
  pool.position.y = 1.1;
  const column = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(0.8, 1.2, 5, 10)), stone);
  column.position.y = 3.5;
  const top = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(3, 2, 0.6, 14)), stone);
  top.position.y = 6;
  fountain.add(basin, pool, column, top);
  fountain.position.set(fp.x, h(fp.x, fp.z), fp.z);
  group.add(fountain);
  const dropCount = 160;
  const dropPos = new Float32Array(dropCount * 3);
  const dropVel = new Float32Array(dropCount * 3);
  const dropGeo = bag.add(new THREE.BufferGeometry());
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3).setUsage(THREE.DynamicDrawUsage));
  const drops = new THREE.Points(dropGeo, bag.add(new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.35, transparent: true, opacity: 0.8 })));
  drops.frustumCulled = false;
  group.add(drops);
  const fountainTop = new THREE.Vector3(fp.x, h(fp.x, fp.z) + 6.4, fp.z);
  const resetDrop = (i: number): void => {
    dropPos[i * 3] = fountainTop.x;
    dropPos[i * 3 + 1] = fountainTop.y;
    dropPos[i * 3 + 2] = fountainTop.z;
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(1, 2.4);
    dropVel[i * 3] = Math.cos(a) * r;
    dropVel[i * 3 + 1] = rng.range(3, 5);
    dropVel[i * 3 + 2] = Math.sin(a) * r;
  };
  for (let i = 0; i < dropCount; i++) resetDrop(i);

  // --- ぶどう畑 (丘の斜面に並ぶ緑の畝) ---
  const vines: InstanceSpec[] = [];
  for (let tries = 0; vines.length < 700 * preset.sceneryDensity && tries < 8000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(townEnd.z + 150, area.maxZ);
    if (!grid.isClear(x, z, 8)) continue;
    // 畝は東西方向にそろえる
    vines.push({ x, y: h(x, z) - 0.2, z, sx: rng.range(8, 16), sy: 1.4, sz: 1.2, rotY: 0.15, color: rng.pick([0xffffff, 0xe0f0d0, 0xd0e8c0]) });
  }
  const vineGeo = new THREE.BoxGeometry(1, 1, 1);
  vineGeo.translate(0, 0.5, 0);
  const vm = makeInstanced(vineGeo, new THREE.MeshLambertMaterial({ color: 0x3f7a2a }), vines, bag);
  if (vm) {
    vm.name = 'vineyards';
    group.add(vm);
  }

  // --- 遠くのアルプスの山並みと、ぶどう畑の谷の湖 ---
  group.add(mountainRing(bag, center, { count: 20, radius: 1500, height: [220, 480], width: [320, 560], color: 0x7a8aa0, snowCap: 0.4, y: 0, seed: 1815 }));
  const lake = new THREE.Mesh(bag.add(new THREE.CircleGeometry(58, 32)), bag.add(new THREE.MeshPhongMaterial({ color: 0x3a8ac8, shininess: 100, specular: 0xffffff })));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(lakeSpot.x, h(lakeSpot.x, lakeSpot.z) + 3.5, lakeSpot.z);
  lake.name = 'lake';
  group.add(lake);

  // --- 風車 (羽根が回る) ---
  const mills: THREE.Group[] = [];
  for (const [frac, side] of [[0.66, -1], [0.7, 1], [0.74, -1]] as const) {
    const p = roadsidePoint(track, frac * track.length, side, 30);
    const mill = new THREE.Group();
    mill.name = 'windmill';
    const body = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(3.2, 4.6, 14, 8)), bag.add(new THREE.MeshLambertMaterial({ color: 0xf2eee4 })));
    body.position.y = 7;
    const cap = new THREE.Mesh(bag.add(new THREE.ConeGeometry(4, 4, 8)), bag.add(new THREE.MeshLambertMaterial({ color: 0x5a3a2a })));
    cap.position.y = 16;
    const hub = new THREE.Group();
    hub.position.set(0, 14, 4.2);
    const sailMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e0d0, side: THREE.DoubleSide }));
    const sailGeo = bag.add(new THREE.BoxGeometry(1.8, 9, 0.2));
    sailGeo.translate(0, 5, 0);
    for (let k = 0; k < 4; k++) {
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.rotation.z = (k * Math.PI) / 2;
      hub.add(sail);
    }
    mill.add(body, cap, hub);
    mill.position.set(p.x, h(p.x, p.z), p.z);
    mill.rotation.y = p.facingRoad;
    group.add(mill);
    mills.push(hub);
  }

  // --- 丘の上の古城 ---
  const castlePos = roadsidePoint(track, 0.79 * track.length, 1, 60);
  const castle = new THREE.Group();
  castle.name = 'castle';
  const wallMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
  const roofMat = bag.add(new THREE.MeshLambertMaterial({ color: 0x3a4a8a }));
  const keep = new THREE.Mesh(bag.add(new THREE.BoxGeometry(18, 22, 18)), wallMat);
  keep.position.y = 11;
  castle.add(keep);
  for (const [tx, tz, th] of [[-14, -14, 30], [14, -14, 26], [-14, 14, 26], [14, 14, 34]] as const) {
    const tower = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(4, 4.4, th, 10)), wallMat);
    tower.position.set(tx, th / 2, tz);
    const cone = new THREE.Mesh(bag.add(new THREE.ConeGeometry(5, 10, 10)), roofMat);
    cone.position.set(tx, th + 5, tz);
    castle.add(tower, cone);
  }
  castle.position.set(castlePos.x, h(castlePos.x, castlePos.z), castlePos.z);
  group.add(castle);

  // --- ポプラ並木 (凱旋門通り) ---
  const poplarGeo = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(0.25, 0.35, 2, 5)), 0x5a3d24).translate(0, 1, 0),
    paint(flatten(new THREE.ConeGeometry(1.6, 10, 6)), 0x3f7a2a).translate(0, 6.5, 0),
  ]);
  const poplars: InstanceSpec[] = [];
  alongRoad(track, 14, 'both', 3, (p) => poplars.push({ x: p.x, y: h(p.x, p.z) - 0.2, z: p.z, sx: 1, sy: rng.range(0.9, 1.2), sz: 1 }), { from: 0.84, to: 1 });
  const ppm = makeInstanced(poplarGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), poplars, bag, { castShadow: preset.shadows });
  if (ppm) group.add(ppm);

  // --- 凱旋門 (ゴールの先。車の頭上高く) ---
  const archS = track.goalS + 70;
  const al = roadsidePoint(track, archS, -1, 5);
  const ar = roadsidePoint(track, archS, 1, 5);
  const arch = new THREE.Group();
  arch.name = 'triumphal-arch';
  const archMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e0cc }));
  const span = Math.hypot(ar.x - al.x, ar.z - al.z);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(bag.add(new THREE.BoxGeometry(10, 26, 12)), archMat);
    pillar.position.set(side * (span / 2 + 5), 13, 0);
    arch.add(pillar);
  }
  const topBlock = new THREE.Mesh(bag.add(new THREE.BoxGeometry(span + 20, 10, 12)), archMat);
  topBlock.position.y = 31;
  arch.add(topBlock);
  arch.position.set((al.x + ar.x) / 2, Math.max(al.y, ar.y) - 0.5, (al.z + ar.z) / 2);
  arch.rotation.y = al.heading;
  group.add(arch);

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    for (const hub of mills) hub.rotation.z += dt * 0.8;
    for (const b of boats) {
      const d = ((b.offset + time * b.speed + 600) % 1200) - 600;
      b.mesh.position.set(canal.x + canalDirX * d + canal.tx * (b.speed > 0 ? 6 : -6), 0.4, canal.z + canalDirZ * d + canal.tz * (b.speed > 0 ? 6 : -6));
      b.mesh.rotation.y = Math.atan2(canalDirX, canalDirZ) + (b.speed > 0 ? 0 : Math.PI);
    }
    for (let i = 0; i < dropCount; i++) {
      dropVel[i * 3 + 1] -= 9.8 * dt;
      dropPos[i * 3] += dropVel[i * 3]! * dt;
      dropPos[i * 3 + 1] += dropVel[i * 3 + 1]! * dt;
      dropPos[i * 3 + 2] += dropVel[i * 3 + 2]! * dt;
      if (dropPos[i * 3 + 1]! < fountainTop.y - 5.2) resetDrop(i);
    }
    (dropGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };
  return { group, update };
}
