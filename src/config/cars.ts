/**
 * 車両設定。
 *
 * 10台の架空車両。完全上位互換を作らないよう、各車に長所と短所を持たせている。
 * 数値を変更するだけで性能を調整できる (ロジック側の変更は不要)。
 *
 * 単位:
 *  - maxSpeedKmh : 最高速度 [km/h]
 *  - accel       : 低速域での加速度 [m/s^2] (高速域では自動的に減衰)
 *  - brake       : ブレーキ減速度 [m/s^2]
 *  - grip        : 横方向グリップ倍率 (1.0 = 標準)
 *  - drift       : ドリフト性能 0..1 (高いほど滑らせやすく、ドリフト中の速度維持が良い)
 *  - handling    : ステアリングの切れ具合倍率 (1.0 = 標準)
 *  - mass        : 車重 [kg] (車同士の接触時の押し合いに影響)
 *  - durability  : 耐久力 1..10 (BATTLE DUEL の被弾ダメージを軽減)
 */

export type Drivetrain = 'FF' | 'FR' | 'MR' | 'AWD';

export type BodyStyle = 'coupe' | 'hatch' | 'wedge' | 'gt' | 'muscle' | 'suv';

export interface CarVisual {
  style: BodyStyle;
  bodyColor: number;
  accentColor: number;
  /** リアウイングの有無 */
  spoiler: boolean;
}

export interface CarSpec {
  id: string;
  name: string;
  drivetrain: Drivetrain;
  /** 選択画面に表示する短い説明 */
  tagline: string;
  maxSpeedKmh: number;
  accel: number;
  brake: number;
  grip: number;
  drift: number;
  handling: number;
  mass: number;
  durability: number;
  visual: CarVisual;
}

