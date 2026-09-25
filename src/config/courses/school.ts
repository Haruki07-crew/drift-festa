import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// SCHOOL FESTIVAL CHAOS (Circuit) — 文化祭の日の学校を走るサーキット。
// 校庭のトラック → 校門 → 屋台の並ぶ通り → 体育館の中を通り抜ける → 校舎のまわり →
// 中庭のパレード (山車が横切る) → スプリンクラーの水しぶき → 校庭へ戻る。
// 見せ場: 風船のアーチ (加速ゲート) と、体育館を突っ切るショートカット
// ---------------------------------------------------------------------------
export const schoolFestivalChaos: CourseDef = {
  id: 'school',
  name: 'SCHOOL FESTIVAL CHAOS',
  idPrefix: 'SCHOOL',
  raceType: 'circuit',
  description: '文化祭の日の学校をレース！校庭のトラック、屋台の通り、体育館の中を突っ切って、パレードの山車をかわせ。',
  highlight: '体育館を突っ切る道と、風船のアーチ',
  difficultyStars: 2,
  defaultWidth: 16,
  runoffWidth: 5,
  wallHeight: 1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    // 校庭のトラック (南の直線 → 東のカーブ → 北の直線)
    { x: 20, z: 0, left: 'grass', right: 'grass' },
    { x: 140, z: 0 },
    { x: 215, z: 36 },
    { x: 226, z: 110 },
    { x: 170, z: 150 },
    { x: 60, z: 150 },
    // 校門 → 屋台の通り
    { x: -10, z: 190, left: 'wall', right: 'wall' },
    { x: -20, z: 280 },
    { x: 20, z: 380 },
    // 体育館 (中を通り抜ける)
    { x: 120, z: 420 },
    { x: 240, z: 420 },
    // 校舎のまわり → 中庭
    { x: 330, z: 380 },
    { x: 360, z: 290 },
    { x: 340, z: 200 },
    { x: 300, z: 110 },
    { x: 292, z: 20 },
    // 校庭の南側へ戻る
    { x: 250, z: -60, left: 'grass', right: 'grass' },
    { x: 140, z: -92 },
    { x: 40, z: -86 },
    // 校庭の西の半円 (半径 44m)
    { x: -50, z: -84 },
    { x: -81, z: -71 },
    { x: -94, z: -40 },
    { x: -81, z: -9 },
    { x: -46, z: 3 },
  ],
  itemBoxes: [
    { at: 0.06, lateral: [-5, 0, 5] },
    { at: 0.34, lateral: [-5, 5] },
    { at: 0.58, lateral: [-5, 0, 5] },
    { at: 0.84, lateral: [-5, 5] },
  ],
  gimmicks: [
    // 風船のアーチ (加速ゲート)
    { type: 'speedGate', at: 0.03, lateral: 0 },
    // 校庭のスプリンクラー: 右半分に周期的に水がかかる
    { type: 'splash', from: 0.18, to: 0.215, lateralMin: 0.5, lateralMax: 9, period: 5, activeFraction: 0.4 },
    { type: 'boostPad', at: 0.3, lateral: -3 },
    // 体育館の中を通り抜ける
    { type: 'tunnel', from: 0.42, to: 0.474, style: 'metal', height: 9 },
    // 体育館の中は2車線。左はシャッターが開いている時だけ通れる近道 (Shortcut Gate) で、先に加速ゲートがある
    // 中央分離帯は途切れさせない (右車線から近道の途中へ入れないように)
    { type: 'obstacle', at: 0.4318, motion: { kind: 'static', lateral: 0 }, length: 24, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.4435, motion: { kind: 'static', lateral: 0 }, length: 24, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.4551, motion: { kind: 'static', lateral: 0 }, length: 24, width: 1.2, height: 1.2, style: 'divider' },
    { type: 'obstacle', at: 0.426, motion: { kind: 'gate', lateral: -4.4, period: 6, closedFraction: 0.45 }, length: 1, width: 7, height: 2.4, style: 'gate' },
    { type: 'speedGate', at: 0.46, lateral: -4.4, width: 6.5 },
    // 校舎の1階の廊下を通り抜ける
    { type: 'tunnel', from: 0.525, to: 0.57, style: 'school', height: 7 },
    { type: 'speedGate', at: 0.5, lateral: 0 },
    // 中庭のパレード: 山車が道を横切る (黄色いランプが予告)
    {
      type: 'obstacle',
      at: 0.63,
      motion: { kind: 'cross', amplitude: 15, period: 12, crossFraction: 0.3, phase: 0.2 },
      length: 5,
      width: 6,
      height: 3,
      style: 'float',
    },
    { type: 'speedGate', at: 0.82, lateral: 0 },
    { type: 'boostPad', at: 0.9, lateral: 3 },
  ],
  tips: '体育館の左の近道はシャッターが開いている時だけ通れる (先に加速ゲート)。風船のアーチをくぐって加速！パレードの山車は黄色いランプが合図。スプリンクラーの水しぶきは左に寄ってよけよう。',
  environment: {
    scenery: 'school',
    skyTop: 0x4a9ae8,
    skyBottom: 0xd8f0ff,
    fogColor: 0xe0f0fa,
    fogNear: 200,
    fogFar: 800,
    groundColor: 0xc8a878,
    roadColor: 0x505560,
    lineColor: 0xffffff,
    curbColorA: 0xff4f79,
    curbColorB: 0xffffff,
    wallColor: 0xd8dcc8,
    sunColor: 0xfff4e0,
    sunIntensity: 2.6,
    ambientSky: 0xd8ecff,
    ambientGround: 0x7a6a4a,
    ambientIntensity: 1.2,
    night: false,
    groundLevel: -0.05,
    water: false,
  },
};
