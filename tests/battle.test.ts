import { describe, expect, it } from 'vitest';
import { perturbDirection, solveIntercept } from '../src/battle/PredictiveAim';
import { segmentSphere } from '../src/battle/BulletSystem';

describe('predictive aim', () => {
  it('aims directly at a stationary target', () => {
    const s = solveIntercept({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: 0 }, 150);
    expect(s.dir.z).toBeCloseTo(1);
    expect(s.time).toBeCloseTo(100 / 150);
  });

  it('leads a crossing target so that the bullet meets it', () => {
    const shooter = { x: 0, y: 0, z: 0 };
    const target = { x: 0, y: 0, z: 80 };
    const tv = { x: 30, y: 0, z: 0 };
    const u = 150;
    const s = solveIntercept(shooter, { x: 0, y: 0, z: 0 }, target, tv, u);
    expect(s.time).not.toBeNull();
    const t = s.time!;
    const bullet = { x: s.dir.x * u * t, z: s.dir.z * u * t };
    const tgt = { x: target.x + tv.x * t, z: target.z + tv.z * t };
    expect(Math.hypot(bullet.x - tgt.x, bullet.z - tgt.z)).toBeLessThan(0.01);
    expect(s.dir.x).toBeGreaterThan(0);
  });

  it('accounts for shooter velocity (bullet inertia)', () => {
    // 射手と目標が同じ速度で並走 → 相対的には静止しているので真っ直ぐ狙う
    const v = { x: 40, y: 0, z: 0 };
    const s = solveIntercept({ x: 0, y: 0, z: 0 }, v, { x: 0, y: 0, z: 60 }, v, 150);
    expect(s.dir.x).toBeCloseTo(0);
  });

  it('with accuracy 0 aims at the current position', () => {
    const s = solveIntercept({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 80 }, { x: 30, y: 0, z: 0 }, 150, 0);
    expect(s.dir.x).toBeCloseTo(0);
  });

  it('perturbs direction by the given angle', () => {
    const d = perturbDirection({ x: 0, y: 0, z: 1 }, 0.1, 0);
    expect(Math.atan2(d.x, d.z)).toBeCloseTo(0.1);
  });
});

describe('bullet hit test', () => {
  it('detects a fast bullet passing through a car (no tunneling)', () => {
    expect(segmentSphere(0, 1, -5, 0, 1, 5, 0, 1, 0, 1.7)).toBe(true);
    expect(segmentSphere(3, 1, -5, 3, 1, 5, 0, 1, 0, 1.7)).toBe(false);
  });
});

import { battleConfig } from '../src/config/battle';
import { NPC_DIFFICULTIES } from '../src/config/npc';

describe('battle AI difficulty config', () => {
  it('has all four difficulties and ultimate is the most precise (no forced hits)', () => {
    for (const d of NPC_DIFFICULTIES) expect(battleConfig.ai[d]).toBeDefined();
    const u = battleConfig.ai.ultimate;
    const s = battleConfig.ai.strong;
    expect(u.aimErrorRad).toBeLessThan(s.aimErrorRad);
    expect(u.aimErrorRad).toBeGreaterThan(0);
    expect(u.reactionTime).toBeLessThan(s.reactionTime);
    expect(u.predictionAccuracy).toBeGreaterThanOrEqual(s.predictionAccuracy);
    expect(u.conserveAmmoBelow).toBeGreaterThanOrEqual(s.conserveAmmoBelow);
    expect(u.seekItemsOnlyWhenNeeded).toBe(true);
  });
});
