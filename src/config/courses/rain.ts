import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// RAIN CITY (Circuit) — 雨の夜の街を走るサーキット。路面はずっと濡れていて滑りやすい。
// 大通り → 直角コーナーのビル街 → 丘の上から水たまりだらけの長い下りS字 →
// 屋根のある地下トンネル (乾いていて速い) → 大通りへ。
// 見せ場: ネオンが映る濡れた下り坂のS字 (水たまりを避けるライン取り)
// ---------------------------------------------------------------------------
export const rainCity: CourseDef = {
  id: 'rain',
  name: 'RAIN CITY',
  idPrefix: 'RAIN',
  raceType: 'circuit',
  description: '雨の夜の街。濡れた路面はずっと滑りやすい。水たまりをよけながら長い下り坂のS字を攻めろ。地下トンネルの中だけは乾いている。',
  highlight: 'ネオンが映る濡れた下り坂のS字',
  difficultyStars: 3,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.2,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    // 大通り
    { x: 0, z: 0, y: 10, left: 'wall', right: 'wall' },
    { x: 160, z: 0, y: 10 },
    // 直角コーナーのビル街
    { x: 240, z: 40, y: 10 },
    { x: 252, z: 140, y: 10 },
    { x: 302, z: 212, y: 10 },
    { x: 420, z: 222, y: 12 },
    // 丘の上 → 長い下りのS字
    { x: 520, z: 190, y: 14 },
    { x: 580, z: 110, y: 12 },
    { x: 560, z: 10, y: 8 },
    { x: 600, z: -90, y: 4 },
    { x: 560, z: -190, y: 0 },
    // 地下トンネル (乾いている)
    { x: 450, z: -240, y: -2 },
    { x: 320, z: -250, y: -2 },
    { x: 190, z: -240, y: -2 },
    // 大通りへ戻る
    { x: 80, z: -200, y: 2 },
    { x: -10, z: -120, y: 6 },
    { x: -40, z: -40, y: 9 },
  ],
  itemBoxes: [
    { at: 0.06, lateral: [-5, 0, 5] },
    { at: 0.32, lateral: [-4, 4] },
    { at: 0.6, lateral: [-4, 0, 4] },
    { at: 0.86, lateral: [-5, 5] },
  ],
  gimmicks: [
    // 雨: トンネル以外はずっと濡れた路面
    { type: 'surface', from: 0.0, to: 0.645, surface: 'wet' },
    { type: 'surface', from: 0.795, to: 1.0, surface: 'wet' },
    { type: 'speedGate', at: 0.05, lateral: 0 },
    { type: 'boostPad', at: 0.3, lateral: 3 },
    // 下りのS字の水たまり (左右交互)
    { type: 'splash', from: 0.43, to: 0.46, lateralMin: -8, lateralMax: -1 },
    { type: 'splash', from: 0.49, to: 0.52, lateralMin: 1, lateralMax: 8 },
    { type: 'splash', from: 0.55, to: 0.58, lateralMin: -8, lateralMax: -1 },
    // 地下トンネル (乾いていて速い)
    { type: 'tunnel', from: 0.645, to: 0.795, style: 'city', height: 8, speedBonus: 0.03 },
    { type: 'speedGate', at: 0.9, lateral: 0 },
  ],
  tips: '濡れた路面はいつもより早めにブレーキ。水たまりは滑ってしぶきが上がるのでよけよう。トンネルの中は乾いていて速い！',
  environment: {
    scenery: 'rain',
    skyTop: 0x06080e,
    skyBottom: 0x1a2030,
    fogColor: 0x1a2030,
    fogNear: 120,
    fogFar: 620,
    groundColor: 0x1a1c22,
    roadColor: 0x3a3e48,
    lineColor: 0xf2f2f2,
    curbColorA: 0xff2d95,
    curbColorB: 0xe8e8e8,
    wallColor: 0x6a7080,
    sunColor: 0xa8b8ff,
    sunIntensity: 1.1,
    ambientSky: 0x8a98c8,
    ambientGround: 0x20242e,
    ambientIntensity: 1.4,
    night: true,
    groundLevel: -8,
    water: false,
    weather: { kind: 'rain', intensity: 1 },
  },
};
