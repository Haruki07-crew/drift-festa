import { describe, expect, it } from 'vitest';
import { getCarSpec } from '../src/config/cars';
import { getCourseDef, type CourseDef } from '../src/config/courses';
import { gimmickConfig, type GimmickDef } from '../src/config/gimmicks';
import { physicsConfig } from '../src/config/physics';
import { Track } from '../src/courses/Track';
import { GimmickSystem } from '../src/gimmicks/GimmickSystem';
import { buildRaceCars } from '../src/game/RaceSetup';
import { RaceWorld } from '../src/game/RaceWorld';
import { TrackCollision } from '../src/physics/TrackCollision';
import { VehicleBody } from '../src/physics/VehicleBody';
import { stepVehicle } from '../src/physics/VehiclePhysics';
import { createControls } from '../src/vehicles/VehicleControls';

const dt = physicsConfig.fixedTimeStep;

/** aurora の形でギミックだけ差し替えたテスト用コース */
function courseWith(gimmicks: GimmickDef[]): Track {
  const def: CourseDef = { ...getCourseDef('aurora'), gimmicks };
  return Track.build(def);
}

function carAt(track: Track, s: number, lateral = 0, speed = 30): VehicleBody {
  const b = new VehicleBody(getCarSpec('apex86'));
  const p = track.worldAt(s, lateral);
  b.place(p.x, p.y, p.z, Math.atan2(p.tx, p.tz));
  b.trackHint = track.sampleIndexAt(s);
  b.vx = p.tx * speed;
  b.vz = p.tz * speed;
  return b;
}

describe('speed gate', () => {
  it('boosts more than a boost pad and is seekable by NPCs', () => {
    const track = courseWith([{ type: 'speedGate', at: 0.05, lateral: 0 }]);
    const gs = new GimmickSystem(track);
    expect(gs.pads).toHaveLength(1);
    expect(gs.pads[0]!.kind).toBe('gate');
    const b = carAt(track, gs.pads[0]!.s, 0, 30);
    const col = new TrackCollision(track);
    col.resolve(b);
    gs.applyToBody(b, dt);
    expect(b.padBoostTimer).toBeCloseTo(gimmickConfig.speedGate.duration, 5);
    expect(b.boostMaxSpeedMul).toBe(gimmickConfig.speedGate.maxSpeedMul);
    expect(gimmickConfig.speedGate.maxSpeedMul).toBeGreaterThan(gimmickConfig.boostPad.maxSpeedMul);
    expect(gs.padAhead(gs.pads[0]!.s - 30, 8, 70)?.pad.kind).toBe('gate');
  });
});

describe('falling object (drop)', () => {
  const track = courseWith([
    { type: 'obstacle', at: 0.1, motion: { kind: 'drop', laterals: [-3, 3], period: 8 }, length: 3, width: 3, height: 2.5, style: 'rock' },
  ]);
  const gs = new GimmickSystem(track);
  const o = gs.obstacles[0]!;
  const d = gimmickConfig.drop;

  it('warns before falling, blocks while resting, then disappears', () => {
    const warn = o.stateAt(0.2);
    expect(warn.warn).toBe(true);
    expect(warn.active).toBe(false);
    const rest = o.stateAt(d.warnSeconds + d.fallSeconds + 0.5);
    expect(rest.active).toBe(true);
    expect(rest.lift).toBe(0);
    const gone = o.stateAt(d.warnSeconds + d.fallSeconds + d.restSeconds + 0.3);
    expect(gone.active).toBe(false);
    expect(gone.shown).toBe(false);
  });

  it('falls at the listed lateral positions in turn (deterministic)', () => {
    expect(o.stateAt(1).lateral).toBe(-3);
    expect(o.stateAt(9).lateral).toBe(3);
    expect(o.stateAt(17).lateral).toBe(-3);
  });

  it('NPC advice avoids the predicted resting position', () => {
    // 落ちてくる直前に近づく → 到達時刻には道路にある → 避ける
    gs.time = d.warnSeconds * 0.5;
    const adv = { lateral: null as number | null, speedCap: Infinity, obstacle: null as unknown as null };
    gs.adviseObstacles(o.s - 40, 30, -3, 6, 1, adv);
    expect(adv.obstacle).not.toBeNull();
    expect(adv.lateral === null || Math.abs(adv.lateral - -3) > 2).toBe(true);
  });
});

describe('drawbridge', () => {
  const track = courseWith([{ type: 'drawbridge', from: 0.2, to: 0.23, lateralMin: -8, lateralMax: 0, period: 20, openFraction: 0.2 }]);
  const gs = new GimmickSystem(track);
  const bridge = gs.drawbridges[0]!;
  const mid = bridge.s + bridge.len / 2;

  it('the gate closes before the bridge lifts and opens after it lowers', () => {
    const cfg = gimmickConfig.drawbridge;
    const period = bridge.period;
    const liftStart = period * (1 - bridge.openFraction);
    // 橋が上がり始めるより gateLeadSeconds 以上前に遮断機が閉まっている
    const tBefore = liftStart - cfg.gateLeadSeconds + 0.4;
    expect(gs.drawbridgeLift(bridge, tBefore)).toBe(0);
    expect(bridge.gate.stateAt(tBefore).active).toBe(true);
    // 橋が上がっている間は閉まっている
    for (let t = liftStart; t < period; t += 0.5) {
      if (gs.drawbridgeLift(bridge, t) > 0.05) expect(bridge.gate.stateAt(t).active).toBe(true);
    }
    // 橋が下りて少しすると開く
    expect(bridge.gate.stateAt(period + cfg.gateLagSeconds + 0.5).active).toBe(false);
    expect(gs.drawbridgeLift(bridge, period * 0.3)).toBe(0);
  });

  it('the bridge lane is a gap only while lifted, other lane always open', () => {
    const liftedT = bridge.period * (1 - bridge.openFraction / 2);
    expect(gs.isDynamicGap(mid, -4, liftedT)).toBe(true);
    expect(gs.isDynamicGap(mid, 4, liftedT)).toBe(false);
    expect(gs.isDynamicGap(mid, -4, bridge.period * 0.3)).toBe(false);
  });
});

