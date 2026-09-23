/**
 * レース開始時の設定と、出場車リストの生成。
 */
import { getCarSpec } from '../config/cars';
import { getCourseDef } from '../config/courses';
import { gameConfig, type RaceMode } from '../config/game';
import { physicsConfig } from '../config/physics';
import type { NpcDifficulty } from '../config/npc';
import type { Track } from '../courses/Track';
import { selectNpcPatterns } from '../npc/NpcPatterns';
import { RaceCar } from './RaceCar';
import type { CourseTiming } from './RaceProgress';

export interface RaceSetup {
  mode: RaceMode;
  courseId: string;
  /** 人間プレイヤーの車 (1〜2台。BATTLE DUEL は1台) */
  humanCarIds: string[];
  /** 総参加台数 (PURE RACE: 2〜8、BATTLE DUEL: 2) */
  totalCars: number;
  difficulty: NpcDifficulty;
}

export function courseTiming(track: Track): CourseTiming {
  return {
    length: track.length,
    checkpoints: track.checkpoints,
    laps: gameConfig.laps,
    maxStep: track.def.checkpointWindow,
  };
}

/** 設定値を仕様の範囲に収める */
export function normalizeSetup(setup: RaceSetup): RaceSetup {
  getCourseDef(setup.courseId);
  if (setup.mode === 'battle') {
    return { ...setup, humanCarIds: setup.humanCarIds.slice(0, 1), totalCars: 2 };
  }
  const cfg = gameConfig.pureRace;
  const humans = setup.humanCarIds.slice(0, cfg.maxPlayers);
  if (humans.length < cfg.minPlayers) {
    throw new Error('At least one human player is required');
  }
  const total = Math.min(cfg.maxCars, Math.max(cfg.minCars, humans.length, setup.totalCars));
  return { ...setup, humanCarIds: humans, totalCars: total };
}

/**
 * 出場車を生成する。並び順 = グリッド順 (NPC が前方、人間が後方)。
 * car.id は配列のインデックスと一致させる。
 */
export function buildRaceCars(setup: RaceSetup, track: Track, random: () => number = Math.random): RaceCar[] {
  const s = normalizeSetup(setup);
  const timing = courseTiming(track);
  const npcCount = s.totalCars - s.humanCarIds.length;
  const patterns = selectNpcPatterns(track.def, s.difficulty, npcCount, random);

  type Entry = { kind: 'human'; playerIndex: number; carId: string } | { kind: 'npc'; index: number };
  const entries: Entry[] = [];
  patterns.forEach((_, index) => entries.push({ kind: 'npc', index }));
  s.humanCarIds.forEach((carId, playerIndex) => entries.push({ kind: 'human', playerIndex, carId }));

  return entries.map((e, id) => {
    if (e.kind === 'human') {
      return new RaceCar({
        id,
        spec: getCarSpec(e.carId),
        kind: 'human',
        playerIndex: e.playerIndex,
        pattern: null,
        timing,
        displayName: s.humanCarIds.length > 1 ? `P${e.playerIndex + 1}` : 'YOU',
      });
    }
    const pattern = patterns[e.index]!;
    return new RaceCar({
      id,
      spec: getCarSpec(pattern.carId),
      kind: 'npc',
      playerIndex: -1,
      pattern,
      timing,
      displayName: `CPU${e.index + 1}`,
    });
  });
}

/** 復帰ロック時間 (HUD 表示用に参照) */
export const RESPAWN_LOCK_SECONDS = physicsConfig.respawn.lockSeconds;
