/**
 * コース品質のデバッグ表示 (v3)。DebugManager の F6 / F3 から使う。
 *
 * - Road Safety Corridor (走れる範囲の外端 = 地形・背景物が入ってはいけない範囲) を水色の線で描く
 * - 地形の高さ上限の目安 (帯の外側で地形が上がり始める位置) を緑の線で描く
 * - 背景物・地形が安全帯へ侵入している点を赤い柱で示す (npm run check:courses と同じ判定)
 * - いま車がいる位置のギミック名一覧 (F3 の表示用)
 */
import * as THREE from 'three';
import { courseQualityConfig } from '../config/courseQuality';
import type { GimmickSystem } from '../gimmicks/GimmickSystem';
import type { ResourceBag } from '../render/dispose';
import { RoadCorridor, drivableExtent, scanIntrusions, type IntrusionReport } from '../courses/RoadClearance';
import type { Track } from '../courses/Track';

/** 安全帯と地形の上限ラインを描く */
export function buildCorridorGizmo(track: Track, bag: ResourceBag): THREE.LineSegments {
  const pts: number[] = [];
  const cols: number[] = [];
  const corridorColor = new THREE.Color(0x33e0ff);
  const terrainColor = new THREE.Color(0x66ff66);
  const n = track.samples.length;
  const flat = courseQualityConfig.terrain.flatBand;
  const open = track.def.raceType === 'pointToPoint';
  for (let i = 0; i < n; i++) {
    if (open && i === n - 1) break;
    const a = track.samples[i]!;
    const b = track.samples[(i + 1) % n]!;
    if (a.gap || b.gap) continue;
    for (const side of [-1, 1]) {
      const extA = drivableExtent(track, a, side > 0 ? a.right : a.left);
      const extB = drivableExtent(track, b, side > 0 ? b.right : b.left);
      const yA = a.y + side * a.halfWidth * Math.tan(a.bank) + 0.15;
      const yB = b.y + side * b.halfWidth * Math.tan(b.bank) + 0.15;
      const line = (offA: number, offB: number, dy: number, c: THREE.Color): void => {
        const la = side * offA;
        const lb = side * offB;
        pts.push(a.x + a.rx * la, yA + dy, a.z + a.rz * la, b.x + b.rx * lb, yB + dy, b.z + b.rz * lb);
        cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      };
      line(extA, extB, 0, corridorColor);
      // 安全帯の上限の高さ (これより低い物は路面扱いの誤差、高い物は頭上)
      line(extA, extB, courseQualityConfig.corridor.heightAbove, corridorColor);
      line(extA + flat, extB + flat, -courseQualityConfig.terrain.belowRoad, terrainColor);
    }
  }
  const geo = bag.add(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const lines = new THREE.LineSegments(geo, bag.add(new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.75 })));
  lines.renderOrder = 19;
  lines.name = 'debug-corridor';
  return lines;
}

/**
 * コースの描画物を走査し、安全帯への侵入点に赤い柱を立てる。
 * 重い処理なので F6 を初めて押したときに 1 回だけ行う。
 */
export function buildIntrusionMarkers(track: Track, courseRoot: THREE.Object3D, bag: ResourceBag): { group: THREE.Group; reports: IntrusionReport[] } {
  const group = new THREE.Group();
  group.name = 'debug-intrusions';
  const reports = scanIntrusions(new RoadCorridor(track), courseRoot);
  const geo = bag.add(new THREE.CylinderGeometry(0.3, 0.3, 12, 6));
  geo.translate(0, 6, 0);
  const mat = bag.add(new THREE.MeshBasicMaterial({ color: 0xff2020, depthTest: false }));
  for (const r of reports) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(r.worst.x, r.worst.y - r.worst.height, r.worst.z);
    m.renderOrder = 23;
    group.add(m);
  }
  return { group, reports };
}

/** スタートライン (緑) とゴールライン (赤) の高い柱 (Point to Point ではゴールが別の場所) */
export function buildRaceLineMarkers(track: Track, bag: ResourceBag): THREE.Group {
  const g = new THREE.Group();
  g.name = 'debug-race-lines';
  const geo = bag.add(new THREE.BoxGeometry(0.6, 30, 0.6));
  geo.translate(0, 15, 0);
  const lines: [number, number][] = [[track.startS, 0x33ff66]];
  if (!track.closed) lines.push([track.goalS, 0xff3355]);
  for (const [s, color] of lines) {
    const mat = bag.add(new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.8 }));
    const p = track.pointAt(s);
    for (const side of [-1, 1]) {
      const lat = side * (p.halfWidth + 1);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x - p.tz * lat, p.y, p.z + p.tx * lat);
      m.renderOrder = 23;
      g.add(m);
    }
  }
  return g;
}

/** 位置 (s, lateral) にかかっているギミックの名前一覧 */
export function gimmicksAt(gs: GimmickSystem, s: number, lateral: number): string[] {
  const out: string[] = [];
  for (const z of gs.surfaces) if (lateral >= z.latMin && lateral <= z.latMax && gs.inRange(z, s)) out.push(`surface:${z.kind}`);
  for (const p of gs.pads) if (Math.abs(lateral - p.lateral) <= p.halfWidth && Math.abs(s - p.s) <= p.halfLength) out.push('boostPad');
  for (const z of gs.jumps) if (gs.inRange(z, s)) out.push('jump');
  for (const z of gs.transforms) if (gs.inRange(z, s)) out.push(`transform:${z.mode}`);
  for (const z of gs.winds) if (gs.inRange(z, s)) out.push(`wind:${gs.windPhase(z)}`);
  for (const z of gs.conveyors) if (gs.inRange(z, s)) out.push('conveyor');
  for (const z of gs.seesaws) if (gs.inRange(z, s)) out.push('seesaw');
  for (const z of gs.tunnels) if (gs.inRange(z, s)) out.push(z.speedBonus > 0 ? `tunnel+${Math.round(z.speedBonus * 100)}%` : 'tunnel');
  for (const p of gs.pads) if (p.kind === 'gate' && Math.abs(s - p.s) <= p.halfLength + 2) out.push('speedGate');
  for (const z of gs.draftZones) if (gs.inRange(z, s)) out.push(`draftZone x${z.multiplier}`);
  for (const z of gs.splashes) if (lateral >= z.latMin && lateral <= z.latMax && gs.inRange(z, s)) out.push(`splash:${gs.splashPhase(z)}`);
  for (const z of gs.platforms) if (gs.inRange(z, s)) out.push(`platform@${gs.platformCenter(z).toFixed(1)}`);
  for (const z of gs.drawbridges) if (gs.inRange(z, s)) out.push(`drawbridge lift ${gs.drawbridgeLift(z).toFixed(2)}`);
  return out;
}
