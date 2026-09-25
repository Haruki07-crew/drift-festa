import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// VOLCANO ISLAND (Circuit) — 南の島の火山を1周するサーキット。
// 砂浜のストレート → 火山の斜面を登る (ジャングルの土の道) → 火口のふち (噴石が落ちてくる) →
// 西の斜面を下って溶岩の川をジャンプ → 砂浜へ戻る大きな右コーナー。
// 見せ場: 煙を上げる火口のすぐ横を走る区間と、光る溶岩の川を飛び越えるジャンプ
// ---------------------------------------------------------------------------
export const volcanoIsland: CourseDef = {
  id: 'volcano',
  name: 'VOLCANO ISLAND',
  idPrefix: 'VOLCANO',
  raceType: 'circuit',
  description: '南の島の火山を1周。砂浜のストレートから火口のふちまで登り、光る溶岩の川をジャンプで飛び越える。噴石に注意！',
  highlight: '煙を上げる火口のそばと、光る溶岩の川のジャンプ',
  difficultyStars: 3,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.2,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    // 砂浜のストレート (左 = 海、右 = 島)
    { x: -120, z: -235, y: 3, left: 'guardrail', right: 'wall' },
    { x: 40, z: -238, y: 3 },
    { x: 180, z: -215, y: 5 },
    // 東の斜面を登る
    { x: 290, z: -150, y: 9, bank: 5 },
    { x: 340, z: -40, y: 15 },
    { x: 330, z: 80, y: 22, bank: 4 },
    { x: 270, z: 190, y: 29 },
    // 北の斜面 → 火口のふち
    { x: 160, z: 270, y: 36, bank: 4 },
    { x: 30, z: 300, y: 42 },
    { x: -90, z: 270, y: 46 },
    { x: -170, z: 200, y: 46, bank: 4 },
    // 西の斜面を下る (溶岩の川をジャンプ)
    { x: -210, z: 110, y: 40 },
    { x: -222, z: 20, y: 32 },
    { x: -226, z: -70, y: 22 },
    // 砂浜へ戻る
    { x: -220, z: -160, y: 10, bank: 5 },
    { x: -180, z: -222, y: 5 },
  ],
  itemBoxes: [
    { at: 0.08, lateral: [-5, 0, 5] },
    { at: 0.32, lateral: [-4, 4] },
    { at: 0.56, lateral: [-4, 0, 4] },
    { at: 0.86, lateral: [-5, 5] },
  ],
  gimmicks: [
    // 砂浜: 海側の路肩は砂
    { type: 'surface', from: 0.0, to: 0.16, surface: 'sand', lateralMin: -8, lateralMax: -4.5 },
    { type: 'speedGate', at: 0.1, lateral: 0 },
    // ジャングルの土の道
    { type: 'surface', from: 0.3, to: 0.37, surface: 'dirt' },
    // 溶岩洞窟 (昔の溶岩が流れた跡のトンネル)
    { type: 'tunnel', from: 0.375, to: 0.43, style: 'rock', height: 8 },
    { type: 'boostPad', at: 0.45, lateral: -2.5 },
    // 火口のふち: 噴石が落ちてくる (赤い影が予告)
    {
      type: 'obstacle',
      at: 0.6,
      motion: { kind: 'drop', laterals: [-3, 3], period: 6.5 },
      length: 3,
      width: 3,
      height: 2.4,
      style: 'rock',
    },
    {
      type: 'obstacle',
      at: 0.68,
      motion: { kind: 'drop', laterals: [0, -3, 3], period: 7, phase: 0.4 },
      length: 3,
      width: 3,
      height: 2.4,
      style: 'rock',
    },
    // 溶岩の川のジャンプ (下り坂の直線)
    { type: 'jump', at: 0.81, launch: 10, gap: 12 },
    { type: 'boostPad', at: 0.93, lateral: 3 },
  ],
  tips: '火口のふちは赤い影に噴石が落ちてくる。溶岩の川のジャンプは下り坂で勢いをつけてまっすぐ！',
  environment: {
    scenery: 'volcano',
    skyTop: 0x4a88d0,
    skyBottom: 0xf4e0c8,
    fogColor: 0xe8d8c8,
    fogNear: 200,
    fogFar: 820,
    groundColor: 0x5a8a3a,
    roadColor: 0x44403e,
    lineColor: 0xfff0d0,
    curbColorA: 0xe25a2b,
    curbColorB: 0xf5eee0,
    wallColor: 0x5a4e48,
    sunColor: 0xfff0d8,
    sunIntensity: 2.6,
    ambientSky: 0xffe8d0,
    ambientGround: 0x4a3a2a,
    ambientIntensity: 1.2,
    night: false,
    groundLevel: -12,
    water: true,
  },
};
