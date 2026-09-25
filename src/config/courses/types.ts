/**
 * コース設定。
 *
 * コースは制御点を Catmull-Rom スプラインで結んだ道として定義する。
 * raceType = circuit は周回路 (最後の制御点から最初へ戻る)、pointToPoint は開いた一本道
 * (最初の制御点 = 助走路の始まり、最後の制御点 = 退避路の終わり)。
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

/**
 * コースの種類。
 *   circuit      : 周回コース (スタート = ゴール、規定周回数を走る)
 *   pointToPoint : スタートからゴールまで一方通行で走る (周回なし)
 */
export type RaceType = 'circuit' | 'pointToPoint';

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

export type SceneryKind =
  | 'circuit'
  | 'touge'
  | 'harbor'
  | 'aqua'
  | 'skyline'
  | 'frost'
  | 'magma'
  | 'neon'
  | 'jungle'
  | 'toybox'
  | 'tokyo'
  | 'alpine'
  | 'coastal'
  | 'desert'
  | 'northern'
  | 'europe'
  | 'airport'
  | 'volcano'
  | 'mall'
  | 'school'
  | 'cloud'
  | 'space'
  | 'rain'
  | 'windfarm';

/** 天候 (v3)。粒子は見ている車の周りだけに出す (軽量) */
export interface WeatherDef {
  kind: 'rain' | 'sandstorm' | 'snow' | 'aurora';
  /** 強さ 0..1 (粒子の量) */
  intensity?: number;
  /** 天候が強くなる区間 (割合 0..1)。区間の中では霧が濃くなる (砂嵐・豪雨) */
  zones?: { from: number; to: number; fogNear: number; fogFar: number; fogColor?: number }[];
}

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
  /** 天候 (雨・砂嵐・雪・オーロラ) */
  weather?: WeatherDef;
}

export interface CourseDef {
  id: string;
  name: string;
  /** NPCパターンIDの接頭辞 (例: TOUGE → TOUGE_STRONG_017) */
  idPrefix: string;
  /** コースの種類 (周回 / スタート→ゴール) */
  raceType: RaceType;
  description: string;
  /** 見せ場 (このコースならではの一番の見どころ。選択画面に表示) */
  highlight?: string;
  /**
   * 選択画面の難易度表示 (1..5)。★1 とてもかんたん / ★2 はじめての人向け / ★3 ふつう /
   * ★4 むずかしい / ★5 上級者向け。★2 のコースが一番多くなるようにする (文化祭は初めての人が多い)
   */
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
  /** Point to Point の道の設定 (省略時は config/game.ts の raceTypeConfig.pointToPoint) */
  pointToPoint?: {
    /** スタートライン手前の助走路の長さ [m] (制御点の最初からスタートラインまで) */
    preludeLength?: number;
    /** ゴールライン後の減速用の道の長さ [m] */
    runoutLength?: number;
    /** HUD に表示する区間名 (チェックポイント数と同じ個数。省略時は SECTION 1..) */
    sectionNames?: string[];
  };
  /** 選択画面に出す「攻略ポイント」 */
  tips?: string;
  environment: CourseEnvironment;
}
