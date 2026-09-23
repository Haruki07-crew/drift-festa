/**
 * NPC走行パターンの生成と選択 (純粋ロジック。テスト対象)。
 *
 * 各コース × 各難易度で 30 パターン (合計 90 / コース、3コースで 270)。
 * 難易度のパラメータレンジと性格補正から、コースIDをシードにして決定的に生成する。
 * 同じパターンIDは常に同じ内容になる (再現・調整がしやすい)。
 */
import { CARS } from '../config/cars';
import type { CourseDef } from '../config/courses';
import {
  NPC_DIFFICULTIES,
  NPC_PATTERNS_PER_DIFFICULTY,
  NPC_PERSONALITIES,
  npcConfig,
  type NpcDifficulty,
  type NpcDifficultyProfile,
  type NpcPersonality,
  type NpcPersonalityModifier,
  type Range,
} from '../config/npc';
import { SeededRandom, hashString, sampleWithoutReplacement } from '../core/math';

export interface NpcPattern {
  /** 例: TOUGE_STRONG_017 */
  id: string;
  courseId: string;
  difficulty: NpcDifficulty;
  /** 1..30 */
  number: number;
  personality: NpcPersonality;
  carId: string;
  lineBlend: number;
  lineOffset: number;
  cornerSpeedFactor: number;
  brakingFactor: number;
  brakeMargin: number;
  straightSpeedFactor: number;
  reactionTime: number;
  steeringNoise: number;
  mistakeRatePerMinute: number;
  mistakeSeverity: number;
  overtakeTendency: number;
  lookaheadTime: number;
  driftTendency: number;
  blockTendency: number;
  /** 実行時の乱数シード (ステアリングの揺らぎ等) */
  seed: number;
}

type NumericKey = Exclude<keyof NpcDifficultyProfile, 'label'>;

const NUMERIC_KEYS: readonly NumericKey[] = [
  'lineBlend',
  'lineOffset',
  'cornerSpeedFactor',
  'brakingFactor',
  'brakeMargin',
  'straightSpeedFactor',
  'reactionTime',
  'steeringNoise',
  'mistakeRatePerMinute',
  'mistakeSeverity',
  'overtakeTendency',
  'lookaheadTime',
];

/** 値の下限・上限 (性格補正で範囲外にならないように) */
const HARD_LIMITS: Record<NumericKey, Range> = {
  lineBlend: { min: 0, max: 1 },
  lineOffset: { min: -3, max: 3 },
  cornerSpeedFactor: { min: 0.5, max: 1 },
  brakingFactor: { min: 0.3, max: 0.95 },
  brakeMargin: { min: 0, max: 40 },
  straightSpeedFactor: { min: 0.6, max: 1 },
  reactionTime: { min: 0.02, max: 0.6 },
  steeringNoise: { min: 0, max: 0.3 },
  mistakeRatePerMinute: { min: 0, max: 6 },
  mistakeSeverity: { min: 0, max: 1 },
  overtakeTendency: { min: 0, max: 1 },
  lookaheadTime: { min: 0.3, max: 1.2 },
};

export function patternId(course: CourseDef, difficulty: NpcDifficulty, num: number): string {
  return `${course.idPrefix}_${difficulty.toUpperCase()}_${String(num).padStart(3, '0')}`;
}

/** 1コース・1難易度分 (30個) のパターンを生成 */
export function generateNpcPatterns(course: CourseDef, difficulty: NpcDifficulty): NpcPattern[] {
  const profile = npcConfig.difficulties[difficulty];
  const rng = new SeededRandom(hashString(`${course.id}:${difficulty}`));
  const patterns: NpcPattern[] = [];
  for (let k = 0; k < NPC_PATTERNS_PER_DIFFICULTY; k++) {
    const num = k + 1;
    // 性格は順番に割り当て (各性格が均等に出る)
    const personality = NPC_PERSONALITIES[k % NPC_PERSONALITIES.length]!;
    const mod: NpcPersonalityModifier = npcConfig.personalities[personality];
    const values = {} as Record<NumericKey, number>;
    for (const key of NUMERIC_KEYS) {
      const range = profile[key];
      const base = rng.range(range.min, range.max);
      const add = mod.add[key] ?? 0;
      const lim = HARD_LIMITS[key];
      values[key] = Math.min(lim.max, Math.max(lim.min, base + add));
    }
    // 車: 性格の好みから 75%、全車種から 25%
    const carPool = rng.next() < 0.75 ? mod.preferredCars : CARS.map((c) => c.id);
    const carId = rng.pick(carPool);
    patterns.push({
      id: patternId(course, difficulty, num),
      courseId: course.id,
      difficulty,
      number: num,
      personality,
      carId,
      ...values,
      driftTendency: mod.driftTendency,
      blockTendency: mod.blockTendency,
      seed: Math.floor(rng.next() * 0xffffffff),
    });
  }
  return patterns;
}

/** 1コース分 (90個) の全パターン */
export function generateCoursePatterns(course: CourseDef): NpcPattern[] {
  return NPC_DIFFICULTIES.flatMap((d) => generateNpcPatterns(course, d));
}

/**
 * レースに出場するNPCパターンを選ぶ。
 * 該当難易度の30パターンから必要台数をランダムに、可能な限り重複なしで選択。
 */
export function selectNpcPatterns(
  course: CourseDef,
  difficulty: NpcDifficulty,
  count: number,
  random: () => number = Math.random,
): NpcPattern[] {
  const all = generateNpcPatterns(course, difficulty);
  const result = sampleWithoutReplacement(all, count, random);
  // 30台を超える要求 (通常はありえない) の場合のみ重複を許して補充
  while (result.length < count) {
    result.push(all[Math.floor(random() * all.length)]!);
  }
  return result;
}
