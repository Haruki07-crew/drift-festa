/**
 * 背景オブジェクト配置の共通処理。
 */
import * as THREE from 'three';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';

/**
 * コースからの距離を粗いグリッドで保持する。
 * 背景オブジェクトをコース上や壁に重ならないように置くための判定と、
 * 地形生成時の最近傍サンプルのヒントに使う。
 */
export class TrackProximityGrid {
  readonly cellSize: number;
  readonly minX: number;
  readonly minZ: number;
  readonly cols: number;
  readonly rows: number;
  /** 各セルからコース路肩外側までのおおよその距離 [m] */
  readonly clearance: Float32Array;
  /** 各セルに最も近いサンプル番号 */
  readonly nearest: Int32Array;

  constructor(track: Track, margin: number, cellSize = 6, influence = 90) {
    this.cellSize = cellSize;
    const b = track.bounds;
    this.minX = b.minX - margin;
    this.minZ = b.minZ - margin;
    this.cols = Math.ceil((b.maxX - b.minX + margin * 2) / cellSize) + 1;
    this.rows = Math.ceil((b.maxZ - b.minZ + margin * 2) / cellSize) + 1;
    const count = this.cols * this.rows;
    this.clearance = new Float32Array(count).fill(Infinity);
    this.nearest = new Int32Array(count).fill(-1);
    const bestD = new Float32Array(count).fill(Infinity);
    const runoff = track.def.runoffWidth;
    const r = Math.ceil(influence / cellSize);
    track.samples.forEach((s, idx) => {
      const cx = Math.floor((s.x - this.minX) / cellSize);
      const cz = Math.floor((s.z - this.minZ) / cellSize);
      const edge = s.halfWidth + Math.max(runoff, 1.2);
      for (let dz = -r; dz <= r; dz++) {
        const zz = cz + dz;
        if (zz < 0 || zz >= this.rows) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = cx + dx;
          if (xx < 0 || xx >= this.cols) continue;
          const k = zz * this.cols + xx;
          const wx = this.minX + (xx + 0.5) * cellSize;
          const wz = this.minZ + (zz + 0.5) * cellSize;
          const d = Math.hypot(wx - s.x, wz - s.z);
          if (d < bestD[k]!) {
            bestD[k] = d;
            this.nearest[k] = idx;
          }
          const c = d - edge;
          if (c < this.clearance[k]!) this.clearance[k] = c;
        }
      }
    });
  }

  private index(x: number, z: number): number {
    const cx = Math.floor((x - this.minX) / this.cellSize);
    const cz = Math.floor((z - this.minZ) / this.cellSize);
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return -1;
    return cz * this.cols + cx;
  }

  /** コース路肩の外側から min [m] 以上離れているか */
  isClear(x: number, z: number, min: number): boolean {
    const k = this.index(x, z);
    if (k < 0) return true;
    return this.clearance[k]! - this.cellSize * 0.75 > min;
  }

  clearanceAt(x: number, z: number): number {
    const k = this.index(x, z);
    return k < 0 ? Infinity : this.clearance[k]!;
  }

  nearestSample(x: number, z: number): number | undefined {
    const k = this.index(x, z);
    if (k < 0) return undefined;
    const v = this.nearest[k]!;
    return v >= 0 ? v : undefined;
  }
}

export interface InstanceSpec {
  x: number;
  y: number;
  z: number;
  sx?: number;
  sy?: number;
  sz?: number;
  rotY?: number;
  color?: number;
}

