/**
 * ヘッドレス・レースシミュレーション (描画なし)。
 * NPC が全コース・全難易度で3周を完走できるか、スタック・落下・所要時間を確認する。
 *
 *   npm run sim                       全コース × 全難易度
 *   npm run sim -- touge strong 3     コース・難易度・試行回数を指定
 */
import { COURSES } from '../src/config/courses';
import { NPC_DIFFICULTIES, type NpcDifficulty } from '../src/config/npc';
import { physicsConfig } from '../src/config/physics';
import { Track } from '../src/courses/Track';
import { SeededRandom } from '../src/core/math';
import { formatRaceTime } from '../src/game/RaceProgress';
import { buildRaceCars } from '../src/game/RaceSetup';
import { RaceWorld } from '../src/game/RaceWorld';
import { computeIdealOffsets } from '../src/npc/RacingLine';

const [courseArg, diffArg, trialsArg] = process.argv.slice(2);
const courses = COURSES.filter((c) => !courseArg || c.id === courseArg);
const diffs = NPC_DIFFICULTIES.filter((d) => !diffArg || d === diffArg);
const trials = trialsArg ? Number(trialsArg) : 1;
const dt = physicsConfig.fixedTimeStep;
const MAX_TIME = 600;

let failures = 0;
for (const def of courses) {
  const track = Track.build(def);
  const t0 = performance.now();
  const ideal = computeIdealOffsets(track);
  const idealMs = performance.now() - t0;
  for (const diff of diffs) {
    for (let trial = 0; trial < trials; trial++) {
      const rng = new SeededRandom(1000 + trial);
      // 全車 NPC の 8 台 (人間の枠は NPC の車で代用するため、humanCarIds のダミーを後で NPC 化しない)
      const cars = buildRaceCars(
        { mode: 'pure', courseId: def.id, humanCarIds: ['apex86'], totalCars: 8, difficulty: diff as NpcDifficulty },
        track,
        () => rng.next(),
      ).filter((c) => c.kind === 'npc');
      cars.forEach((c, i) => ((c as { id: number }).id = i));
      let falls = 0;
      let wall = 0;
      const world = new RaceWorld(track, cars, {
        onFall: () => falls++,
        onWallImpact: () => wall++,
      }, ideal);
      world.startRace();
      const start = performance.now();
      while (world.time < MAX_TIME && !cars.every((c) => c.progress.finished)) {
        world.step(dt);
      }
      const ms = performance.now() - start;
      const finished = cars.filter((c) => c.progress.finished).length;
      const times = cars.map((c) => c.progress.finishTime ?? Infinity).sort((a, b) => a - b);
      const best = Math.min(...cars.map((c) => c.progress.bestLap ?? Infinity));
      const respawns = cars.reduce((s, c) => s + c.respawnCount, 0);
      if (finished < cars.length) failures++;
      console.log(
        `${def.id.padEnd(7)} ${diff.padEnd(6)} #${trial} finished ${finished}/${cars.length} ` +
          `win=${formatRaceTime(times[0]!)} last=${formatRaceTime(times[times.length - 1]!)} bestLap=${formatRaceTime(best)} ` +
          `falls=${falls} respawns=${respawns} wallHits=${wall} sim=${ms.toFixed(0)}ms (ideal ${idealMs.toFixed(0)}ms)`,
      );
      for (const c of cars) {
        if (!c.progress.finished) {
          console.log(`   DNF ${c.pattern?.id} car=${c.spec.id} lap=${c.progress.lap} s=${c.body.trackS.toFixed(0)} lat=${c.body.trackLateral.toFixed(1)} v=${c.body.speed.toFixed(1)} state=${c.npc?.debug.state}`);
        }
      }
    }
  }
}
if (failures > 0) process.exitCode = 1;
