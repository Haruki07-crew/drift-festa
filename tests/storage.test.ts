import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, StorageManager, sanitizeSaveData, type StorageBackend } from '../src/storage/StorageManager';

class FakeStorage implements StorageBackend {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe('StorageManager', () => {
  it('uses defaults when empty and persists settings', () => {
    const fs = new FakeStorage();
    const s = new StorageManager(fs);
    expect(s.settings.theme).toBe('arcade');
    s.updateSettings({ seVolume: 0.3, theme: 'neon', graphicsQuality: 'low' });
    const s2 = new StorageManager(fs);
    expect(s2.settings.seVolume).toBe(0.3);
    expect(s2.settings.theme).toBe('neon');
    expect(s2.settings.graphicsQuality).toBe('low');
  });

  it('records best times only when improved', () => {
    const fs = new FakeStorage();
    const s = new StorageManager(fs);
    expect(s.submitResult('aurora', 'apex86', 120, 38)).toEqual({ newRaceRecord: true, newLapRecord: true });
    expect(s.submitResult('aurora', 'neonfox', 130, 37)).toEqual({ newRaceRecord: false, newLapRecord: true });
    const s2 = new StorageManager(fs);
    expect(s2.getBest('aurora')).toEqual({ raceTime: 120, raceCarId: 'apex86', bestLap: 37, bestLapCarId: 'neonfox' });
  });

  it('survives corrupted data', () => {
    const fs = new FakeStorage();
    fs.setItem(STORAGE_KEY, '{not json');
    const s = new StorageManager(fs);
    expect(s.settings.seVolume).toBeGreaterThan(0);
  });

  it('sanitizes invalid values', () => {
    const d = sanitizeSaveData({ settings: { seVolume: 9, theme: 'xxx', cameraShake: 'yes' }, prefs: { pureTotalCars: 50 } });
    expect(d.settings.seVolume).toBe(1);
    expect(d.settings.theme).toBe('arcade');
    expect(d.settings.cameraShake).toBe(true);
    expect(d.prefs.pureTotalCars).toBe(8);
  });

  it('stores player prefs', () => {
    const fs = new FakeStorage();
    const s = new StorageManager(fs);
    s.updatePrefs({ carIds: ['titangt', 'flashrs'], difficulty: 'strong' });
    const s2 = new StorageManager(fs);
    expect(s2.prefs.carIds).toEqual(['titangt', 'flashrs']);
    expect(s2.prefs.difficulty).toBe('strong');
  });
});
