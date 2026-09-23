/**
 * レース中の HUD (プレイヤーごとに1つ。2人プレイでは左右に独立して表示)。
 *
 * 表示: 現在順位 / 全台数、ラップ / 全ラップ、速度、前の車との差、トップとの差、ミニマップ、
 *       カウントダウン、各種メッセージ (FINAL LAP・逆走・復帰中・GOAL)
 * BATTLE DUEL: タイヤHP、インベントリ (3枠)、弾数、ブースト残り、照準、被弾フラッシュ
 */
import { ITEM_DEFS } from '../config/items';
import { itemsConfig } from '../config/items';
import type { Combatant } from '../battle/Combatant';
import { msToKmh } from '../core/math';
import type { RaceCar } from '../game/RaceCar';
import { formatGap, formatRaceTime } from '../game/RaceProgress';
import type { Track } from '../courses/Track';
import type { ItemBox } from '../items/ItemBoxes';
import { el, setStyle, setText, toggleClass } from './dom';
import { Minimap, PLAYER_COLORS } from './Minimap';

export interface HudFrame {
  car: RaceCar;
  totalCars: number;
  laps: number;
  raceTime: number;
  gapAhead: number | null;
  gapLeader: number | null;
  cars: readonly RaceCar[];
  itemBoxes: readonly ItemBox[] | null;
  combatant: Combatant | null;
  opponent: Combatant | null;
  aimX: number;
  aimY: number;
  showAim: boolean;
}

const ORDINAL = ['', 'st', 'nd', 'rd'];

export class Hud {
  readonly root: HTMLElement;
  private readonly pos: HTMLElement;
  private readonly posSuffix: HTMLElement;
  private readonly posTotal: HTMLElement;
  private readonly lap: HTMLElement;
  private readonly lapTime: HTMLElement;
  private readonly bestLap: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly speedBar: HTMLElement;
  private readonly gapAhead: HTMLElement;
  private readonly gapLeader: HTMLElement;
  private readonly center: HTMLElement;
  private readonly message: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly minimap: Minimap;
  private minimapTimer = 0;
  // バトル
  private readonly battle: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly enemyHpFill: HTMLElement;
  private readonly enemyBar: HTMLElement;
  private readonly slots: HTMLElement[] = [];
  private readonly ammo: HTMLElement;
  private readonly boost: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;
  private messageTimer = 0;

  constructor(track: Track, opts: { playerIndex: number; split: boolean; battle: boolean }) {
    this.root = el('div', `hud ${opts.split ? 'split' : ''} player-${opts.playerIndex}`);
    this.root.style.setProperty('--player-color', PLAYER_COLORS[opts.playerIndex] ?? '#ffffff');

    // 左上: 順位とラップ
    const tl = el('div', 'hud-panel hud-tl');
    const posRow = el('div', 'hud-pos');
    this.pos = el('span', 'hud-pos-num', '-');
    this.posSuffix = el('span', 'hud-pos-suffix', '');
    this.posTotal = el('span', 'hud-pos-total', '/ -');
    posRow.append(this.pos, this.posSuffix, this.posTotal);
    this.lap = el('div', 'hud-lap', 'LAP 1/3');
    this.lapTime = el('div', 'hud-laptime', '0:00.000');
    this.bestLap = el('div', 'hud-bestlap', 'BEST --:--.---');
    tl.append(posRow, this.lap, this.lapTime, this.bestLap);
    if (opts.split) {
      tl.prepend(el('div', 'hud-player-tag', `P${opts.playerIndex + 1}`));
    }

    // 左下: タイム差
    const bl = el('div', 'hud-panel hud-bl');
    const gapRow1 = el('div', 'hud-gap');
    gapRow1.append(el('span', 'hud-gap-label', '前の車'));
    this.gapAhead = el('span', 'hud-gap-value', '--');
    gapRow1.append(this.gapAhead);
    const gapRow2 = el('div', 'hud-gap');
    gapRow2.append(el('span', 'hud-gap-label', 'トップ'));
    this.gapLeader = el('span', 'hud-gap-value', '--');
    gapRow2.append(this.gapLeader);
    bl.append(gapRow1, gapRow2);

    // 右下: 速度
    const br = el('div', 'hud-panel hud-br');
    this.speed = el('div', 'hud-speed', '0');
    const unit = el('div', 'hud-speed-unit', 'km/h');
    const bar = el('div', 'hud-speedbar');
    this.speedBar = el('div', 'hud-speedbar-fill');
    bar.append(this.speedBar);
    br.append(this.speed, unit, bar);

    // 右上: ミニマップ
    this.minimap = new Minimap(track, opts.split ? 150 : 200);
    const tr = el('div', 'hud-tr');
    tr.append(this.minimap.root);

    // 中央: カウントダウン・メッセージ
    this.center = el('div', 'hud-center');
    this.message = el('div', 'hud-message');
    this.sub = el('div', 'hud-submessage');
    this.center.append(this.message, this.sub);

    // バトル
    this.battle = el('div', 'hud-battle');
    const hp = el('div', 'hud-hp');
    hp.append(el('span', 'hud-hp-label', 'TIRE'));
    const hpBar = el('div', 'hud-hp-bar');
    this.hpFill = el('div', 'hud-hp-fill');
    hpBar.append(this.hpFill);
    this.hpText = el('span', 'hud-hp-text', '100');
    hp.append(hpBar, this.hpText);
    const enemy = el('div', 'hud-hp enemy');
    enemy.append(el('span', 'hud-hp-label', 'CPU'));
    const eBar = el('div', 'hud-hp-bar');
    this.enemyHpFill = el('div', 'hud-hp-fill');
    eBar.append(this.enemyHpFill);
    enemy.append(eBar);
    const inv = el('div', 'hud-inventory');
    for (let i = 0; i < itemsConfig.maxInventory; i++) {
      const s = el('div', 'hud-slot');
      s.append(el('span', 'hud-slot-icon'), el('span', 'hud-slot-name'), el('span', 'hud-slot-ammo'));
      this.slots.push(s);
      inv.append(s);
    }
    this.ammo = el('div', 'hud-ammo', '');
    this.boost = el('div', 'hud-boost', '');
    const help = el('div', 'hud-battle-help', '左クリック:発砲　ホイール:選択　ホイールクリック:使用　4:捨てる　右クリック:照準リセット');
    this.battle.append(hp, inv, this.ammo, this.boost, help);
    this.enemyBar = enemy;
    this.crosshair = el('div', 'hud-crosshair');
    this.flash = el('div', 'hud-flash');
    this.toast = el('div', 'hud-toast');

    this.root.append(tl, bl, br, tr, this.center, this.toast);
    if (opts.battle) {
      this.root.append(this.battle, this.enemyBar, this.crosshair, this.flash);
    }
  }

