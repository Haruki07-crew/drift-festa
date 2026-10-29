/**
 * 効果音設定。
 *
 * 音はすべて Web Audio API で実行時に合成する (外部音声ファイル不要・完全オフライン)。
 * BGM は config/music.ts (ジャンル・音量) と config/musicThemes.ts (コースごとの曲) で設定する。
 */
export const audioConfig = {
  /** 効果音音量の既定値 0..1 */
  defaultSeVolume: 0.7,

  engine: {
    /** アイドリング時の基本周波数 [Hz] */
    idleFrequency: 42,
    /** 各ギアの最高回転時の周波数 [Hz] */
    maxFrequency: 150,
    /** 仮想ギア段数 (ピッチ変化を車らしくする) */
    gears: 5,
    volume: 0.22,
    /** アクセル ON 時の音量増加 */
    throttleVolumeBoost: 0.35,
    /** ローパスフィルタの基本周波数 [Hz] */
    filterBase: 500,
    filterPerFrequency: 9,
  },

  tire: {
    /** スキール音が鳴り始める横滑り速度 [m/s] */
    slipThreshold: 3.2,
    volume: 0.22,
    frequency: 1400,
  },

  /** 2人プレイ時の左右パン */
  splitPan: 0.55,

  sfx: {
    collisionVolume: 0.5,
    gunVolume: 0.35,
    hitVolume: 0.45,
    itemVolume: 0.45,
    countdownVolume: 0.45,
    goalVolume: 0.5,
    uiVolume: 0.3,
    fallVolume: 0.4,
  },
};
