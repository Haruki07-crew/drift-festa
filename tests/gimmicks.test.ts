import { describe, expect, it } from 'vitest';
import { COURSES, getCourseDef } from '../src/config/courses';
import { gimmickConfig } from '../src/config/gimmicks';
import { getCarSpec } from '../src/config/cars';
import { physicsConfig } from '../src/config/physics';
import { Track } from '../src/courses/Track';
import { GimmickSystem, chooseSide } from '../src/gimmicks/GimmickSystem';
import { TrackCollision } from '../src/physics/TrackCollision';
import { VehicleBody } from '../src/physics/VehicleBody';
import { stepVehicle } from '../src/physics/VehiclePhysics';
import { createControls } from '../src/vehicles/VehicleControls';

const dt = physicsConfig.fixedTimeStep;

function carOn(track: Track, frac: number, lateral = 0, speed = 30): VehicleBody {
  const b = new VehicleBody(getCarSpec('apex86'));
  const s = track.fracToS(frac);
  const p = track.worldAt(s, lateral);
  b.place(p.x, p.y, p.z, Math.atan2(p.tx, p.tz));
  b.trackHint = track.sampleIndexAt(s);
  b.vx = p.tx * speed;
  b.vz = p.tz * speed;
  return b;
}

describe('gimmick config for all courses', () => {
  it('every gimmick has valid positions and references', () => {
    for (const def of COURSES) {
      const track = Track.build(def);
      const gs = new GimmickSystem(track);
      for (const g of def.gimmicks ?? []) {
        if ('at' in g) {
          expect(g.at).toBeGreaterThanOrEqual(0);
          expect(g.at).toBeLessThan(1);
        }
        if ('from' in g) {
          expect(g.from).toBeGreaterThanOrEqual(0);
          expect(g.to).toBeLessThanOrEqual(1);
        }
        if (g.type === 'surface') expect(gimmickConfig.surfaces[g.surface]).toBeDefined();
      }
      for (const o of gs.obstacles) {
        // 障害物があっても必ずどこかは通れる (静止物・ゲートは道幅全体を塞がない)
        if (o.motion.kind === 'static' || o.motion.kind === 'gate') {
          expect(o.halfWidth * 2).toBeLessThan(o.roadHalfWidth * 2 - 3);
        }
      }
      // スタートラインは道路の切れ目ではない
      expect(track.samples[0]!.gap).toBe(false);
    }
  });

  it('the 7 new courses each have distinct gimmicks', () => {
    const kinds = (id: string) => new Set((getCourseDef(id).gimmicks ?? []).map((g) => g.type));
    expect(kinds('aqua')).toContain('transform');
    expect(kinds('aqua')).toContain('boostPad');
    expect(kinds('skyline')).toContain('jump');
    expect((getCourseDef('skyline').gimmicks ?? []).some((g) => g.type === 'surface' && g.surface === 'glass')).toBe(true);
    expect((getCourseDef('frost').gimmicks ?? []).some((g) => g.type === 'surface' && g.surface === 'ice')).toBe(true);
    expect(kinds('magma')).toContain('obstacle');
    expect(kinds('magma')).toContain('conveyor');
    expect(getCourseDef('neon').controlPoints.some((cp) => (cp.bank ?? 0) >= 45)).toBe(true);
    expect((getCourseDef('jungle').gimmicks ?? []).some((g) => g.type === 'surface' && g.surface === 'mud')).toBe(true);
    expect(kinds('toybox')).toContain('seesaw');
    expect(kinds('toybox')).toContain('wind');
  });
});

describe('surfaces', () => {
  it('ice has much lower grip than road and physics uses it', () => {
    expect(gimmickConfig.surfaces.ice.grip).toBeLessThan(gimmickConfig.surfaces.snow.grip);
    expect(gimmickConfig.surfaces.snow.grip).toBeLessThan(gimmickConfig.surfaces.road.grip);
    const make = (kind: 'road' | 'ice') => {
      const b = new VehicleBody(getCarSpec('apex86'));
      b.place(0, 0, 0, 0);
      b.vz = 30;
      b.surfaceKind = kind;
      const c = { ...createControls(), steer: 1, throttle: 1 };
      for (let t = 0; t < 0.8; t += dt) stepVehicle(b, c, dt);
      return b;
    };
    expect(Math.abs(make('ice').slipAngle)).toBeGreaterThan(Math.abs(make('road').slipAngle));
  });

  it('frost shortcut is ice only on the inside', () => {
    const track = Track.build(getCourseDef('frost'));
    const gs = new GimmickSystem(track);
    const s = track.fracToS(0.9);
    expect(gs.surfaceAt(s, 6)).toBe('ice');
    expect(gs.surfaceAt(s, -6)).not.toBe('ice');
  });
});