  /** 中央に大きく表示 (カウントダウン等)。duration 0 で消えない */
  showMessage(text: string, sub = '', duration = 1.5, cls = ''): void {
    setText(this.message, text);
    setText(this.sub, sub);
    this.center.className = `hud-center show ${cls}`;
    this.messageTimer = duration;
  }

  clearMessage(): void {
    this.center.className = 'hud-center';
    this.messageTimer = 0;
  }

  showToast(text: string, duration = 1.6): void {
    setText(this.toast, text);
    this.toast.classList.add('show');
    this.toastTimer = duration;
  }

  update(f: HudFrame, dt: number): void {
    const car = f.car;
    const p = car.progress;
    const n = car.position;
    setText(this.pos, String(n));
    setText(this.posSuffix, ORDINAL[n] ?? 'th');
    setText(this.posTotal, `/ ${f.totalCars}`);
    setText(this.lap, `LAP ${p.displayLap}/${f.laps}`);
    toggleClass(this.lap, 'final', p.lap === f.laps && !p.finished);
    setText(this.lapTime, formatRaceTime(p.finished ? (p.lapTimes[p.lapTimes.length - 1] ?? 0) : p.currentLapTime(f.raceTime)));
    setText(this.bestLap, `BEST ${formatRaceTime(p.bestLap)}`);
    const kmh = Math.round(msToKmh(Math.abs(car.body.forwardSpeed)));
    setText(this.speed, String(kmh));
    const ratio = Math.min(1, Math.abs(car.body.forwardSpeed) / Math.max(1, car.body.maxSpeed / car.body.maxSpeedMul));
    setStyle(this.speedBar, 'width', `${(ratio * 100).toFixed(1)}%`);
    setText(this.gapAhead, n === 1 ? 'TOP!' : formatGap(f.gapAhead));
    setText(this.gapLeader, n === 1 ? '--' : formatGap(f.gapLeader));

    // メッセージのタイマー
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.clearMessage();
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('show');
    }

    // ミニマップ (約30fps)
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 1 / 30;
      this.minimap.draw(f.cars, car, f.itemBoxes);
    }

    // バトル
    const c = f.combatant;
    if (c) {
      const hp = c.tire.hp;
      setStyle(this.hpFill, 'width', `${(c.tire.ratio * 100).toFixed(1)}%`);
      toggleClass(this.hpFill, 'low', hp <= 30);
      setText(this.hpText, c.tire.isFlat ? 'PUNCTURE!' : String(Math.ceil(hp)));
      if (f.opponent) setStyle(this.enemyHpFill, 'width', `${(f.opponent.tire.ratio * 100).toFixed(1)}%`);
      const inv = c.inventory;
      this.slots.forEach((s, i) => {
        const slot = inv.slots[i];
        const icon = s.children[0] as HTMLElement;
        const name = s.children[1] as HTMLElement;
        const ammo = s.children[2] as HTMLElement;
        if (slot) {
          const def = ITEM_DEFS[slot.kind];
          setText(icon, def.icon);
          setText(name, def.name);
          setText(ammo, slot.kind === 'gun' ? `×${slot.ammo}` : '');
          setStyle(s, '--item-color', def.color);
        } else {
          setText(icon, '');
          setText(name, '');
          setText(ammo, '');
          setStyle(s, '--item-color', 'transparent');
        }
        toggleClass(s, 'empty', !slot);
        toggleClass(s, 'selected', i === inv.selected && !!slot);
      });
      const ammoTotal = inv.totalAmmo;
      setText(this.ammo, ammoTotal > 0 ? `弾 ${ammoTotal}` : '銃なし (アイテムボックスで入手)');
      toggleClass(this.ammo, 'none', ammoTotal <= 0);
      setText(this.boost, c.boosting ? `BOOST ${c.boostTimer.toFixed(1)}s` : '');
      toggleClass(this.boost, 'active', c.boosting);
      setStyle(this.flash, 'opacity', (c.hitFlash > 0 ? 0.55 : 0).toFixed(2));
      setStyle(this.crosshair, 'transform', `translate(${f.aimX.toFixed(1)}px, ${f.aimY.toFixed(1)}px)`);
      toggleClass(this.crosshair, 'hidden', !f.showAim);
      toggleClass(this.crosshair, 'noammo', ammoTotal <= 0);
    }
  }
}
