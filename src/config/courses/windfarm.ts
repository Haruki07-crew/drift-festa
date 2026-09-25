import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// WIND FARM HILLS (Circuit) — 風車の並ぶ緑の丘を走るサーキット。
// なだらかなアップダウン → バンクのついた大きなカーブ (Bank Assist) → 丘のてっぺんで小さくジャンプ →
// 風の強い尾根 (横風) → 牧場の横を通ってスタートへ。
// 見せ場: 巨大な風車の足元を横風に耐えながら駆け抜ける尾根道
// ---------------------------------------------------------------------------
export const windFarmHills: CourseDef = {
  id: 'windfarm',
  name: 'WIND FARM HILLS',
  idPrefix: 'WINDFARM',
  raceType: 'circuit',
  description: '巨大な風車が回る緑の丘。バンクのついた気持ちいいカーブと、丘のてっぺんの小ジャンプ。尾根では横風に注意！',
  highlight: '巨大な風車の足元を走る尾根道',
  difficultyStars: 2,
  defaultWidth: 16,
  runoffWidth: 5,
  wallHeight: 1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    { x: 0, z: 0, y: 10, left: 'grass', right: 'grass' },
    { x: 150, z: 0, y: 12 },
    // 丘のてっぺん
    { x: 280, z: -30, y: 18 },
    // バンクのついた大きな右カーブ
    { x: 382, z: -100, y: 14, bank: 9 },
    { x: 422, z: -220, y: 10, bank: 10 },
    { x: 382, z: -332, y: 12, bank: 9 },
    // 丘のてっぺんの小ジャンプ
    { x: 280, z: -382, y: 18 },
    { x: 150, z: -372, y: 14 },
    { x: 40, z: -412, y: 12 },
    { x: -72, z: -382, y: 14, bank: 6 },
    // 風の強い尾根
    { x: -112, z: -282, y: 18 },
    { x: -102, z: -170, y: 21 },
    { x: -72, z: -72, y: 16 },
    // 牧場の横
    { x: -40, z: -18, y: 12 },
  ],
  itemBoxes: [
    { at: 0.06, lateral: [-5, 0, 5] },
    { at: 0.32, lateral: [-5, 5] },
    { at: 0.6, lateral: [-5, 0, 5] },
    { at: 0.86, lateral: [-5, 5] },
  ],
  gimmicks: [
    { type: 'speedGate', at: 0.08, lateral: 0 },
    // 丘のてっぺんで小さくジャンプ (道路の切れ目なし)
    { type: 'jump', at: 0.172, launch: 5 },
    { type: 'boostPad', at: 0.25, lateral: 3 },
    { type: 'jump', at: 0.482, launch: 6 },
    { type: 'boostPad', at: 0.62, lateral: -3 },
    // 風の強い尾根 (吹き流しがピンと伸びたら横風)
    { type: 'wind', from: 0.73, to: 0.9, force: 5, period: 6.5, activeFraction: 0.4, style: 'windsock' },
    { type: 'speedGate', at: 0.95, lateral: 0 },
  ],
  tips: 'バンクのカーブはアクセル全開のまま曲がれる！尾根の吹き流しがピンと伸びたら横風が来る合図。',
  environment: {
    scenery: 'windfarm',
    skyTop: 0x3a8ae8,
    skyBottom: 0xd8f0ff,
    fogColor: 0xdcecf8,
    fogNear: 220,
    fogFar: 900,
    groundColor: 0x6ab84a,
    roadColor: 0x4a4e58,
    lineColor: 0xffffff,
    curbColorA: 0x3ddc84,
    curbColorB: 0xffffff,
    wallColor: 0xc8d0b8,
    sunColor: 0xfff6e0,
    sunIntensity: 2.6,
    ambientSky: 0xd8ecff,
    ambientGround: 0x5a7a3a,
    ambientIntensity: 1.2,
    night: false,
    groundLevel: -10,
    water: false,
  },
};
