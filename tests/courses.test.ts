import { describe, expect, it } from 'vitest';
import { COURSES } from '../src/config/courses';
import { NPC_DIFFICULTIES } from '../src/config/npc';
import { physicsConfig } from '../src/config/physics';
import { Track } from '../src/courses/Track';
import { SeededRandom } from '../src/core/math';
import { buildRaceCars } from '../src/game/RaceSetup';
import { RaceWorld } from '../src/game/RaceWorld';

describe('all courses', () => {
  it('have unique ids and prefixes and all load', () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(COURSES.map((c) => c.id)).size).toBe(COURSES.length);
    expect(new Set(COURSES.map((c) => c.idPrefix)).size).toBe(COURSES.length);
    for (const def of COURSES) {
      const track = Track.build(def);
      expect(track.length).toBeGreaterThan(1000);
      // Point to Point はゴールラインが最後のチェックポイントとして加わる
      expect(track.checkpoints.length).toBe(def.checkpointCount + (track.closed ? 0 : 1));
      expect(track.closed).toBe(def.raceType === 'circuit');
    }
  });

  // 各コースで NPC が完走できる (周回コースは3周、Point to Point はゴールまで。全難易度は npm run sim で確認)
  for (const def of COURSES) {
    it(`NPCs finish the race on ${def.id}`, () => {
      const track = Track.build(def);
      const rng = new SeededRandom(99);
      const difficulty = NPC_DIFFICULTIES[def.id.length % NPC_DIFFICULTIES.length]!;
      const cars = buildRaceCars({ mode: 'pure', courseId: def.id, humanCarIds: ['apex86'], totalCars: 4, difficulty }, track, () => rng.next())
        .filter((c) => c.kind === 'npc');
      cars.forEach((c, i) => ((c as { id: number }).id = i));
      const world = new RaceWorld(track, cars);
      world.startRace();
      const dt = physicsConfig.fixedTimeStep;
      while (world.time < 400 && !cars.every((c) => c.progress.finished)) world.step(dt);
      for (const c of cars) {
        expect(c.progress.finished, `${c.pattern?.id} lap=${c.progress.lap}`).toBe(true);
        expect(c.progress.lapTimes.length).toBe(track.closed ? 3 : 1);
      }
    }, 30000);
  }
});
