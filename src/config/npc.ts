/**
 * NPC設定。
 *
 * NPCは「基本レーシングライン + リアルタイム補正」方式。
 * 強さは車の性能ではなく、ライン取り・ブレーキング・反応速度・操作精度・ミス率で表現する。
 * ラバーバンド (順位による速度補正) は使用しない。
 *
 * 各コース × 各難易度で PATTERNS_PER_DIFFICULTY 個 (仕様: 30) のパターンを
 * 下記のレンジと性格からシード付き乱数で決定的に生成する。
 * パターンID例: TOUGE_STRONG_017
 *
 * 「CPUが少し速すぎる」→ 該当難易度の cornerSpeedFactor / brakingFactor を少し下げる。
 */

export type NpcDifficulty = 'weak' | 'normal' | 'strong';

export const NPC_DIFFICULTIES: readonly NpcDifficulty[] = ['weak', 'normal', 'strong'];

export type NpcPersonality = 'balanced' | 'aggressive' | 'defensive' | 'drift' | 'grip' | 'speed' | 'conservative';

export const NPC_PERSONALITIES: readonly NpcPersonality[] = [
  'balanced',
  'aggressive',
  'defensive',
  'drift',
  'grip',
  'speed',
  'conservative',
];

export interface Range {
  min: number;
  max: number;
}

export interface NpcDifficultyProfile {
  label: string;
  /** 基本ラインの理想ラインへの近さ 0 (中央線) .. 1 (理想ライン) */
  lineBlend: Range;
  /** 基本ラインの一定横オフセット [m] (ライン取りの甘さ) */
  lineOffset: Range;
  /** コーナー限界速度に対する目標速度の割合 */
  cornerSpeedFactor: Range;
  /** 車のブレーキ性能のうち、減速計画で想定する割合 (低い = ブレーキが早い) */
  brakingFactor: Range;
  /** 追加のブレーキ開始マージン [m] */
  brakeMargin: Range;
  /** 直線での最高速度の使用率 */
  straightSpeedFactor: Range;
  /** ステアリング反応の遅れ [s] */
  reactionTime: Range;
  /** ステアリングの揺らぎ振幅 */
  steeringNoise: Range;
  /** ミスの発生率 [回/分] */
  mistakeRatePerMinute: Range;
  /** ミスの大きさ 0..1 */
  mistakeSeverity: Range;
  /** 追い越しの積極性 0..1 */
  overtakeTendency: Range;
  /** 前方注視時間 [s] (ステアリングの目標点までの距離 = 速度 × これ) */
  lookaheadTime: Range;
}

export interface NpcPersonalityModifier {
  label: string;
  /** 各パラメータへの加算 (指定なしは 0) */
  add: Partial<Record<keyof Omit<NpcDifficultyProfile, 'label'>, number>>;
  /** ドリフトキーを使う傾向 0..1 */
  driftTendency: number;
  /** 前の車をブロックする傾向 0..1 */
  blockTendency: number;
  /** この性格が好んで選ぶ車 (パターン生成時の車選択に使用) */
  preferredCars: string[];
}

export const NPC_PATTERNS_PER_DIFFICULTY = 30;

