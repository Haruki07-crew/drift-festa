/**
 * コース選択画面に出す情報の設定 (v3)。
 *
 * - 難易度 (★) の意味
 * - 目安タイムの計算に使う平均速度 (★ごと)
 * - ギミック・路面・天候のアイコンと名前 (コース定義から自動でバッジを作る)
 */
import type { RaceType } from './courses/types';
import type { GimmickType, SurfaceKind } from './gimmicks';

/** ★の意味 (選択画面・説明書で共通) */
export const STAR_LABELS: Record<number, string> = {
  1: 'とてもかんたん',
  2: 'はじめての人向け',
  3: 'ふつう',
  4: 'むずかしい',
  5: '上級者向け',
};

export const RACE_TYPE_LABELS: Record<RaceType, { name: string; short: string; description: string }> = {
  circuit: { name: 'CIRCUIT 周回コース', short: 'CIRCUIT', description: '同じコースを3周してゴール。コースを覚えてタイムを縮めよう' },
  pointToPoint: { name: 'POINT TO POINT 一本道', short: 'POINT TO POINT', description: 'スタートからゴールまで一気に走る旅。景色がどんどん変わる' },
};

export const courseInfoConfig = {
  /** 目安タイムの計算に使う平均速度 [m/s] (★1..★5)。実際の CPU (ふつう) の走りに近い値 */
  avgSpeedByStars: [0, 42, 40, 36, 33, 31],
  /** 選択画面のカードに出すバッジの最大数 */
  maxCardBadges: 5,
};

export interface BadgeDef {
  icon: string;
  label: string;
}

/** ギミックの種類ごとのバッジ */
export const GIMMICK_BADGES: Partial<Record<GimmickType, BadgeDef>> = {
  boostPad: { icon: '⚡', label: 'ブースト' },
  speedGate: { icon: '💫', label: '加速ゲート' },
  jump: { icon: '🦘', label: 'ジャンプ' },
  wind: { icon: '🌬️', label: '横風' },
  conveyor: { icon: '➡️', label: 'コンベア' },
  obstacle: { icon: '🚧', label: '動く障害物' },
  seesaw: { icon: '⚖️', label: 'シーソー' },
  tunnel: { icon: '🚇', label: 'トンネル' },
  transform: { icon: '🐟', label: '水中' },
  draftZone: { icon: '💨', label: 'スリップストリーム' },
  splash: { icon: '🌊', label: '水しぶき' },
  platform: { icon: '↔️', label: '動く足場' },
  drawbridge: { icon: '🌉', label: '跳ね橋' },
};

/** 路面ごとのバッジ (普通の路面・鉄板はなし) */
export const SURFACE_BADGES: Partial<Record<SurfaceKind, BadgeDef>> = {
  snow: { icon: '⛄', label: '雪' },
  ice: { icon: '🧊', label: '氷' },
  dirt: { icon: '🟫', label: '土' },
  mud: { icon: '🟤', label: '泥' },
  water: { icon: '💧', label: '浅い水' },
  glass: { icon: '🔷', label: '透明な道' },
  sand: { icon: '🏜️', label: '砂' },
  wet: { icon: '☔', label: '濡れた路面' },
  cobble: { icon: '🧱', label: '石畳' },
  magnet: { icon: '🧲', label: '磁力道路' },
};

/** 環境のバッジ */
export const ENVIRONMENT_BADGES = {
  night: { icon: '🌙', label: '夜' },
  rain: { icon: '🌧️', label: '雨' },
  sandstorm: { icon: '🌪️', label: '砂嵐' },
  snow: { icon: '❄️', label: '雪が降る' },
  aurora: { icon: '🌌', label: 'オーロラ' },
  fall: { icon: '⚠️', label: '柵のない道' },
  drop: { icon: '🪨', label: '落下物' },
} satisfies Record<string, BadgeDef>;
