import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// DESERT CANYON RUN (Point to Point) — メサ (台地) の上から赤い渓谷を抜けて砂漠のハイウェイへ。
// 下りのS字 → 渓谷の底の砂地 → 砂嵐 (視界が悪く横風) → 干上がった川をジャンプ →
// 落石注意の狭い渓谷と岩のアーチ → 砂漠のハイウェイ → ガソリンスタンドの前でゴール。
// 見せ場: 川を飛び越える大ジャンプと、砂嵐の中から現れる岩のアーチ
// ---------------------------------------------------------------------------
export const desertCanyonRun: CourseDef = {
  id: 'desert',
  name: 'DESERT CANYON RUN',
  idPrefix: 'DESERT',
  raceType: 'pointToPoint',
  description: '台地の上から赤い渓谷を駆け下りる。砂地は滑りやすく、砂嵐では横風。干上がった川を大ジャンプで飛び越えろ！',
  highlight: '干上がった川の大ジャンプと、砂嵐から現れる岩のアーチ',
  difficultyStars: 3,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.2,
  sampleSpacing: 2,
  checkpointCount: 26,
  checkpointWindow: 45,
  pointToPoint: {
    sectionNames: [
      'メサの上', 'メサの上', 'メサの上',
      '下りのS字', '下りのS字', '下りのS字', '下りのS字',
      '渓谷の底', '渓谷の底', '渓谷の底',
      '砂嵐', '砂嵐', '砂嵐',
      '干上がった川', '干上がった川', '干上がった川',
      '落石の渓谷', '落石の渓谷', '落石の渓谷', '岩のアーチ',
      'ハイウェイ', 'ハイウェイ', 'ハイウェイ', 'ハイウェイ', 'ゴール前', 'ゴール前',
    ],
  },
  controlPoints: [
    // メサの上 (台地の縁はガードレール)
    { x: 0, z: -60, y: 60, left: 'guardrail', right: 'guardrail' },
    { x: 0, z: 60, y: 60 },
    { x: 30, z: 190, y: 58 },
    // 下りのS字
    { x: 110, z: 290, y: 54, bank: 5 },
    { x: 230, z: 332, y: 48 },
    { x: 350, z: 302, y: 42, bank: 5 },
    { x: 432, z: 222, y: 36 },
    { x: 542, z: 188, y: 30, bank: 5 },
    { x: 650, z: 238, y: 24 },
    // 渓谷の底 (両側が岩壁)
    { x: 700, z: 350, y: 18, left: 'wall', right: 'wall' },
    { x: 690, z: 480, y: 12 },
    { x: 640, z: 600, y: 10 },
    // 砂嵐
    { x: 650, z: 730, y: 8 },
    { x: 720, z: 842, y: 6 },
    { x: 830, z: 902, y: 5 },
    // 干上がった川のジャンプ (まっすぐな助走)
    { x: 960, z: 922, y: 5, left: 'guardrail', right: 'guardrail' },
    { x: 1100, z: 926, y: 5 },
    { x: 1240, z: 926, y: 5 },
    { x: 1362, z: 960, y: 6, left: 'wall', right: 'wall' },
    // 落石の渓谷 (道幅が狭い) と岩のアーチ
    { x: 1440, z: 1060, y: 8, width: 12 },
    { x: 1470, z: 1180, y: 10, width: 12 },
    { x: 1452, z: 1300, y: 12, width: 12 },
    { x: 1500, z: 1412, y: 14 },
    // 砂漠のハイウェイ
    { x: 1600, z: 1490, y: 15, left: 'guardrail', right: 'guardrail' },
    { x: 1740, z: 1530, y: 15 },
    { x: 1900, z: 1540, y: 15 },
    { x: 2060, z: 1530, y: 15 },
    { x: 2200, z: 1520, y: 15 },
    { x: 2330, z: 1512, y: 15 },
  ],
  itemBoxes: [
    { at: 0.12, lateral: [-5, 0, 5] },
    { at: 0.34, lateral: [-4, 4] },
    { at: 0.62, lateral: [-4, 0, 4] },
    { at: 0.86, lateral: [-5, 5] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.12, lateral: 0 },
    { type: 'boostPad', at: 0.222, lateral: 3 },
    // 渓谷の底の砂地
    { type: 'surface', from: 0.33, to: 0.4, surface: 'sand' },
    // 岩の洞窟 (渓谷の底)
    { type: 'tunnel', from: 0.3, to: 0.335, style: 'rock', height: 8 },
    // 砂嵐: 横風 + 路面の砂だまり (霧は environment.weather.zones)
    { type: 'wind', from: 0.412, to: 0.49, force: 7, period: 6, activeFraction: 0.5, style: 'windsock' },
    { type: 'surface', from: 0.42, to: 0.44, surface: 'sand', lateralMin: -8, lateralMax: -1 },
    { type: 'surface', from: 0.455, to: 0.475, surface: 'sand', lateralMin: 1, lateralMax: 8 },
    // 干上がった川の大ジャンプ
    { type: 'jump', at: 0.548, launch: 11, gap: 14 },
    // 落石の渓谷
    {
      type: 'obstacle',
      at: 0.69,
      motion: { kind: 'drop', laterals: [-2.5, 2.5], period: 6.5 },
      length: 3,
      width: 3,
      height: 2.4,
      style: 'rock',
    },
    {
      type: 'obstacle',
      at: 0.735,
      motion: { kind: 'drop', laterals: [0, -2.5, 2.5], period: 7.5, phase: 0.3 },
      length: 3,
      width: 3,
      height: 2.4,
      style: 'rock',
    },
    { type: 'speedGate', at: 0.86, lateral: 0 },
    { type: 'boostPad', at: 0.93, lateral: -3 },
  ],
  tips: '砂地ではアクセルを踏みすぎない。ジャンプは速度を落とさずまっすぐ！赤い影には岩が落ちてくる。',
  environment: {
    scenery: 'desert',
    skyTop: 0x3a78c8,
    skyBottom: 0xf6d8a8,
    fogColor: 0xf0d0a0,
    fogNear: 200,
    fogFar: 880,
    groundColor: 0xd9a86a,
    roadColor: 0x4a4440,
    lineColor: 0xfff0c8,
    curbColorA: 0xe25a2b,
    curbColorB: 0xf5eee0,
    wallColor: 0xb8663a,
    sunColor: 0xfff0d0,
    sunIntensity: 2.7,
    ambientSky: 0xffe8c8,
    ambientGround: 0x8a5a3a,
    ambientIntensity: 1.2,
    night: false,
    groundLevel: -8,
    water: false,
    // 砂嵐の区間は霧が濃くなる
    weather: { kind: 'sandstorm', intensity: 0.8, zones: [{ from: 0.405, to: 0.5, fogNear: 10, fogFar: 150, fogColor: 0xdcc39a }] },
  },
};
