/**
 * SCHOOL FESTIVAL CHAOS の背景: 文化祭の日の学校。
 * 校庭 (土) とサッカー場・3階建ての校舎 (時計と横断幕)・体育館 (道路が中を通る)・
 * 屋台 (しま模様の屋根と看板)・通りの上に張られた提灯・桜の木・野外ステージ。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { RoadCorridor } from '../RoadClearance';
import type { Track } from '../Track';
import { alongRoad, areaAround, beamMatrix, beams, buildings, centerOf, groundPlane, makeSignTexture, roadsidePoint } from './SceneryKit';
import { TrackProximityGrid, flatten, makeInstanced, mergeGeometries, paint, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildSchoolScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-school';
  const rng = new SeededRandom(2025);
  const grid = new TrackProximityGrid(track, 200, 6, 100);
  const corridor = new RoadCorridor(track);
  const center = centerOf(track);

  // --- 校庭 (土) と芝生、サッカー場 ---
  group.add(groundPlane(bag, center, 9000, -0.05, new THREE.MeshLambertMaterial({ color: 0x7ab84e })));
  const yard = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(420, 330)), bag.add(new THREE.MeshLambertMaterial({ color: 0xd2b488 })));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(120, -0.03, 40);
  yard.name = 'schoolyard';
  group.add(yard);
  const soccer = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(130, 70)), bag.add(new THREE.MeshLambertMaterial({ color: 0x5aa83a })));
  soccer.rotation.x = -Math.PI / 2;
  soccer.position.set(110, -0.02, 75);
  group.add(soccer);
  const goalMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (const side of [-1, 1]) {
    const goal = new THREE.Mesh(bag.add(new THREE.BoxGeometry(1, 2.4, 7.3)), goalMat);
    goal.position.set(110 + side * 62, 1.2, 75);
    group.add(goal);
  }

  // --- 校舎 (コースの内側の空き地に 3 階建て) ---
  const findSpot = (x0: number, z0: number, clearance: number): { x: number; z: number } => {
    for (let r = 0; r < 250; r += 8) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const x = x0 + Math.cos(a) * r;
        const z = z0 + Math.sin(a) * r;
        if (grid.isClear(x, z, clearance)) return { x, z };
      }
    }
    return { x: x0, z: z0 };
  };
  // 校舎 (60m 四方) の角まで道路から離す
  const bs = findSpot(190, 290, 46);
  group.add(
    buildings(bag, {
      count: 1,
      spots: [bs],
      jitter: 0,
      height: [15, 15],
      width: [60, 60],
      night: false,
      baseColor: 0xffffff,
      tints: [0xf4f0e6],
      grid,
      clearance: 0,
      yAt: () => 0,
      seed: 3,
    }),
  );
  const clock = new THREE.Mesh(bag.add(new THREE.CylinderGeometry(3, 3, 0.6, 20)), bag.add(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(bs.x, 18, bs.z);
  group.add(clock);
  const banner = new THREE.Mesh(
    bag.add(new THREE.PlaneGeometry(34, 5)),
    bag.add(new THREE.MeshBasicMaterial({ map: bag.add(makeSignTexture('DRIFT FESTA 文化祭', '#ff4f79', '#ffffff', 512, 72)), side: THREE.DoubleSide })),
  );
  banner.position.set(bs.x, 11, bs.z);
  group.add(banner);

  // --- 体育館 (道路が中を通るトンネルの外側の建物) ---
  const gymS0 = track.fracToS(0.42);
  const gymS1 = track.fracToS(0.474);
  const gymMat = bag.add(new THREE.MeshLambertMaterial({ color: 0xe8e2d0 }));
  const roofMat = bag.add(new THREE.MeshLambertMaterial({ color: 0x3a6ab8 }));
  for (let s = gymS0; s < gymS1; s += 8) {
    for (const side of [-1, 1] as const) {
      const p = roadsidePoint(track, s, side, 1.5);
      const wall = new THREE.Mesh(bag.add(new THREE.BoxGeometry(2, 11, 8.4)), gymMat);
      wall.position.set(p.x, p.y + 5.5, p.z);
      wall.rotation.y = p.heading;
      group.add(wall);
    }
    const mid = track.pointAt(s);
    const roof = new THREE.Mesh(bag.add(new THREE.BoxGeometry(mid.halfWidth * 2 + 7, 1.2, 8.4)), roofMat);
    roof.position.set(mid.x, mid.y + 11.5, mid.z);
    roof.rotation.y = Math.atan2(mid.tx, mid.tz);
    group.add(roof);
  }

  // --- 屋台 (屋台の通り) ---
  const stallGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(5, 2.2, 3.5)), 0xf4ead8).translate(0, 1.1, 0),
    paint(flatten(new THREE.BoxGeometry(5.6, 0.5, 4.2)), 0xffffff).translate(0, 3, 0),
  ]);
  const stalls: InstanceSpec[] = [];
  const stallNames = ['やきそば', 'たこやき', 'わたあめ', 'かき氷', 'ヨーヨー', 'お化け屋敷', 'くじびき', 'フランクフルト'];
  const stallColors = ['#e23b3b', '#39a8ff', '#ff8a3d', '#3ddc84', '#b98cff'];
  const roofColors = [0xe23b3b, 0x39a8ff, 0xff8a3d, 0x3ddc84, 0xb98cff];
  const signGeo = bag.add(new THREE.PlaneGeometry(4.6, 1.2));
  let si = 0;
  alongRoad(
    track,
    9,
    'both',
    4,
    (p) => {
      if (corridor.isNearRoad(p.x, p.y + 1, p.z, 2.5, 5)) return;
      stalls.push({ x: p.x, y: 0, z: p.z, rotY: p.facingRoad, color: rng.pick(roofColors) });
      const tex = bag.add(makeSignTexture(stallNames[si % stallNames.length]!, stallColors[si % stallColors.length]!, '#ffffff'));
      si++;
      const sign = new THREE.Mesh(signGeo, bag.add(new THREE.MeshBasicMaterial({ map: tex })));
      sign.position.set(p.x + Math.sin(p.facingRoad) * 2.2, 3.9, p.z + Math.cos(p.facingRoad) * 2.2);
      sign.rotation.y = p.facingRoad;
      group.add(sign);
    },
    { from: 0.27, to: 0.4 },
  );
  const stm = makeInstanced(stallGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), stalls, bag, { castShadow: preset.shadows });
  if (stm) {
    stm.name = 'stalls';
    group.add(stm);
  }

  // --- 提灯 (通りの上。車の頭上高く) ---
  const cables: THREE.Matrix4[] = [];
  const lanterns: InstanceSpec[] = [];
  for (let s = track.fracToS(0.27); s < track.fracToS(0.4); s += 18) {
    const l = roadsidePoint(track, s, -1, 2);
    const r = roadsidePoint(track, s, 1, 2);
    const a = new THREE.Vector3(l.x, l.y + 10, l.z);
    const bb = new THREE.Vector3(r.x, r.y + 10, r.z);
    cables.push(beamMatrix(a, bb, 0.06));
    for (let k = 1; k < 8; k++) {
      const p = a.clone().lerp(bb, k / 8);
      lanterns.push({ x: p.x, y: p.y - 0.6 - Math.sin((Math.PI * k) / 8) * 0.6, z: p.z, color: k % 2 === 0 ? 0xff3b3b : 0xfff4e0 });
    }
  }
  const cm = beams(bag, cables, new THREE.MeshBasicMaterial({ color: 0x222222 }));
  if (cm) group.add(cm);
  const lanternGeo = new THREE.SphereGeometry(0.38, 8, 6);
  lanternGeo.scale(1, 1.35, 1);
  const lm = makeInstanced(lanternGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), lanterns, bag);
  if (lm) {
    lm.name = 'lanterns';
    group.add(lm);
  }

  // --- 桜の木 ---
  const sakura = mergeGeometries([
    paint(flatten(new THREE.CylinderGeometry(0.4, 0.6, 3, 6)), 0x5a3d2a).translate(0, 1.5, 0),
    paint(flatten(new THREE.IcosahedronGeometry(3, 0)), 0xffc0d8).translate(0, 5, 0),
    paint(flatten(new THREE.IcosahedronGeometry(2.2, 0)), 0xffd8e6).translate(1.6, 6, 0.8),
  ]);
  const area = areaAround(track, 160);
  const trees: InstanceSpec[] = [];
  for (let tries = 0; trees.length < 260 * preset.sceneryDensity && tries < 5000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 7) || (Math.abs(x - bs.x) < 40 && Math.abs(z - bs.z) < 20)) continue;
    const s = rng.range(0.8, 1.3);
    trees.push({ x, y: 0, z, sx: s, sy: s, sz: s, rotY: rng.range(0, 6.28) });
  }
  const tm = makeInstanced(sakura, new THREE.MeshLambertMaterial({ vertexColors: true }), trees, bag, { castShadow: preset.shadows });
  if (tm) {
    tm.name = 'sakura';
    group.add(tm);
  }

  // --- 巨大な机と椅子 (文化祭の教室を大きくしたような置物。コースの外) ---
  const deskGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(1.2, 0.06, 0.8)), 0xd8b080).translate(0, 0.72, 0),
    ...[[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]].map(([x, z]) => paint(flatten(new THREE.BoxGeometry(0.05, 0.72, 0.05)), 0x8a8a92).translate(x!, 0.36, z!)),
  ]);
  const chairGeo = mergeGeometries([
    paint(flatten(new THREE.BoxGeometry(0.42, 0.05, 0.42)), 0xd8b080).translate(0, 0.42, 0),
    paint(flatten(new THREE.BoxGeometry(0.42, 0.4, 0.05)), 0xd8b080).translate(0, 0.66, -0.2),
    ...[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([x, z]) => paint(flatten(new THREE.BoxGeometry(0.04, 0.42, 0.04)), 0x8a8a92).translate(x!, 0.21, z!)),
  ]);
  const desks: InstanceSpec[] = [];
  const chairs: InstanceSpec[] = [];
  for (let tries = 0; desks.length < 14 && tries < 3000; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, 16)) continue;
    const rot = rng.range(0, 6.28);
    desks.push({ x, y: 0, z, sx: 9, sy: 9, sz: 9, rotY: rot });
    chairs.push({ x: x - Math.sin(rot) * 6, y: 0, z: z - Math.cos(rot) * 6, sx: 9, sy: 9, sz: 9, rotY: rot });
  }
  const dm = makeInstanced(deskGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), desks, bag, { castShadow: preset.shadows });
  const chm = makeInstanced(chairGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), chairs, bag, { castShadow: preset.shadows });
  if (dm) {
    dm.name = 'giant-desks';
    group.add(dm);
  }
  if (chm) {
    chm.name = 'giant-chairs';
    group.add(chm);
  }

  // --- 野外ステージ (中庭) ---
  const stageSpot = findSpot(250, 180, 16);
  const stage = new THREE.Group();
  stage.name = 'stage';
  const floor = new THREE.Mesh(bag.add(new THREE.BoxGeometry(22, 1.4, 12)), bag.add(new THREE.MeshLambertMaterial({ color: 0x8a5a3a })));
  floor.position.y = 0.7;
  const back = new THREE.Mesh(bag.add(new THREE.BoxGeometry(22, 9, 0.8)), bag.add(new THREE.MeshLambertMaterial({ color: 0x2a2d6a })));
  back.position.set(0, 5.5, -6);
  stage.add(floor, back);
  for (const side of [-1, 1]) {
    const speaker = new THREE.Mesh(bag.add(new THREE.BoxGeometry(2, 4, 2)), bag.add(new THREE.MeshLambertMaterial({ color: 0x1a1a1a })));
    speaker.position.set(side * 12, 2, -3);
    stage.add(speaker);
  }
  stage.position.set(stageSpot.x, 0, stageSpot.z);
  group.add(stage);

  return { group };
}
