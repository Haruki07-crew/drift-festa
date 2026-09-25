/**
 * 背景づくりの共通部品 (v3 の新コースで共通利用)。
 *
 * - 道路沿いの物 (街灯・柵・旗など) は必ず「走れる範囲 (Road Safety Corridor)」の外に置く
 * - 同じ形の物は InstancedMesh にまとめて描画コールを減らす
 * - コース専用の見た目は各 *Scenery.ts に書き、ここには再利用できる物だけを置く
 */
import * as THREE from 'three';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import { drivableExtent } from '../RoadClearance';
import type { Track, TrackSample } from '../Track';
import { makeInstanced, makeWindowTexture, type InstanceSpec, type TrackProximityGrid } from './SceneryUtils';

/** 道路の外側 (走れる範囲の外端 + extra) の位置と、その地点の向き */
export interface RoadsidePoint {
  x: number;
  y: number;
  z: number;
  /** 道路の進行方向の角度 (rotY に使う) */
  heading: number;
  /** 道路側を向く角度 */
  facingRoad: number;
  sample: TrackSample;
}

export function roadsidePoint(track: Track, s: number, side: -1 | 1, extra: number): RoadsidePoint {
  const smp = track.sample(track.sampleIndexAt(s));
  const p = track.pointAt(s);
  const edge = side > 0 ? smp.right : smp.left;
  const lat = side * (drivableExtent(track, smp, edge) + extra);
  const rx = -p.tz;
  const rz = p.tx;
  const heading = Math.atan2(p.tx, p.tz);
  const roadEdgeY = p.y + side * smp.halfWidth * Math.tan(p.bank);
  return {
    x: p.x + rx * lat,
    y: roadEdgeY,
    z: p.z + rz * lat,
    heading,
    // 右側 (side > 0) から道路へ向かう方向は -右 = (cos h, -sin h) → 角度 h + π/2
    facingRoad: heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2),
    sample: smp,
  };
}

/**
 * 道路沿いに一定間隔で位置を列挙する (道路のない区間は飛ばす)。
 * @param range 周回上の割合の範囲 (省略 = 全体。開いた道はスタート手前〜ゴール後も含む)
 */
export function alongRoad(
  track: Track,
  spacing: number,
  side: -1 | 1 | 'both',
  extra: number,
  fn: (p: RoadsidePoint, index: number) => void,
  range?: { from: number; to: number },
): void {
  const s0 = range ? range.from * track.length : 0;
  const s1 = range ? range.to * track.length : track.closed ? track.length : track.length - 1;
  let k = 0;
  for (let s = s0; s < s1; s += spacing) {
    if (track.isGap(s)) continue;
    const sides: (-1 | 1)[] = side === 'both' ? [-1, 1] : [side];
    for (const sd of sides) fn(roadsidePoint(track, s, sd, extra), k++);
  }
}

export interface StreetLightOptions {
  spacing: number;
  side: -1 | 1 | 'both';
  /** 灯りの色 */
  color: number;
  /** 柱の色 */
  poleColor?: number;
  /** 灯りの高さ [m] (安全帯の上限 4.5m より十分高く) */
  height?: number;
  /** 道路側へ張り出す腕の長さ [m] */
  arm?: number;
  range?: { from: number; to: number };
}

/**
 * 街灯 (柱 + 道路側へ張り出す腕 + 発光する灯り)。実際のライトは使わず発光マテリアルで表現する。
 */
export function streetLights(track: Track, bag: ResourceBag, o: StreetLightOptions): THREE.Group {
  const g = new THREE.Group();
  g.name = 'street-lights';
  const h = o.height ?? 8;
  const arm = o.arm ?? 2.4;
  const poles: InstanceSpec[] = [];
  const arms: InstanceSpec[] = [];
  const heads: InstanceSpec[] = [];
  alongRoad(
    track,
    o.spacing,
    o.side,
    1.2,
    (p) => {
      poles.push({ x: p.x, y: p.y - 0.5, z: p.z, sy: h + 0.5 });
      const ax = Math.sin(p.facingRoad);
      const az = Math.cos(p.facingRoad);
      arms.push({ x: p.x + ax * arm * 0.5, y: p.y + h, z: p.z + az * arm * 0.5, sx: 0.18, sy: 0.18, sz: arm, rotY: p.facingRoad });
      heads.push({ x: p.x + ax * arm, y: p.y + h - 0.2, z: p.z + az * arm, rotY: p.facingRoad });
    },
    o.range,
  );
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 1, 6);
  poleGeo.translate(0, 0.5, 0);
  const pm = makeInstanced(poleGeo, new THREE.MeshLambertMaterial({ color: o.poleColor ?? 0x3a3d46 }), poles, bag);
  const am = makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: o.poleColor ?? 0x3a3d46 }), arms, bag);
  const hm = makeInstanced(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: o.color }), heads, bag);
  for (const m of [pm, am, hm]) if (m) g.add(m);
  return g;
}