describe('moving platform', () => {
  const track = courseWith([{ type: 'platform', from: 0.3, to: 0.33, width: 8, amplitude: 4, period: 6 }]);
  const gs = new GimmickSystem(track);
  const z = gs.platforms[0]!;
  const mid = z.s + z.len / 2;

  it('only the platform is drivable, and it carries the car sideways', () => {
    const t = 1.5; // 中心 = +4 付近
    const c = gs.platformCenter(z, t);
    expect(gs.isDynamicGap(mid, c, t)).toBe(false);
    expect(gs.isDynamicGap(mid, c + z.halfWidth + 1, t)).toBe(true);
    gs.time = 0.2;
    const b = carAt(track, mid, gs.platformCenter(z, 0.2), 10);
    const col = new TrackCollision(track);
    col.resolve(b);
    const x0 = b.x;
    const z0 = b.z;
    gs.time += dt;
    gs.applyToBody(b, dt);
    expect(Math.hypot(b.x - x0, b.z - z0)).toBeGreaterThan(0);
  });

  it('NPC advice predicts the platform position at arrival', () => {
    gs.time = 0;
    const exact = gs.platformAhead(z.s - 40, 20, 1)!;
    const naive = gs.platformAhead(z.s - 40, 20, 0)!;
    expect(exact.center).toBeCloseTo(gs.platformCenter(z, 2), 5);
    expect(naive.center).toBeCloseTo(gs.platformCenter(z, 0), 5);
  });

  it('a car driving off the platform falls', () => {
    const t = 1.5;
    gs.time = t;
    const col = new TrackCollision(track);
    col.dynamicGap = (s, lat) => gs.isDynamicGap(s, lat);
    const b = carAt(track, mid, gs.platformCenter(z, t) - z.halfWidth - 2, 10);
    col.resolve(b);
    expect(b.airborne).toBe(true);
    expect(b.airMode).toBe('fall');
  });
});

describe('splash and tunnel speed', () => {
  it('a periodic wave slows cars only while it is on the road', () => {
    const track = courseWith([{ type: 'splash', from: 0.4, to: 0.45, period: 10, activeFraction: 0.3 }]);
    const gs = new GimmickSystem(track);
    const z = gs.splashes[0]!;
    const b = carAt(track, z.s + 10);
    new TrackCollision(track).resolve(b);
    gs.time = 1; // 波の中
    gs.applyToBody(b, dt);
    expect(b.zoneDrag).toBeGreaterThan(0);
    expect(b.zoneGripMul).toBeLessThan(1);
    gs.time = 5; // 波が引いている
    gs.applyToBody(b, dt);
    expect(b.zoneDrag).toBe(0);
    expect(gs.splashPhase(z, 9.5)).toBe('warn');
  });

  it('a speed tunnel raises the top speed inside', () => {
    const track = courseWith([{ type: 'tunnel', from: 0.5, to: 0.6, style: 'city', speedBonus: 0.06 }]);
    const gs = new GimmickSystem(track);
    const b = carAt(track, track.fracToS(0.55));
    new TrackCollision(track).resolve(b);
    const before = b.maxSpeed;
    gs.applyToBody(b, dt);
    expect(b.maxSpeed).toBeCloseTo(before * 1.06, 5);
  });
});

describe('slipstream', () => {
  it('a car right behind another gains top speed; a car alone does not (same for NPC and human)', () => {
    const track = courseWith([]);
    const cars = buildRaceCars({ mode: 'pure', courseId: 'aurora', humanCarIds: ['apex86'], totalCars: 3, difficulty: 'normal' }, track, () => 0.5);
    const world = new RaceWorld(track, cars);
    world.startRace();
    const [a, b, c] = cars;
    const s = track.fracToS(0.02);
    world.placeCarAt(a!, s + 12, 0);
    world.placeCarAt(b!, s, 0);
    world.placeCarAt(c!, s + 200, 5);
    for (const car of cars) {
      const p = track.pointAt(car.body.trackS);
      car.body.vx = p.tx * 40;
      car.body.vz = p.tz * 40;
    }
    for (let i = 0; i < 120; i++) {
      for (const car of cars) {
        car.body.vx = Math.sin(car.body.heading) * 40;
        car.body.vz = Math.cos(car.body.heading) * 40;
        car.body.forwardSpeed = 40;
      }
      (world as unknown as { applySlipstream(dt: number): void }).applySlipstream(dt);
    }
    expect(b!.body.draft).toBeGreaterThan(0.5);
    expect(c!.body.draft).toBe(0);
    expect(a!.body.draft).toBe(0);
  });

  it('draft effect is bounded by config (no unfair boost)', () => {
    const cfg = gimmickConfig.slipstream;
    expect(cfg.maxSpeedBonus).toBeLessThanOrEqual(0.1);
    // stepVehicle は zone 値を使う: draft が 0 なら通常の最高速度
    const track = courseWith([]);
    const b = carAt(track, 100, 0, 0);
    const col = new TrackCollision(track);
    const ctrl = createControls();
    ctrl.throttle = 1;
    for (let i = 0; i < 120 * 30; i++) {
      stepVehicle(b, ctrl, dt);
      col.resolve(b);
    }
    expect(b.speed).toBeLessThanOrEqual(b.maxSpeed + 0.5);
  });
});
