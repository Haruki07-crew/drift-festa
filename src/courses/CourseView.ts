/**
 * コースの描画一式 (空・ライト・路面・壁・背景) をまとめて生成・破棄する。
 * 新しい背景の種類を追加する場合は SCENERY_BUILDERS に登録する。
 */
import * as THREE from 'three';
import type { SceneryKind } from '../config/courses';
import type { QualityPreset } from '../config/graphics';
import { ResourceBag, disposeObject } from '../render/dispose';
import { buildCircuitScenery } from './scenery/CircuitScenery';
import { CourseEnvironment } from './scenery/Environment';
import { buildHarborScenery } from './scenery/HarborScenery';
import { buildTougeScenery } from './scenery/TougeScenery';
import type { Track } from './Track';
import { buildTrackMeshes } from './TrackMeshBuilder';

type SceneryBuilder = (track: Track, preset: QualityPreset, bag: ResourceBag) => THREE.Group;

const SCENERY_BUILDERS: Record<SceneryKind, SceneryBuilder> = {
  circuit: buildCircuitScenery,
  touge: buildTougeScenery,
  harbor: buildHarborScenery,
};

export class CourseView {
  readonly environment: CourseEnvironment;
  private readonly root = new THREE.Group();
  private readonly bag = new ResourceBag();

  constructor(track: Track, scene: THREE.Scene, preset: QualityPreset) {
    this.root.name = 'course';
    this.environment = new CourseEnvironment(track, scene, preset, this.bag);
    const { group } = buildTrackMeshes(track, this.bag);
    this.root.add(group);
    this.root.add(SCENERY_BUILDERS[track.def.environment.scenery](track, preset, this.bag));
    scene.add(this.root);
  }

  dispose(): void {
    // ライトの影マップ (レンダーターゲット) も明示的に解放する
    this.environment.sun.shadow.dispose();
    disposeObject(this.root);
    disposeObject(this.environment.group);
    this.bag.dispose();
  }
}
