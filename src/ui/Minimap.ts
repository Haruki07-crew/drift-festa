/**
 * ミニマップ (Canvas 2D)。コース形状は初回にオフスクリーンへ描画し、毎回は車の点だけ描く。
 */
import type { Track } from '../courses/Track';
import type { RaceCar } from '../game/RaceCar';
import type { ItemBox } from '../items/ItemBoxes';
import { colorHex, el } from './dom';

const PLAYER_COLORS = ['#ffd23f', '#39f3ff'];

export class Minimap {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly base: HTMLCanvasElement;
  private readonly size: number;
  private readonly scale: number;
  private readonly ox: number;
  private readonly oz: number;

  constructor(track: Track, sizePx: number) {
    this.size = sizePx;
    this.root = el('div', 'minimap');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas = el('canvas', 'minimap-canvas');
    this.canvas.width = Math.round(sizePx * dpr);
    this.canvas.height = Math.round(sizePx * dpr);
    this.canvas.style.width = `${sizePx}px`;
    this.canvas.style.height = `${sizePx}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx?.scale(dpr, dpr);
    this.root.append(this.canvas);

    const b = track.bounds;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const pad = 12;
    this.scale = (sizePx - pad * 2) / span;
    this.ox = (b.minX + b.maxX) / 2;
    this.oz = (b.minZ + b.maxZ) / 2;

    // コース形状を事前描画
    this.base = document.createElement('canvas');
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    const bctx = this.base.getContext('2d');
    if (bctx) {
      bctx.scale(dpr, dpr);
      bctx.lineJoin = 'round';
      bctx.lineCap = 'round';
      const path = new Path2D();
      track.samples.forEach((s, i) => {
        const [x, y] = this.toMap(s.x, s.z);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      });
      path.closePath();
      bctx.strokeStyle = 'rgba(0,0,0,0.55)';
      bctx.lineWidth = 9;
      bctx.stroke(path);
      bctx.strokeStyle = 'rgba(255,255,255,0.85)';
      bctx.lineWidth = 4.5;
      bctx.stroke(path);
      // スタートライン
      const s0 = track.samples[0]!;
      const [sx, sy] = this.toMap(s0.x, s0.z);
      bctx.fillStyle = '#ff4f79';
      bctx.fillRect(sx - 3, sy - 3, 6, 6);
    }
  }

  /** ワールド座標 → マップ座標。俯瞰で +Z を上、+X を左にして画面の見た目と一致させる */
  private toMap(x: number, z: number): [number, number] {
    const h = this.size / 2;
    return [h - (x - this.ox) * this.scale, h - (z - this.oz) * this.scale];
  }

  draw(cars: readonly RaceCar[], focus: RaceCar, itemBoxes: readonly ItemBox[] | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.base, 0, 0, this.size, this.size);
    if (itemBoxes) {
      ctx.fillStyle = '#ff9df0';
      for (const b of itemBoxes) {
        if (!b.active) continue;
        const [x, y] = this.toMap(b.x, b.z);
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
    // NPC → 人間 → 自分 の順に描画 (自分を最前面に)
    const order = cars.slice().sort((a, b) => rank(a, focus) - rank(b, focus));
    for (const car of order) {
      const [x, y] = this.toMap(car.body.x, car.body.z);
      const isFocus = car === focus;
      const r = isFocus ? 5.5 : car.isHuman ? 4.5 : 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (car.isHuman) {
        ctx.fillStyle = PLAYER_COLORS[car.playerIndex] ?? '#ffffff';
      } else {
        ctx.fillStyle = colorHex(car.spec.visual.bodyColor);
        ctx.globalAlpha = 0.8;
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = isFocus ? 2.5 : 1.5;
      ctx.strokeStyle = isFocus ? '#000000' : 'rgba(0,0,0,0.7)';
      ctx.stroke();
      if (isFocus) {
        // 進行方向
        const hx = -Math.sin(car.body.heading);
        const hy = -Math.cos(car.body.heading);
        ctx.beginPath();
        ctx.moveTo(x + hx * 9, y + hy * 9);
        ctx.lineTo(x - hy * 4, y + hx * 4);
        ctx.lineTo(x + hy * 4, y - hx * 4);
        ctx.closePath();
        ctx.fillStyle = PLAYER_COLORS[car.playerIndex] ?? '#ffffff';
        ctx.fill();
      }
    }
  }
}

function rank(car: RaceCar, focus: RaceCar): number {
  if (car === focus) return 2;
  return car.isHuman ? 1 : 0;
}

export { PLAYER_COLORS };
