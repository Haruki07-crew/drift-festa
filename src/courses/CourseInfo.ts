/**
 * コース選択画面向けの情報をコース定義から計算する (距離・目安タイム・バッジ)。
 * ギミックを追加すると自動でバッジが付くので、コースごとに手で書かなくてよい。
 */
import {
  ENVIRONMENT_BADGES,
  GIMMICK_BADGES,
  SURFACE_BADGES,
  courseInfoConfig,
  type BadgeDef,
} from '../config/courseInfo';
import type { CourseDef } from '../config/courses';
import { gameConfig } from '../config/game';
import { Track } from './Track';

export interface CourseSummary {
  def: CourseDef;
  /** 1周 (周回コース) またはスタート〜ゴール (Point to Point) の距離 [m] */
  raceLength: number;
  /** レース全体の距離 [m] (周回コースは周回数を掛ける) */
  totalDistance: number;
  laps: number;
  /** 目安タイム [s] */
  estimatedSeconds: number;
  badges: BadgeDef[];
}

const cache = new Map<string, CourseSummary>();

export function courseSummary(def: CourseDef): CourseSummary {
  const hit = cache.get(def.id);
  if (hit) return hit;
  const track = Track.build(def);
  const laps = track.closed ? gameConfig.laps : 1;
  const total = track.raceLength * laps;
  const speed = courseInfoConfig.avgSpeedByStars[Math.max(1, Math.min(5, def.difficultyStars))]!;
  const summary: CourseSummary = {
    def,
    raceLength: track.raceLength,
    totalDistance: total,
    laps,
    estimatedSeconds: total / speed,
    badges: courseBadges(def, track),
  };
  cache.set(def.id, summary);
  return summary;
}

/** コースの特徴バッジ (環境 → ギミック → 路面の順。重複なし) */
export function courseBadges(def: CourseDef, track?: Track): BadgeDef[] {
  const out: BadgeDef[] = [];
  const add = (b: BadgeDef | undefined): void => {
    if (b && !out.some((x) => x.label === b.label)) out.push(b);
  };
  const env = def.environment;
  if (env.night) add(ENVIRONMENT_BADGES.night);
  const weather = env.weather?.kind;
  if (weather === 'rain') add(ENVIRONMENT_BADGES.rain);
  if (weather === 'sandstorm') add(ENVIRONMENT_BADGES.sandstorm);
  if (weather === 'snow') add(ENVIRONMENT_BADGES.snow);
  if (weather === 'aurora') add(ENVIRONMENT_BADGES.aurora);
  for (const g of def.gimmicks ?? []) {
    if (g.type === 'surface') add(SURFACE_BADGES[g.surface]);
    else if (g.type === 'obstacle' && g.motion.kind === 'drop') add(ENVIRONMENT_BADGES.drop);
    else add(GIMMICK_BADGES[g.type]);
  }
  const t = track ?? Track.build(def);
  const fallShare = t.samples.filter((s) => s.left === 'fall' || s.right === 'fall').length / t.samples.length;
  if (fallShare > 0.08) add(ENVIRONMENT_BADGES.fall);
  return out;
}

/** 1:23 形式 (目安タイム用。秒は5秒単位に丸める) */
export function formatApproxTime(seconds: number): string {
  const r = Math.round(seconds / 5) * 5;
  const m = Math.floor(r / 60);
  const s = r - m * 60;
  return m > 0 ? `約${m}分${s > 0 ? `${s}秒` : ''}` : `約${s}秒`;
}

export function formatKm(m: number): string {
  return `${(m / 1000).toFixed(1)} km`;
}
