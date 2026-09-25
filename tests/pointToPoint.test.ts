import { describe, expect, it } from 'vitest';
import { getCourseDef, type CourseDef } from '../src/config/courses';
import { raceTypeConfig } from '../src/config/game';
import { Track } from '../src/courses/Track';
import { RaceProgress, computeRanking } from '../src/game/RaceProgress';
import { courseTiming } from '../src/game/RaceSetup';

/** テスト用の S 字の一本道 (約 1.6km) */
function testRoad(): CourseDef {
  const base = getCourseDef('aurora');
  return {
    ...base,
    id: 'p2p-test',
    idPrefix: 'P2PTEST',
    raceType: 'pointToPoint',
    checkpointCount: 10,
    gimmicks: [],
    controlPoints: [
      { x: 0, z: 0, left: 'wall', right: 'wall' },
      { x: 0, z: 200 },
      { x: 60, z: 420 },
      { x: 0, z: 640 },
      { x: -60, z: 860 },
      { x: 0, z: 1080 },
      { x: 40, z: 1300 },
      { x: 0, z: 1520 },
    ],
  };
}

describe('Point to Point track', () => {
  const track = Track.build(testRoad());

  it('is an open road with start, goal, prelude and runout', () => {
    expect(track.closed).toBe(false);
    expect(track.startS).toBe(raceTypeConfig.pointToPoint.preludeLength);
    expect(track.goalS).toBeCloseTo(track.length - raceTypeConfig.pointToPoint.runoutLength, 6);
    expect(track.raceLength).toBeCloseTo(track.goalS - track.startS, 6);
    // 端点は制御点の最初と最後
    const first = track.samples[0]!;
    const last = track.samples[track.samples.length - 1]!;
    expect(first.x).toBeCloseTo(0, 3);
    expect(first.z).toBeCloseTo(0, 3);
    expect(last.x).toBeCloseTo(0, 3);
    expect(last.z).toBeCloseTo(1520, 3);
    expect(last.s).toBeCloseTo(track.length, 6);
  });

  it('places intermediate checkpoints between start and goal (goal is last)', () => {
    const cps = track.checkpoints;
    expect(cps.length).toBe(testRoad().checkpointCount + 1);
    expect(cps[0]).toBeCloseTo(track.startS, 6);
    expect(cps[cps.length - 1]).toBeCloseTo(track.goalS, 6);
    for (let i = 1; i < cps.length; i++) expect(cps[i]!).toBeGreaterThan(cps[i - 1]!);
  });

  it('does not wrap s around (no lap)', () => {
    expect(track.wrapS(-50)).toBe(0);
    expect(track.wrapS(track.length + 50)).toBe(track.length);
    expect(track.deltaS(track.length - 10, 10)).toBeCloseTo(-(track.length - 20), 6);
    expect(track.forwardDistance(100, 50)).toBe(-50);
  });

  it('projects beyond the ends onto the ends (no jump to the other end)', () => {
    const endHint = track.samples.length - 3;
    const beyond = track.project(0, 1560, endHint);
    expect(beyond.s).toBeGreaterThan(track.length - 5);
    const before = track.project(0, -30, 2);
    expect(before.s).toBeLessThan(5);
  });

  it('first and last segments do not connect (no closing segment)', () => {
    expect(track.hasSegment(track.samples.length - 1)).toBe(false);
    expect(track.nextIndex(track.samples.length - 1)).toBe(track.samples.length - 1);
    expect(track.segmentCount).toBe(track.samples.length - 1);
  });
});

describe('Point to Point progress', () => {
  const track = Track.build(testRoad());
  const timing = courseTiming(track);

  function drive(p: RaceProgress, from: number, to: number, t0: number, speed = 40): number {
    let t = t0;
    for (let s = from; s <= to; s += 1) {
      t += 1 / speed;
      p.update(s, true, t);
    }
    return t;
  }

  it('has no laps and finishes when passing the goal line after all checkpoints', () => {
    expect(timing.laps).toBe(1);
    const p = new RaceProgress(timing);
    p.teleport(track.startS - 20);
    const t = drive(p, track.startS - 20, track.goalS - 1, 0);
    expect(p.lap).toBe(1);
    expect(p.finished).toBe(false);
    drive(p, track.goalS - 1, track.goalS + 5, t);
    expect(p.finished).toBe(true);
    expect(p.finishTime).not.toBeNull();
    expect(p.completion).toBe(1);
  });

  it('does not finish when skipping checkpoints (teleport over the middle)', () => {
    const p = new RaceProgress(timing);
    p.teleport(track.startS - 5);
    drive(p, track.startS - 5, track.startS + 50, 0);
    // 途中を飛ばしてゴール前へ
    p.teleport(track.goalS - 3);
    drive(p, track.goalS - 3, track.goalS + 5, 10);
    expect(p.finished).toBe(false);
  });

  it('reports completion, remaining distance and section', () => {
    const p = new RaceProgress(timing);
    p.teleport(track.startS - 5);
    drive(p, track.startS - 5, track.startS + track.raceLength / 2, 0);
    expect(p.completion).toBeGreaterThan(0.45);
    expect(p.completion).toBeLessThan(0.55);
    expect(p.remainingDistance).toBeGreaterThan(track.raceLength * 0.45);
    expect(p.remainingDistance).toBeLessThan(track.raceLength * 0.55);
    expect(p.section).toBeGreaterThanOrEqual(5);
  });

  it('ranks cars by checkpoints and progress, finished cars first', () => {
    const a = new RaceProgress(timing);
    const b = new RaceProgress(timing);
    const c = new RaceProgress(timing);
    for (const p of [a, b, c]) p.teleport(track.startS - 5);
    drive(a, track.startS - 5, track.startS + 300, 0);
    drive(b, track.startS - 5, track.startS + 600, 0);
    drive(c, track.startS - 5, track.goalS + 2, 0);
    const order = computeRanking([
      { id: 0, progress: a },
      { id: 1, progress: b },
      { id: 2, progress: c },
    ]);
    expect(order).toEqual([2, 1, 0]);
  });
});
