/**
 * AQUA SHIFT の背景: 海面・海上研究施設・海底 (砂・海藻・サンゴ・岩)・泳ぐ巨大魚と魚の群れ・泡。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { addBox } from './CircuitScenery';
import { coral, fish, seaweed } from './Props';
import { TrackProximityGrid, flatten, makeInstanced, scatter, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildAquaScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-aqua';
  const env = track.def.environment;
  const rng = new SeededRandom(4401);
  const grid = new TrackProximityGrid(track, 200, 8, 120);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const area = { minX: b.minX - 150, maxX: b.maxX + 150, minZ: b.minZ - 150, maxZ: b.maxZ + 150 };

  // --- 海面 (下からも見える) ---
  const seaGeo = bag.add(new THREE.PlaneGeometry(4000, 4000));
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(
    seaGeo,
    bag.add(new THREE.MeshStandardMaterial({ color: 0x1a86c0, transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false })),
  );
  sea.position.set(cx, -0.4, cz);
  sea.renderOrder = 4;
  group.add(sea);

  // --- 海底 ---
  const bedGeo = bag.add(new THREE.PlaneGeometry(4000, 4000, 1, 1));
  bedGeo.rotateX(-Math.PI / 2);
  const bed = new THREE.Mesh(bedGeo, bag.add(new THREE.MeshLambertMaterial({ color: env.groundColor })));
  bed.position.set(cx, env.groundLevel, cz);
  group.add(bed);

  // --- 海底の小物 ---
  const weeds = scatter(grid, rng, Math.floor(420 * preset.sceneryDensity), area, 3, () => env.groundLevel).map<InstanceSpec>((p) => ({
    ...p,
    sx: rng.range(0.6, 1.4),
    sy: rng.range(0.7, 2.2),
    sz: rng.range(0.6, 1.4),
    rotY: rng.range(0, 6.28),
    color: [0xffffff, 0xc8f0c0, 0xa0e0b0][Math.floor(rng.next() * 3)]!,
  }));
  const weedMesh = makeInstanced(seaweed(), new THREE.MeshLambertMaterial({ vertexColors: true }), weeds, bag);
  if (weedMesh) group.add(weedMesh);
  const corals = scatter(grid, rng, Math.floor(220 * preset.sceneryDensity), area, 2, () => env.groundLevel).map<InstanceSpec>((p) => ({
    ...p,
    sx: rng.range(1, 2.5),
    sy: rng.range(1, 2.5),
    sz: rng.range(1, 2.5),
    rotY: rng.range(0, 6.28),
    color: [0xff7a8a, 0xffb04a, 0xb88aff, 0x6ae0ff][Math.floor(rng.next() * 4)]!,
  }));
  const coralMesh = makeInstanced(coral(0xffffff), new THREE.MeshLambertMaterial({ vertexColors: true }), corals, bag);
  if (coralMesh) group.add(coralMesh);
  const rocks = scatter(grid, rng, 90, area, 3, () => env.groundLevel).map<InstanceSpec>((p) => {
    const s = rng.range(2, 7);
    return { ...p, sx: s * 1.3, sy: s, sz: s, rotY: rng.range(0, 6.28) };
  });
  const rockMesh = makeInstanced(flatten(new THREE.DodecahedronGeometry(1, 0)), new THREE.MeshLambertMaterial({ color: 0x5a6a78 }), rocks, bag);
  if (rockMesh) group.add(rockMesh);

  // --- 海上研究施設 (スタート付近) ---
  const facility = new GeometryBuilder();
  for (let s = track.length - 160; s < track.length + 160; s += 45) {
    const p = track.pointAt(s);
    const h = Math.atan2(p.tx, p.tz);
    for (const side of [-1, 1]) {
      const lat = side * (p.halfWidth + 16);
      const x = p.x - p.tz * lat;
      const z = p.z + p.tx * lat;
      addBox(facility, x, -1, z, 30, 3, 16, h, 0xd8e0e8);
      addBox(facility, x, 2, z, 12, rng.range(5, 12), 9, h, rng.next() < 0.5 ? 0xf2f6fa : 0xffb347);
      addBox(facility, x, 2, z, 1, 22, 1, h, 0x8a96a4);
    }
  }
  const facMesh = new THREE.Mesh(bag.add(facility.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  facMesh.castShadow = preset.shadows;
  facMesh.receiveShadow = true;
  group.add(facMesh);
  // ドーム
  const domeGeo = bag.add(new THREE.SphereGeometry(6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2));
  const domeMat = bag.add(new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.55, roughness: 0.1 }));
  for (const s of [track.length - 60, 70]) {
    const p = track.pointAt(s);
    const lat = p.halfWidth + 34;
    const d = new THREE.Mesh(domeGeo, domeMat);
    d.position.set(p.x - p.tz * lat, 2, p.z + p.tx * lat);
    group.add(d);
  }

  // --- 泳ぐ巨大魚 (トンネルの周りを回る) ---
  const underwater = track.samples.filter((smp) => smp.y < -10);
  const center = underwater.length > 0
    ? underwater.reduce((acc, smp) => ({ x: acc.x + smp.x / underwater.length, z: acc.z + smp.z / underwater.length }), { x: 0, z: 0 })
    : { x: cx, z: cz };
  const bigFishGeo = bag.add(fish(0xffa02a, 0xff5a2a));
  const bigFishMat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const bigFish: { mesh: THREE.Mesh; radius: number; speed: number; phase: number; y: number }[] = [];
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(bigFishGeo, bigFishMat);
    m.scale.setScalar(rng.range(3, 5));
    group.add(m);
    bigFish.push({ mesh: m, radius: rng.range(90, 170), speed: rng.range(0.05, 0.1) * (k % 2 === 0 ? 1 : -1), phase: rng.range(0, 6.28), y: rng.range(-32, -14) });
  }
  // 魚の群れ
  const schoolCount = Math.floor(60 * preset.sceneryDensity) + 10;
  const schoolGeo = fish(0x6ae0ff, 0x2a8aff);
  const school = new THREE.InstancedMesh(bag.add(schoolGeo), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })), schoolCount);
  school.frustumCulled = false;
  const schoolData = Array.from({ length: schoolCount }, () => ({
    r: rng.range(40, 110),
    a: rng.range(0, 6.28),
    y: rng.range(-30, -8),
    s: rng.range(0.25, 0.45),
  }));
  group.add(school);

  // --- 泡 ---
  const bubbleCount = 400;
  const bubblePos = new Float32Array(bubbleCount * 3);
  for (let i = 0; i < bubbleCount; i++) {
    bubblePos[i * 3] = center.x + rng.range(-200, 200);
    bubblePos[i * 3 + 1] = rng.range(env.groundLevel, -1);
    bubblePos[i * 3 + 2] = center.z + rng.range(-200, 200);
  }
  const bubbleGeo = bag.add(new THREE.BufferGeometry());
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3).setUsage(THREE.DynamicDrawUsage));
  const bubbles = new THREE.Points(bubbleGeo, bag.add(new THREE.PointsMaterial({ color: 0xdff6ff, size: 0.45, transparent: true, opacity: 0.7 })));
  bubbles.frustumCulled = false;
  group.add(bubbles);

  let time = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const update = (dt: number): void => {
    time += dt;
    for (const f of bigFish) {
      const a = f.phase + time * f.speed;
      f.mesh.position.set(center.x + Math.cos(a) * f.radius, f.y + Math.sin(time * 0.7 + f.phase) * 2, center.z + Math.sin(a) * f.radius);
      f.mesh.rotation.y = -a + (f.speed > 0 ? 0 : Math.PI);
    }
    schoolData.forEach((d, i) => {
      const a = d.a + time * 0.25;
      pos.set(center.x + Math.cos(a) * d.r, d.y + Math.sin(time + i) * 0.8, center.z + Math.sin(a) * d.r);
      q.setFromAxisAngle(up, -a);
      scl.setScalar(d.s);
      m4.compose(pos, q, scl);
      school.setMatrixAt(i, m4);
    });
    school.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < bubbleCount; i++) {
      let y = bubblePos[i * 3 + 1]! + dt * 2.2;
      if (y > -0.8) y = env.groundLevel;
      bubblePos[i * 3 + 1] = y;
    }
    (bubbleGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  };
  update(0);
  return { group, update };
}
