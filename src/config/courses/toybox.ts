import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// TOYBOX MAYHEM
// ---------------------------------------------------------------------------
export const toyboxMayhem: CourseDef = {
  id: 'toybox',
  name: 'TOYBOX MAYHEM',
  idPrefix: 'TOYBOX',
  raceType: 'circuit',
  description: 'ミニカーになって巨大なおもちゃ部屋を爆走！ シーソー、回転する積み木、おもちゃの列車、扇風機の風、鉛筆の橋。',
  highlight: 'シーソーと横切るおもちゃの列車',
  tips: '障害物はリズムを見よう。列車は警告ランプが点いたら来る。扇風機の風は逆ハンで耐える！',
  difficultyStars: 4,
  defaultWidth: 15,
  runoffWidth: 0,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 40,
  controlPoints: [
    { x: -100, z: 0, y: 0, left: 'wall', right: 'wall' },
    { x: 10, z: 0, y: 0 },
    { x: 100, z: 10, y: 0 },
    { x: 160, z: 60, y: 2 },
    { x: 170, z: 140, y: 6 },
    { x: 130, z: 210, y: 8 },
    { x: 60, z: 230, y: 8 },
    { x: -10, z: 200, y: 4 },
    { x: -70, z: 240, y: 0 },
    { x: -60, z: 310, y: 0 },
    { x: 10, z: 340, y: 0 },
    { x: 90, z: 320, y: 0 },
    { x: 200, z: 290, y: 0 },
    { x: 240, z: 220, y: 0, left: 'fall', right: 'fall', width: 9 },
    { x: 240, z: 120, y: 0, width: 9 },
    { x: 230, z: 40, y: 0, left: 'wall', right: 'wall' },
    { x: 190, z: -40, y: 0 },
    { x: 100, z: -80, y: 0 },
    { x: 0, z: -70, y: 0 },
    { x: -100, z: -60, y: 0 },
    { x: -170, z: -45, y: 0 },
    { x: -195, z: 5, y: 0 },
    { x: -160, z: 18, y: 0 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-4, 0, 4] },
    { at: 0.33, lateral: [-4, 4] },
    { at: 0.6, lateral: [-2.5, 0, 2.5] },
    { at: 0.82, lateral: [-4, 4] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.03, lateral: 0 },
    // おもちゃの列車が横切る (警告ランプの後に来る)
    { type: 'obstacle', at: 0.09, style: 'train', length: 4, width: 11, height: 3, motion: { kind: 'cross', amplitude: 16, period: 7, crossFraction: 0.35, phase: 0.1 } },
    // 巨大な本から本へジャンプ
    { type: 'jump', at: 0.243, launch: 9, gap: 11 },
    // シーソー道路
    { type: 'seesaw', from: 0.36, to: 0.405, tilt: 2.5, period: 5 },
    // 回転する積み木
    { type: 'obstacle', at: 0.44, style: 'spinner', length: 7, width: 1.6, height: 2, motion: { kind: 'spin', lateral: -3.5, period: 4 } },
    { type: 'obstacle', at: 0.455, style: 'spinner', length: 7, width: 1.6, height: 2, motion: { kind: 'spin', lateral: 3.5, period: 4, phase: 0.25 } },
    { type: 'boostPad', at: 0.47, lateral: -3 },
    // 巨大な扇風機の風で横へ押される
    { type: 'wind', from: 0.49, to: 0.53, force: 9, period: 5, activeFraction: 0.45 },
    // 鉛筆の橋
    { type: 'surface', from: 0.578, to: 0.632, surface: 'metal' },
    // レールの上を高速走行
    { type: 'conveyor', from: 0.7, to: 0.77, speed: 10 },
    { type: 'boostPad', at: 0.83, lateral: 3 },
    // バウンドする床
    { type: 'jump', at: 0.845, launch: 5 },
    { type: 'jump', at: 0.858, launch: 5 },
    { type: 'jump', at: 0.871, launch: 5 },
  ],
  environment: { scenery: 'toybox', skyTop: 0xfff3d8, skyBottom: 0xffe0b0, fogColor: 0xffe8c8, fogNear: 200, fogFar: 800, groundColor: 0xc8905a, roadColor: 0xff7a1a, lineColor: 0xffffff, curbColorA: 0x2b86c5, curbColorB: 0xffd23f, wallColor: 0x39b54a, sunColor: 0xfff6e0, sunIntensity: 2.2, ambientSky: 0xfff0e0, ambientGround: 0xa06a3a, ambientIntensity: 1.4, night: false, groundLevel: -30, water: false, roadSupports: 'none' },
};
