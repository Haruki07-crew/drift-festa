/**
 * コースの描画一式を Node 上で組み立て、Road Safety Corridor への侵入を調べる。
 */
import * as THREE from 'three';
import type { CourseDef } from '../../src/config/courses';
import { graphicsConfig } from '../../src/config/graphics';
import { CourseView } from '../../src/courses/CourseView';
import { RoadCorridor, scanIntrusions, type IntrusionReport } from '../../src/courses/RoadClearance';
import { Track } from '../../src/courses/Track';
import { GimmickSystem } from '../../src/gimmicks/GimmickSystem';
import { installHeadlessDom } from './headlessDom';

export function checkCourseScene(def: CourseDef): IntrusionReport[] {
  installHeadlessDom();
  const track = Track.build(def);
  const scene = new THREE.Scene();
  // 最も背景物が多い「高」画質で検査する
  const view = new CourseView(track, scene, graphicsConfig.presets.high, new GimmickSystem(track));
  const reports = scanIntrusions(new RoadCorridor(track), scene);
  view.dispose();
  return reports;
}
