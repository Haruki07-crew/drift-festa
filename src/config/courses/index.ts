/**
 * コース一覧。新しいコースはファイルを追加してこの配列に並べるだけで、
 * 選択画面・NPCパターン・チェックポイント・ミニマップ・ベストタイム保存まで自動で対応する。
 */
import { circuitAurora } from './aurora';
import { kageTouge } from './touge';
import { neoHarbor } from './harbor';
import { aquaShift } from './aqua';
import { skylineZero } from './skyline';
import { frostbitePass } from './frost';
import { magmaFactory } from './magma';
import { neonGravity } from './neon';
import { jungleTempleRun } from './jungle';
import { toyboxMayhem } from './toybox';
import type { CourseDef } from './types';

export * from './types';

export const COURSES: readonly CourseDef[] = [
  circuitAurora,
  kageTouge,
  neoHarbor,
  aquaShift,
  skylineZero,
  frostbitePass,
  magmaFactory,
  neonGravity,
  jungleTempleRun,
  toyboxMayhem,
];

export function getCourseDef(id: string): CourseDef {
  const def = COURSES.find((c) => c.id === id);
  if (!def) {
    throw new Error(`Unknown course id: ${id}`);
  }
  return def;
}

export function findCourseDef(id: string | undefined): CourseDef | undefined {
  return id === undefined ? undefined : COURSES.find((c) => c.id === id);
}
