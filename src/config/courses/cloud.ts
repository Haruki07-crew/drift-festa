import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// CLOUD KINGDOM (Circuit) — 雲の上に浮かぶ王国のサーキット。
// お城の島 → 虹のガラスの橋 (柵なし) → 雲の島 → 横に動く足場を2つ渡る → 空の道 →
// 島から島へのジャンプ → お城へ戻る。
// 見せ場: 動く足場のタイミングを読んで渡るところと、虹の橋
// ---------------------------------------------------------------------------
export const cloudKingdom: CourseDef = {
  id: 'cloud',
  name: 'CLOUD KINGDOM',
  idPrefix: 'CLOUD',
  raceType: 'circuit',
  description: '雲の上の王国を走る！柵のない虹の橋、横に動く足場、島から島へのジャンプ。落ちたら雲の下へ…。',
  highlight: '動く足場を渡るタイミングと、虹の橋',
  difficultyStars: 3,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    // お城の島 (ストレート)
    { x: 0, z: -60, y: 60, left: 'guardrail', right: 'guardrail' },
    { x: 140, z: -60, y: 60 },
    { x: 250, z: -30, y: 62 },
    // 虹のガラスの橋 (柵なし)
    { x: 330, z: 50, y: 66, left: 'fall', right: 'fall' },
    { x: 380, z: 160, y: 70 },
    // 雲の島
    { x: 370, z: 270, y: 72, left: 'guardrail', right: 'guardrail', bank: 4 },
    { x: 290, z: 340, y: 72 },
    // 動く足場を2つ渡る
    { x: 180, z: 356, y: 72, left: 'fall', right: 'fall', width: 20 },
    { x: 70, z: 346, y: 72, width: 20 },
    // 小さな島 → 空の道
    { x: -30, z: 310, y: 70, left: 'guardrail', right: 'guardrail', bank: 4 },
    { x: -90, z: 230, y: 68 },
    { x: -106, z: 130, y: 66, left: 'fall', right: 'fall' },
    // 島から島へのジャンプ
    { x: -100, z: 30, y: 64 },
    { x: -82, z: -40, y: 62, left: 'guardrail', right: 'guardrail' },
    { x: -50, z: -70, y: 61 },
  ],
  itemBoxes: [
    { at: 0.06, lateral: [-5, 0, 5] },
    { at: 0.32, lateral: [-4, 4] },
    { at: 0.6, lateral: [-4, 0, 4] },
    { at: 0.86, lateral: [-5, 5] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.12, lateral: 0 },
    { type: 'speedGate', at: 0.2, lateral: 0 },
    // 虹のガラスの橋
    { type: 'surface', from: 0.25, to: 0.33, surface: 'glass' },
    { type: 'boostPad', at: 0.42, lateral: 3 },
    // 横に動く足場 (2つは逆の向きに動く)
    { type: 'platform', from: 0.535, to: 0.562, width: 9, amplitude: 5, period: 6 },
    { type: 'platform', from: 0.588, to: 0.614, width: 9, amplitude: 5, period: 6, phase: 0.5 },
    { type: 'speedGate', at: 0.72, lateral: 0 },
    // 島から島へのジャンプ
    { type: 'jump', at: 0.85, launch: 9, gap: 12 },
  ],
  tips: '動く足場は、足場が来る位置を見て先にハンドルを切る。虹の橋は柵がないので真ん中を。ジャンプはまっすぐ！',
  environment: {
    scenery: 'cloud',
    skyTop: 0x5aa8ff,
    skyBottom: 0xfff0f8,
    fogColor: 0xf4f0ff,
    fogNear: 220,
    fogFar: 900,
    groundColor: 0xffffff,
    roadColor: 0x6a6a8a,
    lineColor: 0xffffff,
    curbColorA: 0xff9ad5,
    curbColorB: 0xffffff,
    wallColor: 0xf6f0ff,
    sunColor: 0xfff8f0,
    sunIntensity: 2.4,
    ambientSky: 0xf0f0ff,
    ambientGround: 0xd8c8f0,
    ambientIntensity: 1.35,
    night: false,
    groundLevel: 10,
    water: false,
    roadSupports: 'none',
  },
};
