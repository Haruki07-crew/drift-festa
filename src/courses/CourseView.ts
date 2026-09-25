/**
 * コースの描画一式 (空・ライト・路面・壁・背景) をまとめて生成・破棄する。
 * 新しい背景の種類を追加する場合は SCENERY_BUILDERS に登録する。
 */
import * as THREE from 'three';
import type { SceneryKind } from '../config/courses';
import type { QualityPreset } from '../config/graphics';
import { ResourceBag, disposeObject } from '../render/dispose';
import { GimmickView } from '../gimmicks/GimmickView';
import type { GimmickSystem } from '../gimmicks/GimmickSystem';
import { buildAirportScenery } from './scenery/AirportScenery';
import { buildAlpineScenery } from './scenery/AlpineScenery';
import { buildAquaScenery } from './scenery/AquaScenery';
import { buildCircuitScenery } from './scenery/CircuitScenery';
import { buildCloudScenery } from './scenery/CloudScenery';
import { buildCoastalScenery } from './scenery/CoastalScenery';
import { buildDesertScenery } from './scenery/DesertScenery';
import { CourseEnvironment } from './scenery/Environment';
import { buildEuropeScenery } from './scenery/EuropeScenery';
import { buildFrostScenery } from './scenery/FrostScenery';
import { buildNightGuides } from './NightGuides';
import { buildRaceGates } from './RaceGates';
import { buildHarborScenery } from './scenery/HarborScenery';
import { buildJungleScenery } from './scenery/JungleScenery';
import { buildMagmaScenery } from './scenery/MagmaScenery';
import { buildMallScenery } from './scenery/MallScenery';
import { buildNeonScenery } from './scenery/NeonScenery';
import { buildNorthernScenery } from './scenery/NorthernScenery';
import { buildRainScenery } from './scenery/RainScenery';
import type { SceneryResult } from './scenery/SceneryUtils';
import { buildSchoolScenery } from './scenery/SchoolScenery';
import { buildSkylineScenery } from './scenery/SkylineScenery';
import { buildSpaceScenery } from './scenery/SpaceScenery';
import { buildTokyoScenery } from './scenery/TokyoScenery';
import { buildToyboxScenery } from './scenery/ToyboxScenery';
import { buildVolcanoScenery } from './scenery/VolcanoScenery';
import { buildWindfarmScenery } from './scenery/WindfarmScenery';
import { buildTougeScenery } from './scenery/TougeScenery';
import type { Track } from './Track';
import { buildTrackMeshes } from './TrackMeshBuilder';
import { Weather } from './Weather';

type SceneryBuilder = (track: Track, preset: QualityPreset, bag: ResourceBag) => THREE.Group | SceneryResult;

const SCENERY_BUILDERS: Record<SceneryKind, SceneryBuilder> = {
  circuit: buildCircuitScenery,
  touge: buildTougeScenery,
  harbor: buildHarborScenery,
  aqua: buildAquaScenery,
  skyline: buildSkylineScenery,
  frost: buildFrostScenery,
  magma: buildMagmaScenery,
  neon: buildNeonScenery,
  jungle: buildJungleScenery,
  toybox: buildToyboxScenery,
  tokyo: buildTokyoScenery,
  alpine: buildAlpineScenery,
  coastal: buildCoastalScenery,
  desert: buildDesertScenery,
  northern: buildNorthernScenery,
  europe: buildEuropeScenery,
  airport: buildAirportScenery,
  volcano: buildVolcanoScenery,
  mall: buildMallScenery,
  school: buildSchoolScenery,
  cloud: buildCloudScenery,
  space: buildSpaceScenery,
  rain: buildRainScenery,
  windfarm: buildWindfarmScenery,
};

export class CourseView {
  readonly environment: CourseEnvironment;
  private readonly root = new THREE.Group();
  private readonly bag = new ResourceBag();
  private readonly gimmickView: GimmickView;
  private readonly sceneryUpdate: ((dt: number) => void) | undefined;
  /** 天候 (雨・砂嵐・雪・オーロラ) */
  readonly weather: Weather;

  /** @param viewers 画面の数 (天候の粒子を画面ごとに出す) */
  constructor(track: Track, scene: THREE.Scene, preset: QualityPreset, gimmicks: GimmickSystem, viewers = 1) {
    this.root.name = 'course';
    this.environment = new CourseEnvironment(track, scene, preset, this.bag);
    // ガラス道路・シーソー・動く足場は GimmickView が描くので通常の路面を描かない
    const skipRoad = (i: number): boolean => {
      const smp = track.samples[i]!;
      return (
        gimmicks.surfaces.some((z) => z.kind === 'glass' && z.latMin <= -smp.halfWidth && z.latMax >= smp.halfWidth && gimmicks.inRange(z, smp.s)) ||
        gimmicks.seesaws.some((z) => gimmicks.inRange(z, smp.s)) ||
        gimmicks.platforms.some((z) => gimmicks.inRange(z, smp.s))
      );
    };
    // 跳ね橋の車線は橋板を GimmickView が描く
    const roadCut = (i: number): { min: number; max: number } | null => {
      const smp = track.samples[i]!;
      const z = gimmicks.drawbridges.find((b) => gimmicks.inRange(b, smp.s) && gimmicks.inRange(b, smp.s + track.spacing));
      return z ? { min: z.latMin, max: z.latMax } : null;
    };
    const { group } = buildTrackMeshes(track, this.bag, { skipRoad, roadCut });
    this.root.add(group);
    const scenery = SCENERY_BUILDERS[track.def.environment.scenery](track, preset, this.bag);
    const result: SceneryResult = scenery instanceof THREE.Group ? { group: scenery } : scenery;
    this.root.add(result.group);
    this.sceneryUpdate = result.update;
    // 夜コース: カーブ外側の誘導灯・矢印看板・路肩の反射材で先のコースを見やすくする
    if (track.def.environment.night) this.root.add(buildNightGuides(track, this.bag));
    // Point to Point: START / GOAL ゲートと道の両端の壁
    if (!track.closed) this.root.add(buildRaceGates(track, this.bag));
    this.gimmickView = new GimmickView(track, gimmicks);
    this.root.add(this.gimmickView.group);
    this.weather = new Weather(track, preset, this.bag, viewers);
    this.root.add(this.weather.group);
    scene.add(this.root);
  }

  /**
   * アニメーション (背景の魚・雪・ギミックの動き・天候)
   * @param viewCenters 天候の粒子を出す位置 (見ている車の位置)
   * @param viewS 見ている車のコース上の位置 (区間だけの天候用)
   */
  update(dt: number, viewCenters: readonly THREE.Vector3[] = [], viewS: readonly number[] = []): void {
    this.sceneryUpdate?.(dt);
    this.gimmickView.update(dt);
    this.weather.update(dt, viewCenters, viewS);
  }

  dispose(): void {
    // ライトの影マップ (レンダーターゲット) も明示的に解放する
    this.environment.sun.shadow.dispose();
    this.gimmickView.dispose();
    disposeObject(this.root);
    disposeObject(this.environment.group);
    this.bag.dispose();
  }
}