export const CARS: readonly CarSpec[] = [
  {
    id: 'apex86',
    name: 'Apex 86',
    drivetrain: 'FR',
    tagline: 'バランス型。迷ったらコレ',
    maxSpeedKmh: 204,
    accel: 9.2,
    brake: 16,
    grip: 1.0,
    drift: 0.7,
    handling: 1.0,
    mass: 1200,
    durability: 5,
    visual: { style: 'coupe', bodyColor: 0xf2f2f2, accentColor: 0x1a1a1a, spoiler: false },
  },
  {
    id: 'neonfox',
    name: 'Neon Fox',
    drivetrain: 'FF',
    tagline: '初心者向け。安定して曲がる',
    maxSpeedKmh: 192,
    accel: 8.8,
    brake: 17.5,
    grip: 1.1,
    drift: 0.4,
    handling: 1.08,
    mass: 1050,
    durability: 5,
    visual: { style: 'hatch', bodyColor: 0xff8a1f, accentColor: 0x202020, spoiler: false },
  },
  {
    id: 'vortexr',
    name: 'Vortex R',
    drivetrain: 'AWD',
    tagline: '高加速・安定型。立ち上がり最強',
    maxSpeedKmh: 206,
    accel: 11.2,
    brake: 15.5,
    grip: 1.06,
    drift: 0.35,
    handling: 0.95,
    mass: 1450,
    durability: 6,
    visual: { style: 'wedge', bodyColor: 0x2b6cff, accentColor: 0xf0f0f0, spoiler: true },
  },
  {
    id: 'midnights',
    name: 'Midnight S',
    drivetrain: 'FR',
    tagline: 'ドリフト特化。滑らせて速い',
    maxSpeedKmh: 198,
    accel: 8.9,
    brake: 14.5,
    grip: 0.9,
    drift: 1.0,
    handling: 1.06,
    mass: 1250,
    durability: 4,
    visual: { style: 'coupe', bodyColor: 0x3a2a6e, accentColor: 0xb8a8ff, spoiler: true },
  },
  {
    id: 'cometmr',
    name: 'Comet MR',
    drivetrain: 'MR',
    tagline: 'コーナリング型。挙動はシビア',
    maxSpeedKmh: 208,
    accel: 9.6,
    brake: 17,
    grip: 1.2,
    drift: 0.6,
    handling: 1.12,
    mass: 1100,
    durability: 3,
    visual: { style: 'wedge', bodyColor: 0xffd21f, accentColor: 0x111111, spoiler: false },
  },
  {
    id: 'titangt',
    name: 'Titan GT',
    drivetrain: 'AWD',
    tagline: '重量級GT。直線と押し合いに強い',
    maxSpeedKmh: 226,
    accel: 8.1,
    brake: 13,
    grip: 0.96,
    drift: 0.3,
    handling: 0.86,
    mass: 1750,
    durability: 8,
    visual: { style: 'gt', bodyColor: 0x1d6b3a, accentColor: 0xd8c47a, spoiler: true },
  },
  {
    id: 'flashrs',
    name: 'Flash RS',
    drivetrain: 'FF',
    tagline: '軽量加速型。当たりに弱い',
    maxSpeedKmh: 194,
    accel: 11.8,
    brake: 16.5,
    grip: 1.02,
    drift: 0.45,
    handling: 1.1,
    mass: 900,
    durability: 2,
    visual: { style: 'hatch', bodyColor: 0xe0262f, accentColor: 0xffffff, spoiler: true },
  },
  {
    id: 'phantomrx',
    name: 'Phantom RX',
    drivetrain: 'FR',
    tagline: '高速・ドリフト型。上級者向け',
    maxSpeedKmh: 232,
    accel: 8.3,
    brake: 13.8,
    grip: 0.9,
    drift: 0.85,
    handling: 0.94,
    mass: 1400,
    durability: 5,
    visual: { style: 'muscle', bodyColor: 0x151515, accentColor: 0xff2d7a, spoiler: true },
  },
  {
    id: 'circuitnova',
    name: 'Circuit Nova',
    drivetrain: 'MR',
    tagline: 'グリップ・ブレーキ型。突っ込みで勝つ',
    maxSpeedKmh: 212,
    accel: 9.0,
    brake: 20.5,
    grip: 1.26,
    drift: 0.4,
    handling: 1.02,
    mass: 1150,
    durability: 4,
    visual: { style: 'wedge', bodyColor: 0x19c2c9, accentColor: 0x0b2a4a, spoiler: true },
  },
  {
    id: 'ironwolf',
    name: 'Iron Wolf',
    drivetrain: 'AWD',
    tagline: '高重量・高耐久。撃たれても平気',
    maxSpeedKmh: 199,
    accel: 7.9,
    brake: 15,
    grip: 1.0,
    drift: 0.25,
    handling: 0.9,
    mass: 1900,
    durability: 10,
    visual: { style: 'suv', bodyColor: 0x6b6f76, accentColor: 0xff9d00, spoiler: false },
  },
];

/** UI のステータスバー表示用レンジ (min で 0%、max で 100% 表示) */
export const CAR_STAT_RANGES = {
  maxSpeedKmh: { min: 180, max: 235 },
  accel: { min: 7, max: 12 },
  brake: { min: 12, max: 21 },
  grip: { min: 0.85, max: 1.3 },
  drift: { min: 0, max: 1 },
  mass: { min: 850, max: 1950 },
  durability: { min: 1, max: 10 },
} as const;

export type CarStatKey = keyof typeof CAR_STAT_RANGES;

export const CAR_STAT_LABELS: Record<CarStatKey, string> = {
  maxSpeedKmh: '最高速度',
  accel: '加速',
  brake: 'ブレーキ',
  grip: 'グリップ',
  drift: 'ドリフト',
  mass: '重量',
  durability: '耐久力',
};

export function getCarSpec(id: string): CarSpec {
  const spec = CARS.find((c) => c.id === id);
  if (!spec) {
    throw new Error(`Unknown car id: ${id}`);
  }
  return spec;
}

export function findCarSpec(id: string | undefined): CarSpec | undefined {
  return id === undefined ? undefined : CARS.find((c) => c.id === id);
}

/** ステータスを 0..1 に正規化 (UI表示用) */
export function normalizedStat(spec: CarSpec, key: CarStatKey): number {
  const range = CAR_STAT_RANGES[key];
  const v = spec[key];
  return Math.min(1, Math.max(0, (v - range.min) / (range.max - range.min)));
}
