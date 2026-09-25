/**
 * 車両物理の設定。
 *
 * アーケード寄りのリアル挙動を目指したゲーム物理 (自前実装) のパラメータ。
 * 車種ごとの性能は cars.ts、駆動方式ごとの癖はここの drivetrains で調整する。
 */
import type { Drivetrain } from './cars';

export interface DrivetrainTraits {
  /** ドリフト中の横グリップ倍率 (小さいほど滑る) */
  driftGripMul: number;
  /** ドリフト中のヨー (回頭) 性能倍率 */
  driftYawMul: number;
  /** ドリフト中にアクセルで後輪が流れる量 (パワーオーバー) [rad/s] */
  powerOversteer: number;
  /** 通常走行時の姿勢安定アシスト (大きいほどスピンしにくい) [1/s] */
  stabilityAssist: number;
  /** ヨー応答速度 [1/s] (大きいほどキビキビ、MRは高い) */
  yawResponse: number;
  /** ドリフト中の加速倍率 (AWDは引っ張って立ち上がる) */
  driftAccelMul: number;
}

export const physicsConfig = {
  /** 物理の固定タイムステップ [s] */
  fixedTimeStep: 1 / 120,
  /** 1フレームで処理する最大サブステップ数 (処理落ち時のスパイラル防止) */
  maxSubSteps: 10,

  /** 重力 [m/s^2] (アーケード感のため実重力より強め) */
  gravity: 26,

  engine: {
    /** 最高速度付近での加速の落ち方 (大きいほど最高速度まで粘る) */
    powerCurveExponent: 1.6,
    /** アクセルOFF時の減速 [m/s^2] */
    coastDecel: 2.2,
    /** 転がり抵抗 [m/s^2] */
    rollingResistance: 0.35,
    /** 後退の最高速度 [km/h] */
    reverseMaxSpeedKmh: 38,
    /** 後退の加速度 [m/s^2] */
    reverseAccel: 6.5,
    /** この速度 [m/s] 未満でブレーキキーを押すと後退に切り替わる */
    reverseSwitchSpeed: 0.8,
  },

  steering: {
    /** 最大ヨーレート [rad/s] (低中速域) */
    maxYawRate: 2.25,
    /** この速度 [m/s] まではステアリングの効きが速度に比例 (停止中は曲がらない) */
    fullAuthoritySpeed: 7,
    /** 速度依存でステアの効きが落ちる基準速度 [m/s]。この速度で効きが半分になる */
    highSpeedHalfAuthority: 31,
    /** ステア入力の立ち上がり速度 [1/s] (キーボード入力を滑らかにする) */
    inputRiseRate: 7.5,
    /** ステア入力の戻り速度 [1/s] */
    inputFallRate: 11,
  },

  grip: {
    /** 横方向の最大グリップ加速度 [m/s^2] (車の grip 倍率が掛かる) */
    lateralGripAccel: 27,
    /** 横滑りが止まるときに前方向へ変換される速度の割合 (0..1) */
    slideToForwardRetention: 0.25,
  },

  drift: {
    /** ドリフトが発動する最低速度 [km/h] */
    minSpeedKmh: 32,
    /** ドリフト中の横グリップ基本倍率 (車の drift 値が高いほどさらに下がる) */
    baseGripMul: 0.55,
    /** 車の drift 値1.0 のときに追加で下がるグリップ倍率 */
    driftStatGripReduction: 0.3,
    /** ドリフト中のヨーレート倍率 */
    yawBoost: 1.45,
    /** カウンターステア時のヨー抑制 (0..1) */
    counterSteerDamping: 0.55,
    /** ドリフト中の速度減衰 [m/s^2] (車の drift 値が高いほど小さく) */
    speedLoss: 3.2,
    /** ドリフト終了後にグリップが戻る速さ [1/s] */
    gripRecoveryRate: 3.5,
    /** ドリフトへの移行速度 [1/s] */
    gripDropRate: 9,
  },

  drivetrains: {
    FF: {
      driftGripMul: 1.25,
      driftYawMul: 0.85,
      powerOversteer: 0.0,
      stabilityAssist: 3.2,
      yawResponse: 9,
      driftAccelMul: 0.85,
    },
    FR: {
      driftGripMul: 0.85,
      driftYawMul: 1.1,
      powerOversteer: 0.45,
      stabilityAssist: 2.0,
      yawResponse: 10,
      driftAccelMul: 0.8,
    },
    MR: {
      driftGripMul: 0.8,
      driftYawMul: 1.2,
      powerOversteer: 0.55,
      stabilityAssist: 1.3,
      yawResponse: 13,
      driftAccelMul: 0.8,
    },
    AWD: {
      driftGripMul: 1.35,
      driftYawMul: 0.9,
      powerOversteer: 0.15,
      stabilityAssist: 3.8,
      yawResponse: 9,
      driftAccelMul: 1.05,
    },
  } satisfies Record<Drivetrain, DrivetrainTraits>,

  offroad: {
    /** コース外 (芝・砂利) での横グリップ倍率 */
    gripMul: 0.6,
    /** コース外での追加減速 [m/s^2] */
    extraDrag: 7,
    /** コース外での最高速度倍率 */
    maxSpeedMul: 0.55,
  },

  collision: {
    /** 車体を前後2つの円で近似したときの円の半径 [m] */
    carRadius: 1.05,
    /** 車体中心から前後の円の中心までの距離 [m] */
    circleOffset: 1.05,
    /** 車同士の反発係数 */
    carRestitution: 0.2,
    /** 車同士の押し出しで加わる最大速度変化 [m/s] (不自然に吹き飛ばさない) */
    maxImpulseSpeed: 9,
    /** 車同士の接触時に回転が加わる量 */
    carSpinFactor: 0.12,
    /** 壁の反発係数 */
    wallRestitution: 0.25,
    /** 壁接触時に壁に沿った速度が失われる割合 (0..1) */
    wallFriction: 0.08,
    /** 壁判定用の車体半幅 [m] */
    wallHalfWidth: 1.0,
    /** これ以上の衝突速度 [m/s] でカメラシェイク・衝突音 */
    impactThreshold: 4,
  },

  respawn: {
    /** 復帰後に操作不能となる時間 [s] (仕様 v3: 2秒) */
    lockSeconds: 2,
    /** 復帰後に他車との衝突が無効化される時間 [s] (連続落下防止) */
    ghostSeconds: 3.5,
    /** 路面からこれだけ落下したら復帰 [m] */
    fallDepth: 9,
    /** 落下開始からの最大時間 [s] */
    maxFallTime: 1.6,
    /** ジャンプ中の最大滞空時間 [s] (これを超えたら復帰) */
    maxJumpAirTime: 5,
    /** この縦速度 [m/s] 以上で着地したら衝撃演出 */
    landingImpactSpeed: 6,
    /** コースアウト (落下可能区間) と判定する、路肩からの距離 [m] */
    fallEdgeMargin: 0.4,
    /** 逆さま・停止などで動けなくなった時に自動復帰するまでの時間 [s] (人間プレイヤーには適用しない) */
    npcStuckRespawnSeconds: 7,
  },

  /** タイヤHP 0 時の最高速度倍率 (仕様: 50%) */
  flatTireMaxSpeedMul: 0.5,
};

export type PhysicsConfig = typeof physicsConfig;
