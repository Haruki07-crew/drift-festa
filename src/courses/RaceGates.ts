/**
 * Point to Point コースの START / GOAL ゲートと、道の両端の止めの壁 (v3)。
 *
 * - ゲートの柱は走れる範囲 (Road Safety Corridor) の外、横断幕は車の頭上に置く (安全帯の検査対象)
 * - 道の両端の壁は物理 (TrackCollision.resolveRoadEnds) と同じ位置に描く
 */
import * as THREE from 'three';
import { raceTypeConfig } from '../config/game';
import type { ResourceBag } from '../render/dispose';
import { drivableExtent } from './RoadClearance';
import type { Track } from './Track';

const GATE_BEAM_HEIGHT = 7.5;
const GATE_PILLAR_SIZE = 1.2;

export function buildRaceGates(track: Track, bag: ResourceBag): THREE.Group {
  const group = new THREE.Group();
  group.name = 'race-gates';
  if (track.closed) return group;

  const pillarGeo = bag.add(new THREE.BoxGeometry(GATE_PILLAR_SIZE, 1, GATE_PILLAR_SIZE));
  pillarGeo.translate(0, 0.5, 0);
  const pillarMat = bag.add(new THREE.MeshLambertMaterial({ color: 0x2a2d36 }));

  const gate = (s: number, label: string, color: string, name: string): void => {
    const i = track.sampleIndexAt(s);
    const smp = track.sample(i);
    const p = track.pointAt(s);
    const rx = -p.tz;
    const rz = p.tx;
    const left = drivableExtent(track, smp, smp.left) + GATE_PILLAR_SIZE;
    const right = drivableExtent(track, smp, smp.right) + GATE_PILLAR_SIZE;
    const heading = Math.atan2(p.tx, p.tz);
    const g = new THREE.Group();
    g.name = name;
    const topY = p.y + GATE_BEAM_HEIGHT;
    for (const lat of [-left, right]) {
      const baseY = p.y + lat * Math.tan(p.bank) - 0.5;
      const m = new THREE.Mesh(pillarGeo, pillarMat);
      m.position.set(p.x + rx * lat, baseY, p.z + rz * lat);
      m.scale.set(1, topY + 1.6 - baseY, 1);
      g.add(m);
    }
    // 横断幕 (両面に文字)
    const width = left + right;
    const tex = bag.add(makeBannerTexture(label, color));
    const bannerMat = bag.add(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const banner = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(width, 1.8)), bannerMat);
    const mid = (right - left) / 2;
    banner.position.set(p.x + rx * mid, topY + 0.7, p.z + rz * mid);
    // 文字の面 (+Z) を向かってくる車の方へ向ける
    banner.rotation.y = heading + Math.PI;
    g.add(banner);
    group.add(g);
  };
  gate(track.startS, 'START', '#1fbf5f', 'start-gate');
  gate(track.goalS, 'GOAL', '#e0254f', 'goal-gate');

  // 道の両端の止めの壁 (紅白)。道の上にあるが意図した壁なので安全帯の検査対象外
  const ends = new THREE.Group();
  ends.name = 'road-end-walls';
  ends.userData.clearanceExempt = true;
  const inset = raceTypeConfig.pointToPoint.endWallInset;
  const stripeTex = bag.add(makeStripeTexture());
  const endMat = bag.add(new THREE.MeshLambertMaterial({ map: stripeTex }));
  for (const s of [inset, track.length - inset]) {
    const i = track.sampleIndexAt(s);
    const smp = track.sample(i);
    const p = track.pointAt(s);
    const w = drivableExtent(track, smp, smp.left) + drivableExtent(track, smp, smp.right) + 1;
    const geo = bag.add(new THREE.BoxGeometry(w, 1.6, 0.8));
    geo.translate(0, 0.8, 0);
    const m = new THREE.Mesh(geo, endMat);
    const rx = -p.tz;
    const rz = p.tx;
    const mid = (drivableExtent(track, smp, smp.right) - drivableExtent(track, smp, smp.left)) / 2;
    const dir = s < track.length / 2 ? -1 : 1;
    m.position.set(p.x + rx * mid + p.tx * dir * 0.4, p.y - 0.2, p.z + rz * mid + p.tz * dir * 0.4);
    m.rotation.y = Math.atan2(p.tx, p.tz);
    m.rotation.z = -p.bank;
    ends.add(m);
  }
  group.add(ends);
  return group;
}

function makeBannerTexture(label: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 72;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 512, 72);
    // 両端の市松模様
    for (let y = 0; y < 72; y += 12) {
      for (let x = 0; x < 48; x += 12) {
        ctx.fillStyle = (x + y) % 24 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(x, y, 12, 12);
        ctx.fillRect(512 - 48 + x, y, 12, 12);
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 38);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeStripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext('2d');
  if (ctx) {
    for (let x = 0; x < 64; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? '#e02020' : '#f5f5f5';
      ctx.fillRect(x, 0, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}
