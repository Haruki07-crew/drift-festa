/**
 * コースごとの BGM (と、タイトル・メニューの曲)。
 *
 * 曲は「ジャンル (style) + キー (root/scale) + テンポ (bpm) + コード進行 + メロディの種 (seed)」で決まる。
 * 同じ設定なら毎回同じ曲になる。seed を変えるとメロディだけが変わるので、気に入るまで数字を変えて試せる。
 *
 * - root  : キーの基準の音 (MIDI ノート番号。45 = A2、48 = C3、50 = D3、52 = E3、55 = G3)
 * - progression / bProgression : 1小節ごとのコード。スケールの何番目の音から作る和音か (0 = 1番目 = 主和音)
 *   例: メジャーで [0, 4, 5, 3] = I - V - vi - IV、マイナーで [0, 5, 2, 6] = i - VI - III - VII
 * - 新しいコースを追加したらここにも1曲追加する (テストで確認している)
 */
import type { MusicStyleId, ScaleId } from './music';

export interface MusicTheme {
  /** 曲名 (デバッグ表示用) */
  title: string;
  style: MusicStyleId;
  bpm: number;
  root: number;
  scale: ScaleId;
  progression: readonly number[];
  bProgression: readonly number[];
  seed: number;
}

/** タイトル・メニュー・結果画面の曲 */
export const MENU_MUSIC_ID = 'menu';

