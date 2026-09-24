/**
 * タイトル → モード選択 → (人数 → 総台数) → NPC難易度 → 車選択 → コース選択 の画面遷移。
 *
 * PURE RACE : タイトル → モード → プレイヤー人数 → 総参加台数 → NPC難易度 → 車 (P1, P2) → コース
 * BATTLE DUEL: タイトル → モード → NPC難易度 → 車 → コース
 */
import { CARS, CAR_STAT_LABELS, normalizedStat, type CarStatKey } from '../../config/cars';
import { COURSES } from '../../config/courses';
import { gameConfig } from '../../config/game';
import { NPC_DIFFICULTIES, npcConfig, type NpcDifficulty } from '../../config/npc';
import { Track } from '../../courses/Track';
import { formatRaceTime } from '../../game/RaceProgress';
import type { RaceSetup } from '../../game/RaceSetup';
import type { StorageManager } from '../../storage/StorageManager';
import { colorHex, el } from '../dom';
import type { UIManager } from '../UIManager';

export interface SetupFlowCallbacks {
  onStart: (setup: RaceSetup) => void;
  onSettings: (back: () => void) => void;
  onHowToPlay: (back: () => void) => void;
  /** 車選択画面でフォーカス中の車 (背景の3D表示用) */
  onPreviewCar: (carId: string | null) => void;
}

const DIFFICULTY_TEXT: Record<NpcDifficulty, string> = {
  weak: 'やさしい — はじめての人向け',
  normal: 'ふつう — ほどよいライバル',
  strong: 'つよい — 本気のCPU',
  ultimate: '最強 — ほぼミスしない完璧な走り (チートなし)',
};

const STAT_KEYS: CarStatKey[] = ['maxSpeedKmh', 'accel', 'brake', 'grip', 'drift', 'mass', 'durability'];

export class SetupFlow {
  private readonly ui: UIManager;
  private readonly storage: StorageManager;
  private readonly cb: SetupFlowCallbacks;
  private mode: 'pure' | 'battle' = 'pure';
  private humans = 1;
  private total = 6;
  private difficulty: NpcDifficulty = 'normal';
  private carIds: string[] = [];
  private readonly trackPreviewCache = new Map<string, HTMLCanvasElement>();

  constructor(ui: UIManager, storage: StorageManager, cb: SetupFlowCallbacks) {
    this.ui = ui;
    this.storage = storage;
    this.cb = cb;
  }

