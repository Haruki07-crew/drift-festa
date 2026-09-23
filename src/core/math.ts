/** 汎用の数値ユーティリティ (Three.js 非依存。テスト可能) */

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

/** 角度を -PI..PI に正規化 */
export function wrapAngle(a: number): number {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  else if (r < -Math.PI) r += TAU;
  return r;
}

/** フレームレート非依存の指数減衰補間。rate [1/s] */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** 角度版 damp */
export function dampAngle(current: number, target: number, rate: number, dt: number): number {
  const diff = wrapAngle(target - current);
  return current + diff * (1 - Math.exp(-rate * dt));
}

/** current を target へ最大 maxDelta だけ近づける */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}

/**
 * シード付き疑似乱数 (mulberry32)。
 * NPCパターン生成など、同じシードで常に同じ結果が欲しい場面で使う。
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.pick: empty array');
    }
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** 平均0, 標準偏差1 の正規乱数 */
  gaussian(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
}

/** 文字列から32bitハッシュ (シード生成用) */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 配列から重複なしで n 個ランダムに選ぶ (Fisher-Yates) */
export function sampleWithoutReplacement<T>(items: readonly T[], n: number, random: () => number): T[] {
  const pool = items.slice();
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    const tmp = pool[i] as T;
    pool[i] = pool[j] as T;
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}
