/**
 * BATTLE DUEL 設定 (タイヤHP・銃・弾丸・NPC射撃AI)。
 */
import type { NpcDifficulty } from './npc';

export interface BattleAiDifficulty {
  /** 状況変化に反応するまでの時間 [s] (照準の更新間隔) */
  reactionTime: number;
  /** 照準のランダム誤差 (標準偏差) [rad] */
  aimErrorRad: number;
  /** 未来位置予測の精度 0..1 (1 = 完全な偏差射撃、0 = 現在位置を狙う) */
  predictionAccuracy: number;
  /** 発砲を判断する最大距離 [m] */
  fireRange: number;
  /** 照準が合ってから撃つまでの許容角度誤差 [rad] */
  fireAngleTolerance: number;
  /** 1回の判断で撃つ確率 (発射判断の積極性) 0..1 */
  fireDecisionRate: number;
  /** 弾薬節約: 残弾がこの数以下なら近距離 (conserveRange) でのみ撃つ */
  conserveAmmoBelow: number;
  conserveRange: number;
  /** HP がこの値以下で Recovery を使う */
  recoveryHpThreshold: number;
  /** Boost を使う最低の直線長 [m] (これ以上まっすぐな区間で使う) */
  boostStraightLength: number;
  /** アイテムを使うまでの考慮時間 [s] */
  itemDecisionDelay: number;
  /** アイテムボックスへ寄せる最大横移動 [m] */
  itemSeekMaxOffset: number;
}

export const battleConfig = {
  tire: {
    /** 初期タイヤHP (仕様: 100) */
    maxHp: 100,
  },

  gun: {
    /** 連射間隔 [s] (左クリック長押しでもこの間隔で発射) */
    fireInterval: 0.22,
    /** 銃口速度 [m/s] (これに車速ベクトルが加算される) */
    muzzleVelocity: 150,
    /** 弾の最大飛行時間 [s] */
    maxLifetime: 1.6,
    /** 弾の最大射程 [m] */
    maxRange: 220,
    /** 1発の基本ダメージ (耐久力で軽減される) */
    baseDamage: 12,
    /**
     * 耐久力による軽減。
     * damage = baseDamage * (1 - durabilityReduction * (durability - 1) / 9)
     * durability 1 → 軽減なし、durability 10 → durabilityReduction 分だけ軽減
     */
    durabilityReduction: 0.5,
    /** 弾の当たり判定半径 [m] */
    bulletRadius: 0.25,
    /** 車の当たり判定半径 [m] (車体を球で近似) */
    carHitRadius: 1.7,
    /** 銃口の車体上の高さ [m] */
    muzzleHeight: 1.45,
    /** 同時に存在できる弾丸の最大数 (オブジェクトプール) */
    poolSize: 64,
    /** 照準の最大距離 [m] (何もない方向を狙った場合) */
    aimMaxDistance: 180,
  },

  aim: {
    /** マウス感度の既定値 (設定画面で変更可) */
    defaultSensitivity: 1.0,
    /** 照準カーソルの移動量倍率 [px / マウス移動px] */
    baseSpeed: 1.0,
  },

  /** 被弾時の演出 */
  hitFeedback: {
    flashSeconds: 0.15,
    cameraShake: 0.25,
  },

  /** NPC 射撃AIの難易度別設定。強制命中は使用しない */
  ai: {
    weak: {
      reactionTime: 0.55,
      aimErrorRad: 0.085,
      predictionAccuracy: 0.35,
      fireRange: 70,
      fireAngleTolerance: 0.12,
      fireDecisionRate: 0.45,
      conserveAmmoBelow: 0,
      conserveRange: 0,
      recoveryHpThreshold: 25,
      boostStraightLength: 60,
      itemDecisionDelay: 2.5,
      itemSeekMaxOffset: 2,
    },
    normal: {
      reactionTime: 0.3,
      aimErrorRad: 0.045,
      predictionAccuracy: 0.72,
      fireRange: 95,
      fireAngleTolerance: 0.07,
      fireDecisionRate: 0.7,
      conserveAmmoBelow: 3,
      conserveRange: 45,
      recoveryHpThreshold: 40,
      boostStraightLength: 90,
      itemDecisionDelay: 1.2,
      itemSeekMaxOffset: 4,
    },
    strong: {
      reactionTime: 0.14,
      aimErrorRad: 0.02,
      predictionAccuracy: 0.95,
      fireRange: 120,
      fireAngleTolerance: 0.04,
      fireDecisionRate: 0.9,
      conserveAmmoBelow: 4,
      conserveRange: 60,
      recoveryHpThreshold: 50,
      boostStraightLength: 110,
      itemDecisionDelay: 0.5,
      itemSeekMaxOffset: 6,
    },
  } satisfies Record<NpcDifficulty, BattleAiDifficulty>,
};

/** 耐久力を考慮した1発のダメージ (純粋関数・テスト対象) */
export function computeBulletDamage(durability: number, cfg = battleConfig.gun): number {
  const d = Math.min(10, Math.max(1, durability));
  const reduction = cfg.durabilityReduction * ((d - 1) / 9);
  return cfg.baseDamage * (1 - reduction);
}