export interface BuildingOptions {
  count: number;
  /** 置ける場所 (コースから離れた点) */
  spots: readonly { x: number; z: number }[];
  /** 置く位置のばらつき [m] */
  jitter: number;
  height: [number, number];
  width: [number, number];
  /** 夜 (窓が発光する) */
  night: boolean;
  baseColor: number;
  tints?: number[];
  /** 屋上・中腹のネオン帯の色 (空なら付けない) */
  neonColors?: number[];
  /** 窓の色 */
  windowColors?: string[];
  grid: TrackProximityGrid;
  clearance: number;
  yAt: (x: number, z: number) => number;
  seed: number;
}

/** 窓のあるビル群 (InstancedMesh)。昼は窓を暗く、夜は発光させる */
export function buildings(bag: ResourceBag, o: BuildingOptions): THREE.Group {
  const g = new THREE.Group();
  g.name = 'buildings';
  const rng = new SeededRandom(o.seed);
  const winTex = bag.add(
    makeWindowTexture(rng, o.windowColors ?? (o.night ? ['#ffe9a8', '#bfe8ff', '#ffffff'] : ['#4a5a70', '#5a7090', '#3a4a60']), o.night ? 0.45 : 0.7, o.night ? '#000000' : '#e4ded4'),
  );
  const mat = o.night
    ? new THREE.MeshLambertMaterial({ color: o.baseColor, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.85 })
    : new THREE.MeshLambertMaterial({ color: 0xffffff, map: winTex });
  const specs: InstanceSpec[] = [];
  const bands: InstanceSpec[] = [];
  const tints = o.tints ?? [0xffffff, 0xe8eef8, 0xf8f0e4, 0xe0f0ec];
  for (let tries = 0; specs.length < o.count && tries < o.count * 10 && o.spots.length > 0; tries++) {
    const c = rng.pick(o.spots as { x: number; z: number }[]);
    const x = c.x + rng.range(-o.jitter, o.jitter);
    const z = c.z + rng.range(-o.jitter, o.jitter);
    const h = rng.range(o.height[0], o.height[1]);
    const w = rng.range(o.width[0], o.width[1]);
    const d = rng.range(o.width[0], o.width[1]);
    // 建物の中心ではなく、角 (対角線の半分) まで道路から離れているか
    if (!o.grid.isClear(x, z, o.clearance + Math.hypot(w, d) / 2)) continue;
    const rot = rng.range(0, 0.5);
    const y = o.yAt(x, z) - 0.5;
    specs.push({ x, y, z, sx: w, sy: h, sz: d, rotY: rot, color: rng.pick(tints) });
    if (o.neonColors && o.neonColors.length > 0 && rng.next() < 0.5) {
      bands.push({ x, y: y + h * rng.range(0.55, 0.98), z, sx: w + 0.5, sy: 0.7, sz: d + 0.5, rotY: rot, color: rng.pick(o.neonColors) });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const bm = makeInstanced(geo, mat, specs, bag, { receiveShadow: true });
  if (bm) {
    bm.name = 'buildings';
    g.add(bm);
  }
  const nm = makeInstanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), bands, bag);
  if (nm) g.add(nm);
  return g;
}

/** 大きな地面 (または海) の板 */
export function groundPlane(bag: ResourceBag, center: { x: number; z: number }, size: number, y: number, material: THREE.Material): THREE.Mesh {
  const geo = bag.add(new THREE.PlaneGeometry(size, size));
  geo.rotateX(-Math.PI / 2);
  bag.add(material);
  const m = new THREE.Mesh(geo, material);
  m.position.set(center.x, y, center.z);
  m.receiveShadow = true;
  return m;
}

