import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// FROSTBITE PASS
// ---------------------------------------------------------------------------
export const frostbitePass: CourseDef = {
  id: 'frost',
  name: 'FROSTBITE PASS',
  idPrefix: 'FROST',
  raceType: 'circuit',
  description: '雪山と凍った湖。雪はやや滑り、氷はツルツル。氷の洞窟、狭い氷の橋、湖へ飛び降りるジャンプ。',
  highlight: '凍った湖へのジャンプと氷の洞窟',
  tips: '氷の上はドリフトが命。ヘアピンの内側の氷ショートカットは上級者向け。',
  difficultyStars: 4,
  defaultWidth: 14,
  runoffWidth: 0,
  wallHeight: 1.0,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 40,
  controlPoints: [
    { x: 0, z: -100, y: 20, left: 'wall', right: 'guardrail' },
    { x: 0, z: 20, y: 22 },
    { x: 10, z: 120, y: 28 },
    { x: 60, z: 190, y: 36 },
    { x: 140, z: 200, y: 44, left: 'wall', right: 'wall' },
    { x: 200, z: 150, y: 50 },
    { x: 210, z: 70, y: 52 },
    { x: 180, z: 0, y: 48, left: 'guardrail', right: 'wall' },
    { x: 230, z: -60, y: 40 },
    { x: 300, z: -40, y: 34, left: 'fall', right: 'fall' },
    { x: 350, z: 30, y: 28 },
    { x: 360, z: 110, y: 6, left: 'grass', right: 'grass' },
    { x: 320, z: 190, y: 2 },
    { x: 230, z: 250, y: 2 },
    { x: 130, z: 285, y: 3, left: 'fall', right: 'fall', width: 9 },
    { x: 40, z: 285, y: 4, width: 9 },
    { x: -40, z: 240, y: 8, left: 'guardrail', right: 'wall' },
    { x: -80, z: 150, y: 12 },
    { x: -70, z: 40, y: 16 },
    { x: -50, z: -80, y: 18, width: 22 },
    { x: -55, z: -165, y: 19, width: 26, left: 'grass', right: 'grass' },
    { x: -15, z: -210, y: 20, width: 20 },
    { x: 30, z: -170, y: 20, width: 16 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.33, lateral: [-4, 4] },
    { at: 0.58, lateral: [-4, 0, 4] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.03, lateral: 0 },
    // 雪原
    { type: 'surface', from: 0.05, to: 0.185, surface: 'snow' },
    // 氷の洞窟
    { type: 'tunnel', from: 0.19, to: 0.29, style: 'ice', height: 8 },
    { type: 'surface', from: 0.195, to: 0.285, surface: 'ice' },
    { type: 'surface', from: 0.31, to: 0.42, surface: 'snow' },
    // 雪山から湖へ飛び降りるジャンプ
    { type: 'jump', at: 0.432, launch: 6, gap: 11 },
    // 凍った湖
    { type: 'surface', from: 0.47, to: 0.6, surface: 'ice' },
    { type: 'boostPad', at: 0.52, lateral: -3 },
    // 狭い氷の橋
    { type: 'surface', from: 0.6, to: 0.66, surface: 'ice' },
    { type: 'surface', from: 0.7, to: 0.86, surface: 'snow' },
    { type: 'boostPad', at: 0.76, lateral: 3 },
    // ヘアピン内側の滑るショートカット (内側 = 右側が氷)
    { type: 'surface', from: 0.87, to: 0.965, surface: 'ice', lateralMin: 3 },
  ],
  environment: { scenery: 'frost', skyTop: 0x6d9ad8, skyBottom: 0xe6f2ff, fogColor: 0xe9f1fb, fogNear: 110, fogFar: 560, groundColor: 0xf2f6fb, roadColor: 0x4a4f5a, lineColor: 0xffd23f, curbColorA: 0xe23b3b, curbColorB: 0xf5f5f5, wallColor: 0xc8d4e2, sunColor: 0xffffff, sunIntensity: 2.3, ambientSky: 0xe0ecff, ambientGround: 0x9aa8ba, ambientIntensity: 1.25, night: false, groundLevel: -6, water: false },
};
