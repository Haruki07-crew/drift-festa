/**
 * ALPINE ZERMATT RUN の背景: 雪山の斜面 (地形)・雪をかぶった針葉樹・正面のマッターホルン・
 * 頭上を渡るロープウェイ (ゴンドラが動く)・渓谷の川・谷の村 (シャレー・教会)・森の中の湖・
 * 山頂近くの氷河・山頂駅。スタートの村からゴールの山頂へ登るにつれて 緑 → 岩 → 雪 → 氷 と変わる。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { snowPine } from './Props';
import { alongRoad, areaAround, beamMatrix, beams, centerOf, groundPlane, mountainRing } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 260;

/** 渓谷 (川) が流れる z 座標の範囲 (橋の下) */
const GORGE_Z = 530;
const GORGE_HALF = 55;
/** 森の中の湖 */
const LAKE = { x: 560, z: 1080, r: 70 };
/** これより高い所は氷河の色 */
const GLACIER_Y = 146;

export function buildAlpineScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-alpine';
  const env = track.def.environment;
  const rng = new SeededRandom(4478);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);
  const center = centerOf(track);

  // 山の斜面: 頂上駅 (z≈0) が高く、谷の村 (z≈1200) へ下る。橋の下は渓谷
  const slope = (x: number, z: number): number => {
    const mountain = z < 0 ? 175 - z * 0.45 : Math.max(8, 178 - z * 0.17);
    const ridge = Math.max(0, Math.abs(x - 300) - 380) * 0.25;
    const gorge = Math.max(0, 1 - Math.abs(z - GORGE_Z) / GORGE_HALF);
    const lake = Math.max(0, 1 - Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r);
    return mountain + ridge - gorge * gorge * 55 - Math.min(1, lake * 2) * 10;
  };
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0xf2f6fb,
    colorHigh: 0xdfe7f0,
    colorRock: 0x7c766f,
    wallRise: 30,
    baseOffset: 0,
    noiseScale: 1.2,
    baseHeight: slope,
    // 低い所は牧草地、上へ行くほど雪、山頂近くは氷河
    palette: (y, steep) =>
      steep > 1.1 ? 0x7c766f : y > GLACIER_Y ? 0xcfe6f6 : y > 60 ? ((Math.floor(y / 5) & 1) === 0 ? 0xf2f6fb : 0xe2eaf2) : y > 30 ? 0xc8d8c0 : 0x7aa85a,
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0xe8eef6 })));

  // --- 渓谷の川 ---
  const river = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(1400, GORGE_HALF * 0.9)), bag.add(new THREE.MeshPhongMaterial({ color: 0x3f8fc8, shininess: 80 })));
  river.rotation.x = -Math.PI / 2;
  river.position.set(300, slope(300, GORGE_Z) + 3, GORGE_Z);
  river.name = 'river';
  group.add(river);

  // --- 森の中の湖 ---
  const lakeMesh = new THREE.Mesh(bag.add(new THREE.CircleGeometry(LAKE.r * 0.8, 32)), bag.add(new THREE.MeshPhongMaterial({ color: 0x3a8ac8, shininess: 90, specular: 0xffffff })));
  lakeMesh.rotation.x = -Math.PI / 2;
  lakeMesh.position.set(LAKE.x, slope(LAKE.x, LAKE.z) + 3, LAKE.z);
  lakeMesh.name = 'alpine-lake';
  group.add(lakeMesh);

  // --- 氷河 (山頂近くの斜面を流れ下る氷。道路の山側) ---
  const glacier: InstanceSpec[] = [];
  const iceRng = new SeededRandom(99);
  for (let k = 0; k < 40; k++) {
    const x = iceRng.range(60, 520);
    const z = iceRng.range(-260, -70);
    if (!grid.isClear(x, z, 12)) continue;
    const sx = iceRng.range(20, 50);
    glacier.push({ x, y: h(x, z) - 2, z, sx, sy: iceRng.range(3, 8), sz: sx * iceRng.range(0.6, 1.4), rotY: iceRng.range(0, 6.28), color: iceRng.pick([0xffffff, 0xd8f0ff, 0xbfe4ff]) });
  }
  const gm = makeInstanced(flatten(new THREE.IcosahedronGeometry(1, 0)), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1a3a50 }), glacier, bag);
  if (gm) {
    gm.name = 'glacier';
    group.add(gm);
  }

  // --- 針葉樹 (高い所は雪をかぶる) ---
  const pineSnow = snowPine();
  const pineGreen = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(0.25, 0.35, 2, 5)), 0x4a3322).translate(0, 1, 0),
    paint(flatten(new THREE.ConeGeometry(2.2, 4.4, 6)), 0x24472a).translate(0, 3.8, 0),
    paint(flatten(new THREE.ConeGeometry(1.5, 3.4, 6)), 0x2c5632).translate(0, 6.1, 0),
  ]);
  const area = areaAround(track, TERRAIN_MARGIN - 20);
  const high: InstanceSpec[] = [];
  const low: InstanceSpec[] = [];
  const pineCount = Math.floor(1100 * preset.sceneryDensity);
  for (let tries = 0; high.length + low.length < pineCount && tries < pineCount * 10; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 6)) continue;
    const y = h(x, z);
    const s = rng.range(0.9, 1.9);
    const spec = { x, y: y - 0.3, z, sx: s, sy: s * rng.range(1, 1.4), sz: s, rotY: rng.range(0, 6.28) };
    (y > 95 ? high : low).push(spec);
  }
  const hm = makeInstanced(pineSnow, new THREE.MeshLambertMaterial({ vertexColors: true }), high, bag, { castShadow: preset.shadows });
  const lm = makeInstanced(pineGreen, new THREE.MeshLambertMaterial({ vertexColors: true }), low, bag, { castShadow: preset.shadows });
  if (hm) group.add(hm);
  if (lm) group.add(lm);

  // --- マッターホルン (遠くの尖った山) と山並み ---
  const peak = new THREE.Group();
  peak.name = 'matterhorn';
  const rockGeo = bag.add(new THREE.ConeGeometry(260, 720, 4, 1));
  rockGeo.translate(0, 360, 0);
  const rock = new THREE.Mesh(rockGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0x8a8078, flatShading: true })));
  const capGeo = bag.add(new THREE.ConeGeometry(118, 330, 4, 1));
  capGeo.translate(0, 555, 0);
  const cap = new THREE.Mesh(capGeo, bag.add(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })));
  rock.rotation.y = 0.5;
  cap.rotation.y = 0.5;
  peak.add(rock, cap);
  peak.position.set(250, 0, -1500);
  group.add(peak);
  group.add(mountainRing(bag, center, { count: 22, radius: 1900, height: [320, 620], width: [380, 620], color: 0x8f8a86, snowCap: 0.45, y: -10, seed: 17 }));

  // --- ロープウェイ (頂上駅 → 谷の村。道路のはるか上を渡る) ---
  const cableFrom = new THREE.Vector3(-150, 0, -90);
  const cableTo = new THREE.Vector3(620, 0, 1060);
  cableFrom.y = h(cableFrom.x, cableFrom.z) + 60;
  cableTo.y = h(cableTo.x, cableTo.z) + 45;
  const towers: THREE.Matrix4[] = [];
  const cableSegs: THREE.Matrix4[] = [];
  const midTower = new THREE.Vector3(360, 0, 420);
  const midTop = cableFrom.clone().lerp(cableTo, 0.45);
  midTower.y = h(midTower.x, midTower.z);
  for (const t of [cableFrom, cableTo]) towers.push(beamMatrix(new THREE.Vector3(t.x, h(t.x, t.z) - 2, t.z), t, 3));
  towers.push(beamMatrix(midTower, new THREE.Vector3(midTower.x, midTop.y, midTower.z), 2.4));
  const cablePoint = (u: number): THREE.Vector3 => {
    const p = cableFrom.clone().lerp(cableTo, u);
    p.y -= Math.sin(Math.PI * u) * 12;
    return p;
  };
  for (const off of [-2.5, 2.5]) {
    let prev = cablePoint(0);
    for (let k = 1; k <= 30; k++) {
      const cur = cablePoint(k / 30);
      cableSegs.push(beamMatrix(prev.clone().setX(prev.x + off), cur.clone().setX(cur.x + off), 0.3));
      prev = cur;
    }
  }
  const tm = beams(bag, towers, new THREE.MeshLambertMaterial({ color: 0x9aa0aa }), 'cable-towers');
  const cm = beams(bag, cableSegs, new THREE.MeshLambertMaterial({ color: 0x2a2d36 }), 'cable');
  if (tm) group.add(tm);
  if (cm) group.add(cm);
  const gondolaGeo = bag.add(new THREE.BoxGeometry(5, 4, 6));
  const gondolas: { mesh: THREE.Mesh; u: number; dir: number }[] = [];
  for (const [u, dir, color] of [[0.2, 1, 0xe23b3b], [0.7, -1, 0xffd23f]] as const) {
    const g = new THREE.Mesh(gondolaGeo, bag.add(new THREE.MeshLambertMaterial({ color })));
    group.add(g);
    gondolas.push({ mesh: g, u, dir });
  }

  // --- 谷の村 (シャレーと教会) ---
  const chaletBody = paint(flatten(new THREE.BoxGeometry(8, 5, 10)), 0x9a6a3c).translate(0, 2.5, 0);
  const chaletBase = paint(flatten(new THREE.BoxGeometry(8.2, 2, 10.2)), 0xf2f0e8).translate(0, 1, 0);
  const roof = paint(flatten(new THREE.ConeGeometry(7.4, 3.6, 4)), 0x6a3a2a);
  roof.rotateY(Math.PI / 4);
  roof.scale(1, 1, 1.3);
  roof.translate(0, 6.8, 0);
  const snowRoof = paint(flatten(new THREE.ConeGeometry(4.2, 1.6, 4)), 0xffffff);
  snowRoof.rotateY(Math.PI / 4);
  snowRoof.scale(1, 1, 1.3);
  snowRoof.translate(0, 8, 0);
  const chaletGeo = mergeGeometries([chaletBase, chaletBody, roof, snowRoof]);
  const chalets: InstanceSpec[] = [];
  alongRoad(
    track,
    26,
    'both',
    9,
    (p) => {
      if (rng.next() < 0.25) return;
      chalets.push({ x: p.x, y: h(p.x, p.z) - 0.2, z: p.z, rotY: p.heading + rng.range(-0.2, 0.2), sx: rng.range(0.8, 1.2), sy: rng.range(0.9, 1.3), sz: rng.range(0.8, 1.2) });
    },
    { from: 0, to: 0.12 },
  );
  // 頂上駅の建物
  const station = new THREE.Mesh(bag.add(new THREE.BoxGeometry(40, 14, 24)), bag.add(new THREE.MeshLambertMaterial({ color: 0xb8c0cc })));
  station.position.set(-110, h(-110, -60) + 7, -60);
  group.add(station);
  const chm = makeInstanced(chaletGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), chalets, bag, { castShadow: preset.shadows });
  if (chm) {
    chm.name = 'chalets';
    group.add(chm);
  }
  // 教会 (スタートの村の広場)
  const goal = track.pointAt(track.startS + 30);
  const church = new THREE.Group();
  church.name = 'church';
  const nave = new THREE.Mesh(bag.add(new THREE.BoxGeometry(12, 10, 22)), bag.add(new THREE.MeshLambertMaterial({ color: 0xf4f0e6 })));
  nave.position.y = 5;
  const steeple = new THREE.Mesh(bag.add(new THREE.BoxGeometry(5, 26, 5)), bag.add(new THREE.MeshLambertMaterial({ color: 0xf4f0e6 })));
  steeple.position.set(0, 13, -12);
  const spire = new THREE.Mesh(bag.add(new THREE.ConeGeometry(3.6, 12, 4)), bag.add(new THREE.MeshLambertMaterial({ color: 0x3a4a5a })));
  spire.position.set(0, 32, -12);
  spire.rotation.y = Math.PI / 4;
  church.add(nave, steeple, spire);
  const cx = goal.x - goal.tz * 38;
  const cz = goal.z + goal.tx * 38;
  church.position.set(cx, h(cx, cz), cz);
  church.rotation.y = Math.atan2(goal.tx, goal.tz);
  group.add(church);

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    for (const g of gondolas) {
      const u = (((g.u + time * 0.012 * g.dir) % 1) + 1) % 1;
      const p = cablePoint(u);
      g.mesh.position.set(p.x + (g.dir > 0 ? -2.5 : 2.5), p.y - 3, p.z);
      g.mesh.rotation.y = Math.atan2(cableTo.x - cableFrom.x, cableTo.z - cableFrom.z);
    }
  };
  update(0);
  return { group, update };
}