export const npcConfig = {
  difficulties: {
    weak: {
      label: 'WEAK',
      lineBlend: { min: 0.25, max: 0.55 },
      lineOffset: { min: -1.6, max: 1.6 },
      cornerSpeedFactor: { min: 0.72, max: 0.8 },
      brakingFactor: { min: 0.5, max: 0.62 },
      brakeMargin: { min: 10, max: 20 },
      straightSpeedFactor: { min: 0.84, max: 0.9 },
      reactionTime: { min: 0.22, max: 0.32 },
      steeringNoise: { min: 0.06, max: 0.1 },
      mistakeRatePerMinute: { min: 1.5, max: 2.6 },
      mistakeSeverity: { min: 0.4, max: 0.7 },
      overtakeTendency: { min: 0.15, max: 0.35 },
      lookaheadTime: { min: 0.6, max: 0.75 },
    },
    normal: {
      label: 'NORMAL',
      lineBlend: { min: 0.55, max: 0.8 },
      lineOffset: { min: -0.8, max: 0.8 },
      cornerSpeedFactor: { min: 0.84, max: 0.9 },
      brakingFactor: { min: 0.66, max: 0.76 },
      brakeMargin: { min: 4, max: 10 },
      straightSpeedFactor: { min: 0.93, max: 0.97 },
      reactionTime: { min: 0.12, max: 0.18 },
      steeringNoise: { min: 0.025, max: 0.05 },
      mistakeRatePerMinute: { min: 0.6, max: 1.2 },
      mistakeSeverity: { min: 0.25, max: 0.45 },
      overtakeTendency: { min: 0.35, max: 0.6 },
      lookaheadTime: { min: 0.5, max: 0.62 },
    },
    strong: {
      label: 'STRONG',
      lineBlend: { min: 0.88, max: 1.0 },
      lineOffset: { min: -0.25, max: 0.25 },
      cornerSpeedFactor: { min: 0.93, max: 0.98 },
      brakingFactor: { min: 0.8, max: 0.88 },
      brakeMargin: { min: 0, max: 3 },
      straightSpeedFactor: { min: 0.99, max: 1.0 },
      reactionTime: { min: 0.05, max: 0.08 },
      steeringNoise: { min: 0.005, max: 0.015 },
      mistakeRatePerMinute: { min: 0.08, max: 0.3 },
      mistakeSeverity: { min: 0.1, max: 0.25 },
      overtakeTendency: { min: 0.6, max: 0.9 },
      lookaheadTime: { min: 0.42, max: 0.52 },
    },
  } satisfies Record<NpcDifficulty, NpcDifficultyProfile>,

  personalities: {
    balanced: {
      label: 'Balanced',
      add: {},
      driftTendency: 0.2,
      blockTendency: 0.3,
      preferredCars: ['apex86', 'neonfox', 'vortexr', 'circuitnova'],
    },
    aggressive: {
      label: 'Aggressive',
      add: { cornerSpeedFactor: 0.015, brakeMargin: -2, overtakeTendency: 0.2, mistakeRatePerMinute: 0.3 },
      driftTendency: 0.35,
      blockTendency: 0.6,
      preferredCars: ['flashrs', 'cometmr', 'vortexr', 'phantomrx'],
    },
    defensive: {
      label: 'Defensive',
      add: { overtakeTendency: -0.15, mistakeRatePerMinute: -0.2 },
      driftTendency: 0.1,
      blockTendency: 0.9,
      preferredCars: ['titangt', 'ironwolf', 'apex86'],
    },
    drift: {
      label: 'Drift',
      add: { lineBlend: -0.05, cornerSpeedFactor: -0.01 },
      driftTendency: 0.9,
      blockTendency: 0.3,
      preferredCars: ['midnights', 'phantomrx', 'apex86'],
    },
    grip: {
      label: 'Grip',
      add: { lineBlend: 0.05, cornerSpeedFactor: 0.01, steeringNoise: -0.005 },
      driftTendency: 0.0,
      blockTendency: 0.3,
      preferredCars: ['circuitnova', 'cometmr', 'vortexr', 'neonfox'],
    },
    speed: {
      label: 'Speed',
      add: { straightSpeedFactor: 0.02, cornerSpeedFactor: -0.015, brakeMargin: 2 },
      driftTendency: 0.2,
      blockTendency: 0.4,
      preferredCars: ['titangt', 'phantomrx', 'vortexr'],
    },
    conservative: {
      label: 'Conservative',
      add: { cornerSpeedFactor: -0.02, brakeMargin: 3, mistakeRatePerMinute: -0.3, overtakeTendency: -0.1 },
      driftTendency: 0.05,
      blockTendency: 0.2,
      preferredCars: ['neonfox', 'ironwolf', 'titangt', 'apex86'],
    },
  } satisfies Record<NpcPersonality, NpcPersonalityModifier>,

  /** 理想レーシングラインの計算 */
  racingLine: {
    /** 弾性バンド法の反復回数 */
    iterations: 900,
    /** 路肩からの余裕 [m] */
    edgeMargin: 2.2,
    /** 1回の反復で目標位置へ動かす割合 */
    relaxation: 0.5,
  },

  /** 速度計画 */
  speedPlan: {
    /** 横グリップ限界のうち、コーナー速度計算に使う割合 */
    lateralGripUsage: 0.86,
    /** 目標速度の下限 [m/s] */
    minTargetSpeed: 9,
  },

  /** リアルタイム補正 */
  runtime: {
    /** 前方の車を認識する距離 [m] */
    awarenessDistance: 34,
    /** 後方の車を認識する距離 [m] (ブロック用) */
    rearAwarenessDistance: 16,
    /** 回避時に確保したい横間隔 [m] */
    avoidLateralGap: 3.4,
    /** 回避オフセットの変化速度 [m/s] */
    offsetChangeRate: 5.5,
    /** 基本ラインへ戻る速度 [m/s] */
    lineReturnRate: 2.2,
    /** 目標点までの最小距離 [m] */
    minLookahead: 7,
    /** ステアリングの比例ゲイン */
    steeringGain: 2.1,
    /** 速度差がこれ以上 [m/s] ならブレーキ */
    brakeThreshold: 1.5,
    /** アクセルを緩める速度差 [m/s] */
    liftThreshold: 0.3,
    /** 路肩からの安全距離 [m] */
    wallMargin: 1.6,
    /** 前方の遅い車に追従するときの車間 [m] */
    followGap: 9,
    /** 動けなくなったと判定するまでの時間 [s] */
    stuckSeconds: 1.4,
    /** 脱出のために後退する時間 [s] */
    reverseSeconds: 1.1,
    /** コース方向に対してこれ以上の角度ずれで「姿勢を崩した」と判定 [rad] */
    recoverAngle: 1.2,
    /** ミス1回の長さ [s] */
    mistakeDuration: { min: 0.6, max: 1.6 },
    /** ドリフトを使うコーナーの最小曲率 [1/m] */
    driftCurvature: 0.018,
  },
};
