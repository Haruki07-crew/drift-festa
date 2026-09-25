import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// SKYLINE ZERO
// ---------------------------------------------------------------------------
export const skylineZero: CourseDef = {
  id: 'skyline',
  name: 'SKYLINE ZERO',
  idPrefix: 'SKYLINE',
  raceType: 'circuit',
  description: '空中都市の高速道路。長いストレート、大ジャンプ、傾いたバンク、透明な道路。落ちたら真っ逆さま！',
  highlight: '雲の上の大ジャンプと透明な道路',
  tips: 'バンクコーナーは思い切って踏める。柵のない直線では真ん中をキープ。',
  difficultyStars: 4,
  defaultWidth: 16,
  runoffWidth: 0,
  wallHeight: 1.0,
  sampleSpacing: 2,
  checkpointCount: 26,
  checkpointWindow: 40,
  controlPoints: [
    { x: 0, z: -200, y: 90, left: 'fall', right: 'fall' },
    { x: 0, z: 0, y: 95 },
    { x: 0, z: 200, y: 100, left: 'wall', right: 'wall' },
    { x: 40, z: 290, y: 100, bank: 25 },
    { x: 140, z: 320, y: 102, bank: 32 },
    { x: 240, z: 290, y: 104, bank: 25 },
    { x: 290, z: 190, y: 100, left: 'fall', right: 'fall' },
    { x: 300, z: 60, y: 92 },
    { x: 310, z: -80, y: 84 },
    { x: 360, z: -170, y: 80, left: 'wall', right: 'wall', bank: 20 },
    { x: 330, z: -260, y: 82, bank: 22 },
    { x: 240, z: -300, y: 86, left: 'guardrail', right: 'guardrail' },
    { x: 150, z: -270, y: 88 },
    { x: 70, z: -310, y: 88 },
    { x: 15, z: -275, y: 89, left: 'guardrail', right: 'guardrail' },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.33, lateral: [-4, 4] },
    { at: 0.58, lateral: [-4, 0, 4] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.05, lateral: -4 },
    { type: 'boostPad', at: 0.15, lateral: 4 },
    // 透明な空中道路
    { type: 'surface', from: 0.11, to: 0.2, surface: 'glass' },
    { type: 'boostPad', at: 0.5, lateral: 0 },
    // 大ジャンプ: ビルの谷間を飛び越える
    { type: 'jump', at: 0.527, launch: 10, gap: 11 },
    // 高層ビルの間を吹き抜ける横風
    { type: 'wind', from: 0.57, to: 0.625, force: 5, period: 6, activeFraction: 0.4 },
    { type: 'surface', from: 0.86, to: 0.93, surface: 'glass' },
    { type: 'boostPad', at: 0.9, lateral: 0 },
  ],
  environment: { scenery: 'skyline', skyTop: 0x2463c9, skyBottom: 0xffd8b0, fogColor: 0xf3d6c0, fogNear: 200, fogFar: 900, groundColor: 0xe8eef6, roadColor: 0x2f3440, lineColor: 0x6fe3ff, curbColorA: 0x6fe3ff, curbColorB: 0x2f3440, wallColor: 0xcfd8e6, sunColor: 0xfff0d8, sunIntensity: 2.7, ambientSky: 0xdbe8ff, ambientGround: 0x8a8070, ambientIntensity: 1.2, night: false, groundLevel: 0, water: false, roadSupports: 'pillars' },
};
