import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// MEGA MALL (Circuit) — 巨大ショッピングモールの中を走るサーキット。
// 1階の吹き抜け (噴水の水たまり) → 動く歩道 (右側は加速) → 回転扉のエントランス →
// スロープで2階へ → 吹き抜けを見下ろすバルコニー → 立体駐車場のらせんを下って1階へ。
// 見せ場: ガラス張りの吹き抜けと、立体駐車場のらせんスロープ
// ---------------------------------------------------------------------------
export const megaMall: CourseDef = {
  id: 'mall',
  name: 'MEGA MALL',
  idPrefix: 'MALL',
  raceType: 'circuit',
  description: '巨大ショッピングモールの中を走る！噴水の水たまり、動く歩道、回転扉、2階のバルコニー、立体駐車場のらせんスロープ。',
  highlight: '吹き抜けのバルコニーと、立体駐車場のらせん',
  difficultyStars: 2,
  defaultWidth: 16,
  runoffWidth: 0,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    // 1階: 吹き抜けの大通り (らせんを下りた直後がスタート)
    { x: 10, z: -143, y: 0.5, left: 'wall', right: 'wall' },
    { x: 140, z: -142, y: 0.5 },
    { x: 270, z: -136, y: 0.5 },
    // エントランスホール (回転扉)
    { x: 345, z: -92, y: 0.5 },
    { x: 362, z: 0, y: 0.5, width: 18 },
    { x: 320, z: 80, y: 0.5 },
    // スロープで2階へ
    { x: 220, z: 108, y: 3 },
    { x: 100, z: 106, y: 8, left: 'guardrail', right: 'wall' },
    { x: -10, z: 90, y: 12 },
    // 2階のバルコニー (左 = 吹き抜けのガラス柵)
    { x: -72, z: 30, y: 12 },
    { x: -86, z: -40, y: 12, left: 'wall', right: 'wall' },
    // 立体駐車場のらせん (1周しながら下り、スタートの大通りへ。上下の道は 8m 以上離す)
    { x: -86.0, z: -100.0, y: 11.5, bank: 5 },
    { x: -72.5, z: -132.5, y: 10.3, bank: 5 },
    { x: -40.0, z: -146.0, y: 9.1, bank: 5 },
    { x: -7.5, z: -132.5, y: 7.9, bank: 5 },
    { x: 6.0, z: -100.0, y: 6.7, bank: 5 },
    { x: -7.5, z: -67.5, y: 5.5, bank: 5 },
    { x: -40.0, z: -54.0, y: 4.3, bank: 5 },
    { x: -72.5, z: -67.5, y: 3.1, bank: 5 },
    { x: -86.0, z: -100.0, y: 1.9, bank: 5 },
    { x: -72.5, z: -132.5, y: 1.0, bank: 2 },
  ],
  itemBoxes: [
    { at: 0.08, lateral: [-5, 0, 5] },
    { at: 0.34, lateral: [-5, 5] },
    { at: 0.58, lateral: [-5, 0, 5] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    // 吹き抜けの噴水: 左半分が水たまり (滑る・しぶき)
    { type: 'splash', from: 0.095, to: 0.135, lateralMin: -9, lateralMax: -1.5 },
    // 動く歩道: 右側は前へ運ぶ (加速)、左側は普通の床
    { type: 'conveyor', from: 0.15, to: 0.2, speed: 6, lateralMin: 1, lateralMax: 8 },
    // エントランスの回転扉 (右半分を回る腕が横切る)
    { type: 'obstacle', at: 0.296, motion: { kind: 'spin', lateral: 4.5, period: 3.6 }, length: 1, width: 8, height: 2.6, style: 'turnstile' },
    { type: 'boostPad', at: 0.4, lateral: 0 },
    // 2階のバルコニーの加速ゲート
    { type: 'speedGate', at: 0.62, lateral: 0 },
  ],
  tips: '動く歩道は右側 (矢印が前向き) に乗ると速い！回転扉は左側が通りやすい。立体駐車場のらせんはアクセル一定で。',
  environment: {
    scenery: 'mall',
    skyTop: 0x9ac8f0,
    skyBottom: 0xf4f8ff,
    fogColor: 0xf0eee8,
    fogNear: 180,
    fogFar: 700,
    groundColor: 0xe8e2d8,
    roadColor: 0x8a8580,
    lineColor: 0xffffff,
    curbColorA: 0xff4f79,
    curbColorB: 0xffffff,
    wallColor: 0xf2eee6,
    sunColor: 0xfff8ee,
    sunIntensity: 2.0,
    ambientSky: 0xffffff,
    ambientGround: 0xc8c0b0,
    ambientIntensity: 1.5,
    night: false,
    groundLevel: 0,
    water: false,
    roadSupports: 'pillars',
  },
};
