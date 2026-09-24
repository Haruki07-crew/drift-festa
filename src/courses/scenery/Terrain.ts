/**
 * 道路に沿った地形 (ハイトフィールド) の生成。峠・雪山・ジャングルなどで共通利用する。
 * 壁側は山肌がせり上がり、柵なし側は谷へ落ち、ガードレール側はなだらかに下る。
 */
import * as THREE from 'three';
import { GeometryBuilder } from '../../render/GeometryBuilder';
import type { ResourceBag } from '../../render/dispose';
import { createProjection, type Track } from '../Track';
import type { TrackProximityGrid } from './SceneryUtils';

export interface TerrainOptions {
  margin: number;
  cell: number;
  colorLow: number;
  colorHigh: number;
  colorRock: number;
  /** 壁側の山肌の最大高さ [m] */
  wallRise: number;
  /** 道から離れた基本地形の高さ (groundLevel からの加算) */
  baseOffset: number;
  /** 起伏の強さ */
  noiseScale: number;
}

export interface Terrain {
  mesh: THREE.Mesh;
  heightAt: (x: number, z: number) => number;
  minX: number;
  minZ: number;
  sizeX: number;
  sizeZ: number;
}

export function buildTerrain(track: Track, grid: TrackProximityGrid, bag: ResourceBag, o: TerrainOptions): Terrain {
  const env = track.def.environment;
  const b = track.bounds;
  const proj = createProjection();
  const noise = (x: number, z: number): number =>
    (Math.sin(x * 0.021) * Math.cos(z * 0.017) * 6 + Math.sin(x * 0.053 + z * 0.041) * 2.5) * o.noiseScale;
  const heightFn = (x: number, z: number): number => {
    const hint = grid.nearestSample(x, z);
    const base = env.groundLevel + o.baseOffset + noise(x, z) * 2;
    if (hint === undefined) return base;
    const p = track.project(x, z, hint, proj);
    const d = Math.abs(p.lateral) - p.halfWidth;
    const edge = p.lateral >= 0 ? p.right : p.left;
    const roadY = p.cy + p.lateral * Math.tan(p.bank);
    let h: number;
    if (d < 0.5) h = roadY - 1.2;
    else if (edge === 'wall') h = roadY + Math.min(o.wallRise, (d - 0.5) * 1.1) + noise(x, z) * 0.6;
    else if (edge === 'fall') h = roadY - 3 - (d - 0.5) * 2.2 + noise(x, z) * 0.4;
    else if (edge === 'grass') h = roadY - 0.3 - Math.max(0, d - track.def.runoffWidth) * 0.5;
    else h = roadY - 1.5 - (d - 0.5) * 0.7 + noise(x, z) * 0.5;
    const far = Math.min(1, Math.max(0, (d - 40) / 70));
    h = h * (1 - far) + base * far;
    return Math.max(env.groundLevel - 4, h);
  };

  const minX = b.minX - o.margin;
  const minZ = b.minZ - o.margin;
  const cols = Math.ceil((b.maxX - b.minX + o.margin * 2) / o.cell);
  const rows = Math.ceil((b.maxZ - b.minZ + o.margin * 2) / o.cell);
  const heights = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      heights[j * (cols + 1) + i] = heightFn(minX + i * o.cell, minZ + j * o.cell);
    }
  }
  const gb = new GeometryBuilder();
  const low = new THREE.Color(o.colorLow);
  const high = new THREE.Color(o.colorHigh);
  const rock = new THREE.Color(o.colorRock);
  const tmp = new THREE.Color();
  const colorFor = (y0: number, y1: number, y2: number): THREE.Color => {
    const steep = Math.max(Math.abs(y1 - y0), Math.abs(y2 - y0)) / o.cell;
    tmp.copy(steep > 0.9 ? rock : (Math.floor(y0) & 1) === 0 ? low : high);
    return tmp;
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = minX + i * o.cell;
      const z0 = minZ + j * o.cell;
      const x1 = x0 + o.cell;
      const z1 = z0 + o.cell;
      const h00 = heights[j * (cols + 1) + i]!;
      const h10 = heights[j * (cols + 1) + i + 1]!;
      const h01 = heights[(j + 1) * (cols + 1) + i]!;
      const h11 = heights[(j + 1) * (cols + 1) + i + 1]!;
      gb.tri(x0, h00, z0, x0, h01, z1, x1, h11, z1, colorFor(h00, h01, h11));
      gb.tri(x0, h00, z0, x1, h11, z1, x1, h10, z0, colorFor(h00, h11, h10));
    }
  }
  const mesh = new THREE.Mesh(bag.add(gb.build()), bag.add(new THREE.MeshLambertMaterial({ vertexColors: true })));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  const heightAt = (x: number, z: number): number => {
    const fi = (x - minX) / o.cell;
    const fj = (z - minZ) / o.cell;
    const i = Math.max(0, Math.min(cols - 1, Math.floor(fi)));
    const j = Math.max(0, Math.min(rows - 1, Math.floor(fj)));
    const u = Math.max(0, Math.min(1, fi - i));
    const v = Math.max(0, Math.min(1, fj - j));
    const h00 = heights[j * (cols + 1) + i]!;
    const h10 = heights[j * (cols + 1) + i + 1]!;
    const h01 = heights[(j + 1) * (cols + 1) + i]!;
    const h11 = heights[(j + 1) * (cols + 1) + i + 1]!;
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  };
  return { mesh, heightAt, minX, minZ, sizeX: cols * o.cell, sizeZ: rows * o.cell };
}