  // ------------------------------------------------------------------ タイトル
  showTitle(): void {
    this.cb.onPreviewCar(this.storage.prefs.carIds[0] ?? null);
    const root = el('div', 'screen title-screen');
    const logo = el('div', 'title-logo');
    logo.append(el('div', 'title-main', 'DRIFT FESTA'), el('div', 'title-sub', '3D ローポリ カーレース'));
    const press = el('div', 'title-press', 'Enter キー / クリックでスタート');
    const foot = el('div', 'title-foot', 'PURE RACE (1〜2人) ・ BATTLE DUEL (1人 vs CPU)');
    root.append(logo, press, foot);
    const go = (): void => {
      this.ui.playSound('confirm');
      this.showMode();
    };
    root.addEventListener('click', go);
    this.ui.show({
      root,
      handleKey: (code) => {
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
          go();
          return true;
        }
        return false;
      },
    });
  }

  // ------------------------------------------------------------------ モード
  showMode(): void {
    const prefs = this.storage.prefs;
    this.ui.showMenu({
      title: 'モードをえらぶ',
      className: 'mode-menu',
      initialIndex: prefs.lastMode === 'battle' ? 1 : 0,
      options: [
        {
          label: 'PURE RACE',
          sub: '純粋な運転技術で勝負！ 1〜2人 + CPU で最大8台',
          className: 'big',
          onSelect: () => {
            this.mode = 'pure';
            this.storage.updatePrefs({ lastMode: 'pure' });
            this.showPlayers();
          },
        },
        {
          label: 'BATTLE DUEL',
          sub: '銃とアイテムで妨害しながら CPU と1対1！',
          className: 'big battle',
          onSelect: () => {
            this.mode = 'battle';
            this.humans = 1;
            this.total = 2;
            this.storage.updatePrefs({ lastMode: 'battle' });
            this.showDifficulty();
          },
        },
        { label: 'あそびかた', sub: '操作方法', onSelect: () => this.cb.onHowToPlay(() => this.showMode()) },
        { label: '設定', sub: '音量・画質・テーマなど', onSelect: () => this.cb.onSettings(() => this.showMode()) },
      ],
      onBack: () => this.showTitle(),
    });
  }

  // ------------------------------------------------------------------ 人数
  private showPlayers(): void {
    this.ui.showMenu({
      title: 'プレイヤー人数',
      subtitle: '2人プレイは画面を左右に分割します',
      columns: 2,
      initialIndex: this.storage.prefs.pureHumans - 1,
      options: [
        { label: '1人', sub: 'A=前 F=後 E=右 W=左 ・ Space でドリフト', className: 'big', onSelect: () => this.pickPlayers(1) },
        { label: '2人', sub: 'P1: A/F/E/W + Space ・ P2: 矢印キー + Enter', className: 'big', onSelect: () => this.pickPlayers(2) },
      ],
      onBack: () => this.showMode(),
    });
  }

  private pickPlayers(n: number): void {
    this.humans = n;
    this.storage.updatePrefs({ pureHumans: n });
    this.showTotalCars();
  }

  // ------------------------------------------------------------------ 総台数
  private showTotalCars(): void {
    const cfg = gameConfig.pureRace;
    const min = Math.max(cfg.minCars, this.humans);
    const counts: number[] = [];
    for (let n = min; n <= cfg.maxCars; n++) counts.push(n);
    const pref = this.storage.prefs.pureTotalCars;
    this.ui.showMenu({
      title: '参加台数',
      subtitle: `人間 ${this.humans}人 + CPU で合計何台で走る？`,
      columns: 4,
      initialIndex: Math.max(0, counts.indexOf(Math.max(min, pref))),
      options: counts.map((n) => ({
        label: `${n}台`,
        sub: `CPU ${n - this.humans}台`,
        onSelect: () => {
          this.total = n;
          this.storage.updatePrefs({ pureTotalCars: n });
          if (n - this.humans === 0) {
            this.difficulty = this.storage.prefs.difficulty;
            this.carIds = [];
            this.showCarSelect(0);
          } else {
            this.showDifficulty();
          }
        },
      })),
      onBack: () => this.showPlayers(),
    });
  }

  // ------------------------------------------------------------------ 難易度
  private showDifficulty(): void {
    const pref = this.storage.prefs.difficulty;
    this.ui.showMenu({
      title: 'CPU の強さ',
      subtitle: this.mode === 'battle' ? 'BATTLE DUEL の相手の強さ' : undefined,
      initialIndex: NPC_DIFFICULTIES.indexOf(pref),
      options: NPC_DIFFICULTIES.map((d) => ({
        label: d === 'ultimate' ? `最強 ${npcConfig.difficulties[d].label}` : npcConfig.difficulties[d].label,
        sub: DIFFICULTY_TEXT[d],
        className: `difficulty ${d}`,
        onSelect: () => {
          this.difficulty = d;
          this.storage.updatePrefs({ difficulty: d });
          this.carIds = [];
          this.showCarSelect(0);
        },
      })),
      onBack: () => (this.mode === 'battle' ? this.showMode() : this.showTotalCars()),
    });
  }

  // ------------------------------------------------------------------ 車選択
  private showCarSelect(playerIndex: number): void {
    const prefs = this.storage.prefs;
    const prefId = this.mode === 'battle' ? prefs.battleCarId : prefs.carIds[playerIndex];
    const initial = Math.max(0, CARS.findIndex((c) => c.id === prefId));
    const side = el('div', 'car-detail');
    const renderDetail = (i: number): void => {
      const car = CARS[i]!;
      side.replaceChildren();
      const head = el('div', 'car-detail-head');
      head.append(el('div', 'car-detail-name', car.name), el('div', `car-detail-drive drive-${car.drivetrain}`, car.drivetrain));
      side.append(head, el('div', 'car-detail-tag', car.tagline));
      for (const k of STAT_KEYS) {
        const row = el('div', 'stat-row');
        row.append(el('span', 'stat-label', CAR_STAT_LABELS[k]));
        const bar = el('div', 'stat-bar');
        const fill = el('div', 'stat-fill');
        fill.style.width = `${Math.round(8 + normalizedStat(car, k) * 92)}%`;
        bar.append(fill);
        row.append(bar);
        side.append(row);
      }
      this.cb.onPreviewCar(car.id);
    };
    const title =
      this.mode === 'pure' && this.humans > 1 ? `PLAYER ${playerIndex + 1} の車をえらぶ` : '車をえらぶ';
    this.ui.showMenu({
      title,
      subtitle: '車ごとに長所と短所があります',
      className: 'car-menu',
      columns: 5,
      initialIndex: initial,
      side,
      onFocus: renderDetail,
      options: CARS.map((car) => {
        const swatch = el('span', 'car-swatch');
        swatch.style.background = `linear-gradient(135deg, ${colorHex(car.visual.bodyColor)} 60%, ${colorHex(car.visual.accentColor)} 60%)`;
        return {
          label: car.name,
          sub: car.drivetrain,
          extra: swatch,
          onSelect: () => {
            this.carIds[playerIndex] = car.id;
            if (this.mode === 'battle') {
              this.storage.updatePrefs({ battleCarId: car.id });
              this.showCourseSelect();
              return;
            }
            const ids = [...this.storage.prefs.carIds];
            ids[playerIndex] = car.id;
            this.storage.updatePrefs({ carIds: ids });
            if (playerIndex + 1 < this.humans) this.showCarSelect(playerIndex + 1);
            else this.showCourseSelect();
          },
        };
      }),
      onBack: () => {
        if (playerIndex > 0) this.showCarSelect(playerIndex - 1);
        else if (this.mode === 'pure' && this.total - this.humans === 0) this.showTotalCars();
        else this.showDifficulty();
      },
    });
    renderDetail(initial);
  }

  // ------------------------------------------------------------------ コース選択
  private showCourseSelect(): void {
    this.cb.onPreviewCar(null);
    const pref = this.storage.prefs.courseId;
    const side = el('div', 'course-detail');
    const renderDetail = (i: number): void => {
      const c = COURSES[i]!;
      side.replaceChildren();
      side.append(el('div', 'course-detail-name', c.name));
      side.append(el('div', 'course-detail-stars', `難しさ ${'★'.repeat(c.difficultyStars)}${'☆'.repeat(5 - c.difficultyStars)}`));
      side.append(this.trackPreview(c.id));
      side.append(el('div', 'course-detail-desc', c.description));
      if (c.tips) side.append(el('div', 'course-detail-tips', `攻略: ${c.tips}`));
      const best = this.storage.getBest(c.id);
      const bt = el('div', 'course-best');
      bt.append(
        el('div', '', `ベストタイム ${formatRaceTime(best.raceTime)}${best.raceCarId ? ` (${carName(best.raceCarId)})` : ''}`),
        el('div', '', `ベストラップ ${formatRaceTime(best.bestLap)}${best.bestLapCarId ? ` (${carName(best.bestLapCarId)})` : ''}`),
      );
      side.append(bt);
    };
    this.ui.showMenu({
      title: 'コースをえらぶ',
      subtitle: `全${COURSES.length}コース・すべて ${gameConfig.laps} 周`,
      className: 'course-menu',
      columns: 2,
      initialIndex: Math.max(0, COURSES.findIndex((c) => c.id === pref)),
      side,
      onFocus: renderDetail,
      options: COURSES.map((c) => ({
        label: c.name,
        sub: '★'.repeat(c.difficultyStars),
        onSelect: () => {
          this.storage.updatePrefs({ courseId: c.id });
          this.cb.onStart({
            mode: this.mode,
            courseId: c.id,
            humanCarIds: this.carIds.slice(0, this.mode === 'battle' ? 1 : this.humans),
            totalCars: this.mode === 'battle' ? 2 : this.total,
            difficulty: this.difficulty,
          });
        },
      })),
      onBack: () => this.showCarSelect(this.mode === 'battle' ? 0 : this.humans - 1),
    });
  }

  /** 結果画面の「車を変更」「コースを変更」用 */
  restartFrom(setup: RaceSetup, step: 'car' | 'course'): void {
    this.mode = setup.mode;
    this.humans = setup.humanCarIds.length;
    this.total = setup.totalCars;
    this.difficulty = setup.difficulty;
    this.carIds = [...setup.humanCarIds];
    if (step === 'car') this.showCarSelect(0);
    else this.showCourseSelect();
  }

  private trackPreview(courseId: string): HTMLCanvasElement {
    const cached = this.trackPreviewCache.get(courseId);
    if (cached) return cached;
    const def = COURSES.find((c) => c.id === courseId)!;
    const track = Track.build(def);
    const size = 220;
    const canvas = el('canvas', 'course-preview');
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      const b = track.bounds;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      const scale = (size - 24) / span;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const yr = Math.max(1, b.maxY - b.minY);
      ctx.lineCap = 'round';
      for (let i = 0; i < track.samples.length; i++) {
        const a = track.samples[i]!;
        const c = track.samples[(i + 1) % track.samples.length]!;
        const h = (a.y - b.minY) / yr;
        ctx.strokeStyle = `hsl(${200 - h * 160}, 90%, ${60 + h * 10}%)`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(size / 2 - (a.x - cx) * scale, size / 2 - (a.z - cz) * scale);
        ctx.lineTo(size / 2 - (c.x - cx) * scale, size / 2 - (c.z - cz) * scale);
        ctx.stroke();
      }
      const s0 = track.samples[0]!;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(size / 2 - (s0.x - cx) * scale, size / 2 - (s0.z - cz) * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    this.trackPreviewCache.set(courseId, canvas);
    return canvas;
  }
}

function carName(id: string): string {
  return CARS.find((c) => c.id === id)?.name ?? id;
}
