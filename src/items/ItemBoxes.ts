/**
 * コース上に固定配置されたアイテムボックス (BATTLE DUEL)。
 * 位置はコース設定 (CourseDef.itemBoxes) で管理。取得後 respawnSeconds で再出現。
 * インベントリが満杯の車が触れても取得せず、箱も消えない。
 */
import * as THREE from 'three';
import { itemsConfig } from '../config/items';
import type { Track } from '../courses/Track';
import { ResourceBag } from '../render/dispose';

export interface ItemBox {
  index: number;
  x: number;
  y: number;
  z: number;
  s: number;
  lateral: number;
  active: boolean;
  respawnTimer: number;
}

export class ItemBoxField {
  readonly boxes: ItemBox[] = [];

  constructor(track: Track) {
    const p = { x: 0, y: 0, z: 0, tx: 0, tz: 1, halfWidth: 5 };
    for (const row of track.def.itemBoxes) {
      const s = row.at * track.length;
      for (const lateral of row.lateral) {
        track.worldAt(s, lateral, p);
        this.boxes.push({ index: this.boxes.length, x: p.x, y: p.y, z: p.z, s, lateral, active: true, respawnTimer: 0 });
      }
    }
  }

  update(dt: number): void {
    for (const b of this.boxes) {
      if (!b.active) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) b.active = true;
      }
    }
  }

  /**
   * 位置 (x,y,z) の車が触れているボックスを返す (なければ null)。
   * canTake = false (満杯) の場合は箱を消さない。
   */
  tryPickup(x: number, y: number, z: number, canTake: boolean): ItemBox | null {
    const r = itemsConfig.itemBox.pickupRadius;
    for (const b of this.boxes) {
      if (!b.active) continue;
      const dx = b.x - x;
      const dz = b.z - z;
      if (dx * dx + dz * dz > r * r || Math.abs(b.y - y) > 3) continue;
      if (!canTake) return null;
      b.active = false;
      b.respawnTimer = itemsConfig.itemBox.respawnSeconds;
      return b;
    }
    return null;
  }
}

/** アイテムボックスの見た目 (回転する半透明の「?」ボックス) */
export class ItemBoxView {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly bag = new ResourceBag();
  private time = 0;

  constructor(field: ItemBoxField) {
    const size = itemsConfig.itemBox.size;
    const geo = this.bag.add(new THREE.BoxGeometry(size, size, size));
    const tex = this.bag.add(makeQuestionTexture());
    const mat = this.bag.add(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0xffffff,
        emissiveMap: tex,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.88,
        roughness: 0.3,
      }),
    );
    for (const b of field.boxes) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(b.x, b.y + 1.2, b.z);
      this.meshes.push(m);
      this.group.add(m);
    }
  }

  update(field: ItemBoxField, dt: number): void {
    this.time += dt;
    const spin = itemsConfig.itemBox.spinSpeed;
    field.boxes.forEach((b, i) => {
      const m = this.meshes[i]!;
      m.visible = b.active;
      m.rotation.set(0.5, this.time * spin + i, 0.3);
      m.position.y = b.y + 1.2 + Math.sin(this.time * 2 + i) * 0.2;
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    this.bag.dispose();
  }
}

function makeQuestionTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, '#ff5fd2');
    grad.addColorStop(0.5, '#ffd23f');
    grad.addColorStop(1, '#39f3ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 60, 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 32, 35);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
