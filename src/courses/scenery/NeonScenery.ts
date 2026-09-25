/**
 * NEON GRAVITY の背景: 夜の巨大ネオン都市。光るグリッドの地面・発光ビル・ネオン看板・
 * 空中で回るホログラムのリング・サーチライト。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { TrackProximityGrid, makeInstanced, makeWindowTexture, scatter, type InstanceSpec, type SceneryResult } from './SceneryUtils';

export function buildNeonScenery(track: Track, preset: QualityPreset, bag: ResourceBag): SceneryResult {
  const group = new THREE.Group();
  group.name = 'scenery-neon';
  const env = track.def.environment;
  const rng = new SeededRandom(8008);
  const grid = new TrackProximityGrid(track, 300, 8, 140);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // --- 光るグリッドの地面 ---
  const gridTex = bag.add(makeGridTexture());
  gridTex.wrapS = THREE.RepeatWrapping;
  gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(200, 200);
  const groundGeo = bag.add(new THREE.PlaneGeometry(4000, 4000));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, bag.add(new THREE.MeshBasicMaterial({ map: gridTex })));
  ground.position.set(cx, env.groundLevel, cz);
  group.add(ground);

  // --- 発光ビル ---
  const winTex = bag.add(makeWindowTexture(rng, ['#ff2d95', '#39f3ff', '#b98cff', '#ffe45c'], 0.5));
  const bMat = new THREE.MeshLambertMaterial({ color: 0x1c1a2c, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1 });
  const area = { minX: b.minX - 280, maxX: b.maxX + 280, minZ: b.minZ - 280, maxZ: b.maxZ + 280 };
  const specs = scatter(grid, rng, Math.floor(300 * preset.sceneryDensity) + 40, area, 16, () => env.groundLevel).map<InstanceSpec>((p) => {
    const h = rng.range(30, 160);
    const w = rng.range(12, 26);
    return { ...p, sx: w, sy: h, sz: w * rng.range(0.7, 1.4), rotY: rng.range(0, 0.6), color: [0xffffff, 0xffd0f0, 0xd0f8ff][Math.floor(rng.next() * 3)]! };
  });
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMesh = makeInstanced(bGeo, bMat, specs, bag);
  if (bMesh) group.add(bMesh);
  // ネオンの帯 (屋上と中腹)
  const bands: InstanceSpec[] = [];
  const neon = [0xff2d95, 0x39f3ff, 0xb98cff, 0xffe45c, 0x39ff9e];
  for (const sp of specs) {
    if (rng.next() < 0.6) {
      const h = sp.sy ?? 10;
      bands.push({ x: sp.x, y: sp.y + h * rng.range(0.4, 1), z: sp.z, sx: (sp.sx ?? 10) + 0.6, sy: 0.8, sz: (sp.sz ?? 10) + 0.6, rotY: sp.rotY, color: rng.pick(neon) });
    }
  }
  const bandGeo = new THREE.BoxGeometry(1, 1, 1);
  const bandMesh = makeInstanced(bandGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), bands, bag);
  if (bandMesh) group.add(bandMesh);

  // --- ホログラムのリング ---
  const ringGeo = bag.add(new THREE.TorusGeometry(14, 0.8, 6, 32));
  const rings: THREE.Mesh[] = [];
  for (let k = 0; k < 8; k++) {
    const s = (track.length * k) / 8 + 40;
    const p = track.pointAt(s);
    const mat = bag.add(new THREE.MeshBasicMaterial({ color: rng.pick(neon), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    const m = new THREE.Mesh(ringGeo, mat);
    // 立体交差の上の道路にもかからない高さに浮かべる
    m.position.set(p.x, p.y + 30, p.z);
    m.name = 'holo-ring';
    group.add(m);
    rings.push(m);
  }

  // --- サーチライト ---
  const beamGeo = bag.add(new THREE.ConeGeometry(6, 120, 12, 1, true));
  beamGeo.translate(0, 60, 0);
  const beamMat = bag.add(new THREE.MeshBasicMaterial({ color: 0x8fdfff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beams: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(beamGeo, beamMat);
    const a = (k / 6) * Math.PI * 2;
    m.position.set(cx + Math.cos(a) * 260, env.groundLevel, cz + Math.sin(a) * 260);
    group.add(m);
    beams.push(m);
  }

  let time = 0;
  const update = (dt: number): void => {
    time += dt;
    rings.forEach((r, i) => {
      r.rotation.y = time * 0.6 + i;
      r.rotation.x = Math.sin(time * 0.4 + i) * 0.4;
    });
    beams.forEach((m, i) => {
      m.rotation.z = Math.sin(time * 0.3 + i) * 0.5;
      m.rotation.x = Math.cos(time * 0.25 + i * 2) * 0.4;
    });
  };
  update(0);
  return { group, update };
}

function makeGridTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#7a2aff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
