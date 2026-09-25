/**
 * COASTAL SUNSET DRIVE の背景: 夕日の海・海岸の崖と砂浜 (地形)・ヤシの木・ビーチパラソル・
 * 岬の灯台 (光が回る)・ヨット・港町とリゾートの建物・水平線の大きな夕日。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { palmTree } from './Props';
import { alongRoad, areaAround, bridgePiers, buildings, centerOf, groundPlane, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';
import { buildTerrain } from './Terrain';

const TERRAIN_MARGIN = 240;
const SEA_LEVEL = 0;

export function buildCoastalScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-coastal';
  const rng = new SeededRandom(7070);
  const grid = new TrackProximityGrid(track, TERRAIN_MARGIN, 8, 130);
  const center = centerOf(track);

  // 陸か海か: 近くの道路の「ガードレール側 = 海、壁・芝側 = 陸」で決める
  const coarse = track.samples.filter((_, i) => i % 6 === 0);
  const isLand = (x: number, z: number): boolean => {
    let best = Infinity;
    let land = true;
    for (const s of coarse) {
      const d = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (d < best) {
        best = d;
        const lat = (x - s.x) * s.rx + (z - s.z) * s.rz;
        const edge = lat >= 0 ? s.right : s.left;
        land = edge !== 'guardrail';
      }
    }
    return land;
  };
  const terrain = buildTerrain(track, grid, bag, {
    margin: TERRAIN_MARGIN,
    cell: 8,
    colorLow: 0x6a9a4a,
    colorHigh: 0x5a8a40,
    colorRock: 0x9a7a60,
    wallRise: 26,
    baseOffset: 0,
    noiseScale: 1,
    baseHeight: (x, z) => (isLand(x, z) ? 34 : -14),
    palette: (y, steep) => (steep > 0.9 ? 0x9a7a60 : y < SEA_LEVEL + 3.2 ? 0xe8cf98 : y < 12 ? 0x7aa84e : 0x5f8f42),
  });
  group.add(terrain.mesh);
  const h = terrain.heightAt;

  // --- 海 (夕日を映す) ---
  const sea = groundPlane(bag, center, 9000, SEA_LEVEL, new THREE.MeshPhongMaterial({ color: 0x2a4a8a, emissive: 0x3a1a20, specular: 0xffc080, shininess: 60 }));
  sea.name = 'sea';
  group.add(sea);

  // --- 水平線の夕日 ---
  const sun = new THREE.Mesh(bag.add(new THREE.CircleGeometry(160, 32)), bag.add(new THREE.MeshBasicMaterial({ color: 0xffd080, fog: false })));
  sun.position.set(center.x + 200, 90, center.z - 2600);
  sun.lookAt(center.x, 0, center.z);
  group.add(sun);
  const glow = new THREE.Mesh(
    bag.add(new THREE.CircleGeometry(320, 32)),
    bag.add(new THREE.MeshBasicMaterial({ color: 0xff8a4a, fog: false, transparent: true, opacity: 0.35, depthWrite: false })),
  );
  glow.position.copy(sun.position).add(new THREE.Vector3(0, 0, 5));
  glow.lookAt(center.x, 0, center.z);
  group.add(glow);

  // --- ヤシの木 (陸側・砂浜) ---
  const area = areaAround(track, TERRAIN_MARGIN - 20);
  const palms: InstanceSpec[] = [];
  const palmCount = Math.floor(420 * preset.sceneryDensity);
  for (let tries = 0; palms.length < palmCount && tries < palmCount * 12; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 5)) continue;
    const y = h(x, z);
    if (y < SEA_LEVEL + 0.8) continue;
    const s = rng.range(0.9, 1.5);
    palms.push({ x, y: y - 0.2, z, sx: s, sy: s * rng.range(0.9, 1.3), sz: s, rotY: rng.range(0, 6.28) });
  }
  const pm = makeInstanced(palmTree(), new THREE.MeshLambertMaterial({ vertexColors: true }), palms, bag, { castShadow: preset.shadows });
  if (pm) {
    pm.name = 'palms';
    group.add(pm);
  }

  // --- 砂浜 (ビーチの区間の海側に、道路より少し低い砂の帯を敷く) ---
  const beach = new GeometryBuilder();
  const BEACH_FROM = 0.29;
  const BEACH_TO = 0.42;
  const BEACH_WIDTH = 42;
  const beachY = (smp: { y: number }, u: number): number => Math.min(smp.y - 0.6, 1.4) * (1 - u) + (SEA_LEVEL - 0.6) * u;
  for (let i = track.sampleIndexAt(BEACH_FROM * track.length); i < track.sampleIndexAt(BEACH_TO * track.length); i++) {
    const a = track.samples[i]!;
    const b = track.samples[i + 1]!;
    const p = (smp: typeof a, lat: number, y: number): [number, number, number] => [smp.x + smp.rx * lat, y, smp.z + smp.rz * lat];
    for (let k = 0; k < 6; k++) {
      const u0 = k / 6;
      const u1 = (k + 1) / 6;
      const l0 = -(a.halfWidth + 1.2 + BEACH_WIDTH * u0);
      const l1 = -(a.halfWidth + 1.2 + BEACH_WIDTH * u1);
      const m0 = -(b.halfWidth + 1.2 + BEACH_WIDTH * u0);
      const m1 = -(b.halfWidth + 1.2 + BEACH_WIDTH * u1);
      beach.quad(...p(a, l0, beachY(a, u0)), ...p(b, m0, beachY(b, u0)), ...p(b, m1, beachY(b, u1)), ...p(a, l1, beachY(a, u1)), k % 2 === 0 ? 0xf0d8a0 : 0xe8cf94);
    }
  }
  const beachMesh = new THREE.Mesh(bag.add(beach.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  beachMesh.name = 'beach';
  beachMesh.receiveShadow = true;
  group.add(beachMesh);
  const beachHeight = (x: number, z: number): number => {
    const pr = track.project(x, z, undefined);
    const u = Math.max(0, Math.min(1, (-pr.lateral - pr.halfWidth - 1.2) / BEACH_WIDTH));
    return beachY({ y: pr.cy }, u);
  };

  // --- ビーチパラソル (砂浜の区間の海側) ---
  const umbrellaGeo = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5)), 0xf2f2f2).translate(0, 1.3, 0),
    paint(flatten(new THREE.ConeGeometry(1.8, 0.8, 8)), 0xffffff).translate(0, 2.8, 0),
  ]);
  const umbrellas: InstanceSpec[] = [];
  const umbrellaColors = [0xff4f79, 0x39c5ff, 0xffd23f, 0x3ddc84, 0xff8a3d];
  alongRoad(
    track,
    9,
    -1,
    6,
    (p) => {
      for (let k = 0; k < 2; k++) {
        const off = 8 + k * 11 + rng.range(-2, 2);
        const x = p.x + Math.sin(p.facingRoad + Math.PI) * off;
        const z = p.z + Math.cos(p.facingRoad + Math.PI) * off;
        const y = beachHeight(x, z);
        if (y < SEA_LEVEL + 0.2 || !grid.isClear(x, z, 3)) continue;
        umbrellas.push({ x, y, z, rotY: rng.range(0, 6.28), color: rng.pick(umbrellaColors) });
      }
    },
    { from: BEACH_FROM + 0.01, to: BEACH_TO - 0.01 },
  );
  const um = makeInstanced(umbrellaGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), umbrellas, bag);
  if (um) {
    um.name = 'umbrellas';
    group.add(um);
  }

  // --- 岬の灯台 (カーブの内側の高台) ---
  const lighthouse = new THREE.Group();
  lighthouse.name = 'lighthouse';
  const stripes = 6;
  for (let k = 0; k < stripes; k++) {
    const seg = new THREE.Mesh(
      bag.add(new THREE.CylinderGeometry(3.4 - (k + 1) * 0.3, 3.4 - k * 0.3, 4, 12)),
      bag.add(new THREE.MeshLambertMaterial({ color: k % 2 === 0 ? 0xf6f6f6 : 0xe23b3b })),
    );
    seg.position.y = 2 + k * 4;
    lighthouse.add(seg);
  }
  const lamp = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(1.8, 1.8, 2.4, 10)), bag.add(new THREE.MeshBasicMaterial({ color: 0xfff2b0 })));
  lamp.position.y = 25.2;
  const cap = new THREE.Mesh(bag.add(new THREE.ConeGeometry(2.4, 2.2, 10)), bag.add(new THREE.MeshLambertMaterial({ color: 0x2a2d36 })));
  cap.position.y = 27.5;
  const beamGeo = bag.add(new THREE.ConeGeometry(3, 90, 10, 1, true));
  beamGeo.translate(0, 45, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beamMat = bag.add(new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 25.2;
  lighthouse.add(lamp, cap, beam);
  // 岬の頂点 (曲率が一番大きい所) の内側
  let tip = track.fracToS(0.55);
  let maxK = 0;
  for (const smp of track.samples) {
    if (smp.s > track.fracToS(0.48) && smp.s < track.fracToS(0.62) && Math.abs(smp.curvature) > maxK) {
      maxK = Math.abs(smp.curvature);
      tip = smp.s;
    }
  }
  const lp = roadsidePoint(track, tip, -1, 26);
  lighthouse.position.set(lp.x, h(lp.x, lp.z) - 0.5, lp.z);
  group.add(lighthouse);

  // --- 港町とリゾートの建物 (陸側) ---
  const spots: { x: number; z: number }[] = [];
  // 港町 (スタート) とリゾート (入り江の橋を渡った先)
  for (const [from, to] of [[0, 0.12], [0.81, 1]] as const) {
    alongRoad(track, 14, 1, 16, (p) => spots.push({ x: p.x, z: p.z }), { from, to });
  }
  group.add(
    buildings(bag, {
      count: Math.floor(90 * preset.sceneryDensity) + 20,
      spots,
      jitter: 10,
      height: [8, 36],
      width: [9, 18],
      night: false,
      baseColor: 0xffffff,
      tints: [0xfff4e8, 0xffe8d0, 0xe8f4ff, 0xfff0f4],
      grid,
      clearance: 8,
      yAt: (x, z) => h(x, z),
      seed: 12,
    }),
  );

  // --- 入り江をまたぐ橋の橋脚と橋桁 ---
  group.add(bridgePiers(track, bag, { from: 0.765, to: 0.8, spacing: 22, bottom: -8, color: 0xe8e0d0, archColor: 0xd0c8b8 }));

  // --- ヨット (海の上をゆっくり進む) ---
  const boatGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(2.4, 1.2, 7)), 0xf6f6f6).translate(0, 0.6, 0),
    paint(flatten(new THREE.CylinderGeometry(0.12, 0.12, 9, 5)), 0xdddddd).translate(0, 5.5, 0),
    paint(flatten(new THREE.ConeGeometry(2.4, 8, 3)), 0xfff8f0).translate(0, 5.6, 1.2),
  ]);
  bag.add(boatGeo);
  const boatMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const boats: { mesh: THREE.Mesh; x: number; z: number; speed: number; phase: number }[] = [];
  for (let k = 0; k < 12; k++) {
    const x = center.x + rng.range(-1200, 1200);
    const z = center.z - rng.range(400, 1300);
    if (isLand(x, z)) continue;
    const m = new THREE.Mesh(boatGeo, boatMat);
    m.position.set(x, SEA_LEVEL, z);
    m.rotation.y = rng.range(0, 6.28);
    group.add(m);
    boats.push({ mesh: m, x, z, speed: rng.range(1.5, 3), phase: rng.range(0, 6.28) });
  }

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    beam.rotation.y = time * 0.9;
    for (const b of boats) {
      b.mesh.position.x = b.x + Math.sin(time * 0.02 * b.speed + b.phase) * 60;
      b.mesh.rotation.z = Math.sin(time * 1.3 + b.phase) * 0.05;
    }
  };
  return { group, update };
}
