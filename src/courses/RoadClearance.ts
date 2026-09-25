/**
 * Road Safety Corridor (道路の安全帯) の判定。
 *
 * 地形や背景物が「走れる範囲」の上に覆いかぶさっていないかを調べる。
 * コース検証スクリプト (npm run check:courses) とデバッグ表示から使う。
 * 立体交差や近接する別区間にも対応するため、最寄りの1区間ではなく近くの全サンプルで判定する。
 */
import * as THREE from 'three';
import { courseQualityConfig } from '../config/courseQuality';
import type { EdgeType } from '../config/courses';
import type { Track, TrackSample } from './Track';

const cfg = courseQualityConfig;
const HASH_CELL = 16;

export interface CorridorHit {
  sampleIndex: number;
  s: number;
  lateral: number;
  /** 路面からの高さ [m] */
  height: number;
  x: number;
  y: number;
  z: number;
}

export interface IntrusionReport {
  object: string;
  count: number;
  worst: CorridorHit;
}

/** 路肩の種類ごとの「走れる範囲」の外端 (中心からの距離) */
export function drivableExtent(track: Track, sample: TrackSample, edge: EdgeType): number {
  switch (edge) {
    case 'wall':
    case 'guardrail':
      return sample.halfWidth + 0.6 + cfg.corridor.margin;
    case 'grass':
      return sample.halfWidth + track.def.runoffWidth + cfg.corridor.margin;
    case 'fall':
      return sample.halfWidth + cfg.corridor.fallEdgeMargin;
  }
}

export class RoadCorridor {
  readonly track: Track;
  private readonly hash = new Map<string, number[]>();
  private maxExtent = 0;

  constructor(track: Track) {
    this.track = track;
    track.samples.forEach((s, i) => {
      const ext = Math.max(drivableExtent(track, s, s.left), drivableExtent(track, s, s.right));
      this.maxExtent = Math.max(this.maxExtent, ext);
      const key = this.key(s.x, s.z);
      let list = this.hash.get(key);
      if (!list) this.hash.set(key, (list = []));
      list.push(i);
    });
  }

  private key(x: number, z: number): string {
    return `${Math.floor(x / HASH_CELL)},${Math.floor(z / HASH_CELL)}`;
  }

