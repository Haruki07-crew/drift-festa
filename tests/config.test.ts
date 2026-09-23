import { describe, expect, it } from 'vitest';
import { CARS, getCarSpec, normalizedStat, CAR_STAT_RANGES } from '../src/config/cars';
import { COURSES } from '../src/config/courses';
import { physicsConfig } from '../src/config/physics';
import { Track } from '../src/courses/Track';

describe('car config', () => {
  it('has 10 unique cars with all required stats', () => {
    expect(CARS.length).toBe(10);
    expect(new Set(CARS.map((c) => c.id)).size).toBe(10);
    expect(new Set(CARS.map((c) => c.name)).size).toBe(10);
    for (const c of CARS) {
      expect(['FF', 'FR', 'MR', 'AWD']).toContain(c.drivetrain);
      for (const k of ['maxSpeedKmh', 'accel', 'brake', 'grip', 'drift', 'mass', 'durability'] as const) {
        expect(Number.isFinite(c[k])).toBe(true);
        expect(c[k]).toBeGreaterThanOrEqual(CAR_STAT_RANGES[k].min);
        expect(c[k]).toBeLessThanOrEqual(CAR_STAT_RANGES[k].max);
      }
      expect(physicsConfig.drivetrains[c.drivetrain]).toBeDefined();
    }
    expect(getCarSpec('apex86').name).toBe('Apex 86');
    expect(() => getCarSpec('nope')).toThrow();
  });

  it('has no strictly dominant car', () => {
    const keys = ['maxSpeedKmh', 'accel', 'brake', 'grip', 'drift', 'durability'] as const;
    for (const a of CARS) {
      for (const b of CARS) {
        if (a === b) continue;
        const dominates = keys.every((k) => normalizedStat(a, k) >= normalizedStat(b, k));
        expect(dominates, `${a.name} dominates ${b.name}`).toBe(false);
      }
    }
  });

  it('includes every drivetrain', () => {
    const d = new Set(CARS.map((c) => c.drivetrain));
    expect(d).toEqual(new Set(['FF', 'FR', 'MR', 'AWD']));
  });
});

describe('course config', () => {
  it('has at least 3 courses and builds valid tracks', () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(3);
    for (const def of COURSES) {
      const t = Track.build(def);
      expect(t.length).toBeGreaterThan(500);
      expect(t.checkpoints.length).toBe(def.checkpointCount);
      expect(t.checkpoints[0]).toBe(0);
      for (const row of def.itemBoxes) {
        expect(row.at).toBeGreaterThanOrEqual(0);
        expect(row.at).toBeLessThan(1);
      }
    }
  });

  it('projects points onto the track', () => {
    const t = Track.build(COURSES[0]!);
    const s = t.samples[100]!;
    const p = t.project(s.x + s.rx * 3, s.z + s.rz * 3, undefined);
    expect(p.lateral).toBeCloseTo(3, 1);
    expect(Math.abs(t.deltaS(p.s, s.s))).toBeLessThan(0.5);
    const p2 = t.project(s.x - s.rx * 2, s.z - s.rz * 2, 95);
    expect(p2.lateral).toBeCloseTo(-2, 1);
  });

  it('computes wrapped distances', () => {
    const t = Track.build(COURSES[0]!);
    expect(t.deltaS(t.length - 5, 5)).toBeCloseTo(10);
    expect(t.deltaS(5, t.length - 5)).toBeCloseTo(-10);
  });
});