export interface MountainRingOptions {
  count: number;
  radius: number;
  height: [number, number];
  width: [number, number];
  color: number;
  /** 雪をかぶせる割合 (0 = なし) */
  snowCap?: number;
  y: number;
  seed: number;
}

/** 遠くを囲む山並み (低ポリの角錐) */
export function mountainRing(bag: ResourceBag, center: { x: number; z: number }, o: MountainRingOptions): THREE.Group {
  const g = new THREE.Group();
  g.name = 'mountains';
  const rng = new SeededRandom(o.seed);
  const specs: InstanceSpec[] = [];
  const caps: InstanceSpec[] = [];
  for (let k = 0; k < o.count; k++) {
    const a = (k / o.count) * Math.PI * 2 + rng.range(-0.08, 0.08);
    const r = o.radius * rng.range(0.9, 1.15);
    const h = rng.range(o.height[0], o.height[1]);
    const w = rng.range(o.width[0], o.width[1]);
    const x = center.x + Math.cos(a) * r;
    const z = center.z + Math.sin(a) * r;
    const rot = rng.range(0, 6.28);
    specs.push({ x, y: o.y, z, sx: w, sy: h, sz: w * rng.range(0.7, 1.2), rotY: rot });
    if (o.snowCap && o.snowCap > 0) {
      const f = o.snowCap;
      caps.push({ x, y: o.y + h * (1 - f), z, sx: w * f * 1.02, sy: h * f * 1.01, sz: w * f * 1.02, rotY: rot });
    }
  }
  const geo = new THREE.ConeGeometry(0.5, 1, 5);
  geo.translate(0, 0.5, 0);
  const mm = makeInstanced(geo, new THREE.MeshLambertMaterial({ color: o.color, flatShading: true }), specs, bag);
  if (mm) g.add(mm);
  if (caps.length > 0) {
    const cg = new THREE.ConeGeometry(0.5, 1, 5);
    cg.translate(0, 0.5, 0);
    const cm = makeInstanced(cg, new THREE.MeshLambertMaterial({ color: 0xf6f9ff, flatShading: true }), caps, bag);
    if (cm) g.add(cm);
  }
  return g;
}

/**
 * 道路から clearance 以上離れた点を area の中に count 個置き、形 geo の InstancedMesh を作る。
 */
export function scatterInstances(
  bag: ResourceBag,
  grid: TrackProximityGrid,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  o: {
    count: number;
    area: { minX: number; maxX: number; minZ: number; maxZ: number };
    clearance: number;
    yAt: (x: number, z: number) => number;
    scale: [number, number];
    tints?: number[];
    seed: number;
    castShadow?: boolean;
    /** 置かない場所 (true = 置かない) */
    exclude?: (x: number, z: number) => boolean;
    name?: string;
  },
): THREE.InstancedMesh | null {
  const rng = new SeededRandom(o.seed);
  const specs: InstanceSpec[] = [];
  for (let tries = 0; specs.length < o.count && tries < o.count * 12; tries++) {
    const x = rng.range(o.area.minX, o.area.maxX);
    const z = rng.range(o.area.minZ, o.area.maxZ);
    if (!grid.isClear(x, z, o.clearance) || o.exclude?.(x, z)) continue;
    const s = rng.range(o.scale[0], o.scale[1]);
    specs.push({ x, y: o.yAt(x, z), z, sx: s, sy: s * rng.range(0.9, 1.25), sz: s, rotY: rng.range(0, 6.28), color: o.tints ? rng.pick(o.tints) : undefined });
  }
  const m = makeInstanced(geo, material, specs, bag, { castShadow: o.castShadow });
  if (m && o.name) m.name = o.name;
  return m;
}

/** 道路の周囲の範囲 (bounds に margin を足したもの) */
export function areaAround(track: Track, margin: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const b = track.bounds;
  return { minX: b.minX - margin, maxX: b.maxX + margin, minZ: b.minZ - margin, maxZ: b.maxZ + margin };
}

export function centerOf(track: Track): { x: number; z: number } {
  const b = track.bounds;
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
}