export const MUSIC_THEMES: Record<string, MusicTheme> = {
  menu: {
    title: 'Festival Start Line',
    style: 'pop',
    bpm: 118,
    root: 48, // C
    scale: 'major',
    progression: [5, 3, 0, 4],
    bProgression: [3, 4, 2, 5],
    seed: 7,
  },

  // ---------------- CIRCUIT
  aurora: {
    title: 'Aurora Straight',
    style: 'pop',
    bpm: 132,
    root: 50, // D
    scale: 'major',
    progression: [0, 4, 5, 3],
    bProgression: [3, 4, 2, 5],
    seed: 101,
  },
  harbor: {
    title: 'Neon Harbor Lights',
    style: 'synthwave',
    bpm: 112,
    root: 54, // F#
    scale: 'minor',
    progression: [0, 5, 2, 6],
    bProgression: [3, 5, 6, 6],
    seed: 202,
  },
  touge: {
    title: 'Twilight Hairpin',
    style: 'eurobeat',
    bpm: 156,
    root: 50, // D
    scale: 'harmonicMinor',
    progression: [5, 6, 0, 0],
    bProgression: [3, 4, 5, 4],
    seed: 303,
  },
  neon: {
    title: 'Gravity Loop',
    style: 'techno',
    bpm: 128,
    root: 52, // E
    scale: 'phrygian',
    progression: [0, 0, 1, 0],
    bProgression: [5, 6, 0, 1],
    seed: 404,
  },
  aqua: {
    title: 'Glass Tunnel Blue',
    style: 'tropical',
    bpm: 110,
    root: 53, // F
    scale: 'lydian',
    progression: [0, 1, 0, 1],
    bProgression: [5, 3, 4, 4],
    seed: 505,
  },
  frost: {
    title: 'Frozen Lake Jump',
    style: 'ambient',
    bpm: 122,
    root: 47, // B
    scale: 'minor',
    progression: [0, 5, 3, 4],
    bProgression: [5, 6, 0, 4],
    seed: 606,
  },
  jungle: {
    title: 'Temple Drums',
    style: 'tribal',
    bpm: 124,
    root: 45, // A
    scale: 'dorian',
    progression: [0, 3, 0, 6],
    bProgression: [3, 6, 0, 0],
    seed: 707,
  },
  magma: {
    title: 'Molten Gate',
    style: 'rock',
    bpm: 142,
    root: 52, // E
    scale: 'phrygian',
    progression: [0, 1, 0, 6],
    bProgression: [5, 6, 1, 0],
    seed: 808,
  },
  skyline: {
    title: 'Above The Clouds',
    style: 'eurobeat',
    bpm: 140,
    root: 55, // G
    scale: 'major',
    progression: [0, 4, 5, 3],
    bProgression: [3, 0, 4, 4],
    seed: 909,
  },
  toybox: {
    title: 'Toy Train Panic',
    style: 'chiptune',
    bpm: 150,
    root: 48, // C
    scale: 'major',
    progression: [0, 3, 4, 0],
    bProgression: [5, 3, 1, 4],
    seed: 1010,
  },
  airport: {
    title: 'Runway Rush',
    style: 'pop',
    bpm: 128,
    root: 45, // A
    scale: 'major',
    progression: [0, 3, 0, 4],
    bProgression: [5, 3, 0, 4],
    seed: 1111,
  },
  volcano: {
    title: 'Island Of Fire',
    style: 'tropical',
    bpm: 118,
    root: 55, // G
    scale: 'mixolydian',
    progression: [0, 6, 3, 0],
    bProgression: [3, 6, 4, 4],
    seed: 1212,
  },
  mall: {
    title: 'Mega Mall Groove',
    style: 'lofi',
    bpm: 108,
    root: 46, // Bb
    scale: 'major',
    progression: [0, 5, 1, 4],
    bProgression: [3, 2, 1, 4],
    seed: 1313,
  },
  school: {
    title: 'Festival Chaos',
    style: 'chiptune',
    bpm: 146,
    root: 53, // F
    scale: 'major',
    progression: [0, 3, 4, 0],
    bProgression: [5, 3, 4, 4],
    seed: 1414,
  },
  cloud: {
    title: 'Rainbow Kingdom',
    style: 'ambient',
    bpm: 120,
    root: 52, // E
    scale: 'lydian',
    progression: [0, 1, 0, 1],
    bProgression: [3, 4, 5, 4],
    seed: 1515,
  },
  space: {
    title: 'Orbit Station',
    style: 'techno',
    bpm: 126,
    root: 49, // C#
    scale: 'minor',
    progression: [0, 5, 6, 0],
    bProgression: [3, 5, 4, 4],
    seed: 1616,
  },
  rain: {
    title: 'Wet Neon Streets',
    style: 'lofi',
    bpm: 98,
    root: 50, // D
    scale: 'dorian',
    progression: [0, 3, 0, 3],
    bProgression: [5, 4, 3, 4],
    seed: 1717,
  },
  windfarm: {
    title: 'Windmill Ridge',
    style: 'folk',
    bpm: 128,
    root: 50, // D
    scale: 'major',
    progression: [0, 3, 0, 4],
    bProgression: [5, 3, 0, 4],
    seed: 1818,
  },

  // ---------------- POINT TO POINT
  tokyo: {
    title: 'Midnight Expressway',
    style: 'eurobeat',
    bpm: 150,
    root: 49, // C#
    scale: 'minor',
    progression: [0, 5, 6, 0],
    bProgression: [5, 6, 4, 4],
    seed: 1919,
  },
  alpine: {
    title: 'Matterhorn Run',
    style: 'folk',
    bpm: 132,
    root: 55, // G
    scale: 'major',
    progression: [0, 3, 4, 0],
    bProgression: [3, 0, 4, 4],
    seed: 2020,
  },
  coastal: {
    title: 'Sunset Coastline',
    style: 'tropical',
    bpm: 112,
    root: 52, // E
    scale: 'major',
    progression: [0, 4, 5, 3],
    bProgression: [3, 4, 0, 0],
    seed: 2121,
  },
  desert: {
    title: 'Canyon Sandstorm',
    style: 'tribal',
    bpm: 130,
    root: 50, // D
    scale: 'phrygianDominant',
    progression: [0, 1, 0, 6],
    bProgression: [5, 6, 1, 0],
    seed: 2222,
  },
  northern: {
    title: 'Aurora Borealis',
    style: 'ambient',
    bpm: 114,
    root: 54, // F#
    scale: 'minor',
    progression: [0, 5, 2, 6],
    bProgression: [3, 0, 5, 4],
    seed: 2323,
  },
  europe: {
    title: 'Grand Tour',
    style: 'folk',
    bpm: 130,
    root: 53, // F
    scale: 'major',
    progression: [0, 4, 5, 2],
    bProgression: [3, 0, 3, 4],
    seed: 2424,
  },
};

/** コース (またはメニュー) の曲。未登録ならメニューの曲 */
export function musicThemeFor(id: string): MusicTheme {
  return MUSIC_THEMES[id] ?? MUSIC_THEMES[MENU_MUSIC_ID]!;
}
