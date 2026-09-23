import { describe, expect, it } from 'vitest';
import { RaceProgress, computeGap, computeRanking, formatGap, formatRaceTime } from '../src/game/RaceProgress';

const L = 1000;
const N = 10;
const timing = { length: L, checkpoints: Array.from({ length: N }, (_, k) => (k * L) / N), laps: 3, maxStep: 30 };

/** s を from から to まで step 刻みで進める */
function drive(p: RaceProgress, from: number, to: number, t0: number, step = 2, dtPerStep = 0.05): number {
  let t = t0;
  for (let d = from; d <= to; d += step) {
    t += dtPerStep;
    p.update(((d % L) + L) % L, true, t);
  }
  return t;
}

describe('RaceProgress', () => {
  it('starts at lap 0 and enters lap 1 when crossing the start line', () => {
    const p = new RaceProgress(timing);
    p.update(L - 10, true, 0);
    expect(p.lap).toBe(0);
    drive(p, L - 10, L + 4, 0);
    expect(p.lap).toBe(1);
    expect(p.passed).toBe(1);
    expect(p.nextCheckpoint).toBe(1);
  });

  it('counts laps only when all checkpoints are passed in order and finishes after 3 laps', () => {
    const p = new RaceProgress(timing);
    p.update(L - 10, true, 0);
    const t = drive(p, L - 10, L * 4 + 5, 0);
    expect(p.finished).toBe(true);
    expect(p.lapTimes.length).toBe(3);
    expect(p.finishTime).not.toBeNull();
    expect(p.finishTime!).toBeLessThanOrEqual(t);
    expect(p.bestLap).not.toBeNull();
  });

  it('does not count a lap when going back and forth across the start line', () => {
    const p = new RaceProgress(timing);
    p.update(L - 10, true, 0);
    drive(p, L - 10, L + 10, 0);
    expect(p.lap).toBe(1);
    // 後退してスタートラインを戻り、再び前進
    for (let i = 0; i < 5; i++) {
      for (let d = 10; d >= -10; d -= 2) p.update(((d % L) + L) % L, true, 1);
      for (let d = -10; d <= 10; d += 2) p.update(((d % L) + L) % L, true, 1);
    }
    expect(p.lap).toBe(1);
    expect(p.lapTimes.length).toBe(0);
  });

  it('ignores reverse driving laps', () => {
    const p = new RaceProgress(timing);
    p.update(L - 10, true, 0);
    drive(p, L - 10, L + 10, 0);
    // 逆走で1周
    for (let d = 10; d >= -L; d -= 2) p.update(((d % L) + L) % L, true, 2);
    expect(p.lapTimes.length).toBe(0);
    expect(p.lap).toBe(1);
  });

  it('ignores a big jump (shortcut) and requires the skipped checkpoint', () => {
    const p = new RaceProgress(timing);
    p.update(L - 10, true, 0);
    drive(p, L - 10, L + 50, 0); // passed cp0, next = cp1 (s=100)
    p.update(400, true, 1); // ワープ (ショートカット)
    expect(p.nextCheckpoint).toBe(1);
    drive(p, 400, 990, 1);
    drive(p, 990, 1010, 2);
    expect(p.lapTimes.length).toBe(0);
  });

  it('does not count checkpoints while off track', () => {
    const p = new RaceProgress(timing);
    p.update(L - 10, true, 0);
    for (let d = L - 10; d <= L + 10; d += 2) p.update(d % L, false, 0.1);
    expect(p.lap).toBe(0);
  });
});

describe('ranking', () => {
  it('orders by lap, checkpoint and progress, finished first', () => {
    const a = new RaceProgress(timing);
    const b = new RaceProgress(timing);
    const c = new RaceProgress(timing);
    a.update(L - 10, true, 0);
    b.update(L - 10, true, 0);
    c.update(L - 10, true, 0);
    drive(a, L - 10, L + 150, 0);
    drive(b, L - 10, L + 120, 0);
    drive(c, L - 10, L + 350, 0);
    expect(computeRanking([
      { id: 0, progress: a },
      { id: 1, progress: b },
      { id: 2, progress: c },
    ])).toEqual([2, 0, 1]);
  });

  it('ranks by finish time for finished cars', () => {
    const a = new RaceProgress(timing);
    const b = new RaceProgress(timing);
    a.update(L - 10, true, 0);
    b.update(L - 10, true, 0);
    drive(a, L - 10, 4 * L + 5, 0, 2, 0.06);
    drive(b, L - 10, 4 * L + 5, 0, 2, 0.05);
    expect(computeRanking([
      { id: 0, progress: a },
      { id: 1, progress: b },
    ])).toEqual([1, 0]);
  });
});

describe('time gap', () => {
  it('computes the time since the car ahead passed my position', () => {
    const ahead = new RaceProgress(timing);
    const me = new RaceProgress(timing);
    ahead.update(L - 10, true, 0);
    me.update(L - 10, true, 0);
    // ahead は t=0..で s=0..200 を走る (0.05s / 2m)
    drive(ahead, L - 10, L + 200, 0);
    // me は同じ区間を 1.5 秒遅れて走り、s=100 まで
    drive(me, L - 10, L + 100, 1.5);
    const now = 1.5 + (110 / 2) * 0.05;
    const gap = computeGap(me, ahead, now);
    expect(gap).not.toBeNull();
    expect(gap!).toBeGreaterThan(1.2);
    expect(gap!).toBeLessThan(1.8);
    expect(formatGap(1.4234)).toBe('+1.42s');
    expect(formatGap(null)).toBe('--');
  });

  it('formats race time', () => {
    expect(formatRaceTime(83.456)).toBe('1:23.456');
    expect(formatRaceTime(5.1)).toBe('0:05.100');
    expect(formatRaceTime(null)).toBe('--:--.---');
  });
});
