/**
 * LocalStorage への保存・読み込み。
 *
 * 保存内容: ゲーム設定 (効果音/BGM の音量・マウス感度・カメラ揺れ・画質・テーマ・自動復帰秒数・キー設定)、
 *           各コースのベストタイム / ベストラップ、前回使用した車・人数などのプレイヤー設定。
 * 壊れたデータや古い形式を読み込んでも落ちないよう、項目ごとに検証して既定値で補完する。
 * localStorage が使えない環境 (プライベートモード等) ではメモリ上だけで動作する。
 */
import { audioConfig } from '../config/audio';
import { musicConfig } from '../config/music';
import type { KeyBindingSet } from '../config/controls';
import { battleConfig } from '../config/battle';
import { gameConfig } from '../config/game';
import { graphicsConfig, type GraphicsQuality } from '../config/graphics';
import { NPC_DIFFICULTIES, type NpcDifficulty } from '../config/npc';
import { DEFAULT_THEME, UI_THEMES, type UiThemeId } from '../config/themes';
import { defaultKeyBindings, sanitizeKeyBindings } from '../input/KeyBindings';

export const STORAGE_KEY = 'club-racing-festival:v1';

export interface GameSettings {
  seVolume: number;
  /** BGM の音量 0..1 (0 = BGM なし) */
  bgmVolume: number;
  mouseSensitivity: number;
  cameraShake: boolean;
  graphicsQuality: GraphicsQuality;
  theme: UiThemeId;
  /** 結果画面で無操作時にタイトルへ戻るまでの秒数 (0 = 無効) */
  idleReturnSeconds: number;
  /** 運転キーの割り当て (初期設定 = config/controls.ts の DEFAULT_KEY_BINDINGS) */
  keyBindings: KeyBindingSet;
}

export interface BestRecord {
  raceTime: number | null;
  raceCarId: string | null;
  bestLap: number | null;
  bestLapCarId: string | null;
}

export interface PlayerPrefs {
  lastMode: 'pure' | 'battle';
  pureHumans: number;
  pureTotalCars: number;
  difficulty: NpcDifficulty;
  /** プレイヤー番号ごとの前回の車 */
  carIds: string[];
  battleCarId: string;
  courseId: string;
}

export interface SaveData {
  version: 1;
  settings: GameSettings;
  bestTimes: Record<string, BestRecord>;
  prefs: PlayerPrefs;
}

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSettings(): GameSettings {
  return {
    seVolume: audioConfig.defaultSeVolume,
    bgmVolume: musicConfig.defaultVolume,
    mouseSensitivity: battleConfig.aim.defaultSensitivity,
    cameraShake: true,
    graphicsQuality: graphicsConfig.defaultQuality,
    theme: DEFAULT_THEME,
    idleReturnSeconds: gameConfig.result.defaultIdleReturnSeconds,
    keyBindings: defaultKeyBindings(),
  };
}

export function defaultPrefs(): PlayerPrefs {
  return {
    lastMode: 'pure',
    pureHumans: 1,
    pureTotalCars: 6,
    difficulty: 'normal',
    carIds: ['apex86', 'neonfox'],
    battleCarId: 'vortexr',
    courseId: 'aurora',
  };
}

