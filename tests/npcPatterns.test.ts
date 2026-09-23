import { describe, expect, it } from 'vitest';
import { COURSES } from '../src/config/courses';
import { CARS } from '../src/config/cars';
import { NPC_DIFFICULTIES, npcConfig } from '../src/config/npc';
import { generateCoursePatterns, generateNpcPatterns, selectNpcPatterns } from '../src/npc/NpcPatterns';
import { SeededRandom } from '../src/core/math';

describe('NPC patterns', () => {
  it('generates 30 patterns per difficulty, 90 per course, 270 total with unique ids', () => {
    const all = COURSES.flatMap((c) => generateCoursePatterns(c));
    expect(all.length).toBe(COURSES.length * 90);
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const c of COURSES) {
      for (const d of NPC_DIFFICULTIES) {
        const ps = generateNpcPatterns(c, d);
        expect(ps.length).toBe(30);
        for (const p of ps) {
          expect(p.id).toMatch(new RegExp(`^${c.idPrefix}_${d.toUpperCase()}_\\d{3}$`));
          expect(CARS.some((car) => car.id === p.carId)).toBe(true);
        }
      }
    }
  });

  it('is deterministic', () => {
    const a = generateNpcPatterns(COURSES[1]!, 'strong');
    const b = generateNpcPatterns(COURSES[1]!, 'strong');
    expect(a).toEqual(b);
    expect(a[16]!.id).toBe('TOUGE_STRONG_017');
  });

  it('difficulty is expressed by driving skill ranges, strong > weak', () => {
    const c = COURSES[0]!;
    const avg = (d: 'weak' | 'strong', k: 'cornerSpeedFactor' | 'reactionTime' | 'mistakeRatePerMinute') => {
      const ps = generateNpcPatterns(c, d);
      return ps.reduce((s, p) => s + p[k], 0) / ps.length;
    };
    expect(avg('strong', 'cornerSpeedFactor')).toBeGreaterThan(avg('weak', 'cornerSpeedFactor'));
    expect(avg('strong', 'reactionTime')).toBeLessThan(avg('weak', 'reactionTime'));
    expect(avg('strong', 'mistakeRatePerMinute')).toBeLessThan(avg('weak', 'mistakeRatePerMinute'));
    expect(npcConfig.difficulties.strong.cornerSpeedFactor.max).toBeLessThanOrEqual(1);
  });

  it('selects the requested number without duplicates', () => {
    const rng = new SeededRandom(7);
    for (let n = 1; n <= 7; n++) {
      const sel = selectNpcPatterns(COURSES[2]!, 'normal', n, () => rng.next());
      expect(sel.length).toBe(n);
      expect(new Set(sel.map((p) => p.id)).size).toBe(n);
      expect(sel.every((p) => p.difficulty === 'normal')).toBe(true);
    }
  });
});