/** Canvas で文字の看板テクスチャを作る */
export function makeSignTexture(text: string, bg: string, fg: string, width = 256, height = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = fg;
    ctx.font = `bold ${Math.floor(height * 0.62)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 3D の線分 (from → to) に沿って伸ばした箱の行列 (ケーブル・鉄骨用) */
export function beamMatrix(from: THREE.Vector3, to: THREE.Vector3, thickness: number): THREE.Matrix4 {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
  return new THREE.Matrix4().compose(mid, q, new THREE.Vector3(thickness, thickness, len));
}

/** beamMatrix の一覧を1つの InstancedMesh にする */
export function beams(bag: ResourceBag, matrices: readonly THREE.Matrix4[], material: THREE.Material, name?: string): THREE.InstancedMesh | null {
  if (matrices.length === 0) return null;
  const geo = bag.add(new THREE.BoxGeometry(1, 1, 1));
  bag.add(material);
  const m = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((mm, i) => m.setMatrixAt(i, mm));
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  if (name) m.name = name;
  return m;
}

/**
 * 地面 (または水面) のタイル。道路に覆いかぶさらない場所 (安全帯の地形上限 terrainLimit が
 * top 以上の場所) だけに敷く。道路が地面より低い区間 (切り通し・トンネル) の周りは自動で空く。
 */
export function groundTiles(
  track: Track,
  bag: ResourceBag,
  o: {
    cell: number;
    margin: number;
    top: number;
    bottom: number;
    material: THREE.Material;
    /** タイルを置く場所の追加条件 (false = 置かない) */
    where?: (x: number, z: number) => boolean;
    limit: (x: number, z: number) => number;
    name?: string;
  },
): THREE.InstancedMesh | null {
  const b = track.bounds;
  const specs: InstanceSpec[] = [];
  for (let x = b.minX - o.margin; x < b.maxX + o.margin; x += o.cell) {
    for (let z = b.minZ - o.margin; z < b.maxZ + o.margin; z += o.cell) {
      const cx = x + o.cell / 2;
      const cz = z + o.cell / 2;
      if (o.where && !o.where(cx, cz)) continue;
      // タイルの四隅と中央で確認 (道路に近い所はタイルごと除外)
      const h = o.cell / 2;
      const ok = [[0, 0], [-h, -h], [h, -h], [-h, h], [h, h]].every(([dx, dz]) => o.limit(cx + dx!, cz + dz!) >= o.top);
      if (!ok) continue;
      specs.push({ x: cx, y: o.bottom, z: cz, sx: o.cell, sy: o.top - o.bottom, sz: o.cell });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const m = makeInstanced(geo, o.material, specs, bag, { receiveShadow: true });
  if (m && o.name) m.name = o.name;
  return m;
}

/** 丸い粒 (雪・砂) のテクスチャ。四角い点にならないように */
export function makeRoundSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * 橋脚とアーチ (道路の区間 from..to の下)。石橋・海の橋などで使う。
 * 橋脚は道路の中心の真下 (道路の下なので安全帯にはかからない) に、底は bottom まで伸ばす。
 */
export function bridgePiers(
  track: Track,
  bag: ResourceBag,
  o: { from: number; to: number; spacing: number; bottom: number; color: number; archColor?: number },
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bridge-piers';
  const piers: THREE.Matrix4[] = [];
  const s0 = o.from * track.length;
  const s1 = o.to * track.length;
  for (let s = s0 + o.spacing / 2; s < s1; s += o.spacing) {
    const p = track.pointAt(s);
    const top = p.y - 0.8;
    if (top - o.bottom < 2) continue;
    piers.push(beamMatrix(new THREE.Vector3(p.x, o.bottom, p.z), new THREE.Vector3(p.x, top, p.z), 4));
  }
  const pm = beams(bag, piers, new THREE.MeshLambertMaterial({ color: o.color }), 'piers');
  if (pm) g.add(pm);
  // 橋桁 (道路の下の厚み。道路の幅いっぱい)
  const girders: InstanceSpec[] = [];
  const step = track.spacing * 3;
  for (let s = s0; s < s1 - step; s += step) {
    const p = track.pointAt(s + step / 2);
    girders.push({ x: p.x, y: p.y - 2.1, z: p.z, sx: p.halfWidth * 2 + 1, sy: 1.6, sz: step + 0.4, rotY: Math.atan2(p.tx, p.tz) });
  }
  const girderGeo = new THREE.BoxGeometry(1, 1, 1);
  girderGeo.translate(0, 0.5, 0);
  const gm = makeInstanced(girderGeo, new THREE.MeshLambertMaterial({ color: o.archColor ?? o.color }), girders, bag);
  if (gm) {
    gm.name = 'girders';
    g.add(gm);
  }
  return g;
}
