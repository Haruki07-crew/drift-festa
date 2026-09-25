import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// MAGMA FACTORY
// ---------------------------------------------------------------------------
export const magmaFactory: CourseDef = {
  id: 'magma',
  name: 'MAGMA FACTORY',
  idPrefix: 'MAGMA',
  raceType: 'circuit',
  description: '巨大な火山工場。開閉ゲート、動くピストン、コンベア、溶岩を飛び越えるジャンプ。',
  highlight: '交互に開く溶岩工場のゲート',
  tips: 'ゲートは点滅したら閉まる合図。コンベアの上は流れに乗れば速い。',
  difficultyStars: 4,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.3,
  sampleSpacing: 2,
  checkpointCount: 26,
  checkpointWindow: 40,
  controlPoints: [
    { x: 0, z: -150, y: 2, left: 'wall', right: 'wall' },
    { x: 0, z: -30, y: 2 },
    { x: 0, z: 90, y: 2 },
    { x: 30, z: 160, y: 4 },
    { x: 110, z: 185, y: 8, left: 'fall', right: 'fall' },
    { x: 190, z: 160, y: 10 },
    { x: 230, z: 100, y: 10, left: 'wall', right: 'wall' },
    { x: 220, z: 20, y: 8 },
    { x: 260, z: -40, y: 6 },
    { x: 330, z: -40, y: 6 },
    { x: 370, z: -100, y: 4 },
    { x: 340, z: -180, y: 2 },
    { x: 260, z: -200, y: 2 },
    { x: 180, z: -170, y: 4 },
    { x: 110, z: -210, y: 3 },
    { x: 40, z: -220, y: 2 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.4, lateral: [-4, 4] },
    { at: 0.58, lateral: [-4, 0, 4] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    // ブーストコンベア (右側のレーン)
    { type: 'conveyor', from: 0.04, to: 0.13, speed: 9, lateralMin: 0.5, lateralMax: 8 },
    // 交互に閉まるゲート (左右どちらかは必ず開いている)
    { type: 'obstacle', at: 0.16, style: 'gate', length: 1.2, width: 7.2, height: 4, motion: { kind: 'gate', lateral: -3.75, period: 4, closedFraction: 0.5, phase: 0 } },
    { type: 'obstacle', at: 0.16, style: 'gate', length: 1.2, width: 7.2, height: 4, motion: { kind: 'gate', lateral: 3.75, period: 4, closedFraction: 0.5, phase: 0.5 } },
    // 溶岩の上の橋とジャンプ
    { type: 'jump', at: 0.313, launch: 9, gap: 11 },
    { type: 'surface', from: 0.4, to: 0.47, surface: 'metal' },
    // 横に動くピストン
    { type: 'obstacle', at: 0.49, style: 'piston', length: 3, width: 3, height: 3, motion: { kind: 'slide', center: 0, amplitude: 5, period: 3.2, phase: 0 } },
    { type: 'obstacle', at: 0.515, style: 'piston', length: 3, width: 3, height: 3, motion: { kind: 'slide', center: 0, amplitude: 5, period: 3.2, phase: 0.5 } },
    // コンベア: 左は逆流 (遅い)、右は順流 (速い)。レース選び
    { type: 'conveyor', from: 0.58, to: 0.63, speed: -5, lateralMin: -8, lateralMax: -0.5 },
    { type: 'conveyor', from: 0.58, to: 0.63, speed: 6, lateralMin: 0.5, lateralMax: 8 },
    { type: 'boostPad', at: 0.7, lateral: 3 },
    { type: 'obstacle', at: 0.78, style: 'gate', length: 1.2, width: 7.2, height: 4, motion: { kind: 'gate', lateral: -3.75, period: 3.6, closedFraction: 0.5, phase: 0.25 } },
    { type: 'obstacle', at: 0.78, style: 'gate', length: 1.2, width: 7.2, height: 4, motion: { kind: 'gate', lateral: 3.75, period: 3.6, closedFraction: 0.5, phase: 0.75 } },
    { type: 'boostPad', at: 0.85, lateral: -3 },
    // 小さなジャンプ台
    { type: 'jump', at: 0.905, launch: 6 },
    { type: 'tunnel', from: 0.42, to: 0.54, style: 'metal', height: 9 },
  ],
  environment: { scenery: 'magma', skyTop: 0x1a0b08, skyBottom: 0x7a2410, fogColor: 0x4a1a0e, fogNear: 90, fogFar: 520, groundColor: 0x2a1c18, roadColor: 0x3a3634, lineColor: 0xffb000, curbColorA: 0xffb000, curbColorB: 0x1a1a1a, wallColor: 0x5a5250, sunColor: 0xffb080, sunIntensity: 1.4, ambientSky: 0xff9a60, ambientGround: 0x401008, ambientIntensity: 1.3, night: true, groundLevel: -14, water: false },
};
