/**
 * 背景用ローポリ小物のジオメトリ (頂点カラー付き・インスタンス描画向け)。
 * いずれも底面中心が原点、+Y が上。
 */
import * as THREE from 'three';
import { flatten, mergeGeometries, paint } from './SceneryUtils';

function part(g: THREE.BufferGeometry, color: number, tx = 0, ty = 0, tz = 0): THREE.BufferGeometry {
  const f = paint(flatten(g), color);
  f.translate(tx, ty, tz);
  return f;
}

/** 広葉樹 */
export function broadleafTree(trunk = 0x5a3d24, leaf = 0x2f7a2a): THREE.BufferGeometry {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.4, 0.55, 3, 5), trunk, 0, 1.5, 0),
    part(new THREE.IcosahedronGeometry(2.6, 0), leaf, 0, 4.6, 0),
    part(new THREE.IcosahedronGeometry(1.8, 0), leaf, 1.2, 5.8, 0.4),
  ]);
}

/** ヤシの木 */
export function palmTree(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    parts.push(part(new THREE.CylinderGeometry(0.28 - k * 0.03, 0.34 - k * 0.03, 1.8, 5), 0x8a6a40, k * 0.25, 0.9 + k * 1.7, 0));
  }
  for (let k = 0; k < 5; k++) {
    const leaf = part(new THREE.ConeGeometry(0.6, 3.2, 3), 0x3a9a3a);
    leaf.rotateZ(Math.PI / 2 + 0.4);
    leaf.rotateY((k / 5) * Math.PI * 2);
    leaf.translate(1, 7.2, 0);
    parts.push(leaf);
  }
  return mergeGeometries(parts);
}

/** 雪をかぶった杉 */
export function snowPine(): THREE.BufferGeometry {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.25, 0.35, 2, 5), 0x4a3322, 0, 1, 0),
    part(new THREE.ConeGeometry(2.3, 4.2, 6), 0x2c4d3a, 0, 3.8, 0),
    part(new THREE.ConeGeometry(1.5, 1.6, 6), 0xf4f8ff, 0, 5.4, 0),
    part(new THREE.ConeGeometry(1.7, 3.4, 6), 0x345a44, 0, 6.2, 0),
    part(new THREE.ConeGeometry(0.9, 1.2, 6), 0xf4f8ff, 0, 7.6, 0),
  ]);
}

/** 氷の結晶 */
export function iceCrystal(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(0.8, 2.6, 0.8);
  return part(g, 0xbfeaff, 0, 2.2, 0);
}

/** サンゴ */
export function coral(color = 0xff7a8a): THREE.BufferGeometry {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.3, 0.5, 2.5, 5), color, 0, 1.25, 0),
    part(new THREE.CylinderGeometry(0.2, 0.3, 1.8, 5), color, 0.7, 2.3, 0),
    part(new THREE.IcosahedronGeometry(0.7, 0), color, -0.5, 2.8, 0.3),
  ]);
}

/** 海藻 */
export function seaweed(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.5, 7, 4);
  return part(g, 0x2f9a5a, 0, 3.5, 0);
}

/** 魚 (+Z が前) */
export function fish(body = 0xffa02a, fin = 0xff5a2a): THREE.BufferGeometry {
  const b = new THREE.OctahedronGeometry(1, 0);
  b.scale(0.6, 0.9, 1.8);
  const tail = new THREE.ConeGeometry(0.8, 1.2, 3);
  tail.rotateX(Math.PI / 2);
  return mergeGeometries([part(b, body), part(tail, fin, 0, 0, -2.1)]);
}

/** 飛行船 (+Z が前) */
export function airship(): THREE.BufferGeometry {
  const hull = new THREE.SphereGeometry(1, 10, 6);
  hull.scale(5, 4, 14);
  const gondola = new THREE.BoxGeometry(2.4, 1.6, 5);
  const fin1 = new THREE.BoxGeometry(0.3, 5, 3);
  const fin2 = new THREE.BoxGeometry(5, 0.3, 3);
  return mergeGeometries([
    part(hull, 0xe8ecf4),
    part(gondola, 0x3a4a6a, 0, -4.6, 1),
    part(fin1, 0xff4f79, 0, 0, -12),
    part(fin2, 0xff4f79, 0, 0, -12),
  ]);
}

/** 鉛筆 (横倒し。+Z が芯の方向) */
export function pencil(body = 0xffc21a): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(1, 1, 30, 6);
  shaft.rotateX(Math.PI / 2);
  const tip = new THREE.ConeGeometry(1, 4, 6);
  tip.rotateX(Math.PI / 2);
  const lead = new THREE.ConeGeometry(0.3, 1.2, 6);
  lead.rotateX(Math.PI / 2);
  const eraser = new THREE.CylinderGeometry(1, 1, 2.5, 6);
  eraser.rotateX(Math.PI / 2);
  return mergeGeometries([
    part(shaft, body, 0, 1, 0),
    part(tip, 0xf0c890, 0, 1, 17),
    part(lead, 0x333333, 0, 1, 19.3),
    part(eraser, 0xff8ab0, 0, 1, -16.2),
  ]);
}

/** 古代の像 (箱を積んだ顔) */
export function statue(): THREE.BufferGeometry {
  const stone = 0x8c8a78;
  const dark = 0x5a5848;
  return mergeGeometries([
    part(new THREE.BoxGeometry(10, 4, 10), dark, 0, 2, 0),
    part(new THREE.BoxGeometry(7, 14, 6), stone, 0, 11, 0),
    part(new THREE.BoxGeometry(8, 9, 7), stone, 0, 22.5, 0),
    part(new THREE.BoxGeometry(1.6, 1.2, 0.6), 0x2a2a20, -1.8, 24, 3.6),
    part(new THREE.BoxGeometry(1.6, 1.2, 0.6), 0x2a2a20, 1.8, 24, 3.6),
    part(new THREE.BoxGeometry(1.2, 3, 1.6), dark, 0, 22, 3.8),
    part(new THREE.BoxGeometry(4, 0.8, 0.6), 0x2a2a20, 0, 19.5, 3.6),
  ]);
}

/** 石の柱 (崩れた遺跡) */
export function ruinPillar(): THREE.BufferGeometry {
  return mergeGeometries([
    part(new THREE.BoxGeometry(2.4, 0.8, 2.4), 0x7a7866, 0, 0.4, 0),
    part(new THREE.CylinderGeometry(0.9, 1, 7, 6), 0x9a9884, 0, 4.3, 0),
    part(new THREE.BoxGeometry(2.4, 0.8, 2.4), 0x7a7866, 0, 8.2, 0),
  ]);
}

/** 工場の煙突 */
export function chimney(): THREE.BufferGeometry {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(2, 2.6, 30, 8), 0x3a3432, 0, 15, 0),
    part(new THREE.CylinderGeometry(2.1, 2.1, 1.2, 8), 0xff7a1a, 0, 29, 0),
  ]);
}

/** おもちゃの積み木 (面ごとに色違い) */
export function toyBlock(color: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return paint(flatten(g), color);
}
