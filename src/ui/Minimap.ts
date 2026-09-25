/**
 * ミニマップ (Canvas 2D)。
 *
 * - 周回コース: コース全体を初回にオフスクリーンへ描画し、毎回は車の点だけ描く
 * - Point to Point: 道が長いので自分を中心に拡大して追従表示 (北が上) し、
 *   下端に START → GOAL の進行バー (全車の位置) を出す。START / GOAL の位置も表示する
 */
import { raceTypeConfig } from '../config/game';
import type { Track } from '../courses/Track';
import type { RaceCar } from '../game/RaceCar';
import type { ItemBox } from '../items/ItemBoxes';
import { colorHex, el } from './dom';

const PLAYER_COLORS = ['#ffd23f', '#39f3ff'];
const START_COLOR = '#3dff8a';
const GOAL_COLOR = '#ff4f79';

export class Minimap {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly base: HTMLCanvasElement | null;
  private readonly size: number;
  private readonly track: Track;
  /** 追従表示 (Point to Point) */
  private readonly follow: boolean;
  private readonly roadPath: Path2D;
  private scale: number;
  private ox: number;
  private oz: number;

  constructor(track: Track, sizePx: number) {
    this.size = sizePx;
    this.track = track;
    this.follow = !track.closed;
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

    // コース形状 (ワールド座標の x, z)
    this.roadPath = new Path2D();
    track.samples.forEach((s, i) => {
      if (i === 0) this.roadPath.moveTo(s.x, s.z);
      else this.roadPath.lineTo(s.x, s.z);
    });
    if (track.closed) this.roadPath.closePath();

    const b = track.bounds;
    const pad = 12;
    if (this.follow) {
      this.scale = (sizePx / 2 - pad) / raceTypeConfig.pointToPoint.minimapViewRadius;
      this.ox = track.samples[0]!.x;
      this.oz = track.samples[0]!.z;
      this.base = null;
      return;
    }
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
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
      this.drawRoad(bctx);
      this.drawLineMarker(bctx, track.startS, GOAL_COLOR);
    }
  }

  /** ワールド座標 → マップ座標。俯瞰で +Z を上、+X を左にして画面の見た目と一致させる */
  private toMap(x: number, z: number): [number, number] {
    const h = this.size / 2;
    return [h - (x - this.ox) * this.scale, h - (z - this.oz) * this.scale];
  }

  private drawRoad(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const h = this.size / 2;
    // toMap と同じ変換を Canvas の変換で行う (線幅は画面上のピクセルで指定したいので割り戻す)
    ctx.translate(h, h);
    ctx.scale(-this.scale, -this.scale);
    ctx.translate(-this.ox, -this.oz);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 9 / this.scale;
    ctx.stroke(this.roadPath);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4.5 / this.scale;
    ctx.stroke(this.roadPath);
    ctx.restore();
  }

  private drawLineMarker(ctx: CanvasRenderingContext2D, s: number, color: string, label?: string): void {
    const p = this.track.pointAt(s);
    const [x, y] = this.toMap(p.x, p.z);
    ctx.fillStyle = color;
    ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
    if (label) {
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(label, x, y - 7);
      ctx.fillText(label, x, y - 7);
    }
  }

  draw(cars: readonly RaceCar[], focus: RaceCar, itemBoxes: readonly ItemBox[] | null): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.size, this.size);
    if (this.follow) {
      this.ox = focus.body.x;
      this.oz = focus.body.z;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, this.size, this.size);
      this.drawRoad(ctx);
      this.drawLineMarker(ctx, this.track.startS, START_COLOR, 'START');
      this.drawLineMarker(ctx, this.track.goalS, GOAL_COLOR, 'GOAL');
    } else if (this.base) {
      ctx.drawImage(this.base, 0, 0, this.size, this.size);
    }
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
      if (this.follow && (x < -8 || y < -8 || x > this.size + 8 || y > this.size + 8)) continue;
      const isFocus = car === focus;
      const r = isFocus ? 5.5 : car.isHuman ? 4.5 : 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = carColor(car);
      if (!car.isHuman) ctx.globalAlpha = 0.8;
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
    if (this.follow) this.drawProgressBar(ctx, cars, focus);
  }

  /** START → GOAL の進行バーと全車の位置 */
  private drawProgressBar(ctx: CanvasRenderingContext2D, cars: readonly RaceCar[], focus: RaceCar): void {
    const pad = 10;
    const y = this.size - 12;
    const x0 = pad + 4;
    const x1 = this.size - pad - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(pad - 4, y - 8, this.size - (pad - 4) * 2, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.fillStyle = START_COLOR;
    ctx.fillRect(x0 - 2, y - 5, 4, 10);
    ctx.fillStyle = GOAL_COLOR;
    ctx.fillRect(x1 - 2, y - 5, 4, 10);
    const order = cars.slice().sort((a, b) => rank(a, focus) - rank(b, focus));
    for (const car of order) {
      const x = x0 + (x1 - x0) * car.progress.completion;
      ctx.beginPath();
      ctx.arc(x, y, car === focus ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = carColor(car);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    }
  }
}

function carColor(car: RaceCar): string {
  return car.isHuman ? (PLAYER_COLORS[car.playerIndex] ?? '#ffffff') : colorHex(car.spec.visual.bodyColor);
}

function rank(car: RaceCar, focus: RaceCar): number {
  if (car === focus) return 2;
  return car.isHuman ? 1 : 0;
}

export { PLAYER_COLORS };
