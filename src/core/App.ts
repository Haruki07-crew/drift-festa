/**
 * アプリ全体の管理: 画面遷移・レースの開始/終了・ポーズ・設定反映・メインループ。
 *
 * レンダラー・入力・音・保存データはアプリ起動中に1つだけ持ち、レースごとに作り直すのは
 * RaceSession (シーン・車・HUD など) のみ。レース終了時に RaceSession.dispose() で解放する。
 */
import { AudioManager } from '../audio/AudioManager';
import { findCarSpec } from '../config/cars';
import { controlsConfig } from '../config/controls';
import { findCourseDef } from '../config/courses';
import { NPC_DIFFICULTIES, type NpcDifficulty } from '../config/npc';
import { debugRequestedByUrl, isDebugAllowed } from '../debug/DebugManager';
import type { RaceSetup } from '../game/RaceSetup';
import { RaceSession, type RaceResult } from '../game/RaceSession';
import { InputManager } from '../input/InputManager';
import { RenderContext } from '../render/RenderContext';
import { StorageManager, type GameSettings } from '../storage/StorageManager';
import { MenuBackdrop } from '../ui/MenuBackdrop';
import { showHowToPlay, showLoading, showPause, showSettings, type SettingsHooks } from '../ui/screens/InfoScreens';
import { showResult, type RecordFlags } from '../ui/screens/ResultScreen';
import { SetupFlow } from '../ui/screens/SetupFlow';
import { applyTheme } from '../ui/ThemeManager';
import { UIManager } from '../ui/UIManager';

type AppState = 'menu' | 'loading' | 'race' | 'paused' | 'result';

/**
 * デバッグ用: URL パラメータからメニューを飛ばしてレースを開始する (Festival Mode では無効)。
 * 例: ?debug&race=aqua&mode=pure&cars=6&diff=ultimate&players=2&car=apex86&at=0.4 (at = 開始位置の周回割合)
 */
function quickRaceFromUrl(): RaceSetup | null {
  try {
    const q = new URLSearchParams(window.location.search);
    const courseId = q.get('race');
    if (!courseId || !findCourseDef(courseId)) return null;
    const mode = q.get('mode') === 'battle' ? 'battle' : 'pure';
    const players = mode === 'battle' ? 1 : Math.min(2, Math.max(1, Number(q.get('players') ?? 1)));
    const car = findCarSpec(q.get('car') ?? undefined)?.id ?? 'apex86';
    const diff = (NPC_DIFFICULTIES as readonly string[]).includes(q.get('diff') ?? '') ? (q.get('diff') as NpcDifficulty) : 'normal';
    return {
      mode,
      courseId,
      humanCarIds: players === 2 ? [car, 'neonfox'] : [car],
      totalCars: mode === 'battle' ? 2 : Math.min(8, Math.max(players, Number(q.get('cars') ?? 6))),
      difficulty: diff,
    };
  } catch {
    return null;
  }
}

export class App {
  private readonly storage = new StorageManager();
  private readonly input = new InputManager();
  private readonly audio: AudioManager;
  private readonly render: RenderContext;
  private readonly ui: UIManager;
  private readonly hudLayer: HTMLElement;
  private readonly backdrop = new MenuBackdrop();
  private readonly flow: SetupFlow;
  private session: RaceSession | null = null;
  private lastSetup: RaceSetup | null = null;
  private state: AppState = 'menu';
  private lastTime = 0;
  private rafId = 0;
  private debugEnabled: boolean;
  private raceCount = 0;

  private readonly onVisibility = (): void => {
    if (document.hidden && this.state === 'race') this.pause();
  };

