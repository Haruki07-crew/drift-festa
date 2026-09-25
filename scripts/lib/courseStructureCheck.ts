/**
 * コース形状の構造チェック (npm run check:courses から使う)。
 *
 * - 周回コース: スタート = ゴールの閉じた周回路か、チェックポイントの順番と間隔
 * - Point to Point: 閉じていない (始点と終点が離れている)、START → 中間 CP → GOAL の順、
 *   助走路 (グリッド) と退避路 (ゴール後に止まれる長さ)
 * - 共通: 極端なカーブ・狭すぎる道・ジャンプの着地・NPC ラインの急な横移動
 */
import { CARS } from '../../src/config/cars';
import { courseQualityConfig } from '../../src/config/courseQuality';
import { gameConfig, raceTypeConfig } from '../../src/config/game';
import { gimmickConfig } from '../../src/config/gimmicks';
import { kmhToMs } from '../../src/core/math';
import type { Track } from '../../src/courses/Track';
import { computeIdealOffsets } from '../../src/npc/RacingLine';

export interface StructureIssue {
  level: 'NG' | 'WARN';
  message: string;
}

export function checkCourseStructure(track: Track): StructureIssue[] {
  const cfg = courseQualityConfig.structure;
  const def = track.def;
  const issues: StructureIssue[] = [];
  const ng = (message: string): void => void issues.push({ level: 'NG', message });
  const warn = (message: string): void => void issues.push({ level: 'WARN', message });
  const n = track.samples.length;

  // --- 種類ごとの構造 ---
  if (track.closed) {
    const a = track.samples[n - 1]!;
    const b = track.samples[0]!;
    const closeGap = Math.hypot(a.x - b.x, a.z - b.z);
    if (closeGap > track.spacing * 1.5) ng(`周回路が閉じていない (終点→始点 ${closeGap.toFixed(1)}m)`);
    if (track.isGap(0)) ng('スタートラインが道路のない区間にある');
  } else {
    const a = track.samples[0]!;
    const b = track.samples[n - 1]!;
    const endDist = Math.hypot(a.x - b.x, a.z - b.z);
    if (endDist < cfg.p2pMinEndDistance) warn(`Point to Point の始点と終点が近い (${endDist.toFixed(0)}m)。周回路にすべきでは?`);
    const g = gameConfig.grid;
    const gridLength = g.firstRowOffset + (Math.ceil(gameConfig.pureRace.maxCars / 2) - 1) * g.rowSpacing + g.rowSpacing * 0.35 + 6;
    if (track.startS < gridLength + raceTypeConfig.pointToPoint.endWallInset) {
      ng(`助走路が短い (スタートライン s=${track.startS.toFixed(0)}m < グリッド ${gridLength.toFixed(0)}m + 壁)`);
    }
    // ゴール後に最速の車が止まれるか (退避路)
    const fastest = Math.max(...CARS.map((c) => kmhToMs(c.maxSpeedKmh)));
    const weakestBrake = Math.min(...CARS.map((c) => c.brake));
    const stop = (fastest * fastest) / (2 * weakestBrake * raceTypeConfig.pointToPoint.finishBrake);
    const runout = track.length - track.goalS - raceTypeConfig.pointToPoint.endWallInset;
    if (runout < stop) warn(`退避路が短い (${runout.toFixed(0)}m < 最高速からの停止距離 ${stop.toFixed(0)}m)。壁に当たって止まる`);
    if (track.raceLength < raceTypeConfig.pointToPoint.minRaceLength) ng(`スタート〜ゴールが短すぎる (${track.raceLength.toFixed(0)}m)`);
    for (let s = 0; s < track.startS; s += track.spacing) if (track.isGap(s)) ng(`助走路に道路のない区間がある (s=${s.toFixed(0)})`);
    for (let s = track.goalS; s < track.length; s += track.spacing) if (track.isGap(s)) ng(`退避路に道路のない区間がある (s=${s.toFixed(0)})`);
  }

  // --- チェックポイント ---
  const cps = track.checkpoints;
  for (let i = 1; i < cps.length; i++) {
    if (!(cps[i]! > cps[i - 1]!)) ng(`チェックポイントの順番が不正 (#${i - 1} → #${i})`);
    if (cps[i]! - cps[i - 1]! > cfg.maxCheckpointSpacing) warn(`チェックポイント #${i - 1}→#${i} の間隔が広い (${(cps[i]! - cps[i - 1]!).toFixed(0)}m)`);
  }
  cps.forEach((s, i) => {
    if (track.isGap(s)) ng(`チェックポイント #${i} (s=${s.toFixed(0)}) が道路のない区間にある`);
  });
  if (!track.closed && Math.abs(cps[cps.length - 1]! - track.goalS) > 1e-6) ng('最後のチェックポイントがゴールラインではない');

  // --- カーブと道幅 ---
  let maxK = 0;
  let maxKAt = 0;
  let minW = Infinity;
  let minWAt = 0;
  for (const smp of track.samples) {
    if (Math.abs(smp.curvature) > maxK) {
      maxK = Math.abs(smp.curvature);
      maxKAt = smp.s;
    }
    if (!smp.gap && smp.halfWidth * 2 < minW) {
      minW = smp.halfWidth * 2;
      minWAt = smp.s;
    }
  }
  const minR = 1 / Math.max(1e-6, maxK);
  if (minR < cfg.minRadiusError) ng(`極端なカーブ (半径 ${minR.toFixed(1)}m @ s=${maxKAt.toFixed(0)})`);
  else if (minR < cfg.minRadiusWarn) warn(`急なカーブ (半径 ${minR.toFixed(1)}m @ s=${maxKAt.toFixed(0)})`);
  if (minW < cfg.minWidthError) ng(`道が狭すぎる (${minW.toFixed(1)}m @ s=${minWAt.toFixed(0)})`);
  else if (minW < cfg.minWidthWarn) warn(`道が狭い (${minW.toFixed(1)}m @ s=${minWAt.toFixed(0)})`);

  // --- ジャンプの着地 ---
  for (const g of track.gimmicks) {
    if (g.type !== 'jump' || !g.gap) continue;
    const landing = track.fracToS(g.at) + (g.length ?? gimmickConfig.jump.length) + 1 + g.gap;
    for (let d = 0; d < cfg.landingRunout; d += track.spacing) {
      const s = landing + d + track.spacing;
      if (!track.closed && s > track.length) {
        ng(`ジャンプ (at=${g.at}) の着地先に道がない`);
        break;
      }
      if (track.isGap(s)) {
        ng(`ジャンプ (at=${g.at}) の着地後 ${d.toFixed(0)}m に道路のない区間`);
        break;
      }
      const r = 1 / Math.max(1e-6, Math.abs(track.curvatureAt(s)));
      if (r < cfg.landingMinRadius) {
        warn(`ジャンプ (at=${g.at}) の着地直後に急カーブ (半径 ${r.toFixed(0)}m)`);
        break;
      }
    }
  }

  // --- NPC ライン ---
  const ideal = computeIdealOffsets(track);
  let maxRate = 0;
  let maxRateAt = 0;
  for (let i = 0; i < track.segmentCount; i++) {
    const rate = Math.abs(ideal[track.nextIndex(i)]! - ideal[i]!) / track.spacing;
    if (rate > maxRate) {
      maxRate = rate;
      maxRateAt = track.samples[i]!.s;
    }
  }
  if (maxRate > cfg.maxLineLateralRate) warn(`NPC の理想ラインが急に横移動する (${maxRate.toFixed(2)} m/m @ s=${maxRateAt.toFixed(0)})`);
  if (def.checkpointCount < 8) warn(`チェックポイントが少ない (${def.checkpointCount})`);
  return issues;
}
