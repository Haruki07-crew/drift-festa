import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// AQUA SHIFT
// ---------------------------------------------------------------------------
export const aquaShift: CourseDef = {
  id: 'aqua',
  name: 'AQUA SHIFT',
  idPrefix: 'AQUA',
  description: '海上研究施設から海中トンネルへ。水中では車が変形し、ゆったり曲がる。浮上ジャンプで地上へ飛び出せ！',
  tips: '水中は旋回がゆっくり。早めにハンドルを切ろう。ブーストパッドを踏んで加速！',
  difficultyStars: 3,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.2,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 40,
  controlPoints: [
    { x: 0, z: -150, y: 4, left: 'wall', right: 'wall' },
    { x: 0, z: -20, y: 4 },
    { x: 0, z: 100, y: 4 },
    { x: 25, z: 180, y: 4 },
    { x: 90, z: 215, y: 3 },
    { x: 165, z: 205, y: 0 },
    { x: 215, z: 160, y: -7 },
    { x: 240, z: 90, y: -16 },
    { x: 235, z: 10, y: -24 },
    { x: 275, z: -50, y: -20 },
    { x: 330, z: -70, y: -26 },
    { x: 385, z: -45, y: -18 },
    { x: 412, z: -100, y: -8 },
    { x: 398, z: -160, y: 1 },
    { x: 350, z: -205, y: 3 },
    { x: 270, z: -225, y: 3 },
    { x: 190, z: -205, y: 3 },
    { x: 120, z: -235, y: 3 },
    { x: 50, z: -225, y: 4 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.33, lateral: [-4, 4] },
    { at: 0.58, lateral: [-4, 0, 4] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    // 海上研究施設の鉄板デッキ
    { type: 'surface', from: 0.94, to: 0.17, surface: 'metal' },
    { type: 'boostPad', at: 0.08, lateral: -3 },
    { type: 'boostPad', at: 0.13, lateral: 3 },
    // 着水直前の浅瀬
    { type: 'surface', from: 0.3, to: 0.36, surface: 'water' },
    // 海中トンネル: 水中走行モード (タイヤを格納、ゆったり旋回)
    { type: 'transform', from: 0.355, to: 0.648, mode: 'underwater' },
    { type: 'tunnel', from: 0.355, to: 0.648, style: 'glass', height: 8 },
    { type: 'boostPad', at: 0.44, lateral: 0 },
    { type: 'boostPad', at: 0.5, lateral: -3 },
    // 浮上ジャンプ: 海中から地上へ飛び出す
    { type: 'jump', at: 0.652, launch: 13, gap: 10 },
    { type: 'boostPad', at: 0.76, lateral: 0 },
  ],
  environment: { scenery: 'aqua', skyTop: 0x1a6fd0, skyBottom: 0x9fe3ff, fogColor: 0xa8dcf0, fogNear: 140, fogFar: 640, groundColor: 0xd8c690, roadColor: 0x5b6470, lineColor: 0xffffff, curbColorA: 0xffa31a, curbColorB: 0xf5f5f5, wallColor: 0xe0e8ee, sunColor: 0xffffff, sunIntensity: 2.5, ambientSky: 0xcfefff, ambientGround: 0x3a6a88, ambientIntensity: 1.2, night: false, groundLevel: -38, water: true, roadSupports: 'pillars', underwaterFogColor: 0x0b4f7a },
};
