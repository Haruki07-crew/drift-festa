import { describe, expect, it } from 'vitest';
import { getCarSpec } from '../src/config/cars';
import { physicsConfig } from '../src/config/physics';
import { kmhToMs } from '../src/core/math';
import { VehicleBody } from '../src/physics/VehicleBody';
import { stepVehicle } from '../src/physics/VehiclePhysics';
import { resolveCarCollisions, type CarContact } from '../src/physics/CarCollision';
import { createControls } from '../src/vehicles/VehicleControls';

const dt = physicsConfig.fixedTimeStep;

function run(body: VehicleBody, seconds: number, c = createControls()): void {
  for (let t = 0; t < seconds; t += dt) stepVehicle(body, c, dt);
}

function atSpeed(id: string, speed: number): VehicleBody {
  const b = new VehicleBody(getCarSpec(id));
  b.place(0, 0, 0, 0);
  b.vz = speed;
  return b;
}

describe('vehicle physics', () => {
  it('accelerates toward but not beyond max speed', () => {
    const b = new VehicleBody(getCarSpec('apex86'));
    b.place(0, 0, 0, 0);
    const c = createControls();
    c.throttle = 1;
    run(b, 60, c);
    const vmax = kmhToMs(b.spec.maxSpeedKmh);
    expect(b.forwardSpeed).toBeGreaterThan(vmax * 0.93);
    expect(b.forwardSpeed).toBeLessThanOrEqual(vmax * 1.001);
  });

  it('does not steer when stopped and brakes to a stop then reverses', () => {
    const b = new VehicleBody(getCarSpec('apex86'));
    b.place(0, 0, 0, 0);
    const c = createControls();
    c.steer = 1;
    run(b, 1, c);
    expect(Math.abs(b.heading)).toBeLessThan(1e-6);
    const m = atSpeed('apex86', 30);
    const brake = createControls();
    brake.brake = 1;
    run(m, 1.5, brake);
    expect(m.forwardSpeed).toBeLessThan(10);
    run(m, 4, brake);
    expect(m.forwardSpeed).toBeLessThan(0);
  });

  it('turns less at high speed for the same steering input', () => {
    const c = createControls();
    c.steer = 1;
    c.throttle = 0.5;
    const slow = atSpeed('apex86', 12);
    const fast = atSpeed('apex86', 50);
    stepVehicle(slow, c, dt);
    stepVehicle(fast, c, dt);
    run(slow, 0.5, c);
    run(fast, 0.5, c);
    const radius = (b: VehicleBody): number => b.speed / Math.max(1e-6, Math.abs(b.yawRate));
    expect(radius(fast)).toBeGreaterThan(radius(slow) * 2);
    // 右ステアで右へ曲がる (heading が減る)
    expect(slow.heading).toBeLessThan(0);
  });

  it('drift reduces lateral grip and creates a larger slip angle', () => {
    const c = createControls();
    c.steer = 1;
    c.throttle = 1;
    const grip = atSpeed('midnights', 28);
    run(grip, 0.8, c);
    const dc = { ...c, drift: true };
    const drift = atSpeed('midnights', 28);
    run(drift, 0.8, dc);
    expect(Math.abs(drift.slipAngle)).toBeGreaterThan(Math.abs(grip.slipAngle) + 0.05);
    expect(drift.currentGrip).toBeLessThan(grip.currentGrip);
  });

  it('drivetrain changes drift behaviour: FR slides more than AWD', () => {
    const c = { ...createControls(), steer: 1, throttle: 1, drift: true };
    const fr = atSpeed('apex86', 28);
    const awd = atSpeed('vortexr', 28);
    run(fr, 0.8, c);
    run(awd, 0.8, c);
    expect(Math.abs(fr.slipAngle)).toBeGreaterThan(Math.abs(awd.slipAngle));
  });

  it('ignores input while controls are locked (respawn)', () => {
    const b = new VehicleBody(getCarSpec('apex86'));
    b.place(0, 0, 0, 0);
    b.controlsLocked = true;
    run(b, 2, { ...createControls(), throttle: 1, steer: 1 });
    expect(b.speed).toBeLessThan(0.01);
  });

  it('heavier car pushes lighter car more, without launching it', () => {
    const heavy = new VehicleBody(getCarSpec('ironwolf'));
    const light = new VehicleBody(getCarSpec('flashrs'));
    heavy.place(0, 0, 0, Math.PI / 2);
    light.place(3.5, 0, 0, 0);
    heavy.vx = 20;
    const out: CarContact[] = [];
    for (let i = 0; i < 30; i++) {
      heavy.x += heavy.vx * dt;
      light.x += light.vx * dt;
      resolveCarCollisions([heavy, light], out);
    }
    expect(out.length).toBeGreaterThan(0);
    expect(light.vx).toBeGreaterThan(0);
    // 押した車より速く吹き飛ばされない
    expect(light.vx).toBeLessThanOrEqual(20 * (1 + physicsConfig.collision.carRestitution) + 1e-6);
    // 重い車はほとんど減速しない (軽い車の方が大きく押される)
    expect(20 - heavy.vx).toBeLessThan(light.vx);
  });
});