/** 同じ形のオブジェクトを InstancedMesh でまとめて描画 (描画コール削減) */
export function makeInstanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  specs: readonly InstanceSpec[],
  bag: ResourceBag,
  opts: { castShadow?: boolean; receiveShadow?: boolean } = {},
): THREE.InstancedMesh | null {
  if (specs.length === 0) {
    geometry.dispose();
    return null;
  }
  bag.add(geometry);
  bag.add(material);
  const mesh = new THREE.InstancedMesh(geometry, material, specs.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  specs.forEach((spec, i) => {
    p.set(spec.x, spec.y, spec.z);
    q.setFromAxisAngle(up, spec.rotY ?? 0);
    s.set(spec.sx ?? 1, spec.sy ?? 1, spec.sz ?? 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    if (spec.color !== undefined) {
      mesh.setColorAt(i, c.setHex(spec.color));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = opts.castShadow ?? false;
  mesh.receiveShadow = opts.receiveShadow ?? false;
  mesh.computeBoundingSphere();
  return mesh;
}

/** 形状の底面を y=0 に合わせる (インスタンス配置で地面に置きやすくする) */
export function baseAligned<T extends THREE.BufferGeometry>(g: T, height: number): T {
  g.translate(0, height / 2, 0);
  return g;
}

/** 低ポリの木 (幹 + 葉) のジオメトリを1つにまとめる */
export function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  for (const part of parts) {
    const g = part.index ? part.toNonIndexed() : part;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const col = g.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      if (col) colors.push(col.getX(i), col.getY(i), col.getZ(i));
      else colors.push(1, 1, 1);
    }
    if (g !== part) g.dispose();
    part.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.computeBoundingSphere();
  return out;
}

/** ジオメトリ全体に頂点カラーを塗る */
export function paint<T extends THREE.BufferGeometry>(g: T, hex: number): T {
  const c = new THREE.Color(hex);
  const count = g.getAttribute('position').count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** 平面ジオメトリのフラットシェーディング化 (ローポリ感) */
export function flatten(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  if (ng !== g) g.dispose();
  return ng;
}

/** 背景ビルダーの戻り値 (update があれば毎フレーム呼ばれる。魚・飛行船・雪などのアニメーション) */
export interface SceneryResult {
  group: THREE.Group;
  update?: (dt: number) => void;
}

/**
 * コースから離れた場所にランダムに点を置く。
 * @param yAt 置く高さ
 */
export function scatter(
  grid: TrackProximityGrid,
  rng: { range(a: number, b: number): number },
  count: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  clearance: number,
  yAt: (x: number, z: number) => number,
): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = [];
  for (let tries = 0; out.length < count && tries < count * 12; tries++) {
    const x = rng.range(area.minX, area.maxX);
    const z = rng.range(area.minZ, area.maxZ);
    if (!grid.isClear(x, z, clearance)) continue;
    out.push({ x, y: yAt(x, z), z });
  }
  return out;
}

/**
 * コースから clearance 以上離れた格子状のセル中心 (埋立地・机の天板などを敷く場所)。
 * avoid の点から avoidRadius 以内は除外 (落下区間の下を空けるため)。
 */
export function landCells(
  track: Track,
  grid: TrackProximityGrid,
  cell: number,
  margin: number,
  clearance: number,
  avoid: { x: number; z: number }[] = [],
  avoidRadius = 0,
): { x: number; z: number }[] {
  const b = track.bounds;
  const out: { x: number; z: number }[] = [];
  for (let x = b.minX - margin; x < b.maxX + margin; x += cell) {
    for (let z = b.minZ - margin; z < b.maxZ + margin; z += cell) {
      if (!grid.isClear(x, z, clearance)) continue;
      if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < avoidRadius)) continue;
      out.push({ x, z });
    }
  }
  return out;
}

/** 窓明かりのテクスチャ (実行時生成) */
export function makeWindowTexture(rng: { next(): number }, colors: string[], density = 0.42, background = '#000000'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 64, 128);
    for (let y = 2; y < 128; y += 6) {
      for (let x = 2; x < 64; x += 6) {
        if (rng.next() < density) {
          ctx.fillStyle = colors[Math.floor(rng.next() * colors.length)]!;
          ctx.globalAlpha = 0.5 + rng.next() * 0.5;
          ctx.fillRect(x, y, 3, 3);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
