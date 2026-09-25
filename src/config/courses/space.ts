import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// SPACE STATION (Circuit) — 宇宙ステーションを1周するサーキット。
// 発進デッキ → 回転ゲートのあるモジュール通路 → 磁力道路の超バンク (40°) →
// チューブのトンネル (スリップストリームが強くなる) → 柵のない外デッキでモジュール間ジャンプ。
// 見せ場: 地球を横目に磁力で壁のようなバンクを駆け抜けるカーブ
// ---------------------------------------------------------------------------
export const spaceStation: CourseDef = {
  id: 'space',
  name: 'SPACE STATION',
  idPrefix: 'SPACE',
  raceType: 'circuit',
  description: '宇宙ステーションを走るサーキット。回転ゲート、磁力で吸い付く超バンク、チューブのトンネル、モジュール間ジャンプ！',
  highlight: '地球を横目に磁力で駆け抜ける超バンク',
  difficultyStars: 3,
  defaultWidth: 16,
  runoffWidth: 0,
  wallHeight: 1.3,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    // 発進デッキ
    { x: 0, z: 0, y: 40, left: 'wall', right: 'wall' },
    { x: 150, z: 0, y: 40 },
    // モジュール通路 (回転ゲート)
    { x: 262, z: 20, y: 40 },
    { x: 362, z: 72, y: 40 },
    // 磁力道路の超バンク (右へ 180°)
    { x: 422, z: 162, y: 42, bank: 34 },
    { x: 412, z: 262, y: 44, bank: 40 },
    { x: 332, z: 322, y: 46, bank: 34 },
    // チューブのトンネル
    { x: 220, z: 334, y: 46 },
    { x: 100, z: 322, y: 46 },
    { x: -10, z: 300, y: 44 },
    // 外デッキ (柵なし) のジャンプ
    { x: -92, z: 248, y: 42, left: 'fall', right: 'fall' },
    { x: -140, z: 160, y: 40 },
    { x: -140, z: 60, y: 40, left: 'wall', right: 'wall' },
    { x: -92, z: 2, y: 40 },
  ],
  itemBoxes: [
    { at: 0.06, lateral: [-5, 0, 5] },
    { at: 0.32, lateral: [-5, 5] },
    { at: 0.6, lateral: [-5, 0, 5] },
    { at: 0.86, lateral: [-5, 5] },
  ],
  gimmicks: [
    { type: 'speedGate', at: 0.07, lateral: 0 },
    // モジュール通路の回転ゲート (左右で半周ずれて回る)
    { type: 'obstacle', at: 0.185, motion: { kind: 'spin', lateral: -4, period: 3.2 }, length: 1, width: 7, height: 2.4, style: 'turnstile' },
    { type: 'obstacle', at: 0.228, motion: { kind: 'spin', lateral: 4, period: 3.2, phase: 0.5 }, length: 1, width: 7, height: 2.4, style: 'turnstile' },
    // 磁力道路 (吸い付く = グリップが高い) の超バンク
    { type: 'surface', from: 0.3, to: 0.475, surface: 'magnet' },
    // チューブのトンネル: トンネル加速 + スリップストリームが強くなる
    { type: 'tunnel', from: 0.5, to: 0.69, style: 'space', height: 8, speedBonus: 0.04 },
    { type: 'draftZone', from: 0.5, to: 0.69, multiplier: 1.8 },
    // 外デッキのモジュール間ジャンプ
    { type: 'jump', at: 0.775, launch: 9, gap: 12 },
    { type: 'boostPad', at: 0.9, lateral: 0 },
  ],
  tips: '回転ゲートは腕が通り過ぎた直後に抜ける。青く光る磁力道路は吸い付くのでアクセル全開でOK！',
  environment: {
    scenery: 'space',
    skyTop: 0x000004,
    skyBottom: 0x06081a,
    fogColor: 0x05070f,
    fogNear: 260,
    fogFar: 1100,
    groundColor: 0x1a1c24,
    roadColor: 0x3a3e4a,
    lineColor: 0x39f3ff,
    curbColorA: 0x39f3ff,
    curbColorB: 0x2a2e3a,
    wallColor: 0xb8c0cc,
    sunColor: 0xffffff,
    sunIntensity: 2.4,
    ambientSky: 0x8aa0ff,
    ambientGround: 0x20243a,
    ambientIntensity: 1.3,
    night: true,
    groundLevel: -40,
    water: false,
    roadSupports: 'pillars',
  },
};
