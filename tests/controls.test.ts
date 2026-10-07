import { describe, expect, it } from 'vitest';
import { DEFAULT_KEY_BINDINGS, controlsConfig, drivingBindings } from '../src/config/controls';
import { assignKey, defaultKeyBindings, keyLabel, sanitizeKeyBindings } from '../src/input/KeyBindings';
import { StorageManager } from '../src/storage/StorageManager';
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

describe('key settings (v3.1)', () => {
  it('defaults are the current layout (1P A/F/E/W + Space, 2P arrows + Enter)', () => {
    const d = defaultKeyBindings();
    expect(d).toEqual(DEFAULT_KEY_BINDINGS);
    expect(d.p1).toEqual(drivingBindings('pure', 1, 0));
    expect(d.p2).toEqual(drivingBindings('pure', 2, 1));
    expect(controlsConfig.keyBindings.resetOnFestivalStart).toBe(true);
  });

  it('assigns a free key to one action', () => {
    const r = assignKey(defaultKeyBindings(), 'p1', 'forward', 'KeyJ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bindings.p1.forward).toEqual(['KeyJ']);
    expect(r.swapped).toBeNull();
    expect(drivingBindings('pure', 1, 0, r.bindings).forward).toEqual(['KeyJ']);
    // BATTLE DUEL も 1P のキーを使う
    expect(drivingBindings('battle', 1, 0, r.bindings).forward).toEqual(['KeyJ']);
  });

  it('swaps when the key is already used (same player or the other player)', () => {
    const same = assignKey(defaultKeyBindings(), 'p1', 'forward', 'KeyF');
    expect(same.ok && same.bindings.p1.forward).toEqual(['KeyF']);
    expect(same.ok && same.bindings.p1.reverse).toEqual(['KeyA']);
    expect(same.ok && same.swapped).toEqual({ player: 'p1', action: 'reverse' });
    const other = assignKey(defaultKeyBindings(), 'p1', 'drift', 'ArrowUp');
    expect(other.ok && other.bindings.p1.drift).toEqual(['ArrowUp']);
    expect(other.ok && other.bindings.p2.forward).toEqual(['Space']);
  });

  it('a multi-key action keeps its other key when one key is taken', () => {
    // 2P のドリフトは Enter と テンキー Enter。Enter を 1P に取られてもテンキー Enter が残る
    const r = assignKey(defaultKeyBindings(), 'p1', 'drift', 'Enter');
    expect(r.ok && r.bindings.p2.drift).toEqual(['NumpadEnter']);
    expect(r.ok && r.bindings.p1.drift).toEqual(['Enter']);
  });

  it('rejects reserved keys (pause, debug, drop item)', () => {
    for (const code of ['Escape', 'F3', 'F6', 'Digit4', 'Tab']) {
      expect(assignKey(defaultKeyBindings(), 'p1', 'forward', code).ok).toBe(false);
    }
  });

  it('every key belongs to only one action after any assignment', () => {
    let b = defaultKeyBindings();
    const codes = ['KeyA', 'ArrowUp', 'Space', 'KeyF', 'Enter', 'KeyQ'];
    for (const code of codes) {
      for (const player of ['p1', 'p2'] as const) {
        const r = assignKey(b, player, 'left', code);
        if (r.ok) b = r.bindings;
        const all = [...Object.values(b.p1), ...Object.values(b.p2)].flat();
        expect(new Set(all).size).toBe(all.length);
        expect(Object.values(b.p1).every((k) => k.length > 0)).toBe(true);
        expect(Object.values(b.p2).every((k) => k.length > 0)).toBe(true);
      }
    }
  });

  it('broken or invalid saved key settings fall back to the defaults', () => {
    expect(sanitizeKeyBindings(undefined)).toEqual(DEFAULT_KEY_BINDINGS);
    expect(sanitizeKeyBindings({ p1: { forward: [] } })).toEqual(DEFAULT_KEY_BINDINGS);
    const dup = defaultKeyBindings();
    dup.p2.forward = ['KeyA'];
    expect(sanitizeKeyBindings(dup)).toEqual(DEFAULT_KEY_BINDINGS);
    const reserved = defaultKeyBindings();
    reserved.p1.forward = ['Escape'];
    expect(sanitizeKeyBindings(reserved)).toEqual(DEFAULT_KEY_BINDINGS);
    const custom = defaultKeyBindings();
    custom.p1.forward = ['KeyJ'];
    expect(sanitizeKeyBindings(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
  });

  it('is saved in settings and can be reset to the defaults', () => {
    const mem = new Map<string, string>();
    const backend = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const s1 = new StorageManager(backend);
    expect(s1.settings.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
    const r = assignKey(s1.settings.keyBindings, 'p2', 'drift', 'ShiftRight');
    if (r.ok) s1.updateSettings({ keyBindings: r.bindings });
    const s2 = new StorageManager(backend);
    expect(s2.settings.keyBindings.p2.drift).toEqual(['ShiftRight']);
    s2.resetKeyBindings();
    expect(new StorageManager(backend).settings.keyBindings).toEqual(DEFAULT_KEY_BINDINGS);
  });

  it('PlayerController drives with custom keys', () => {
    const input = new InputManager();
    (input as unknown as { down: Set<string> }).down.add('KeyJ');
    const r = assignKey(defaultKeyBindings(), 'p1', 'forward', 'KeyJ');
    if (!r.ok) throw new Error('assign failed');
    const c = createControls();
    new PlayerController(input, drivingBindings('pure', 1, 0, r.bindings)).read(c);
    expect(c.throttle).toBe(1);
  });

  it('shows readable key names', () => {
    expect(keyLabel('KeyA')).toBe('A');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('NumpadEnter')).toBe('テンキー Enter');
  });
});
