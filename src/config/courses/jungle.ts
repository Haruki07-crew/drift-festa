import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// JUNGLE TEMPLE RUN
// ---------------------------------------------------------------------------
export const jungleTempleRun: CourseDef = {
  id: 'jungle',
  name: 'JUNGLE TEMPLE RUN',
  idPrefix: 'JUNGLE',
  description: '密林と古代遺跡。土・泥・川の浅瀬、吊り橋、洞窟、崩れた遺跡のジャンプ、滝の裏の分岐ルート。',
  tips: '泥は加速が鈍る。分岐は滝の裏 (左) が短いが狭い。倒木に注意！',
  difficultyStars: 4,
  defaultWidth: 14,
  runoffWidth: 0,
  wallHeight: 1.0,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 40,
  controlPoints: [
    { x: 0, z: -120, y: 5, left: 'wall', right: 'wall' },
    { x: 0, z: 0, y: 5 },
    { x: -15, z: 110, y: 8 },
    { x: -70, z: 180, y: 12 },
    { x: -150, z: 190, y: 14 },
    { x: -220, z: 140, y: 12 },
    { x: -240, z: 60, y: 8 },
    { x: -200, z: -10, y: 4 },
    { x: -240, z: -90, y: 4 },
    { x: -310, z: -110, y: 6 },
    { x: -360, z: -50, y: 10 },
    { x: -380, z: 40, y: 16 },
    { x: -340, z: 120, y: 20 },
    { x: -300, z: 200, y: 22, left: 'fall', right: 'fall', width: 10 },
    { x: -220, z: 260, y: 20, width: 10 },
    { x: -120, z: 275, y: 16, left: 'wall', right: 'wall' },
    { x: -40, z: 250, y: 12 },
    { x: 50, z: 200, y: 10 },
    { x: 90, z: 110, y: 8, width: 24 },
    { x: 80, z: 0, y: 6, width: 24 },
    { x: 60, z: -110, y: 5, width: 14 },
    { x: 50, z: -175, y: 5 },
    { x: 0, z: -200, y: 5 },
    { x: -15, z: -165, y: 5 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.33, lateral: [-4, 4] },
    { at: 0.58, lateral: [-3, 0, 3] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.05, lateral: 0 },
    { type: 'surface', from: 0.11, to: 0.3, surface: 'dirt' },
    // 崩れた遺跡を使うジャンプ
    { type: 'jump', at: 0.207, launch: 8, gap: 11 },
    // 川の浅瀬と泥道
    { type: 'surface', from: 0.3, to: 0.33, surface: 'water' },
    { type: 'surface', from: 0.33, to: 0.37, surface: 'mud' },
    // 倒木 (右半分をふさぐ)
    { type: 'obstacle', at: 0.385, style: 'log', length: 1.6, width: 6.5, height: 1.4, motion: { kind: 'static', lateral: 3.5 } },
    // 洞窟
    { type: 'tunnel', from: 0.43, to: 0.5, style: 'rock', height: 8 },
    // 吊り橋
    { type: 'surface', from: 0.56, to: 0.61, surface: 'dirt' },
    { type: 'boostPad', at: 0.65, lateral: 3 },
    { type: 'surface', from: 0.66, to: 0.79, surface: 'dirt' },
    // ルート分岐: 中央の石柱で左右に分かれる。左 = 滝の裏 (舗装)、右 = 泥
    { type: 'obstacle', at: 0.81, style: 'pillar', length: 26, width: 2, height: 5, motion: { kind: 'static', lateral: 0 } },
    { type: 'obstacle', at: 0.826, style: 'pillar', length: 26, width: 2, height: 5, motion: { kind: 'static', lateral: 0 } },
    { type: 'surface', from: 0.8, to: 0.845, surface: 'mud', lateralMin: 1 },
    { type: 'surface', from: 0.8, to: 0.845, surface: 'water', lateralMax: -1 },
  ],
  environment: { scenery: 'jungle', skyTop: 0x4d9fd6, skyBottom: 0xd8f0c8, fogColor: 0xb8d8a8, fogNear: 90, fogFar: 480, groundColor: 0x3f7a2c, roadColor: 0x8c7a5c, lineColor: 0xe8dcb0, curbColorA: 0x9a8a70, curbColorB: 0x6a5a40, wallColor: 0x8a8672, sunColor: 0xfff0c0, sunIntensity: 2.3, ambientSky: 0xd8f0c0, ambientGround: 0x2a4a1a, ambientIntensity: 1.15, night: false, groundLevel: -20, water: false },
};
