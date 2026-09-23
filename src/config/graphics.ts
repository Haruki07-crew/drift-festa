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
  /** 車からの高さ [m] */
  height: 2.9,
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
};
