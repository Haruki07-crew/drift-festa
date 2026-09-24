/**
 * コース設定。
 *
 * コースは制御点を Catmull-Rom スプラインで結んだ周回路として定義する。
 * 新しいコースは COURSES に定義を1つ追加するだけで、選択画面・NPCパターン・
 * チェックポイント・ミニマップ・ベストタイム保存まで自動で対応する。
 *
 * 座標系: x/z が水平面、y が高さ [m]。進行方向は制御点の並び順。
 * 路肩 (left/right) の種類は「その制御点から次の制御点まで」の区間に適用される。
 *   wall      : コンクリート壁
 *   guardrail : ガードレール (物理的には壁と同じ)
 *   grass     : 芝のランオフ (runoffWidth) の先に壁
 *   fall      : 柵なし。はみ出すと落下 → チェックポイントへ復帰
 *   left/right を省略した制御点は、直前の制御点の設定を引き継ぐ。
 */

import type { GimmickDef } from '../gimmicks';

export type EdgeType = 'wall' | 'guardrail' | 'grass' | 'fall';

export interface CourseControlPoint {
  x: number;
  z: number;
  y?: number;
  /** 道幅 [m] (省略時はコースの defaultWidth) */
  width?: number;
  left?: EdgeType;
  right?: EdgeType;
  /**
   * バンク角 [度]。カーブの内側へ向かって路面を傾ける (外側が高くなる)。
   * 省略時は 0。制御点の間は滑らかに補間される。強いバンクは壁走行のような体験になる。
   */
  bank?: number;
}

export interface ItemBoxRow {
  /** 周回上の位置 (0..1, スタートライン = 0) */
  at: number;
  /** 各ボックスの横方向オフセット [m] (右が正) */
  lateral: number[];
}

export type SceneryKind = 'circuit' | 'touge' | 'harbor' | 'aqua' | 'skyline' | 'frost' | 'magma' | 'neon' | 'jungle' | 'toybox';

export interface CourseEnvironment {
  scenery: SceneryKind;
  skyTop: number;
  skyBottom: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  groundColor: number;
  roadColor: number;
  lineColor: number;
  curbColorA: number;
  curbColorB: number;
  wallColor: number;
  sunColor: number;
  sunIntensity: number;
  ambientSky: number;
  ambientGround: number;
  ambientIntensity: number;
  /** 夜のコース (街灯・ネオンが発光) */
  night: boolean;
  /** 地面の高さ [m] (落下可能区間の下) */
  groundLevel: number;
  /** 水面を表示するか (Neo Harbor) */
  water: boolean;
  /**
   * 高架道路の支え方。skirt = 路肩から地面まで壁 (既定)、pillars = 柱 (立体交差があるコース)、none = なし
   */
  roadSupports?: 'skirt' | 'pillars' | 'none';
  /** 水中区間の霧の色 (transform: underwater があるコース) */
  underwaterFogColor?: number;
}

export interface CourseDef {
  id: string;
  name: string;
  /** NPCパターンIDの接頭辞 (例: TOUGE → TOUGE_STRONG_017) */
  idPrefix: string;
  description: string;
  /** 選択画面の難易度表示 (1..5) */
  difficultyStars: number;
  defaultWidth: number;
  runoffWidth: number;
  wallHeight: number;
  /** 路面サンプル間隔 [m] */
  sampleSpacing: number;
  /** 見えないチェックポイントの数 (スタートラインを含む) */
  checkpointCount: number;
  /** チェックポイント通過判定の前後許容距離 [m] */
  checkpointWindow: number;
  controlPoints: CourseControlPoint[];
  /** BATTLE DUEL のアイテムボックス配置 */
  itemBoxes: ItemBoxRow[];
  /** コースギミック (ブーストパッド・路面・ジャンプ・障害物など)。config/gimmicks.ts 参照 */
  gimmicks?: GimmickDef[];
  /** 選択画面に出す「攻略ポイント」 */
  tips?: string;
  environment: CourseEnvironment;
}