  constructor(root: HTMLElement) {
    // 文化祭モードでは前の人が変えたキー設定を残さない (起動時に初期設定へ)
    if (__FESTIVAL__ && controlsConfig.keyBindings.resetOnFestivalStart) this.storage.resetKeyBindings();
    const settings = this.storage.settings;
    applyTheme(settings.theme);
    this.audio = new AudioManager(settings.seVolume);

    const gameLayer = root.querySelector<HTMLElement>('#game-layer');
    const hudLayer = root.querySelector<HTMLElement>('#hud-layer');
    const uiLayer = root.querySelector<HTMLElement>('#ui-layer');
    if (!gameLayer || !hudLayer || !uiLayer) throw new Error('index.html のレイヤー要素が見つかりません');
    this.hudLayer = hudLayer;
    this.render = new RenderContext(gameLayer, settings.graphicsQuality);
    this.input.attach(gameLayer);
    this.ui = new UIManager(uiLayer, this.input, this.audio);
    this.debugEnabled = isDebugAllowed() && (import.meta.env.DEV || debugRequestedByUrl());

    this.flow = new SetupFlow(this.ui, this.storage, {
      onStart: (setup) => this.startRace(setup),
      onSettings: (back) => this.openSettings(back, false),
      onHowToPlay: (back) => showHowToPlay(this.ui, this.storage, back),
      onPreviewCar: (id) => this.backdrop.showCar(id),
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    const quick = this.debugEnabled ? quickRaceFromUrl() : null;
    if (quick) {
      this.startRace(quick);
      const at = Number(new URLSearchParams(window.location.search).get('at'));
      if (Number.isFinite(at) && at > 0) {
        window.setTimeout(() => this.session?.debugTeleport(at), 200);
      }
    }
    else this.flow.showTitle();
  }

  start(): void {
    this.lastTime = performance.now();
    const loop = (t: number): void => {
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (t - this.lastTime) / 1000));
      this.lastTime = t;
      this.frame(dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private frame(dt: number): void {
    switch (this.state) {
      case 'race':
      case 'paused':
        this.session?.update(dt);
        break;
      case 'menu':
      case 'result':
      case 'loading':
        this.backdrop.render(this.render, dt);
        break;
    }
    this.ui.update(dt);
    this.input.endFrame();
  }

  // ------------------------------------------------------------------ レース
  private startRace(setup: RaceSetup): void {
    this.endSession();
    this.lastSetup = setup;
    this.state = 'loading';
    showLoading(this.ui, 'LOADING...');
    // ロード表示を描画してから重い生成処理を行う
    window.setTimeout(() => {
      try {
        const session = new RaceSession(setup, {
          render: this.render,
          input: this.input,
          audio: this.audio,
          settings: () => this.storage.settings,
          hudLayer: this.hudLayer,
          debugEnabled: this.debugEnabled,
        });
        session.onFinished = (r) => this.onRaceFinished(r);
        session.onPauseRequest = () => this.pause();
        this.session = session;
        this.raceCount++;
        this.ui.clear();
        this.input.releaseAll();
        this.state = 'race';
        this.render.canvas.focus();
      } catch (err) {
        console.error('[App] レースの開始に失敗しました', err);
        this.state = 'menu';
        this.flow.showMode();
      }
    }, 30);
  }

  private endSession(): void {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    this.input.gameActive = false;
    this.input.captureMouse = false;
  }

  private onRaceFinished(result: RaceResult): void {
    const records: RecordFlags[] = [];
    for (const e of result.entries) {
      if (!e.isHuman) continue;
      const r = this.storage.submitResult(result.setup.courseId, e.carId, e.finishTime, e.bestLap);
      records.push({ playerIndex: e.playerIndex, ...r });
    }
    this.endSession();
    this.state = 'result';
    this.backdrop.showCar(result.setup.humanCarIds[0] ?? null);
    showResult(this.ui, result, records, this.storage.settings.idleReturnSeconds, {
      retry: () => this.lastSetup && this.startRace(this.lastSetup),
      changeCar: () => this.toMenu(() => this.lastSetup && this.flow.restartFrom(this.lastSetup, 'car')),
      changeCourse: () => this.toMenu(() => this.lastSetup && this.flow.restartFrom(this.lastSetup, 'course')),
      title: () => this.toMenu(() => this.flow.showTitle()),
    });
  }

  private toMenu(show: () => void): void {
    this.endSession();
    this.state = 'menu';
    this.input.releaseAll();
    show();
  }

  // ------------------------------------------------------------------ ポーズ
  private pause(): void {
    if (!this.session || this.state !== 'race') return;
    this.state = 'paused';
    this.session.setPaused(true);
    this.showPauseMenu();
  }

  private showPauseMenu(): void {
    showPause(this.ui, {
      resume: () => this.resume(),
      restart: () => this.lastSetup && this.startRace(this.lastSetup),
      settings: () => this.openSettings(() => this.showPauseMenu(), true),
      title: () => this.toMenu(() => this.flow.showTitle()),
    });
  }

  private resume(): void {
    if (!this.session) return;
    this.ui.clear();
    this.input.releaseAll();
    this.session.setPaused(false);
    this.state = 'race';
    this.render.canvas.focus();
  }

  // ------------------------------------------------------------------ 設定
  private openSettings(back: () => void, inRace: boolean): void {
    const hooks: SettingsHooks = {
      onChanged: (s) => this.applySettings(s),
      toggleFullscreen: () => this.toggleFullscreen(),
      isFullscreen: () => document.fullscreenElement !== null,
    };
    showSettings(this.ui, this.storage, hooks, back, inRace);
  }

  private applySettings(s: Readonly<GameSettings>): void {
    applyTheme(s.theme);
    this.audio.setVolume(s.seVolume);
    // レース中はレンダラーの作り直しを避ける (アンチエイリアスの変更は次回起動時/メニュー時)
    this.render.setQuality(s.graphicsQuality, this.session === null);
    this.session?.applySettings(s);
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        // フルスクリーン不可の環境では何もしない
      });
    }
  }

  /** デバッグ・長時間稼働テスト用 */
  get stats(): { raceCount: number; state: AppState; geometries: number; textures: number; programs: number; heapMB: number | null } {
    const info = this.render.renderer.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      raceCount: this.raceCount,
      state: this.state,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.endSession();
    this.ui.dispose();
    this.backdrop.dispose();
    this.input.detach();
    this.audio.dispose();
    this.render.dispose();
  }
}
