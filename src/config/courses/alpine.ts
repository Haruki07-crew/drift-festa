import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// ALPINE ZERMATT RUN (Point to Point) — 谷の村から雪山の頂上近くまで登る旅。
// 村 → 森の道 → 渓谷の橋 → 落石注意の山道 → 3つのヘアピン (つづら折り) → 雪崩よけギャラリー (雪道) →
// 氷河のそば (凍った路面) → 山頂駅の前でゴール。登るにつれて景色が 緑 → 岩 → 雪 → 氷 と変わる。
// 見せ場: 正面にそびえるマッターホルンと、頭上を渡るロープウェイ、眼下のつづら折り
// ---------------------------------------------------------------------------
export const alpineZermattRun: CourseDef = {
  id: 'alpine',
  name: 'ALPINE ZERMATT RUN',
  idPrefix: 'ALPINE',
  raceType: 'pointToPoint',
  description: '谷の村から雪山の頂上まで登る旅。森、渓谷の橋、落石の山道、3連続ヘアピン、雪のギャラリー、氷河。景色がどんどん変わる。',
  highlight: '正面にそびえるマッターホルンと、頭上を渡るロープウェイ',
  difficultyStars: 3,
  defaultWidth: 14,
  runoffWidth: 0,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 26,
  checkpointWindow: 45,
  pointToPoint: {
    sectionNames: [
      '谷の村', '谷の村', '谷の村',
      '森の道', '森の道', '森の道', '森の道', '森の道',
      '渓谷の橋', '渓谷の橋',
      '落石注意', '落石注意',
      'ヘアピン3', 'ヘアピン3',
      '雪崩ギャラリー', '雪崩ギャラリー', '雪崩ギャラリー',
      'ヘアピン2', 'ヘアピン2',
      '雪道', '雪道', '雪道',
      'ヘアピン1', 'ヘアピン1',
      '氷河', '氷河',
    ],
  },
  controlPoints: [
    // 谷の村 (教会の広場からスタート)
    { x: 850, z: 1330, y: 10, left: 'wall', right: 'wall' },
    { x: 842, z: 1226, y: 10 },
    { x: 826, z: 1120, y: 11 },
    { x: 792, z: 1026, y: 12 },
    // 森の道 (牧草地と森を登る)
    { x: 722, z: 946, y: 14, left: 'guardrail', right: 'wall' },
    { x: 612, z: 900, y: 18, bank: 4 },
    { x: 482, z: 872, y: 25 },
    { x: 362, z: 822, y: 34, bank: 5 },
    { x: 262, z: 740, y: 46 },
    // 渓谷の橋
    { x: 206, z: 650, y: 57, left: 'guardrail', right: 'guardrail' },
    { x: 182, z: 570, y: 63 },
    { x: 170, z: 490, y: 67, left: 'guardrail', right: 'wall' },
    { x: 166, z: 410, y: 71 },
    // 落石注意の山道
    { x: 192, z: 330, y: 75, left: 'wall', right: 'guardrail' },
    { x: 262, z: 294, y: 79 },
    { x: 360, z: 282, y: 84 },
    // ヘアピン3 (右 180°)
    { x: 460, z: 286, y: 89, left: 'guardrail', right: 'guardrail' },
    { x: 546, z: 284, y: 92 },
    { x: 578, z: 268, y: 93 },
    { x: 592, z: 240, y: 94 },
    { x: 580, z: 212, y: 95 },
    // 雪崩よけギャラリー (雪道)
    { x: 548, z: 194, y: 96, left: 'guardrail', right: 'wall' },
    { x: 470, z: 190, y: 99 },
    { x: 350, z: 194, y: 105 },
    { x: 230, z: 186, y: 111 },
    // ヘアピン2 (左 180°)
    { x: 110, z: 192, y: 116, left: 'guardrail', right: 'guardrail' },
    { x: 32, z: 190, y: 119 },
    { x: 0, z: 174, y: 120 },
    { x: -12, z: 146, y: 121 },
    { x: -2, z: 118, y: 122 },
    // 雪道
    { x: 30, z: 100, y: 123, left: 'wall', right: 'guardrail' },
    { x: 100, z: 96, y: 126 },
    { x: 220, z: 100, y: 132 },
    { x: 340, z: 94, y: 138 },
    // ヘアピン1 (右 180°)
    { x: 460, z: 100, y: 143, left: 'guardrail', right: 'guardrail' },
    { x: 546, z: 100, y: 146 },
    { x: 578, z: 84, y: 147 },
    { x: 592, z: 56, y: 148 },
    { x: 580, z: 28, y: 149 },
    // 氷河のそば → 山頂駅
    { x: 548, z: 10, y: 150, left: 'guardrail', right: 'wall' },
    { x: 470, z: 6, y: 153 },
    { x: 340, z: 4, y: 160 },
    { x: 200, z: -6, y: 166 },
    { x: 60, z: 0, y: 170 },
    { x: -60, z: 0, y: 170 },
  ],
  itemBoxes: [
    { at: 0.1, lateral: [-4, 0, 4] },
    { at: 0.38, lateral: [-4, 4] },
    { at: 0.62, lateral: [-4, 0, 4] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    { type: 'speedGate', at: 0.06, lateral: 0 },
    // 森の道の上り (ブースト)
    { type: 'boostPad', at: 0.16, lateral: 0 },
    { type: 'boostPad', at: 0.225, lateral: 3 },
    // 落石注意の山道: 赤い影 (予告) の場所に岩が落ちてくる
    {
      type: 'obstacle',
      at: 0.375,
      motion: { kind: 'drop', laterals: [-3, 3, 0], period: 7 },
      length: 3,
      width: 3,
      height: 2.4,
      style: 'rock',
    },
    {
      type: 'obstacle',
      at: 0.41,
      motion: { kind: 'drop', laterals: [3, -3], period: 8, phase: 0.45 },
      length: 3,
      width: 3,
      height: 2.4,
      style: 'rock',
    },
    // ヘアピンの内側は雪が残っていて滑る (インをかすめすぎない)
    { type: 'surface', from: 0.445, to: 0.49, surface: 'snow', lateralMin: 3.5, lateralMax: 8 },
    { type: 'surface', from: 0.62, to: 0.66, surface: 'snow', lateralMin: -8, lateralMax: -3.5 },
    { type: 'surface', from: 0.79, to: 0.835, surface: 'snow', lateralMin: 3.5, lateralMax: 8 },
    // 雪崩よけギャラリー
    { type: 'tunnel', from: 0.515, to: 0.6, style: 'rock', height: 7 },
    // 雪道 (全面が雪) と加速ゲート
    { type: 'surface', from: 0.67, to: 0.775, surface: 'snow' },
    { type: 'speedGate', at: 0.72, lateral: 0 },
    // 氷河のそば: 凍った路面の最後の直線
    { type: 'surface', from: 0.855, to: 0.925, surface: 'ice' },
  ],
  tips: '上り坂はアクセル全開！ヘアピンは手前で減速。赤い影の場所には岩が落ちてくる。最後の氷河の直線はハンドルをまっすぐ。',
  environment: {
    scenery: 'alpine',
    skyTop: 0x3f7fd8,
    skyBottom: 0xdcecff,
    fogColor: 0xe2eefa,
    fogNear: 180,
    fogFar: 820,
    groundColor: 0xf0f5fb,
    roadColor: 0x4a4e58,
    lineColor: 0xffd23f,
    curbColorA: 0xe23b3b,
    curbColorB: 0xf5f5f5,
    wallColor: 0x9a948a,
    sunColor: 0xffffff,
    sunIntensity: 2.5,
    ambientSky: 0xe0ecff,
    ambientGround: 0x8a98aa,
    ambientIntensity: 1.2,
    night: false,
    groundLevel: -10,
    water: false,
    weather: { kind: 'snow', intensity: 0.35 },
  },
};