  /** (x, z) の近くにあるサンプル番号を列挙 */
  forEachNear(x: number, z: number, radius: number, fn: (i: number) => void): void {
    const r = Math.ceil(radius / HASH_CELL);
    const cx = Math.floor(x / HASH_CELL);
    const cz = Math.floor(z / HASH_CELL);
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const list = this.hash.get(`${cx + dx},${cz + dz}`);
        if (list) for (const i of list) fn(i);
      }
    }
  }

  /**
   * 点が安全帯の中 (かつ路面の少し上〜heightAbove) にあれば、その情報を返す。
   * 道路のない区間 (ジャンプの切れ目) は対象外。
   */
  test(x: number, y: number, z: number): CorridorHit | null {
    const track = this.track;
    const n = track.samples.length;
    const half = track.spacing * 0.5 + 0.05;
    let hit: CorridorHit | null = null;
    this.forEachNear(x, z, this.maxExtent + track.spacing, (i) => {
      if (hit) return;
      const s = track.samples[i]!;
      if (s.gap || !track.hasSegment(i)) return;
      const next = track.samples[(i + 1) % n]!;
      if (next.gap) return;
      const dx = x - s.x;
      const dz = z - s.z;
      const along = dx * s.tx + dz * s.tz;
      if (along < -half || along > half) return;
      const lateral = dx * s.rx + dz * s.rz;
      const edge = lateral >= 0 ? s.right : s.left;
      const ext = drivableExtent(track, s, edge);
      if (Math.abs(lateral) > ext) return;
      const clampedLat = Math.max(-s.halfWidth, Math.min(s.halfWidth, lateral));
      const roadY = s.y + along * s.slope + clampedLat * Math.tan(s.bank);
      const h = y - roadY;
      if (h > cfg.corridor.heightTolerance && h < cfg.corridor.heightAbove) {
        hit = { sampleIndex: i, s: s.s, lateral, height: h, x, y, z };
      }
    });
    return hit;
  }

  /**
   * 点 (x, y, z) が道路 (安全帯) から水平 horizontal [m]・上下 vertical [m] 以内にあるか。
   * 動く背景物 (魚・飛行船など) の軌道が道路を横切らないか確かめるのに使う。
   */
  isNearRoad(x: number, y: number, z: number, horizontal: number, vertical: number): boolean {
    const track = this.track;
    let near = false;
    this.forEachNear(x, z, this.maxExtent + horizontal + track.spacing, (i) => {
      if (near) return;
      const s = track.samples[i]!;
      const dx = x - s.x;
      const dz = z - s.z;
      const along = dx * s.tx + dz * s.tz;
      if (Math.abs(along) > track.spacing + horizontal) return;
      const lateral = dx * s.rx + dz * s.rz;
      const edge = lateral >= 0 ? s.right : s.left;
      if (Math.abs(lateral) > drivableExtent(track, s, edge) + horizontal) return;
      if (Math.abs(y - s.y) < vertical) near = true;
    });
    return near;
  }

  /**
   * 地形の高さの上限 (この高さ以下なら安全帯を覆わない)。近くに道路がなければ Infinity。
   * 帯の中は路面より少し低く、帯の外は flatBand の後に maxSlope で上がってよい。
   */
  terrainLimit(x: number, z: number): number {
    const t = cfg.terrain;
    const track = this.track;
    const reach = this.maxExtent + t.flatBand + 60;
    let limit = Infinity;
    const n = track.samples.length;
    this.forEachNear(x, z, reach, (i) => {
      const s = track.samples[i]!;
      if (s.gap || !track.hasSegment(i) || track.samples[(i + 1) % n]!.gap) return;
      const dx = x - s.x;
      const dz = z - s.z;
      const along = dx * s.tx + dz * s.tz;
      const lateral = dx * s.rx + dz * s.rz;
      const edge = lateral >= 0 ? s.right : s.left;
      const ext = drivableExtent(track, s, edge);
      const alongExcess = Math.max(0, Math.abs(along) - track.spacing * 0.75);
      const latExcess = Math.max(0, Math.abs(lateral) - ext);
      const dist = Math.hypot(alongExcess, latExcess);
      const clampedLat = Math.max(-s.halfWidth, Math.min(s.halfWidth, lateral));
      const roadY = s.y + clampedLat * Math.tan(s.bank);
      const l = roadY - t.belowRoad + t.maxSlope * Math.max(0, dist - t.flatBand);
      if (l < limit) limit = l;
    });
    return limit;
  }
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const instMat = new THREE.Matrix4();
const worldMat = new THREE.Matrix4();

/** 検査対象外 (道路自身・ギミック・空など) かどうか */
function isExempt(obj: THREE.Object3D): boolean {
  if (obj.userData.clearanceCheck === true) return false;
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.userData.clearanceExempt === true) return true;
    o = o.parent;
  }
  return false;
}

function objectLabel(obj: THREE.Object3D): string {
  const names: string[] = [];
  let o: THREE.Object3D | null = obj;
  while (o && names.length < 3) {
    if (o.name) names.unshift(o.name);
    o = o.parent;
  }
  const geo = (obj as THREE.Mesh).geometry;
  return `${names.join('/') || '(unnamed)'}${geo ? `<${geo.type}>` : ''}`;
}

/**
 * root 以下のメッシュの三角形を調べ、安全帯への侵入をオブジェクトごとにまとめて返す。
 */
