import { describe, expect, it } from 'vitest';
import { COURSES } from '../src/config/courses';
import { CARS } from '../src/config/cars';
import { NPC_DIFFICULTIES, npcConfig } from '../src/config/npc';
import { generateCoursePatterns, generateNpcPatterns, selectNpcPatterns } from '../src/npc/NpcPatterns';
import { SeededRandom } from '../src/core/math';

describe('NPC patterns', () => {
  it('generates 30 patterns per difficulty, 120 per course with unique ids', () => {
    expect(NPC_DIFFICULTIES).toEqual(['weak', 'normal', 'strong', 'ultimate']);
    const all = COURSES.flatMap((c) => generateCoursePatterns(c));
    for (const c of COURSES) expect(generateCoursePatterns(c).length).toBe(120);
    expect(all.length).toBe(COURSES.length * 120);
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

  it('ultimate is stronger than strong only through driving skill', () => {
    for (const c of COURSES) {
      const avg = (d: 'strong' | 'ultimate', k: 'cornerSpeedFactor' | 'reactionTime' | 'mistakeRatePerMinute' | 'steeringNoise' | 'brakingFactor') => {
        const ps = generateNpcPatterns(c, d);
        return ps.reduce((sum, p) => sum + p[k], 0) / ps.length;
      };
      expect(avg('ultimate', 'cornerSpeedFactor')).toBeGreaterThan(avg('strong', 'cornerSpeedFactor'));
      expect(avg('ultimate', 'brakingFactor')).toBeGreaterThan(avg('strong', 'brakingFactor'));
      expect(avg('ultimate', 'reactionTime')).toBeLessThan(avg('strong', 'reactionTime'));
      expect(avg('ultimate', 'steeringNoise')).toBeLessThan(avg('strong', 'steeringNoise'));
      expect(avg('ultimate', 'mistakeRatePerMinute')).toBeLessThan(avg('strong', 'mistakeRatePerMinute'));
      for (const p of generateNpcPatterns(c, 'ultimate')) {
        // 完全無欠ではない (ごく小さな誤差を残す) / 車の性能を超えない
        expect(p.mistakeRatePerMinute).toBeGreaterThan(0);
        expect(p.steeringNoise).toBeGreaterThan(0);
        expect(p.cornerSpeedFactor).toBeLessThanOrEqual(1);
        expect(p.straightSpeedFactor).toBeLessThanOrEqual(1);
        expect(p.id).toMatch(new RegExp(`^${c.idPrefix}_ULTIMATE_\\d{3}$`));
      }
    }
  });

  it('selects the requested number without duplicates', () => {
    const rng = new SeededRandom(7);
    for (let n = 1; n <= 7; n++) {
      for (const d of NPC_DIFFICULTIES) {
        const sel = selectNpcPatterns(COURSES[2]!, d, n, () => rng.next());
        expect(sel.length).toBe(n);
        expect(new Set(sel.map((p) => p.id)).size).toBe(n);
        expect(sel.every((p) => p.difficulty === d)).toBe(true);
      }
    }
  });
});
