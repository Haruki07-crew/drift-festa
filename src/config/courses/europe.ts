import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// EUROPE GRAND TOUR (Point to Point) — ヨーロッパの旅。
// 石畳の旧市街 (直角コーナー) → 噴水の広場 → 運河の2車線 (左 = 跳ね橋 + 加速ゲート / 右 = 石畳の固定橋) →
// ぶどう畑の丘と風車 → 古城の坂 → 凱旋門の並木道でゴール。
// 見せ場: 跳ね橋が上がる前にどちらの車線を選ぶか (Dynamic Route Split)
// ---------------------------------------------------------------------------
export const europeGrandTour: CourseDef = {
  id: 'europe',
  name: 'EUROPE GRAND TOUR',
  idPrefix: 'EUROPE',
  raceType: 'pointToPoint',
  description: '石畳の旧市街から凱旋門まで、ヨーロッパを駆け抜ける旅。運河では跳ね橋の車線 (速い) と石畳の橋 (遅いがいつでも通れる) を選べる。',
  highlight: '跳ね橋が上がる前に、どちらの車線を選ぶか',
  difficultyStars: 2,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 26,
  checkpointWindow: 45,
  pointToPoint: {
    sectionNames: [
      '旧市街', '旧市街', '旧市街', '旧市街', '旧市街',
      '噴水の広場', '噴水の広場', '噴水の広場',
      '運河', '運河', '運河',
      'ぶどう畑', 'ぶどう畑', 'ぶどう畑', 'ぶどう畑',
      '風車の丘', '風車の丘', '風車の丘',
      '古城の坂', '古城の坂', '古城の坂',
      '凱旋門通り', '凱旋門通り', '凱旋門通り', 'ゴール前', 'ゴール前',
    ],
  },
  controlPoints: [
    // 旧市街 (石畳・直角コーナー)
    { x: -60, z: 0, y: 3, left: 'wall', right: 'wall', width: 14 },
    { x: 60, z: 0, y: 3, width: 14 },
    { x: 160, z: 8, y: 3, width: 14 },
    { x: 214, z: 62, y: 3, width: 14 },
    { x: 226, z: 164, y: 3, width: 14 },
    { x: 272, z: 232, y: 3, width: 14 },
    { x: 372, z: 248, y: 3, width: 15 },
    // 噴水の広場 (大きく右 → 左)
    { x: 470, z: 282, y: 3, bank: 3 },
    { x: 522, z: 356, y: 3, bank: 3 },
    { x: 498, z: 440, y: 3 },
    { x: 430, z: 500, y: 3, bank: 3 },
    // 運河 (2車線に分かれる。左車線は跳ね橋)
    { x: 396, z: 580, y: 4, width: 22 },
    { x: 392, z: 680, y: 4, width: 22, left: 'guardrail', right: 'guardrail' },
    { x: 396, z: 780, y: 4, width: 22, left: 'wall', right: 'wall' },
    { x: 404, z: 860, y: 5, width: 16 },
    // ぶどう畑の丘
    { x: 446, z: 950, y: 8, left: 'guardrail', right: 'guardrail', width: 15 },
    { x: 546, z: 1024, y: 14, bank: 4 },
    { x: 684, z: 1046, y: 18 },
    { x: 804, z: 1004, y: 20, bank: 4 },
    // 風車の丘
    { x: 922, z: 1040, y: 22 },
    { x: 996, z: 1140, y: 26, bank: 4 },
    // 古城の坂
    { x: 1010, z: 1270, y: 30, left: 'wall', right: 'wall' },
    { x: 962, z: 1384, y: 30, bank: 3 },
    { x: 1002, z: 1500, y: 28 },
    // 凱旋門通り
    { x: 1078, z: 1604, y: 26, left: 'guardrail', right: 'guardrail' },
    { x: 1148, z: 1706, y: 26 },
    { x: 1196, z: 1812, y: 26 },
    { x: 1230, z: 1920, y: 26 },
  ],
  itemBoxes: [
    { at: 0.1, lateral: [-4, 0, 4] },
    { at: 0.34, lateral: [-6, 6] },
    { at: 0.6, lateral: [-4, 0, 4] },
    { at: 0.84, lateral: [-5, 5] },
  ],
  gimmicks: [
    // 旧市街の石畳
    { type: 'surface', from: 0.02, to: 0.2, surface: 'cobble' },
    { type: 'boostPad', at: 0.3, lateral: 0 },
    // 運河: 中央分離帯で2車線に分かれる (Dynamic Route Split)
    { type: 'obstacle', at: 0.376, motion: { kind: 'static', lateral: 0 }, length: 40, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.39, motion: { kind: 'static', lateral: 0 }, length: 40, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.404, motion: { kind: 'static', lateral: 0 }, length: 40, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.418, motion: { kind: 'static', lateral: 0 }, length: 40, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.432, motion: { kind: 'static', lateral: 0 }, length: 40, width: 1.2, height: 1.2, style: 'divider' },
    // 左車線: 跳ね橋 (22秒ごとに約5秒上がる。上がる前に遮断機が閉まる) + 渡った先に加速ゲート
    { type: 'drawbridge', from: 0.408, to: 0.428, lateralMin: -11, lateralMax: -0.8, period: 22, openFraction: 0.22 },
    { type: 'speedGate', at: 0.44, lateral: -5.6, width: 7.5 },
    // 右車線: 石畳の固定橋 (いつでも通れるが少し遅い)
    { type: 'surface', from: 0.37, to: 0.445, surface: 'cobble', lateralMin: 0.6, lateralMax: 12 },
    { type: 'boostPad', at: 0.56, lateral: 0 },
    { type: 'speedGate', at: 0.7, lateral: 0 },
    // 古城の丘を抜けるトンネル
    { type: 'tunnel', from: 0.755, to: 0.79, style: 'rock', height: 8 },
    { type: 'boostPad', at: 0.82, lateral: 3 },
    { type: 'speedGate', at: 0.9, lateral: 0 },
  ],
  tips: '運河は2車線。跳ね橋 (左) は速いけど、信号が黄色になったら石畳の橋 (右) へ！旧市街の石畳は少し滑る。',
  environment: {
    scenery: 'europe',
    skyTop: 0x4a8ad8,
    skyBottom: 0xd8ecff,
    fogColor: 0xd8e8f6,
    fogNear: 200,
    fogFar: 860,
    groundColor: 0x7aa84e,
    roadColor: 0x505058,
    lineColor: 0xf5f5f5,
    curbColorA: 0x2b4ac5,
    curbColorB: 0xf5f5f5,
    wallColor: 0xd8c8a8,
    sunColor: 0xfff4e0,
    sunIntensity: 2.5,
    ambientSky: 0xd8e8ff,
    ambientGround: 0x6a7a4a,
    ambientIntensity: 1.2,
    night: false,
    groundLevel: -8,
    water: true,
  },
};
