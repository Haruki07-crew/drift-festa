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
import { buildAquaScenery } from './scenery/AquaScenery';
import { buildCircuitScenery } from './scenery/CircuitScenery';
import { CourseEnvironment } from './scenery/Environment';
import { buildFrostScenery } from './scenery/FrostScenery';
import { buildHarborScenery } from './scenery/HarborScenery';
import { buildJungleScenery } from './scenery/JungleScenery';
import { buildMagmaScenery } from './scenery/MagmaScenery';
import { buildNeonScenery } from './scenery/NeonScenery';
import type { SceneryResult } from './scenery/SceneryUtils';
import { buildSkylineScenery } from './scenery/SkylineScenery';
import { buildToyboxScenery } from './scenery/ToyboxScenery';
import { buildTougeScenery } from './scenery/TougeScenery';
import type { Track } from './Track';
import { buildTrackMeshes } from './TrackMeshBuilder';

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
};

export class CourseView {
  readonly environment: CourseEnvironment;
  private readonly root = new THREE.Group();
  private readonly bag = new ResourceBag();
  private readonly gimmickView: GimmickView;
  private readonly sceneryUpdate: ((dt: number) => void) | undefined;

  constructor(track: Track, scene: THREE.Scene, preset: QualityPreset, gimmicks: GimmickSystem) {
    this.root.name = 'course';
    this.environment = new CourseEnvironment(track, scene, preset, this.bag);
    // ガラス道路・シーソーは GimmickView が描くので通常の路面を描かない
    const skipRoad = (i: number): boolean => {
      const smp = track.samples[i]!;
      return (
        gimmicks.surfaces.some((z) => z.kind === 'glass' && z.latMin <= -smp.halfWidth && z.latMax >= smp.halfWidth && gimmicks.inRange(z, smp.s)) ||
        gimmicks.seesaws.some((z) => gimmicks.inRange(z, smp.s))
      );
    };
    const { group } = buildTrackMeshes(track, this.bag, { skipRoad });
    this.root.add(group);
    const scenery = SCENERY_BUILDERS[track.def.environment.scenery](track, preset, this.bag);
    const result: SceneryResult = scenery instanceof THREE.Group ? { group: scenery } : scenery;
    this.root.add(result.group);
    this.sceneryUpdate = result.update;
    this.gimmickView = new GimmickView(track, gimmicks);
    this.root.add(this.gimmickView.group);
    scene.add(this.root);
  }

  /** アニメーション (背景の魚・雪・ギミックの動き) */
  update(dt: number): void {
    this.sceneryUpdate?.(dt);
    this.gimmickView.update(dt);
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
