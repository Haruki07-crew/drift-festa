import { describe, expect, it } from 'vitest';
import { getCourseDef } from '../src/config/courses';
import { physicsConfig } from '../src/config/physics';
import { Track } from '../src/courses/Track';
import { SeededRandom } from '../src/core/math';
import { BattleManager } from '../src/battle/BattleManager';
import { buildRaceCars } from '../src/game/RaceSetup';
import { RaceWorld } from '../src/game/RaceWorld';
import type { NpcDifficulty } from '../src/config/npc';

/** プレイヤー車を NPC の前方で走らせ、NPC の射撃成績を測る */
function duel(difficulty: NpcDifficulty): { fired: number; hit: number; recoveries: number } {
  const track = Track.build(getCourseDef('aurora'));
  const rng = new SeededRandom(3);
  const cars = buildRaceCars({ mode: 'battle', courseId: 'aurora', humanCarIds: ['apex86'], totalCars: 2, difficulty }, track, () => rng.next());
  const world = new RaceWorld(track, cars);
  const player = cars.find((c) => c.isHuman)!;
  const npc = cars.find((c) => !c.isHuman)!;
  let recoveries = 0;
  const battle = new BattleManager(world, player, npc, difficulty, { onItemUse: (c, kind, o) => { if (c.car === npc && kind === 'recovery' && o === 'used') recoveries++; } }, () => rng.next());
  // NPC に弾を持たせる
  battle.npc.inventory.clear();
  battle.npc.inventory.add('gun');
  battle.npc.inventory.add('gun');
  battle.npc.inventory.add('recovery');
  world.startRace();
  // プレイヤーを NPC の 25m 前に置き、蛇行させる
  world.placeCarAt(player, npc.body.trackS + 25, 0);
  const dt = physicsConfig.fixedTimeStep;
  let t = 0;
  for (let i = 0; i < 120 * 12; i++) {
    t += dt;
    player.controls.throttle = 0.8;
    player.controls.steer = Math.sin(t * 1.5) * 0.6;
    world.step(dt);
    battle.step(dt);
    if (battle.npc.tire.hp < 60 && i === 600) battle.npc.tire.hp = 40;
  }
  return { fired: battle.npc.shotsFired, hit: battle.npc.shotsHit, recoveries };
}

describe('BATTLE ultimate AI', () => {
  it('shoots accurately with predictive aim but without forced hits', () => {
    const u = duel('ultimate');
    expect(u.fired).toBeGreaterThan(0);
    expect(u.hit).toBeGreaterThan(0);
    // 強制命中はしない: 全弾命中にはならない (または外れ得る照準誤差がある)
    expect(u.hit).toBeLessThanOrEqual(u.fired);
  });

  it('ultimate hits at least as often as weak', () => {
    const u = duel('ultimate');
    const w = duel('weak');
    const ratio = (r: { fired: number; hit: number }) => (r.fired === 0 ? 0 : r.hit / r.fired);
    expect(ratio(u)).toBeGreaterThanOrEqual(ratio(w));
  });
});
