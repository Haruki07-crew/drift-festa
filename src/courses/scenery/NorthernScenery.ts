/**
 * NORTHERN LIGHTS の背景: 夜の雪原 (地形)・雪をかぶった森・凍った湖 (氷の板)・
 * 窓の明かりがともる木の小屋・雪だるま・湖畔のアイスホテル・丘の上の天文台。
 * オーロラは Weather (environment.weather = aurora) が描く。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { snowPine } from './Props';
import { alongRoad, areaAround, centerOf, groundPlane, mountainRing, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 240;
/** 凍った湖の区間 (割合) */
const LAKE_FROM = 0.31;
const LAKE_TO = 0.52;
const LAKE_RADIUS = 190;
const LAKE_Y = 1.3;

export function buildNorthernScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-northern';
  const env = track.def.environment;
  const rng = new SeededRandom(6611);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);
  const center = centerOf(track);

  const lakeSamples = track.samples.filter((s, i) => i % 6 === 0 && s.s >= LAKE_FROM * track.length && s.s <= LAKE_TO * track.length);
  const lakeDist = (x: number, z: number): number => {
    let d = Infinity;
    for (const s of lakeSamples) d = Math.min(d, Math.hypot(s.x - x, s.z - z));
    return d;
  };

  // 雪原: なだらかな丘。湖の上は湖面より低く (氷の板を見せる)
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0xe6eef8,
    colorHigh: 0xd8e4f2,
    colorRock: 0x9aa8ba,
    wallRise: 16,
    baseOffset: 0,
    noiseScale: 1.3,
    baseHeight: (x, z) => {
      const d = lakeDist(x, z);
      const lake = Math.max(0, Math.min(1, (LAKE_RADIUS - d) / 40));
      return 14 * (1 - lake) + (LAKE_Y - 3) * lake;
    },
    palette: (y, steep) => (steep > 1 ? 0xaab6c8 : (Math.floor(y / 4) & 1) === 0 ? 0xe8f0fa : 0xdce6f4),
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;
  group.add(groundPlane(bag, center, 9000, env.groundLevel, new THREE.MeshLambertMaterial({ color: 0xd8e2f0 })));

  // --- 凍った湖 (氷の板)。道路より低いので安全帯にはかからない ---
  const ice = groundPlane(bag, { x: 0, z: 0 }, 1, LAKE_Y, new THREE.MeshPhongMaterial({ color: 0x9ccbe8, emissive: 0x0a2a44, specular: 0xffffff, shininess: 120 }));
  ice.geometry.dispose();
  const iceGeo = bag.add(new THREE.CircleGeometry(1, 40));
  iceGeo.rotateX(-Math.PI / 2);
  ice.geometry = iceGeo;
  const lakeMid = track.pointAt(((LAKE_FROM + LAKE_TO) / 2) * track.length);
  ice.position.set(lakeMid.x, LAKE_Y, lakeMid.z);
  ice.scale.set(LAKE_RADIUS * 1.9, 1, LAKE_RADIUS * 1.9);
  ice.name = 'frozen-lake';
  group.add(ice);

  // --- 森 (湖の上には置かない) ---
  const area = areaAround(track, TERRAIN_MARGIN - 20);
  const pines: InstanceSpec[] = [];
  const pineCount = Math.floor(1000 * preset.sceneryDensity);
  for (let tries = 0; pines.length < pineCount && tries < pineCount * 10; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 7) || lakeDist(x, z) < LAKE_RADIUS + 10) continue;
    const s = rng.range(0.9, 2);
    pines.push({ x, y: h(x, z) - 0.3, z, sx: s, sy: s * rng.range(1, 1.5), sz: s, rotY: rng.range(0, 6.28), color: rng.pick([0xffffff, 0xd8e8ff, 0xc0d4f0]) });
  }
  const pm = makeInstanced(snowPine(), new THREE.MeshLambertMaterial({ vertexColors: true }), pines, bag, { castShadow: preset.shadows });
  if (pm) {
    pm.name = 'pines';
    group.add(pm);
  }

  // --- 木の小屋 (窓の明かり) と雪だるま (村) ---
  const cabinGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(7, 4, 8)), 0x6a4430).translate(0, 2, 0),
    paint(flatten(new THREE.ConeGeometry(6.2, 3, 4)), 0xf4f8ff).rotateY(Math.PI / 4).scale(1, 1, 1.25).translate(0, 5.5, 0),
  ]);
  const windowGeo = paint(flatten(new THREE.BoxGeometry(7.1, 1.2, 1.4)), 0xffc860).translate(0, 2.2, 0);
  const cabins: InstanceSpec[] = [];
  alongRoad(
    track,
    22,
    'both',
    9,
    (p) => {
      if (rng.next() < 0.2) return;
      cabins.push({ x: p.x, y: h(p.x, p.z) - 0.2, z: p.z, rotY: p.heading + rng.range(-0.3, 0.3) });
    },
    { from: 0, to: 0.12 },
  );
  alongRoad(track, 30, 'both', 12, (p) => cabins.push({ x: p.x, y: h(p.x, p.z) - 0.2, z: p.z, rotY: p.heading }), { from: 0.92, to: 1 });
  const cm = makeInstanced(cabinGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), cabins, bag);
  const wm = makeInstanced(windowGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), cabins, bag);
  if (cm) {
    cm.name = 'cabins';
    group.add(cm);
  }
  if (wm) group.add(wm);
  const snowmanGeo = mergeGeometries([
    paint(flatten(new THREE.IcosahedronGeometry(1, 1)), 0xffffff).translate(0, 1, 0),
    paint(flatten(new THREE.IcosahedronGeometry(0.7, 1)), 0xffffff).translate(0, 2.4, 0),
    paint(flatten(new THREE.ConeGeometry(0.12, 0.6, 5)), 0xff8a1f).rotateX(Math.PI / 2).translate(0, 2.4, 0.8),
    paint(flatten(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 8)), 0x222222).translate(0, 3.2, 0),
  ]);
  const snowmen: InstanceSpec[] = [];
  alongRoad(track, 40, 'both', 5, (p) => snowmen.push({ x: p.x, y: h(p.x, p.z), z: p.z, rotY: p.facingRoad }), { from: 0.02, to: 0.14 });
  const sm = makeInstanced(snowmanGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), snowmen, bag);
  if (sm) group.add(sm);

  // --- アイスホテル (湖畔の光る氷のブロック) ---
  const hotelPos = roadsidePoint(track, (LAKE_FROM + 0.02) * track.length, -1, 40);
  const hotel = new THREE.Group();
  hotel.name = 'ice-hotel';
  const iceBlock = bag.add(new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x2a6a9a, transparent: true, opacity: 0.85 }));
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(bag.add(new THREE.BoxGeometry(8, 5 + (k % 2) * 2, 8)), iceBlock);
    b.position.set((k - 2) * 8.5, 2.5, 0);
    hotel.add(b);
  }
  const dome = new THREE.Mesh(bag.add(new THREE.SphereGeometry(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), iceBlock);
  dome.position.set(0, 7, 0);
  hotel.add(dome);
  hotel.position.set(hotelPos.x, h(hotelPos.x, hotelPos.z), hotelPos.z);
  hotel.rotation.y = hotelPos.facingRoad;
  group.add(hotel);

  // --- 天文台 (ゴールの先の丘) ---
  const op = roadsidePoint(track, track.goalS + 20, 1, 26);
  const obs = new THREE.Group();
  obs.name = 'observatory';
  const base = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(9, 9, 8, 16)), bag.add(new THREE.MeshLambertMaterial({ color: 0xe8ecf2 })));
  base.position.y = 4;
  const obsDome = new THREE.Mesh(bag.add(new THREE.SphereGeometry(9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), bag.add(new THREE.MeshLambertMaterial({ color: 0xf6f8fb })));
  obsDome.position.y = 8;
  const slit = new THREE.Mesh(bag.add(new THREE.BoxGeometry(2, 10, 18)), bag.add(new THREE.MeshBasicMaterial({ color: 0x1a2a4a })));
  slit.position.y = 12;
  slit.rotation.x = 0.4;
  obs.add(base, obsDome, slit);
  obs.position.set(op.x, h(op.x, op.z), op.z);
  group.add(obs);

  // --- 遠くの雪山 ---
  group.add(mountainRing(bag, center, { count: 18, radius: 1800, height: [180, 360], width: [300, 520], color: 0x4a5a78, snowCap: 0.5, y: env.groundLevel, seed: 23 }));

  return { group };
}