describe('boost pad / transform / jump', () => {
  it('boost pad gives a speed kick and a temporary max speed boost', () => {
    const track = Track.build(getCourseDef('aqua'));
    const gs = new GimmickSystem(track);
    const pad = gs.pads[0]!;
    const b = carOn(track, pad.s / track.length, pad.lateral, 20);
    const col = new TrackCollision(track);
    col.resolve(b);
    const before = b.maxSpeed;
    const v0 = b.speed;
    gs.applyToBody(b, dt);
    expect(b.padBoostTimer).toBeGreaterThan(0);
    expect(b.speed).toBeGreaterThan(v0);
    expect(b.maxSpeed).toBeGreaterThan(before);
  });

  it('underwater transform zone changes mode and handling', () => {
    const track = Track.build(getCourseDef('aqua'));
    const gs = new GimmickSystem(track);
    const b = carOn(track, 0.45);
    new TrackCollision(track).resolve(b);
    gs.applyToBody(b, dt);
    expect(b.transformMode).toBe('underwater');
    expect(gimmickConfig.transform.underwater.yawMul).toBeLessThan(1);
    const c = carOn(track, 0.1);
    new TrackCollision(track).resolve(c);
    gs.applyToBody(c, dt);
    expect(c.transformMode).toBeNull();
  });

  it('a fast car clears a jump gap and lands; a slow car falls and needs respawn', () => {
    const def = getCourseDef('skyline');
    const track = Track.build(def);
    const gs = new GimmickSystem(track);
    const jump = gs.jumps[0]!;
    const run = (speed: number, startS: number): VehicleBody => {
      const b = carOn(track, startS / track.length, 0, speed);
      const col = new TrackCollision(track);
      const c = { ...createControls(), throttle: speed > 20 ? 1 : 0 };
      for (let t = 0; t < 4 && !b.needsRespawn; t += dt) {
        stepVehicle(b, c, dt);
        col.resolve(b);
        gs.applyToBody(b, dt);
      }
      return b;
    };
    const fast = run(40, jump.s - 20);
    expect(fast.needsRespawn).toBe(false);
    expect(fast.airborne).toBe(false);
    expect(fast.trackS).toBeGreaterThan(jump.s + 20);
    // 低速で台を越えた直後から切れ目へ転がり込む
    const slow = run(5, jump.s + jump.len + 0.2);
    expect(slow.needsRespawn).toBe(true);
  });
});

describe('obstacles', () => {
  it('gates open and close on a fixed period with a warning before closing', () => {
    const track = Track.build(getCourseDef('magma'));
    const gs = new GimmickSystem(track);
    const gate = gs.obstacles.find((o) => o.motion.kind === 'gate')!;
    const m = gate.motion as { period: number; closedFraction: number };
    const states = [];
    for (let t = 0; t < m.period; t += 0.05) states.push(gate.stateAt(t));
    expect(states.some((s) => s.active)).toBe(true);
    expect(states.some((s) => !s.active)).toBe(true);
    expect(states.some((s) => s.warn)).toBe(true);
    // 周期的 (予測可能)
    expect(gate.stateAt(1.234).active).toBe(gate.stateAt(1.234 + m.period).active);
  });

  it('paired gates are never both closed at the same time', () => {
    const track = Track.build(getCourseDef('magma'));
    const gs = new GimmickSystem(track);
    const gates = gs.obstacles.filter((o) => o.motion.kind === 'gate');
    for (let t = 0; t < 10; t += 0.03) {
      const byS = new Map<number, number>();
      for (const g of gates) if (g.stateAt(t).active) byS.set(Math.round(g.s), (byS.get(Math.round(g.s)) ?? 0) + 1);
      for (const v of byS.values()) expect(v).toBeLessThan(2);
    }
  });

  it('pushes a car out and slows it without permanent damage', () => {
    const track = Track.build(getCourseDef('jungle'));
    const gs = new GimmickSystem(track);
    const log = gs.obstacles.find((o) => o.style === 'log')!;
    const b = carOn(track, (log.s - 1.5) / track.length, (log.motion as { lateral: number }).lateral, 25);
    new TrackCollision(track).resolve(b);
    gs.update(0);
    const v0 = b.speed;
    const hit = log.collide(b);
    expect(hit).toBeGreaterThan(0);
    expect(b.speed).toBeLessThan(v0);
    expect(b.maxSpeedMul).toBe(1);
  });

  it('NPC advice dodges an obstacle or slows down for a closed gate', () => {
    expect(chooseSide({ min: -2, max: 2 }, 0.5, 6)).toBe(2);
    expect(chooseSide({ min: -2, max: 2 }, -0.5, 6)).toBe(-2);
    expect(chooseSide({ min: -2, max: 2 }, 0.5, 6, -1)).toBe(-2);
    expect(chooseSide({ min: -7, max: 7 }, 0, 6)).toBeNull();
  });
});

describe('respawn safety', () => {
  it('never respawns inside a gap and keeps a runway before gap jumps', () => {
    for (const def of COURSES) {
      const track = Track.build(def);
      const gs = new GimmickSystem(track);
      for (const cp of track.checkpoints) {
        const s = gs.safeRespawnS(cp);
        expect(track.isGap(s)).toBe(false);
        for (const j of gs.jumps) {
          if (!gs.jumpHasGap(j)) continue;
          const ds = track.deltaS(s, j.s);
          expect(ds < 0 || ds >= gimmickConfig.jump.respawnRunway - 1 || ds > 200).toBe(true);
        }
      }
    }
  });

  it('seesaw height offset is zero at both ends', () => {
    const track = Track.build(getCourseDef('toybox'));
    const gs = new GimmickSystem(track);
    const z = gs.seesaws[0]!;
    for (const t of [0, 1.3, 2.7]) {
      expect(Math.abs(gs.heightOffsetAt(z.s + 0.01, t))).toBeLessThan(0.05);
      expect(Math.abs(gs.heightOffsetAt(z.s + z.len - 0.01, t))).toBeLessThan(0.05);
    }
  });
});
