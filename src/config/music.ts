/**
 * BGM 設定 (音量・曲の構成・ジャンルごとの楽器とリズム)。
 *
 * BGM は効果音と同じく Web Audio API で実行時に合成する (音声ファイルなし・著作権/ライセンスの問題なし・完全オフライン)。
 * 各コースの曲は config/musicThemes.ts で「ジャンル (style) + キー + テンポ + コード進行 + メロディの種 (seed)」として定義し、
 * メロディ・ベース・ドラムは src/audio/music/Composer.ts がそこから毎回同じ曲を組み立てる。
 *
 * リズムの書き方 (1文字 = 16分音符 1つ、16文字 = 1小節。32文字なら2小節で1周):
 *   ドラム : 'x' = 鳴らす、'X' = 強く鳴らす、'.' = 休み
 *   ベース : 'R' = コードのルート、'O' = ルートの1オクターブ上、'F' = 5度、'T' = 3度、'-' = 前の音をのばす、'.' = 休み
 *   アルペジオ : '0'〜'4' = コードの構成音 (低い順。4 以上はオクターブ上)、'-' = のばす、'.' = 休み
 *   パッド : 'x' = コードを鳴らし直す、'-' = のばす、'.' = 休み
 *   メロディ : 'x' = 新しい音、'-' = のばす、'.' = 休み (音の高さは Composer がコードとスケールから決める)
 */

export type MusicStyleId =
  | 'pop'
  | 'eurobeat'
  | 'synthwave'
  | 'techno'
  | 'tropical'
  | 'chiptune'
  | 'ambient'
  | 'rock'
  | 'folk'
  | 'tribal'
  | 'lofi';

export type ScaleId = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'lydian' | 'phrygian' | 'harmonicMinor' | 'phrygianDominant';

/** スケールの音程 (ルートからの半音数) */
export const SCALES: Record<ScaleId, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
};

/** シンセの音色 */
export interface SynthSpec {
  wave: OscillatorType;
  /** 重ねるオシレーターのずらし [cent] (例 [-8, 8] で厚い音)。省略時は1つ */
  detune?: readonly number[];
  /** オクターブ移動 (-2..+2) */
  octave: number;
  attack: number;
  decay: number;
  /** 0..1 */
  sustain: number;
  release: number;
  /** 音の長さの割合 (1 = 書いた長さいっぱい、0.5 = 短く切る) */
  gate?: number;
  volume: number;
  /** ローパスフィルタ [Hz] */
  cutoff: number;
  /** 発音直後だけフィルタを開く量 [Hz] (アタックの「パキッ」とした感じ) */
  cutoffEnv?: number;
  resonance?: number;
  /** ディレイ (やまびこ) に送る量 0..1 */
  delaySend?: number;
  /** ビブラート */
  vibrato?: { rate: number; depthCents: number };
}

export type PercKind = 'tom' | 'shaker' | 'clave';

export interface DrumSpec {
  kick: string;
  snare: string;
  hat: string;
  /** オープンハイハット (長めのシャーン) */
  openHat?: string;
  perc?: string;
  percKind?: PercKind;
  /** 各セクションの最後の小節で鳴らすフィル (スネア) */
  fill: string;
  /** ドラム全体の音量 */
  volume: number;
  /** キックの音程の高さ (1 = 標準) */
  kickTone?: number;
}

export interface MusicStylePreset {
  label: string;
  drums: DrumSpec;
  bass: { pattern: string; synth: SynthSpec };
  arp?: { pattern: string; synth: SynthSpec };
  pad?: { pattern?: string; synth: SynthSpec };
  lead: {
    synth: SynthSpec;
    /** 1小節ぶんのリズム。小節ごとに seed で選ぶ */
    rhythms: readonly string[];
    /** メロディを五音音階 (ペンタトニック) にする (民族調・明るい曲向け) */
    pentatonic?: boolean;
    /** メロディの音域 [ルートからの半音] */
    range: readonly [number, number];
  };
  /** 4 = 7th コード (おしゃれな響き)、3 = 3和音 */
  chordSize: 3 | 4;
  /** 裏拍の16分音符を遅らせる量 0..0.5 (ハネるリズム) */
  swing: number;
  /** ディレイの長さ [16分音符いくつぶん]、くり返しの強さ、全体へのかかり具合 */
  delay: { steps: number; feedback: number; wet: number };
}

