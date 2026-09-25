import type { CourseDef } from './types';

// ---------------------------------------------------------------------------
// COASTAL SUNSET DRIVE (Point to Point) — 夕日の海岸線ドライブ。
// 港町 → バンクのついた海沿いのスイーパー → 波が打ち寄せるビーチ → 岬の灯台をぐるりと回る →
// 崖のトンネル → リゾートの街でゴール。急なカーブがほとんどない初心者向け。
// 見せ場: 夕日に向かって走る岬の灯台と、ときどき道路まで来る大波
// ---------------------------------------------------------------------------
export const coastalSunsetDrive: CourseDef = {
  id: 'coastal',
  name: 'COASTAL SUNSET DRIVE',
  idPrefix: 'COASTAL',
  raceType: 'pointToPoint',
  description: '夕日の海岸線を走るワンウェイドライブ。ゆるいバンクのカーブ、大波が来るビーチ、岬の灯台。急なカーブが少ない初心者向け。',
  highlight: '夕日に向かって走る岬の灯台と、大波のビーチ',
  difficultyStars: 2,
  defaultWidth: 16,
  runoffWidth: 0,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 50,
  pointToPoint: {
    sectionNames: [
      '港町', '港町', '港町',
      '海沿いのカーブ', '海沿いのカーブ', '海沿いのカーブ', '海沿いのカーブ',
      'サンセットビーチ', 'サンセットビーチ', 'サンセットビーチ', 'サンセットビーチ',
      '灯台の岬', '灯台の岬', '灯台の岬', '灯台の岬', '灯台の岬',
      '崖のトンネル', '崖のトンネル',
      'リゾート', 'リゾート', 'リゾート', 'リゾート', 'リゾート', 'リゾート',
    ],
  },
  controlPoints: [
    // 港町 (左 = 海側はガードレール、右 = 陸側は壁)
    { x: -60, z: 0, y: 5, left: 'guardrail', right: 'wall' },
    { x: 80, z: 0, y: 5 },
    { x: 220, z: 18, y: 6 },
    // 海沿いのスイーパー (バンクで気持ちよく曲がれる)
    { x: 360, z: -8, y: 8, bank: 6 },
    { x: 490, z: -58, y: 10, bank: 7 },
    { x: 630, z: -72, y: 11, bank: 6 },
    { x: 760, z: -24, y: 9, bank: 5 },
    // サンセットビーチ (道路が低い。波が来る)
    { x: 880, z: 16, y: 4 },
    { x: 1020, z: 28, y: 2.5 },
    { x: 1160, z: 10, y: 2.5 },
    { x: 1280, z: -30, y: 4 },
    // 灯台の岬 (岬の先を左回りにぐるりと回る。内側 = 岬、外側 = 海)
    { x: 1372, z: -104, y: 10, left: 'wall', right: 'guardrail' },
    { x: 1430, z: -206, y: 17, bank: 5 },
    { x: 1488, z: -300, y: 22, bank: 6 },
    { x: 1574, z: -352, y: 24, bank: 6 },
    { x: 1672, z: -334, y: 24, bank: 6 },
    { x: 1734, z: -252, y: 22, bank: 5 },
    { x: 1772, z: -156, y: 19 },
    // 崖のトンネル
    { x: 1846, z: -76, y: 15, left: 'guardrail', right: 'wall' },
    { x: 1966, z: -36, y: 11 },
    // リゾート
    // 入り江をまたぐ橋 (両側が海)
    { x: 2106, z: -38, y: 8, bank: 4, left: 'guardrail', right: 'guardrail' },
    { x: 2244, z: -78, y: 6, bank: 4, left: 'guardrail', right: 'wall' },
    { x: 2384, z: -60, y: 5 },
    { x: 2500, z: 0, y: 5, left: 'wall', right: 'wall' },
    { x: 2590, z: 90, y: 5 },
    { x: 2640, z: 210, y: 5 },
    { x: 2660, z: 330, y: 5 },
  ],
  itemBoxes: [
    { at: 0.12, lateral: [-5, 0, 5] },
    { at: 0.36, lateral: [-5, 5] },
    { at: 0.6, lateral: [-5, 0, 5] },
    { at: 0.84, lateral: [-5, 5] },
  ],
  gimmicks: [
    { type: 'boostPad', at: 0.15, lateral: 0 },
    { type: 'boostPad', at: 0.232, lateral: -3 },
    // サンセットビーチ: 海側 (左半分) に周期的に大波が来る。予告 (水が光る) の後に来る
    { type: 'splash', from: 0.305, to: 0.4, lateralMin: -9, lateralMax: -0.5, period: 6.5, activeFraction: 0.38 },
    // 岬の出口の加速ゲート
    { type: 'speedGate', at: 0.64, lateral: 0 },
    { type: 'tunnel', from: 0.672, to: 0.722, style: 'rock', height: 7.5 },
    { type: 'speedGate', at: 0.8, lateral: 0 },
    { type: 'boostPad', at: 0.88, lateral: 3 },
  ],
  tips: 'ビーチは波が来ると海側 (左側) が水びたしで滑る。波の来ない山側 (右側) を走ろう。岬はバンクを使ってアクセル全開！',
  environment: {
    scenery: 'coastal',
    skyTop: 0x2c3c8e,
    skyBottom: 0xffa060,
    fogColor: 0xffb888,
    fogNear: 220,
    fogFar: 900,
    groundColor: 0x6a9a4a,
    roadColor: 0x45434a,
    lineColor: 0xfff4e0,
    curbColorA: 0x2b86c5,
    curbColorB: 0xf5f5f5,
    wallColor: 0xb8a890,
    sunColor: 0xffb070,
    sunIntensity: 2.3,
    ambientSky: 0xffc8a0,
    ambientGround: 0x5a4a6a,
    ambientIntensity: 1.25,
    night: false,
    groundLevel: -12,
    water: true,
  },
};
