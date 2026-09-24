import { describe, expect, it } from 'vitest';
import { controlsConfig, drivingBindings } from '../src/config/controls';
import { InputManager } from '../src/input/InputManager';
import { PlayerController } from '../src/input/PlayerController';
import { createControls } from '../src/vehicles/VehicleControls';

describe('key bindings (v2)', () => {
  it('PURE RACE solo uses A/F/E/W + Space (not arrows)', () => {
    const b = drivingBindings('pure', 1, 0);
    expect(b.forward).toEqual(['KeyA']);
    expect(b.reverse).toEqual(['KeyF']);
    expect(b.right).toEqual(['KeyE']);
    expect(b.left).toEqual(['KeyW']);
    expect(b.drift).toEqual(['Space']);
    const all = [...b.forward, ...b.reverse, ...b.left, ...b.right];
    expect(all.some((k) => k.startsWith('Arrow'))).toBe(false);
  });

  it('PURE RACE 2P: P1 = A/F/E/W + Space, P2 = arrows + Enter', () => {
    const p1 = drivingBindings('pure', 2, 0);
    const p2 = drivingBindings('pure', 2, 1);
    expect(p1).toEqual(drivingBindings('pure', 1, 0));
    expect(p2.forward).toEqual(['ArrowUp']);
    expect(p2.reverse).toEqual(['ArrowDown']);
    expect(p2.right).toEqual(['ArrowRight']);
    expect(p2.left).toEqual(['ArrowLeft']);
    expect(p2.drift).toContain('Enter');
    // P1 と P2 のキーが重ならない
    const keys = (x: typeof p1) => [...x.forward, ...x.reverse, ...x.left, ...x.right, ...x.drift];
    expect(keys(p1).filter((k) => keys(p2).includes(k))).toEqual([]);
  });

  it('BATTLE DUEL uses A/F/E/W + Space, 4 to drop, mouse buttons', () => {
    const b = drivingBindings('battle', 1, 0);
    expect(b).toEqual(drivingBindings('pure', 1, 0));
    expect(controlsConfig.battle.dropItem).toContain('Digit4');
    expect(controlsConfig.battle.mouse).toEqual({ fire: 0, useItem: 1, centerAim: 2 });
  });

  it('PlayerController handles simultaneous keys of two players', () => {
    const input = new InputManager();
    const press = (code: string) => (input as unknown as { down: Set<string> }).down.add(code);
    press('KeyA');
    press('KeyE');
    press('Space');
    press('ArrowUp');
    press('ArrowLeft');
    press('Enter');
    const c1 = createControls();
    const c2 = createControls();
    new PlayerController(input, drivingBindings('pure', 2, 0)).read(c1);
    new PlayerController(input, drivingBindings('pure', 2, 1)).read(c2);
    expect(c1).toEqual({ throttle: 1, brake: 0, steer: 1, drift: true });
    expect(c2).toEqual({ throttle: 1, brake: 0, steer: -1, drift: true });
  });
});
