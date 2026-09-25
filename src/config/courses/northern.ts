import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// NORTHERN LIGHTS (Point to Point) — オーロラの夜空の下、雪原を走る。
// 雪の村 → 針葉樹の森 → 凍った湖を渡る氷の道 → 丘の上のトナカイの横断 → 天文台でゴール。
// 道幅が広くカーブもゆるいので初心者向け。氷の上だけは滑るので落ち着いて。
// 見せ場: オーロラが揺れる凍った湖の上の直線と、道を横切るトナカイの群れ
// ---------------------------------------------------------------------------
export const northernLights: CourseDef = {
  id: 'northern',
  name: 'NORTHERN LIGHTS',
  idPrefix: 'NORTHERN',
  raceType: 'pointToPoint',
  description: 'オーロラが揺れる夜の雪原を走るワンウェイレース。凍った湖を渡る氷の道と、横切るトナカイの群れに注意。',
  highlight: 'オーロラの下の凍った湖と、横切るトナカイの群れ',
  difficultyStars: 2,
  defaultWidth: 16,
  runoffWidth: 5,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 50,
  pointToPoint: {
    sectionNames: [
      '雪の村', '雪の村', '雪の村',
      '森の道', '森の道', '森の道', '森の道',
      '凍った湖', '凍った湖', '凍った湖', '凍った湖', '凍った湖', '凍った湖',
      '丘の道', '丘の道', '丘の道',
      'トナカイの丘', 'トナカイの丘', 'トナカイの丘',
      '星の丘', '星の丘', '星の丘', '星の丘',
      '天文台', '天文台', '天文台', '天文台', '天文台',
    ],
  },
  controlPoints: [
    // 雪の村
    { x: 0, z: -60, y: 6, left: 'wall', right: 'wall' },
    { x: 0, z: 60, y: 6 },
    { x: 20, z: 180, y: 7 },
    // 森の道 (路肩は雪の土手)
    { x: 90, z: 280, y: 8, left: 'grass', right: 'grass' },
    { x: 200, z: 342, y: 9 },
    { x: 320, z: 352, y: 9 },
    { x: 430, z: 410, y: 8 },
    { x: 500, z: 520, y: 6 },
    { x: 530, z: 650, y: 4 },
    // 凍った湖 (長いゆるいカーブ)
    { x: 560, z: 800, y: 2 },
    { x: 640, z: 950, y: 2 },
    { x: 760, z: 1060, y: 2 },
    { x: 900, z: 1120, y: 2 },
    { x: 1040, z: 1130, y: 2 },
    { x: 1170, z: 1100, y: 4 },
    // 丘の道
    { x: 1290, z: 1040, y: 8 },
    { x: 1400, z: 1062, y: 12, bank: 4 },
    { x: 1480, z: 1150, y: 15 },
    // トナカイの丘
    { x: 1520, z: 1270, y: 17 },
    { x: 1500, z: 1400, y: 18, bank: 3 },
    // 丘をめぐる道 → 天文台
    { x: 1562, z: 1500, y: 19, bank: 3 },
    { x: 1690, z: 1542, y: 20, bank: 4 },
    { x: 1820, z: 1602, y: 21 },
    { x: 1890, z: 1712, y: 22, bank: 3 },
    { x: 1880, z: 1840, y: 22, left: 'wall', right: 'wall' },
    { x: 1862, z: 1962, y: 22 },
    { x: 1852, z: 2084, y: 22 },
    { x: 1846, z: 2206, y: 22 },
  ],
  itemBoxes: [
    { at: 0.12, lateral: [-5, 0, 5] },
    { at: 0.36, lateral: [-5, 5] },
    { at: 0.6, lateral: [-5, 0, 5] },
    { at: 0.84, lateral: [-5, 5] },
  ],
  gimmicks: [
    // 森の道の路肩には雪が残る (NPC も避ける)
    { type: 'surface', from: 0.103, to: 0.274, surface: 'snow', lateralMin: -9, lateralMax: -5.5 },
    { type: 'surface', from: 0.103, to: 0.274, surface: 'snow', lateralMin: 5.5, lateralMax: 9 },
    // 雪のトンネル (森の中)
    { type: 'tunnel', from: 0.18, to: 0.232, style: 'ice', height: 8 },
    { type: 'speedGate', at: 0.248, lateral: 0 },
    // 凍った湖: 岸の近くは雪、真ん中は氷
    { type: 'surface', from: 0.316, to: 0.36, surface: 'snow' },
    { type: 'surface', from: 0.36, to: 0.466, surface: 'ice' },
    { type: 'surface', from: 0.466, to: 0.513, surface: 'snow' },
    { type: 'speedGate', at: 0.547, lateral: 0 },
    { type: 'boostPad', at: 0.6, lateral: -3 },
    // トナカイの群れの横断 (黄色いランプが予告)
    {
      type: 'obstacle',
      at: 0.672,
      motion: { kind: 'cross', amplitude: 16, period: 12, crossFraction: 0.34 },
      length: 5,
      width: 7,
      height: 2.4,
      style: 'reindeer',
    },
    { type: 'boostPad', at: 0.78, lateral: 3 },
    { type: 'speedGate', at: 0.85, lateral: 0 },
  ],
  tips: '凍った湖ではハンドルをゆっくり。トナカイの群れは黄色いランプが点滅したら来る合図。オーロラのゲートをくぐって加速！',
  environment: {
    scenery: 'northern',
    skyTop: 0x020814,
    skyBottom: 0x0c2440,
    fogColor: 0x0c2036,
    fogNear: 180,
    fogFar: 820,
    groundColor: 0xdfe8f4,
    roadColor: 0x40444e,
    lineColor: 0xffd23f,
    curbColorA: 0x39f3ff,
    curbColorB: 0xf5f5f5,
    wallColor: 0x8a94a4,
    sunColor: 0x9ab8ff,
    sunIntensity: 1.1,
    ambientSky: 0x7aa8ff,
    ambientGround: 0x2a3450,
    ambientIntensity: 1.45,
    night: true,
    groundLevel: -6,
    water: false,
    weather: { kind: 'aurora' },
  },
};
