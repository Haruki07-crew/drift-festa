import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// TOKYO MIDNIGHT EXPRESS (Point to Point) — 夜の首都高。高架の摩天楼 → 湾岸トンネル →
// 吊り橋 → らせんジャンクション → タワーのゴール。広い道と長い高速コーナーで初心者も走りやすい。
// 見せ場: 夜景の吊り橋と、自分の走った高架の下をくぐる「らせんジャンクション」
// ---------------------------------------------------------------------------
export const tokyoMidnightExpress: CourseDef = {
  id: 'tokyo',
  name: 'TOKYO MIDNIGHT EXPRESS',
  idPrefix: 'TOKYO',
  raceType: 'pointToPoint',
  description: '夜の首都高を駆け抜けるワンウェイレース。摩天楼の高架、湾岸トンネル、光る吊り橋、らせんジャンクションを越えて東京タワーのゴールへ。',
  highlight: '夜景の吊り橋と、自分の走った高架の下をくぐるらせんジャンクション',
  difficultyStars: 2,
  defaultWidth: 16,
  runoffWidth: 0,
  wallHeight: 1.3,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 50,
  pointToPoint: {
    // 高速道路なので退避路を長めに
    runoutLength: 210,
    sectionNames: [
      '新宿スカイウェイ', '新宿スカイウェイ', '新宿スカイウェイ', '新宿スカイウェイ',
      'ビル街シケイン', 'ビル街シケイン', 'ビル街シケイン',
      '湾岸トンネル', '湾岸トンネル', '湾岸トンネル', '湾岸トンネル',
      'レインボーブリッジ', 'レインボーブリッジ', 'レインボーブリッジ', 'レインボーブリッジ',
      'らせんジャンクション', 'らせんジャンクション', 'らせんジャンクション', 'らせんジャンクション',
      'タワーストレート', 'タワーストレート', 'タワーストレート', 'タワーストレート',
      'タワーストレート', 'ゴール前', 'ゴール前', 'ゴール前', 'ゴール前',
    ],
  },
  controlPoints: [
    // A. 新宿スカイウェイ (高架・長い直線と緩いS字)
    { x: 0, z: 0, y: 14, left: 'wall', right: 'wall' },
    { x: 150, z: 0, y: 14 },
    { x: 330, z: -10, y: 14 },
    { x: 480, z: -55, y: 14, bank: 4 },
    { x: 610, z: -70, y: 14 },
    { x: 730, z: -30, y: 14, bank: 4 },
    // B. ビル街シケイン (左 → 右の 90° コーナー)
    { x: 805, z: 50, y: 14 },
    { x: 820, z: 165, y: 12 },
    { x: 862, z: 245, y: 10 },
    { x: 975, z: 272, y: 8 },
    // C. 湾岸トンネル (下り → 海の下 → 上り)
    { x: 1110, z: 270, y: 1 },
    { x: 1260, z: 250, y: -6 },
    { x: 1420, z: 222, y: -6 },
    { x: 1560, z: 232, y: -4 },
    { x: 1680, z: 272, y: 6 },
    // D. レインボーブリッジ (高い吊り橋)
    { x: 1800, z: 330, y: 18 },
    { x: 1960, z: 398, y: 26 },
    { x: 2140, z: 448, y: 28 },
    { x: 2318, z: 460, y: 28 },
    // E. らせんジャンクション (左回りに1周しながら下り、入口の高架の下をくぐる)
    { x: 2465, z: 482, y: 27, bank: 7 },
    { x: 2512, z: 560, y: 24, bank: 7 },
    { x: 2466, z: 640, y: 21, bank: 7 },
    { x: 2374, z: 640, y: 18, bank: 7 },
    { x: 2328, z: 560, y: 15, bank: 7 },
    { x: 2372, z: 480, y: 12, bank: 5 },
    { x: 2445, z: 450, y: 10 },
    { x: 2535, z: 410, y: 8 },
    // F. タワーストレート → ゴール → 退避路
    { x: 2660, z: 382, y: 8 },
    { x: 2810, z: 398, y: 10, bank: 3 },
    { x: 2955, z: 468, y: 12 },
    { x: 3080, z: 562, y: 12, bank: 3 },
    { x: 3150, z: 690, y: 12 },
    { x: 3175, z: 830, y: 12 },
    { x: 3185, z: 960, y: 12 },
  ],
  itemBoxes: [
    { at: 0.12, lateral: [-5, 0, 5] },
    { at: 0.36, lateral: [-5, 5] },
    { at: 0.6, lateral: [-5, 0, 5] },
    { at: 0.84, lateral: [-5, 5] },
  ],
  gimmicks: [
    { type: 'speedGate', at: 0.07, lateral: 0 },
    { type: 'boostPad', at: 0.2, lateral: -4 },
    { type: 'boostPad', at: 0.2, lateral: 4 },
    // 湾岸トンネル: トンネル加速 + スリップストリームが強くなる (Draft Tunnel)
    { type: 'tunnel', from: 0.31, to: 0.44, style: 'city', height: 8, speedBonus: 0.05 },
    { type: 'draftZone', from: 0.31, to: 0.44, multiplier: 1.8 },
    { type: 'speedGate', at: 0.52, lateral: 0 },
    { type: 'boostPad', at: 0.76, lateral: 0 },
    { type: 'speedGate', at: 0.88, lateral: 0 },
  ],
  tips: '湾岸トンネルは前の車の真後ろにつくと SLIPSTREAM で加速！らせんジャンクションはアクセル一定でOK。',
  environment: {
    scenery: 'tokyo',
    skyTop: 0x03040e,
    skyBottom: 0x1c1440,
    fogColor: 0x120e2a,
    fogNear: 160,
    fogFar: 760,
    groundColor: 0x16161e,
    roadColor: 0x3a3b46,
    lineColor: 0xf2f2f2,
    curbColorA: 0xff4f79,
    curbColorB: 0xf2f2f2,
    wallColor: 0x8a8e9c,
    sunColor: 0x9aa6ff,
    sunIntensity: 1.0,
    ambientSky: 0x7a70ff,
    ambientGround: 0x201830,
    ambientIntensity: 1.35,
    night: true,
    groundLevel: -12,
    water: true,
    roadSupports: 'pillars',
  },
};
