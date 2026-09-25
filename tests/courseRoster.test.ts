import { describe, expect, it } from 'vitest';
import { COURSES, getCourseDef } from '../src/config/courses';
import { courseBadges, courseSummary, formatApproxTime } from '../src/courses/CourseInfo';
import { RoadCorridor, drivableExtent } from '../src/courses/RoadClearance';
import { Track } from '../src/courses/Track';

const POINT_TO_POINT = ['tokyo', 'alpine', 'coastal', 'desert', 'northern', 'europe'];
const NEW_CIRCUITS = ['airport', 'volcano', 'mall', 'school', 'cloud', 'space', 'rain', 'windfarm'];

describe('course roster (v3)', () => {
  it('has 24 courses: 6 point-to-point and 18 circuits', () => {
    expect(COURSES).toHaveLength(24);
    expect(COURSES.filter((c) => c.raceType === 'pointToPoint').map((c) => c.id).sort()).toEqual([...POINT_TO_POINT].sort());
    expect(COURSES.filter((c) => c.raceType === 'circuit')).toHaveLength(18);
    for (const id of NEW_CIRCUITS) expect(getCourseDef(id).raceType).toBe('circuit');
  });

  it('rates stars 1..5 with 2 stars the most common', () => {
    const count = [0, 0, 0, 0, 0, 0];
    for (const c of COURSES) {
      expect(c.difficultyStars).toBeGreaterThanOrEqual(1);
      expect(c.difficultyStars).toBeLessThanOrEqual(5);
      count[c.difficultyStars]!++;
    }
    const most = Math.max(...count);
    expect(count[2]).toBe(most);
    expect(count.filter((n) => n === most)).toHaveLength(1);
  });

  it('every course has a highlight, tips and its own scenery', () => {
    const sceneries = new Set<string>();
    for (const c of COURSES) {
      expect(c.highlight, c.id).toBeTruthy();
      expect(c.tips, c.id).toBeTruthy();
      sceneries.add(c.environment.scenery);
    }
    expect(sceneries.size).toBe(COURSES.length);
  });

  it('point-to-point courses name each section and are long enough', () => {
    for (const id of POINT_TO_POINT) {
      const def = getCourseDef(id);
      const track = Track.build(def);
      expect(track.closed).toBe(false);
      expect(def.pointToPoint?.sectionNames?.length, id).toBe(def.checkpointCount);
      expect(track.raceLength, id).toBeGreaterThan(2500);
      // 始点と終点が離れている (周回路ではない)
      const a = track.samples[0]!;
      const b = track.samples[track.samples.length - 1]!;
      expect(Math.hypot(a.x - b.x, a.z - b.z), id).toBeGreaterThan(300);
    }
  });

  it('new courses use v3 gimmicks', () => {
    const types = (id: string) => new Set((getCourseDef(id).gimmicks ?? []).map((g) => g.type));
    expect(types('tokyo')).toContain('draftZone');
    expect(types('europe')).toContain('drawbridge');
    expect(types('cloud')).toContain('platform');
    expect(types('coastal')).toContain('splash');
    expect((getCourseDef('space').gimmicks ?? []).some((g) => g.type === 'surface' && g.surface === 'magnet')).toBe(true);
    expect((getCourseDef('rain').gimmicks ?? []).some((g) => g.type === 'surface' && g.surface === 'wet')).toBe(true);
    expect((getCourseDef('desert').gimmicks ?? []).some((g) => g.type === 'surface' && g.surface === 'sand')).toBe(true);
    expect((getCourseDef('alpine').gimmicks ?? []).some((g) => g.type === 'obstacle' && g.motion.kind === 'drop')).toBe(true);
    expect(getCourseDef('desert').environment.weather?.kind).toBe('sandstorm');
    expect(getCourseDef('northern').environment.weather?.kind).toBe('aurora');
  });
});

describe('course info for the select screen', () => {
  it('derives badges from gimmicks and environment', () => {
    const labels = courseBadges(getCourseDef('rain')).map((b) => b.label);
    expect(labels).toContain('夜');
    expect(labels).toContain('雨');
    expect(labels).toContain('濡れた路面');
    expect(labels).toContain('水しぶき');
  });

  it('estimates race time and distance', () => {
    const circuit = courseSummary(getCourseDef('aurora'));
    expect(circuit.laps).toBe(3);
    expect(circuit.totalDistance).toBeCloseTo(circuit.raceLength * 3, 3);
    const p2p = courseSummary(getCourseDef('tokyo'));
    expect(p2p.laps).toBe(1);
    expect(p2p.estimatedSeconds).toBeGreaterThan(60);
    expect(formatApproxTime(125)).toBe('約2分5秒');
    expect(formatApproxTime(40)).toBe('約40秒');
  });
});

describe('road safety corridor', () => {
  const track = Track.build(getCourseDef('touge'));
  const corridor = new RoadCorridor(track);
  const smp = track.samples[200]!;

  it('detects objects over the drivable area but not the road itself', () => {
    expect(corridor.test(smp.x, smp.y + 2, smp.z)).not.toBeNull();
    expect(corridor.test(smp.x, smp.y + 0.1, smp.z)).toBeNull();
    // 頭上高く (トンネルの天井・ゲートの梁) は対象外
    expect(corridor.test(smp.x, smp.y + 12, smp.z)).toBeNull();
    // 走れる範囲の外は対象外
    const ext = drivableExtent(track, smp, smp.right) + 3;
    expect(corridor.test(smp.x + smp.rx * ext, smp.y + 2, smp.z + smp.rz * ext)).toBeNull();
  });

  it('caps terrain below the road near every road section', () => {
    expect(corridor.terrainLimit(smp.x, smp.z)).toBeLessThan(smp.y);
    // 道路から遠い所は制限なし (または十分高い)
    expect(corridor.terrainLimit(smp.x + 2000, smp.z + 2000)).toBe(Infinity);
  });
});
