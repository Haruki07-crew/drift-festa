/**
 * タイトル → モード選択 → (人数 → 総台数) → NPC難易度 → 車選択 → コース選択 の画面遷移。
 *
 * PURE RACE : タイトル → モード → プレイヤー人数 → 総参加台数 → NPC難易度 → 車 (P1, P2) → コース
 * BATTLE DUEL: タイトル → モード → NPC難易度 → 車 → コース
 */
import { CARS, CAR_STAT_LABELS, normalizedStat, type CarStatKey } from '../../config/cars';
import { gameConfig } from '../../config/game';
import { NPC_DIFFICULTIES, npcConfig, type NpcDifficulty } from '../../config/npc';
import type { RaceSetup } from '../../game/RaceSetup';
import type { StorageManager } from '../../storage/StorageManager';
import { colorHex, el } from '../dom';
import type { UIManager } from '../UIManager';
import { CourseSelect } from './CourseSelect';

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
  private readonly courseSelect: CourseSelect;

  constructor(ui: UIManager, storage: StorageManager, cb: SetupFlowCallbacks) {
    this.ui = ui;
    this.storage = storage;
    this.cb = cb;
    this.courseSelect = new CourseSelect(ui, storage);
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

  // ------------------------------------------------------------------ コース選択 (CourseSelect.ts)
  private showCourseSelect(): void {
    this.cb.onPreviewCar(null);
    this.courseSelect.show(
      (courseId) =>
        this.cb.onStart({
          mode: this.mode,
          courseId,
          humanCarIds: this.carIds.slice(0, this.mode === 'battle' ? 1 : this.humans),
          totalCars: this.mode === 'battle' ? 2 : this.total,
          difficulty: this.difficulty,
        }),
      () => this.showCarSelect(this.mode === 'battle' ? 0 : this.humans - 1),
    );
  }
}

