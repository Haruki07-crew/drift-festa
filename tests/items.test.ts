import { describe, expect, it } from 'vitest';
import { Inventory, rollItem } from '../src/items/Inventory';
import { itemsConfig } from '../src/config/items';
import { TireHealth } from '../src/battle/TireHealth';
import { battleConfig, computeBulletDamage } from '../src/config/battle';
import { SeededRandom } from '../src/core/math';

describe('Inventory', () => {
  it('holds at most 3 items and refuses when full', () => {
    const inv = new Inventory();
    expect(inv.capacity).toBe(3);
    expect(inv.add('recovery')).toBe(true);
    expect(inv.add('boost')).toBe(true);
    expect(inv.add('gun')).toBe(true);
    expect(inv.isFull).toBe(true);
    expect(inv.add('boost')).toBe(false);
    expect(inv.slots.length).toBe(3);
  });

  it('gives 10 rounds per gun and removes empty gun', () => {
    const inv = new Inventory();
    inv.add('gun');
    expect(inv.totalAmmo).toBe(itemsConfig.gun.ammoPerPickup);
    for (let i = 0; i < 10; i++) expect(inv.consumeAmmo()).toBe(true);
    expect(inv.consumeAmmo()).toBe(false);
    expect(inv.count('gun')).toBe(0);
  });

  it('cycles selection and drops the selected item', () => {
    const inv = new Inventory();
    inv.add('recovery');
    inv.add('boost');
    inv.add('gun');
    inv.cycle(1);
    expect(inv.selectedSlot?.kind).toBe('boost');
    inv.cycle(-1);
    inv.cycle(-1);
    expect(inv.selectedSlot?.kind).toBe('gun');
    expect(inv.dropSelected()?.kind).toBe('gun');
    expect(inv.slots.map((s) => s.kind)).toEqual(['recovery', 'boost']);
    expect(inv.selected).toBe(1);
  });
});

describe('rollItem', () => {
  it('draws all items with equal probability by default', () => {
    const rng = new SeededRandom(42);
    const counts = { recovery: 0, boost: 0, gun: 0 };
    const n = 30000;
    for (let i = 0; i < n; i++) counts[rollItem(() => rng.next())]++;
    for (const k of Object.keys(counts) as (keyof typeof counts)[]) {
      expect(counts[k] / n).toBeGreaterThan(0.31);
      expect(counts[k] / n).toBeLessThan(0.356);
    }
  });

  it('respects custom weights', () => {
    const rng = new SeededRandom(1);
    for (let i = 0; i < 100; i++) {
      expect(rollItem(() => rng.next(), { recovery: 0, boost: 1, gun: 0 })).toBe('boost');
    }
  });
});

describe('TireHealth / damage', () => {
  it('starts at 100 and recovers fully', () => {
    const t = new TireHealth(5);
    expect(t.hp).toBe(100);
    expect(t.recover()).toBe(false);
    t.hitByBullet();
    expect(t.hp).toBeLessThan(100);
    expect(t.recover()).toBe(true);
    expect(t.hp).toBe(100);
  });

  it('reduces damage with durability', () => {
    expect(computeBulletDamage(1)).toBeCloseTo(battleConfig.gun.baseDamage);
    expect(computeBulletDamage(10)).toBeCloseTo(battleConfig.gun.baseDamage * (1 - battleConfig.gun.durabilityReduction));
    expect(computeBulletDamage(10)).toBeLessThan(computeBulletDamage(5));
  });

  it('becomes flat at 0 and never goes negative', () => {
    const t = new TireHealth(1);
    for (let i = 0; i < 50; i++) t.hitByBullet();
    expect(t.hp).toBe(0);
    expect(t.isFlat).toBe(true);
  });
});