export function scanIntrusions(corridor: RoadCorridor, root: THREE.Object3D): IntrusionReport[] {
  root.updateMatrixWorld(true);
  const reports = new Map<string, IntrusionReport>();
  const record = (label: string, hit: CorridorHit): void => {
    const r = reports.get(label);
    if (!r) reports.set(label, { object: label, count: 1, worst: hit });
    else {
      r.count++;
      if (hit.height > r.worst.height) r.worst = hit;
    }
  };
  const step = courseQualityConfig.check.sampleStep;
  const maxTri = courseQualityConfig.check.maxTriangleSize;
  // 巨大な三角形 (地面・海の板) は頂点だけでは分からないので、走れる範囲の点の真上/真下を調べる
  const roadPoints = corridorPoints(corridor);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as { isMesh?: boolean }).isMesh || isExempt(obj)) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    const index = geo.getIndex();
    const triCount = index ? index.count / 3 : pos.count / 3;
    const inst = obj as THREE.InstancedMesh;
    const instances = (inst as { isInstancedMesh?: boolean }).isInstancedMesh ? inst.count : 1;
    const label = objectLabel(obj);
    for (let k = 0; k < instances; k++) {
      worldMat.copy(obj.matrixWorld);
      if (instances > 1 || (inst as { isInstancedMesh?: boolean }).isInstancedMesh) {
        inst.getMatrixAt(k, instMat);
        worldMat.multiply(instMat);
      }
      for (let t = 0; t < triCount; t++) {
        const ia = index ? index.getX(t * 3) : t * 3;
        const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
        const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
        tmpA.fromBufferAttribute(pos, ia).applyMatrix4(worldMat);
        tmpB.fromBufferAttribute(pos, ib).applyMatrix4(worldMat);
        tmpC.fromBufferAttribute(pos, ic).applyMatrix4(worldMat);
        const size = Math.max(tmpA.distanceTo(tmpB), tmpB.distanceTo(tmpC), tmpC.distanceTo(tmpA));
        if (size > maxTri) {
          checkLargeTriangle(corridor, roadPoints, tmpA, tmpB, tmpC, (hit) => record(label, hit));
          continue;
        }
        const div = Math.max(1, Math.min(30, Math.ceil(size / step)));
        for (let u = 0; u <= div; u++) {
          for (let v = 0; v <= div - u; v++) {
            const w = div - u - v;
            tmpP.set(
              (tmpA.x * u + tmpB.x * v + tmpC.x * w) / div,
              (tmpA.y * u + tmpB.y * v + tmpC.y * w) / div,
              (tmpA.z * u + tmpB.z * v + tmpC.z * w) / div,
            );
            const hit = corridor.test(tmpP.x, tmpP.y, tmpP.z);
            if (hit) record(label, hit);
          }
        }
      }
    }
  });
  return [...reports.values()].sort((a, b) => b.count - a.count);
}

/** 走れる範囲の中の点 (x, z) の一覧 (巨大な三角形の検査用) */
function corridorPoints(corridor: RoadCorridor): { x: number; z: number }[] {
  const track = corridor.track;
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i]!;
    if (s.gap || !track.hasSegment(i)) continue;
    const l0 = -drivableExtent(track, s, s.left);
    const l1 = drivableExtent(track, s, s.right);
    for (let l = l0; l <= l1; l += cfg.check.sampleStep) pts.push({ x: s.x + s.rx * l, z: s.z + s.rz * l });
    pts.push({ x: s.x + s.rx * l1, z: s.z + s.rz * l1 });
  }
  return pts;
}

/** 巨大な三角形: 走れる範囲の各点について、真上/真下の三角形の高さが安全帯に入っていないか */
function checkLargeTriangle(
  corridor: RoadCorridor,
  points: readonly { x: number; z: number }[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  onHit: (hit: CorridorHit) => void,
): void {
  const minX = Math.min(a.x, b.x, c.x);
  const maxX = Math.max(a.x, b.x, c.x);
  const minZ = Math.min(a.z, b.z, c.z);
  const maxZ = Math.max(a.z, b.z, c.z);
  const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(det) < 1e-9) return;
  for (const p of points) {
    if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) continue;
    const w1 = ((b.z - c.z) * (p.x - c.x) + (c.x - b.x) * (p.z - c.z)) / det;
    const w2 = ((c.z - a.z) * (p.x - c.x) + (a.x - c.x) * (p.z - c.z)) / det;
    const w3 = 1 - w1 - w2;
    if (w1 < 0 || w2 < 0 || w3 < 0) continue;
    const y = a.y * w1 + b.y * w2 + c.y * w3;
    const hit = corridor.test(p.x, y, p.z);
    if (hit) onHit(hit);
  }
}
