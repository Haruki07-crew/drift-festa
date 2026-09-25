/**
 * グラフィック品質とカメラ設定。
 */

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface QualityPreset {
  label: string;
  /** devicePixelRatio の上限 */
  maxPixelRatio: number;
  /** 描画解像度の倍率 (低品質で 1 未満にすると軽くなる) */
  renderScale: number;
  shadows: boolean;
  shadowMapSize: number;
  /** カメラの描画距離 [m] */
  drawDistance: number;
  /** 背景オブジェクト (木・建物) の密度倍率 */
  sceneryDensity: number;
  /** タイヤスモーク等のパーティクル最大数 */
  maxParticles: number;
  antialias: boolean;
}

export const graphicsConfig = {
  defaultQuality: 'medium' as GraphicsQuality,
  presets: {
    low: {
      label: '低 (軽い)',
      maxPixelRatio: 1,
      renderScale: 0.8,
      shadows: false,
      shadowMapSize: 512,
      drawDistance: 450,
      sceneryDensity: 0.45,
      maxParticles: 60,
      antialias: false,
    },
    medium: {
      label: '中',
      maxPixelRatio: 1.25,
      renderScale: 1,
      shadows: true,
      shadowMapSize: 1024,
      drawDistance: 700,
      sceneryDensity: 0.75,
      maxParticles: 140,
      antialias: true,
    },
    high: {
      label: '高 (綺麗)',
      maxPixelRatio: 2,
      renderScale: 1,
      shadows: true,
      shadowMapSize: 2048,
      drawDistance: 950,
      sceneryDensity: 1,
      maxParticles: 260,
      antialias: true,
    },
  } satisfies Record<GraphicsQuality, QualityPreset>,

  /** NPC のゴーストカー表現 */
  ghost: {
    opacity: 0.5,
    emissiveIntensity: 0.35,
    /** 復帰直後 (衝突無効中) の点滅周期 [s] */
    respawnBlinkPeriod: 0.25,
  },

  /** 影を落とす範囲 (プレイヤー周辺) [m] */
  shadowRadius: 70,
};

export const cameraConfig = {
  /** 車の後方距離 [m] */
  distance: 7.2,
  /** 車からの高さ [m] (v3: 先のコースが見やすいよう少し高く) */
  height: 3.3,
  /** 高速時に加える高さ [m] */
  speedHeightBoost: 0.6,
  /** 注視点の前方オフセット [m] */
  lookAhead: 5.5,
  /** 注視点の高さ [m] */
  lookHeight: 1.1,
  /** 基本 FOV [deg] */
  baseFov: 66,
  /** 最高速度時に加算される FOV [deg] (速度感) */
  speedFovBoost: 16,
  /** 加速時の一時的な FOV 変化 [deg] */
  accelFovBoost: 4,
  /** FOV の追従速度 [1/s] */
  fovResponse: 3,
  /** カメラ位置の追従速度 [1/s] */
  positionResponse: 7,
  /** カメラの向きの追従速度 [1/s] (小さいほどドリフトで車が横を向いて見える) */
  yawResponse: 4.2,
  /** ドリフト中のカメラ向き追従速度 [1/s] */
  driftYawResponse: 2.4,
  /** 高速時に後方距離を伸ばす量 [m] */
  speedDistanceBoost: 1.6,
  /** カメラシェイクの減衰 [1/s] */
  shakeDecay: 6,
  /** カメラシェイクの最大振幅 [m] */
  shakeMaxAmplitude: 0.45,
  /** 衝突速度 1m/s あたりのシェイク量 */
  shakePerImpactSpeed: 0.035,
  /** 高速時の微振動 (速度感) [m] */
  speedRumble: 0.03,
  /** 描画の近クリップ [m] */
  near: 0.3,
  /** スタート前のイントロで回り込むカメラ半径 [m] */
  introRadius: 14,
  /**
   * コースの先を見る注視点 (v3)。車の正面だけでなくコース中心線の少し先へ視線を寄せ、
   * カーブの先が見えるようにする。高速・急カーブほど先を見る。
   */
  trackLook: {
    /** 注視するコース上の距離 = base + 速度 × perSpeed (最大 max) [m] */
    baseDistance: 12,
    perSpeed: 0.45,
    maxDistance: 40,
    /** コース上の点へ寄せる割合 (0 = 車の正面のみ) */
    blend: 0.35,
    /** 急カーブで追加で寄せる割合 (曲率 1/m あたり) と上限 */
    curvatureBlend: 14,
    maxBlend: 0.7,
    /** 注視点の追従速度 [1/s] */
    response: 5,
  },
};

/** 夜コースの視認性 (v3) */
export const nightVisibilityConfig = {
  /** 人間が運転する車のヘッドライト (SpotLight 1灯。NPC は発光ランプのみで GPU 負荷を抑える) */
  headlights: {
    color: 0xfff2d8,
    intensity: 120,
    distance: 110,
    /** 照らす範囲の半角 [deg] */
    angleDeg: 32,
    penumbra: 0.45,
    decay: 1,
    /** 照らす点 (車の前方) [m] */
    targetDistance: 30,
    height: 1.2,
  },
  /** カーブ外側の誘導灯 */
  guideLights: {
    /** この曲率 [1/m] 以上のカーブに置く */
    minCurvature: 1 / 110,
    spacing: 7,
    color: 0xffa21f,
    height: 1.1,
  },
  /** 急カーブの矢印看板 (シェブロン) */
  chevrons: {
    minCurvature: 1 / 55,
    spacing: 12,
  },
  /** 路肩の反射材 (直線にも置く) */
  reflectors: {
    spacing: 10,
    color: 0x9fe8ff,
  },
};

/** 天候の粒子 (v3)。数は画質の sceneryDensity を掛ける */
export const weatherConfig = {
  rain: { count: 1400, radius: 55, height: 34, fallSpeed: 34, dropLength: 1.3, color: 0xa8c8ff, opacity: 0.55, slant: 0.18 },
  sandstorm: { count: 1600, radius: 45, height: 14, windSpeed: 26, size: 0.7, color: 0xf0d8a8, opacity: 0.75 },
  snow: { count: 900, radius: 50, height: 30, fallSpeed: 3.2, size: 0.45, color: 0xffffff, opacity: 0.85 },
  aurora: { ribbons: 4, height: 260, length: 1400, colors: [0x3dff9a, 0x39f3ff, 0xb98cff, 0x5affc8] },
};