/** 曲の構成 (セクションの並び)。最後まで来たら loopFrom のセクションへ戻る */
export interface MusicSection {
  name: 'intro' | 'A' | 'B' | 'A2' | 'break';
  bars: number;
  /** 'B' のセクションはテーマの bProgression を使う */
  progression: 'main' | 'b';
  layers: readonly MusicLayer[];
}

export type MusicLayer = 'kick' | 'snare' | 'hat' | 'perc' | 'bass' | 'arp' | 'pad' | 'lead';

const FULL: readonly MusicLayer[] = ['kick', 'snare', 'hat', 'perc', 'bass', 'arp', 'pad', 'lead'];

export const musicConfig = {
  /** BGM 音量の既定値 0..1 (設定画面で変更) */
  defaultVolume: 0.5,
  /** BGM 全体の音量の上限 (効果音・エンジン音を聞こえにくくしないため控えめ) */
  masterGain: 0.55,
  /** ポーズ中の音量の倍率 */
  pausedGain: 0.3,
  /** 曲の切り替え時のフェードアウト [s] */
  fadeOutSeconds: 0.6,
  /** 曲の始まりのフェードイン [s] */
  fadeInSeconds: 0.4,
  /** 先読みして予約する時間 [s] と、その確認間隔 [ms] (Web Audio の正確なタイミングで鳴らすため) */
  scheduleAheadSeconds: 0.15,
  schedulerIntervalMs: 25,

  /** 最終ラップ (一本道は残り少なくなったら) で曲を盛り上げる */
  finalStretch: {
    /** テンポの倍率 */
    bpmMultiplier: 1.06,
    /** 一本道コースで盛り上げ始める進み具合 0..1 */
    pointToPointCompletion: 0.75,
  },

  /** 曲の構成: イントロ → A → B → A' → ブレイク → (A へ戻る) */
  form: [
    { name: 'intro', bars: 4, progression: 'main', layers: ['hat', 'bass', 'arp', 'pad'] },
    { name: 'A', bars: 8, progression: 'main', layers: FULL },
    { name: 'B', bars: 8, progression: 'b', layers: FULL },
    { name: 'A2', bars: 8, progression: 'main', layers: FULL },
    { name: 'break', bars: 4, progression: 'b', layers: ['perc', 'bass', 'arp', 'pad'] },
  ] as readonly MusicSection[],
  /** ループで戻るセクションの番号 (イントロは最初の1回だけ) */
  loopFrom: 1,
};

// ------------------------------------------------------------------ 音色

const softPad = (wave: OscillatorType, volume: number, cutoff: number): SynthSpec => ({
  wave,
  detune: [-9, 9],
  octave: 0,
  attack: 0.35,
  decay: 0.5,
  sustain: 0.8,
  release: 0.6,
  volume,
  cutoff,
});

// ------------------------------------------------------------------ ジャンル