export function defaultSaveData(): SaveData {
  return { version: 1, settings: defaultSettings(), bestTimes: {}, prefs: defaultPrefs() };
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function nullableTime(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function str<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 読み込んだ JSON を検証し、足りない項目を既定値で補う */
export function sanitizeSaveData(raw: unknown): SaveData {
  const def = defaultSaveData();
  if (!isRecord(raw)) return def;

  const s = isRecord(raw.settings) ? raw.settings : {};
  const settings: GameSettings = {
    seVolume: num(s.seVolume, def.settings.seVolume, 0, 1),
    bgmVolume: num(s.bgmVolume, def.settings.bgmVolume, 0, 1),
    mouseSensitivity: num(s.mouseSensitivity, def.settings.mouseSensitivity, 0.2, 3),
    cameraShake: typeof s.cameraShake === 'boolean' ? s.cameraShake : def.settings.cameraShake,
    graphicsQuality: str<GraphicsQuality>(s.graphicsQuality, ['low', 'medium', 'high'], def.settings.graphicsQuality),
    theme: str<UiThemeId>(s.theme, Object.keys(UI_THEMES) as UiThemeId[], def.settings.theme),
    idleReturnSeconds: num(s.idleReturnSeconds, def.settings.idleReturnSeconds, 0, 600),
    keyBindings: sanitizeKeyBindings(s.keyBindings),
  };

  const bestTimes: Record<string, BestRecord> = {};
  if (isRecord(raw.bestTimes)) {
    for (const [courseId, rec] of Object.entries(raw.bestTimes)) {
      if (!isRecord(rec)) continue;
      bestTimes[courseId] = {
        raceTime: nullableTime(rec.raceTime),
        raceCarId: typeof rec.raceCarId === 'string' ? rec.raceCarId : null,
        bestLap: nullableTime(rec.bestLap),
        bestLapCarId: typeof rec.bestLapCarId === 'string' ? rec.bestLapCarId : null,
      };
    }
  }

  const p = isRecord(raw.prefs) ? raw.prefs : {};
  const prefs: PlayerPrefs = {
    lastMode: str(p.lastMode, ['pure', 'battle'] as const, def.prefs.lastMode),
    pureHumans: Math.round(num(p.pureHumans, def.prefs.pureHumans, 1, 2)),
    pureTotalCars: Math.round(num(p.pureTotalCars, def.prefs.pureTotalCars, 2, 8)),
    difficulty: str<NpcDifficulty>(p.difficulty, NPC_DIFFICULTIES, def.prefs.difficulty),
    carIds:
      Array.isArray(p.carIds) && p.carIds.every((c) => typeof c === 'string')
        ? (p.carIds as string[]).slice(0, 2)
        : def.prefs.carIds,
    battleCarId: typeof p.battleCarId === 'string' ? p.battleCarId : def.prefs.battleCarId,
    courseId: typeof p.courseId === 'string' ? p.courseId : def.prefs.courseId,
  };
  while (prefs.carIds.length < 2) prefs.carIds.push(def.prefs.carIds[prefs.carIds.length]!);

  return { version: 1, settings, bestTimes, prefs };
}

class MemoryBackend implements StorageBackend {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function detectBackend(): StorageBackend {
  try {
    const ls = globalThis.localStorage;
    const probe = '__probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryBackend();
  }
}

export class StorageManager {
  private readonly backend: StorageBackend;
  private data: SaveData;

  constructor(backend: StorageBackend = detectBackend()) {
    this.backend = backend;
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const text = this.backend.getItem(STORAGE_KEY);
      if (!text) return defaultSaveData();
      return sanitizeSaveData(JSON.parse(text));
    } catch (err) {
      console.warn('[Storage] 保存データを読み込めなかったため初期化します', err);
      return defaultSaveData();
    }
  }

  private save(): void {
    try {
      this.backend.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      // 容量不足などで保存できなくてもゲームは続行する (設定はメモリ上に保持)
      console.warn('[Storage] 保存に失敗しました', err);
    }
  }

  get settings(): Readonly<GameSettings> {
    return this.data.settings;
  }

  get prefs(): Readonly<PlayerPrefs> {
    return this.data.prefs;
  }

  updateSettings(patch: Partial<GameSettings>): void {
    this.data.settings = sanitizeSaveData({ ...this.data, settings: { ...this.data.settings, ...patch } }).settings;
    this.save();
  }

  updatePrefs(patch: Partial<PlayerPrefs>): void {
    this.data.prefs = sanitizeSaveData({ ...this.data, prefs: { ...this.data.prefs, ...patch } }).prefs;
    this.save();
  }

  getBest(courseId: string): BestRecord {
    return this.data.bestTimes[courseId] ?? { raceTime: null, raceCarId: null, bestLap: null, bestLapCarId: null };
  }

  /**
   * レース結果を記録する。ベスト更新があった項目を返す。
   */
  submitResult(courseId: string, carId: string, raceTime: number | null, bestLap: number | null): {
    newRaceRecord: boolean;
    newLapRecord: boolean;
  } {
    const cur = this.getBest(courseId);
    const next: BestRecord = { ...cur };
    let newRaceRecord = false;
    let newLapRecord = false;
    if (raceTime !== null && raceTime > 0 && (cur.raceTime === null || raceTime < cur.raceTime)) {
      next.raceTime = raceTime;
      next.raceCarId = carId;
      newRaceRecord = true;
    }
    if (bestLap !== null && bestLap > 0 && (cur.bestLap === null || bestLap < cur.bestLap)) {
      next.bestLap = bestLap;
      next.bestLapCarId = carId;
      newLapRecord = true;
    }
    if (newRaceRecord || newLapRecord) {
      this.data.bestTimes[courseId] = next;
      this.save();
    }
    return { newRaceRecord, newLapRecord };
  }

  /** 全データを初期化 (設定画面・トラブル対応用) */
  resetAll(): void {
    this.data = defaultSaveData();
    try {
      this.backend.removeItem(STORAGE_KEY);
    } catch {
      // 何もしない
    }
  }

  /** キー設定を初期設定に戻す */
  resetKeyBindings(): void {
    this.updateSettings({ keyBindings: defaultKeyBindings() });
  }

  /** ベストタイムのみ初期化 */
  resetBestTimes(): void {
    this.data.bestTimes = {};
    this.save();
  }
}
