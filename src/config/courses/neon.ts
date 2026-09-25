import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// NEON GRAVITY
// ---------------------------------------------------------------------------
export const neonGravity: CourseDef = {
  id: 'neon',
  name: 'NEON GRAVITY',
  idPrefix: 'NEON',
  raceType: 'circuit',
  description: '夜のネオン都市を8の字に駆ける。立体交差、壁を走るような超バンク、ネオントンネル、大ジャンプ。',
  highlight: '8の字の立体交差と 52° の超バンク',
  tips: '超バンクは速度を落とさず曲がれる。立体交差の下をくぐった後は大ジャンプ！',
  difficultyStars: 5,
  defaultWidth: 16,
  runoffWidth: 0,
  wallHeight: 1.4,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 40,
  controlPoints: [
    { x: -110, z: -110, y: 0, left: 'wall', right: 'wall' },
    { x: 0, z: 0, y: 0 },
    { x: 110, z: 110, y: 4 },
    { x: 220, z: 140, y: 10, bank: 40 },
    { x: 300, z: 60, y: 14, bank: 52 },
    { x: 270, z: -60, y: 16, bank: 52 },
    { x: 180, z: -120, y: 16, bank: 35 },
    { x: 90, z: -90, y: 15, bank: 0 },
    { x: 0, z: 0, y: 15 },
    { x: -90, z: 90, y: 13 },
    { x: -190, z: 130, y: 8, bank: 40 },
    { x: -280, z: 60, y: 5, bank: 50 },
    { x: -270, z: -70, y: 3, bank: 50 },
    { x: -190, z: -140, y: 1, bank: 25 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.33, lateral: [-4, 4] },
    { at: 0.58, lateral: [-4, 0, 4] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.05, lateral: 0 },
    // 立体交差の下をくぐった直後の大ジャンプ
    { type: 'jump', at: 0.128, launch: 10, gap: 11 },
    { type: 'boostPad', at: 0.2, lateral: -4 },
    { type: 'boostPad', at: 0.55, lateral: 4 },
    // ネオントンネル
    { type: 'tunnel', from: 0.625, to: 0.69, style: 'neon', height: 9 },
    { type: 'boostPad', at: 0.66, lateral: 0 },
    { type: 'surface', from: 0.0, to: 0.06, surface: 'glass' },
  ],
  environment: { scenery: 'neon', skyTop: 0x030008, skyBottom: 0x1a0638, fogColor: 0x12042a, fogNear: 140, fogFar: 700, groundColor: 0x0e0e1a, roadColor: 0x1c1c26, lineColor: 0xff2d95, curbColorA: 0x39f3ff, curbColorB: 0x1c1c26, wallColor: 0x2a2440, sunColor: 0x9a80ff, sunIntensity: 1.0, ambientSky: 0x8060ff, ambientGround: 0x200a40, ambientIntensity: 1.3, night: true, groundLevel: -12, water: false, roadSupports: 'pillars' },
};