export const MUSIC_STYLES: Record<MusicStyleId, MusicStylePreset> = {
  /** 明るいシンセポップ (タイトル画面・初心者向けサーキット) */
  pop: {
    label: 'Synth Pop',
    drums: {
      kick: 'x.......x.x.....',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      openHat: '..............x.',
      fill: '....x.......xxxx',
      volume: 0.9,
    },
    bass: {
      pattern: 'R-R.R-R.R-R.O-F.',
      synth: { wave: 'sawtooth', octave: -1, attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.05, gate: 0.85, volume: 0.32, cutoff: 700, cutoffEnv: 900 },
    },
    arp: {
      pattern: '0.2.1.2.0.2.1.3.',
      synth: { wave: 'square', octave: 1, attack: 0.003, decay: 0.12, sustain: 0.1, release: 0.06, gate: 0.6, volume: 0.07, cutoff: 2600, delaySend: 0.3 },
    },
    pad: { synth: softPad('sawtooth', 0.06, 1500) },
    lead: {
      synth: { wave: 'square', detune: [-5, 5], octave: 1, attack: 0.01, decay: 0.2, sustain: 0.55, release: 0.12, volume: 0.085, cutoff: 3200, delaySend: 0.25, vibrato: { rate: 5.5, depthCents: 10 } },
      rhythms: ['x-.xx-x-x-..x-x-', 'x-x-x-.xx---x-..', 'x--xx-x-x---....', 'x.x.x-x-x-x-x---'],
      range: [0, 16],
    },
    chordSize: 3,
    swing: 0,
    delay: { steps: 3, feedback: 0.3, wet: 0.22 },
  },

  /** ユーロビート (峠・夜の高速道路) */
  eurobeat: {
    label: 'Eurobeat',
    drums: {
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      openHat: '..x...x...x...x.',
      fill: '....x...x.xxxxxx',
      volume: 1,
    },
    bass: {
      pattern: 'RORORORORORORORO',
      synth: { wave: 'sawtooth', octave: -1, attack: 0.003, decay: 0.1, sustain: 0.5, release: 0.04, gate: 0.8, volume: 0.3, cutoff: 900, cutoffEnv: 1400, resonance: 4 },
    },
    arp: {
      pattern: '0213021302130213',
      synth: { wave: 'square', octave: 1, attack: 0.002, decay: 0.08, sustain: 0.15, release: 0.04, gate: 0.6, volume: 0.06, cutoff: 3200, delaySend: 0.2 },
    },
    pad: { synth: softPad('sawtooth', 0.05, 1800) },
    lead: {
      synth: { wave: 'sawtooth', detune: [-12, 0, 12], octave: 1, attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.1, volume: 0.07, cutoff: 4200, cutoffEnv: 1500, delaySend: 0.3, vibrato: { rate: 6, depthCents: 14 } },
      rhythms: ['x-x-x-xxx-x-x---', 'x.xxx-x-x-xxx---', 'x-xx-xx-x-x-x-x-', 'xxx-x-x-x---x-x-'],
      range: [0, 15],
    },
    chordSize: 3,
    swing: 0,
    delay: { steps: 3, feedback: 0.35, wet: 0.25 },
  },

  /** シンセウェイブ (ネオンの夜景) */
  synthwave: {
    label: 'Synthwave',
    drums: {
      kick: 'x.......x.......',
      snare: '....X.......X...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: '....x.......x.xx',
      volume: 0.95,
    },
    bass: {
      pattern: 'RRRRRRRRRRRRRRRR',
      synth: { wave: 'sawtooth', octave: -1, attack: 0.003, decay: 0.09, sustain: 0.4, release: 0.04, gate: 0.7, volume: 0.28, cutoff: 600, cutoffEnv: 1100 },
    },
    arp: {
      pattern: '0.1.2.3.4.3.2.1.',
      synth: { wave: 'sawtooth', octave: 1, attack: 0.003, decay: 0.15, sustain: 0.1, release: 0.1, gate: 0.6, volume: 0.05, cutoff: 2200, delaySend: 0.45 },
    },
    pad: { synth: softPad('sawtooth', 0.075, 1300) },
    lead: {
      synth: { wave: 'sawtooth', detune: [-10, 10], octave: 1, attack: 0.03, decay: 0.3, sustain: 0.7, release: 0.3, volume: 0.07, cutoff: 2600, delaySend: 0.45, vibrato: { rate: 5, depthCents: 12 } },
      rhythms: ['x---x-x-x-------', 'x-x-x---x---x---', 'x-----x-x-x-x---', 'x---x---x-x-x---'],
      range: [0, 14],
    },
    chordSize: 4,
    swing: 0,
    delay: { steps: 3, feedback: 0.45, wet: 0.3 },
  },

  /** テクノ (宇宙・重力) */
  techno: {
    label: 'Techno',
    drums: {
      kick: 'X...X...X...X...',
      snare: '....x.......x...',
      hat: 'xxXxxxXxxxXxxxXx',
      openHat: '..x...x...x...x.',
      fill: '....x.......xxxx',
      volume: 0.95,
      kickTone: 0.9,
    },
    bass: {
      pattern: '..RR..RR..RR..RO',
      synth: { wave: 'sawtooth', octave: -1, attack: 0.003, decay: 0.08, sustain: 0.3, release: 0.03, gate: 0.6, volume: 0.3, cutoff: 500, cutoffEnv: 1500, resonance: 6 },
    },
    arp: {
      pattern: '0102030201020302',
      synth: { wave: 'square', octave: 1, attack: 0.002, decay: 0.07, sustain: 0.1, release: 0.04, gate: 0.5, volume: 0.05, cutoff: 1800, cutoffEnv: 1800, resonance: 5, delaySend: 0.35 },
    },
    pad: { synth: softPad('sawtooth', 0.045, 1100) },
    lead: {
      synth: { wave: 'square', detune: [-7, 7], octave: 1, attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.15, volume: 0.06, cutoff: 2400, delaySend: 0.4 },
      rhythms: ['x-------x-x-----', 'x--x--x---x-----', '....x-x-x-------', 'x-x-x-x-x-------'],
      range: [0, 12],
    },
    chordSize: 3,
    swing: 0,
    delay: { steps: 3, feedback: 0.4, wet: 0.28 },
  },

  /** トロピカル (海・ビーチ・島) */
  tropical: {
    label: 'Tropical',
    drums: {
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      hat: '..x...x...x...x.',
      perc: 'x.xxx.xxx.xxx.xx',
      percKind: 'shaker',
      fill: '....x.....x.x.x.',
      volume: 0.8,
    },
    bass: {
      pattern: 'R..R..R.R..R..F.',
      synth: { wave: 'triangle', octave: -1, attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.08, gate: 0.85, volume: 0.42, cutoff: 900 },
    },
    arp: {
      pattern: '0.2.1.2.3.2.1.2.',
      synth: { wave: 'triangle', octave: 1, attack: 0.002, decay: 0.18, sustain: 0, release: 0.1, gate: 0.9, volume: 0.13, cutoff: 3000, delaySend: 0.3 },
    },
    pad: { pattern: '..x-..x-..x-..x-', synth: { wave: 'square', octave: 0, attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.05, gate: 0.6, volume: 0.035, cutoff: 1600 } },
    lead: {
      synth: { wave: 'triangle', detune: [-4, 4], octave: 1, attack: 0.01, decay: 0.25, sustain: 0.5, release: 0.2, volume: 0.13, cutoff: 3500, delaySend: 0.3, vibrato: { rate: 5, depthCents: 12 } },
      rhythms: ['x-x-..x-x-x-....', '..x-x-x-x---x-..', 'x--x--x-x-x-x---', 'x-x-x-..x---....'],
      pentatonic: true,
      range: [0, 14],
    },
    chordSize: 3,
    swing: 0.08,
    delay: { steps: 3, feedback: 0.3, wet: 0.22 },
  },

  /** チップチューン (おもちゃ・学園祭) */
  chiptune: {
    label: 'Chiptune',
    drums: {
      kick: 'x.....x.x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: '....x...x.x.xxxx',
      volume: 0.75,
      kickTone: 1.2,
    },
    bass: {
      pattern: 'R.O.R.O.R.O.F.O.',
      synth: { wave: 'triangle', octave: -1, attack: 0.002, decay: 0.1, sustain: 0.7, release: 0.03, gate: 0.8, volume: 0.45, cutoff: 6000 },
    },
    arp: {
      pattern: '0120120120120120',
      synth: { wave: 'square', octave: 1, attack: 0.001, decay: 0.05, sustain: 0.4, release: 0.02, gate: 0.7, volume: 0.04, cutoff: 6000 },
    },
    lead: {
      synth: { wave: 'square', octave: 1, attack: 0.002, decay: 0.1, sustain: 0.6, release: 0.04, volume: 0.075, cutoff: 7000, vibrato: { rate: 7, depthCents: 15 } },
      rhythms: ['x-x-x-x-xxx-x---', 'x.x.x-x-x-x-x-x-', 'xxx-x-x-x---x-x-', 'x-xx-xx-x-x-x---'],
      range: [0, 16],
    },
    chordSize: 3,
    swing: 0,
    delay: { steps: 2, feedback: 0.2, wet: 0.12 },
  },

  /** アンビエント寄り (雲の上・オーロラ・氷)。レース向けに軽いビートつき */
  ambient: {
    label: 'Ambient',
    drums: {
      kick: 'x.......x.......',
      snare: '........x.......',
      hat: '..x...x...x...x.',
      perc: 'x..x..x...x..x..',
      percKind: 'clave',
      fill: '........x...x.x.',
      volume: 0.7,
    },
    bass: {
      pattern: 'R-------R---F---',
      synth: { wave: 'sine', octave: -1, attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.3, volume: 0.36, cutoff: 800 },
    },
    arp: {
      pattern: '0.1.2.3.4.3.2.1.',
      synth: { wave: 'sine', octave: 1, attack: 0.002, decay: 0.4, sustain: 0, release: 0.3, gate: 1, volume: 0.13, cutoff: 5000, delaySend: 0.5 },
    },
    pad: { synth: softPad('triangle', 0.075, 1800) },
    lead: {
      synth: { wave: 'sine', detune: [0, 1200], octave: 1, attack: 0.003, decay: 0.6, sustain: 0.15, release: 0.5, volume: 0.1, cutoff: 6000, delaySend: 0.55 },
      rhythms: ['x---x---x-------', 'x-------x---x---', 'x---x-x---------', '..x---x---x-----'],
      range: [0, 14],
    },
    chordSize: 4,
    swing: 0,
    delay: { steps: 3, feedback: 0.5, wet: 0.35 },
  },

  /** ロック (溶岩・工場・砂漠) */
  rock: {
    label: 'Rock',
    drums: {
      kick: 'x.x.....x.x.x...',
      snare: '....X.......X...',
      hat: 'x.x.x.x.x.x.x.x.',
      openHat: '..............x.',
      fill: '....x...xxxxXXXX',
      volume: 1,
    },
    bass: {
      pattern: 'R.R.R.R.R.R.R.RO',
      synth: { wave: 'sawtooth', octave: -1, attack: 0.004, decay: 0.1, sustain: 0.7, release: 0.04, gate: 0.85, volume: 0.32, cutoff: 800, cutoffEnv: 600 },
    },
    pad: {
      pattern: 'x-.x-.x-x-.x-.x-',
      synth: { wave: 'sawtooth', detune: [-14, 14], octave: 0, attack: 0.004, decay: 0.15, sustain: 0.6, release: 0.05, gate: 0.85, volume: 0.05, cutoff: 1800, cutoffEnv: 1200, resonance: 2 },
    },
    lead: {
      synth: { wave: 'sawtooth', detune: [-8, 8], octave: 1, attack: 0.01, decay: 0.2, sustain: 0.75, release: 0.15, volume: 0.065, cutoff: 3000, cutoffEnv: 1000, resonance: 3, delaySend: 0.2, vibrato: { rate: 6, depthCents: 20 } },
      rhythms: ['x-x-x---x-x-x---', 'x---x-x-x-x-x---', 'x.x.x-x-x---x---', 'x-xx-x--x-------'],
      range: [0, 14],
    },
    chordSize: 3,
    swing: 0,
    delay: { steps: 3, feedback: 0.25, wet: 0.15 },
  },

  /** フォーク / 牧歌的 (山・風車・ヨーロッパ) */
  folk: {
    label: 'Folk',
    drums: {
      kick: 'x.......x.......',
      snare: '....x.......x...',
      hat: '..x...x...x...x.',
      perc: 'x..x..x...x.x...',
      percKind: 'clave',
      fill: '....x.......x.xx',
      volume: 0.75,
    },
    bass: {
      pattern: 'R...F...R...F...',
      synth: { wave: 'triangle', octave: -1, attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.1, gate: 0.9, volume: 0.45, cutoff: 1200 },
    },
    arp: {
      pattern: '..12..12..12..12',
      synth: { wave: 'triangle', octave: 0, attack: 0.002, decay: 0.15, sustain: 0, release: 0.08, gate: 0.9, volume: 0.1, cutoff: 3000 },
    },
    pad: { synth: softPad('triangle', 0.07, 1600) },
    lead: {
      synth: { wave: 'triangle', octave: 1, attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.15, volume: 0.15, cutoff: 4000, delaySend: 0.2, vibrato: { rate: 5.5, depthCents: 18 } },
      rhythms: ['x-x-x-x-x---x---', 'x--xx-x-x-x-x---', 'x-xxx-x-x-x-x-x-', 'x---x-x-x-------'],
      pentatonic: true,
      range: [0, 14],
    },
    chordSize: 3,
    swing: 0,
    delay: { steps: 3, feedback: 0.25, wet: 0.15 },
  },

  /** 民族調の打楽器 (ジャングル・遺跡・砂漠) */
  tribal: {
    label: 'Tribal',
    drums: {
      kick: 'x..x..x...x..x..',
      snare: '........x.......',
      hat: 'x.xxx.xxx.xxx.xx',
      perc: 'x.x..x.x..x.x.x.',
      percKind: 'tom',
      fill: '....x...x.x.xxxx',
      volume: 0.85,
      kickTone: 0.85,
    },
    bass: {
      pattern: 'R..R..R...R..F..',
      synth: { wave: 'triangle', octave: -1, attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.1, gate: 0.9, volume: 0.45, cutoff: 900 },
    },
    arp: {
      pattern: '0..1..2...1..0..',
      synth: { wave: 'triangle', octave: 1, attack: 0.002, decay: 0.2, sustain: 0, release: 0.1, gate: 0.9, volume: 0.12, cutoff: 2600, delaySend: 0.3 },
    },
    pad: { synth: softPad('sawtooth', 0.04, 900) },
    lead: {
      synth: { wave: 'triangle', detune: [-6, 6], octave: 1, attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.2, volume: 0.13, cutoff: 3200, delaySend: 0.3, vibrato: { rate: 5, depthCents: 25 } },
      rhythms: ['x---x-x-x-------', 'x-x-x---x-x-----', 'x-----x-x-x-x---', 'x--x--x-x-------'],
      pentatonic: true,
      range: [0, 13],
    },
    chordSize: 3,
    swing: 0.05,
    delay: { steps: 3, feedback: 0.35, wet: 0.22 },
  },

  /** ローファイ / シティポップ寄り (雨の街・ショッピングモール) */
  lofi: {
    label: 'Lo-Fi',
    drums: {
      kick: 'x......x..x.....',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: '....x.......x..x',
      volume: 0.8,
      kickTone: 0.9,
    },
    bass: {
      pattern: 'R-..F-.R..O-F-..',
      synth: { wave: 'sine', octave: -1, attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.1, gate: 0.9, volume: 0.4, cutoff: 900 },
    },
    arp: {
      pattern: '..1...2...3...2.',
      synth: { wave: 'sine', octave: 1, attack: 0.003, decay: 0.3, sustain: 0, release: 0.2, gate: 1, volume: 0.1, cutoff: 4000, delaySend: 0.4 },
    },
    pad: { pattern: 'x-------..x-----', synth: { wave: 'triangle', detune: [-6, 6], octave: 0, attack: 0.01, decay: 0.8, sustain: 0.4, release: 0.4, volume: 0.08, cutoff: 1800 } },
    lead: {
      synth: { wave: 'triangle', octave: 1, attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.25, volume: 0.13, cutoff: 3000, delaySend: 0.4, vibrato: { rate: 4.5, depthCents: 10 } },
      rhythms: ['x-x---x-x-------', '..x-x-x---x-----', 'x---x-x-..x-x---', 'x-x-x-------x---'],
      range: [0, 13],
    },
    chordSize: 4,
    swing: 0.16,
    delay: { steps: 3, feedback: 0.4, wet: 0.28 },
  },
};
