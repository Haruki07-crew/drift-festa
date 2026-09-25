import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// AIRPORT RUSH (Circuit) — 空港を1周するサーキット。
// 広い滑走路の全開ストレート (スリップストリーム合戦) → 誘導路へのコーナー → 駐機場の横
// (ジェット機の噴射で横風) → ターミナルの周り → 手荷物カートの横断。
// 見せ場: 隣の滑走路から離陸する旅客機と並んで走るストレート
// ---------------------------------------------------------------------------
export const airportRush: CourseDef = {
  id: 'airport',
  name: 'AIRPORT RUSH',
  idPrefix: 'AIRPORT',
  raceType: 'circuit',
  description: '空港の滑走路と誘導路を走るサーキット。広いストレートでスリップストリーム合戦！ジェット機の噴射と手荷物カートに注意。',
  highlight: '離陸する旅客機と並んで走る滑走路',
  difficultyStars: 2,
  defaultWidth: 17,
  runoffWidth: 6,
  wallHeight: 1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 50,
  controlPoints: [
    // 滑走路 (広い全開ストレート)
    { x: 0, z: 0, width: 21, left: 'grass', right: 'grass' },
    { x: 200, z: 0, width: 21 },
    { x: 450, z: 0, width: 21 },
    { x: 650, z: 2, width: 20 },
    // 誘導路へ (左へ大きく)
    { x: 762, z: 32 },
    { x: 804, z: 122 },
    // 駐機場の横の誘導路
    { x: 742, z: 202 },
    { x: 620, z: 212 },
    { x: 520, z: 182 },
    { x: 420, z: 212 },
    { x: 300, z: 242 },
    // ターミナルの周り
    { x: 220, z: 302 },
    { x: 148, z: 362 },
    { x: 58, z: 342 },
    { x: -22, z: 262 },
    { x: -62, z: 162 },
    { x: -52, z: 62, width: 19 },
  ],
  itemBoxes: [
    { at: 0.1, lateral: [-6, 0, 6] },
    { at: 0.36, lateral: [-5, 5] },
    { at: 0.6, lateral: [-5, 0, 5] },
    { at: 0.84, lateral: [-5, 5] },
  ],
  gimmicks: [
    // 滑走路: スリップストリームが効きやすい長い直線 + 加速ゲート
    { type: 'draftZone', from: 0.0, to: 0.31, multiplier: 1.5 },
    { type: 'speedGate', at: 0.12, lateral: 0, width: 9 },
    { type: 'boostPad', at: 0.25, lateral: -5 },
    // 駐機場の横: ジェット機の噴射 (横風)
    { type: 'wind', from: 0.47, to: 0.56, force: 6, period: 7, activeFraction: 0.35, style: 'windsock' },
    // 手荷物カートの列が横断する (黄色いランプが予告)
    {
      type: 'obstacle',
      at: 0.7,
      motion: { kind: 'cross', amplitude: 15, period: 10, crossFraction: 0.35, phase: 0.3 },
      length: 3,
      width: 9,
      height: 1.8,
      style: 'cart',
    },
    { type: 'boostPad', at: 0.8, lateral: 3 },
    { type: 'speedGate', at: 0.93, lateral: 0 },
  ],
  tips: '滑走路は前の車の真後ろにつくと SLIPSTREAM！駐機場の横はジェット機の噴射で横に流される。カートの横断は黄色いランプが合図。',
  environment: {
    scenery: 'airport',
    skyTop: 0x3a86e0,
    skyBottom: 0xcfe8ff,
    fogColor: 0xd8eaf8,
    fogNear: 220,
    fogFar: 900,
    groundColor: 0x6aa84a,
    roadColor: 0x505560,
    lineColor: 0xffffff,
    curbColorA: 0xffd23f,
    curbColorB: 0x2a2d36,
    wallColor: 0xd0d4dc,
    sunColor: 0xfff4e0,
    sunIntensity: 2.6,
    ambientSky: 0xd0e4ff,
    ambientGround: 0x5a6a4a,
    ambientIntensity: 1.15,
    night: false,
    groundLevel: -0.05,
    water: false,
  },
};
