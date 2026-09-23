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

export type EdgeType = 'wall' | 'guardrail' | 'grass' | 'fall';

export interface CourseControlPoint {
  x: number;
  z: number;
  y?: number;
  /** 道幅 [m] (省略時はコースの defaultWidth) */
  width?: number;
  left?: EdgeType;
  right?: EdgeType;
}

export interface ItemBoxRow {
  /** 周回上の位置 (0..1, スタートライン = 0) */
  at: number;
  /** 各ボックスの横方向オフセット [m] (右が正) */
  lateral: number[];
}

export type SceneryKind = 'circuit' | 'touge' | 'harbor';

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
  environment: CourseEnvironment;
}

// ---------------------------------------------------------------------------
// Course 1 : Circuit Aurora — 初心者向けサーキット。長いストレートと中高速コーナー
// ---------------------------------------------------------------------------
const circuitAurora: CourseDef = {
  id: 'aurora',
  name: 'Circuit Aurora',
  idPrefix: 'AURORA',
  description: '初心者向けサーキット。長いストレートと気持ちいい中高速コーナー。',
  difficultyStars: 1,
  defaultWidth: 17,
  runoffWidth: 7,
  wallHeight: 1.1,
  sampleSpacing: 2,
  checkpointCount: 24,
  checkpointWindow: 45,
  controlPoints: [
    { x: 0, z: -150, left: 'grass', right: 'grass' },
    { x: 0, z: -30 },
    { x: 0, z: 90 },
    { x: 2, z: 190 },
    { x: 25, z: 262 },
    { x: 80, z: 292 },
    { x: 145, z: 282 },
    { x: 188, z: 238 },
    { x: 205, z: 180 },
    { x: 238, z: 138 },
    { x: 298, z: 140 },
    { x: 348, z: 116 },
    { x: 366, z: 60 },
    { x: 344, z: 6 },
    { x: 290, z: -22 },
    { x: 262, z: -70 },
    { x: 280, z: -130 },
    { x: 282, z: -200 },
    { x: 238, z: -252 },
    { x: 165, z: -268 },
    { x: 92, z: -262 },
    { x: 36, z: -232 },
    { x: 8, z: -196 },
  ],
  itemBoxes: [
    { at: 0.08, lateral: [-5, 0, 5] },
    { at: 0.3, lateral: [-4, 4] },
    { at: 0.52, lateral: [-5, 0, 5] },
    { at: 0.75, lateral: [-4, 4] },
  ],
  environment: {
    scenery: 'circuit',
    skyTop: 0x3f86d8,
    skyBottom: 0xbfe3ff,
    fogColor: 0xcfe6fa,
    fogNear: 160,
    fogFar: 700,
    groundColor: 0x5fa845,
    roadColor: 0x3b3e45,
    lineColor: 0xf5f5f5,
    curbColorA: 0xe23b3b,
    curbColorB: 0xf5f5f5,
    wallColor: 0xd9dce3,
    sunColor: 0xfff2d6,
    sunIntensity: 2.6,
    ambientSky: 0xcfe8ff,
    ambientGround: 0x557744,
    ambientIntensity: 1.1,
    night: false,
    groundLevel: -0.05,
    water: false,
  },
};

// ---------------------------------------------------------------------------
// Course 2 : Kage Touge — 日本の峠。高低差・ヘアピン・一部落下可能
// ---------------------------------------------------------------------------
const kageTouge: CourseDef = {
  id: 'touge',
  name: 'Kage Touge',
  idPrefix: 'TOUGE',
  description: '夕暮れの峠道。高低差とヘアピンが続くテクニカルコース。柵のない区間は落下注意！',
  difficultyStars: 3,
  defaultWidth: 12.5,
  runoffWidth: 0,
  wallHeight: 0.85,
  sampleSpacing: 2,
  checkpointCount: 28,
  checkpointWindow: 35,
  controlPoints: [
    { x: 0, z: 0, y: 0, left: 'wall', right: 'guardrail' },
    { x: 0, z: 70, y: 2 },
    { x: 8, z: 135, y: 6 },
    { x: 38, z: 178, y: 10, left: 'guardrail', right: 'wall' },
    { x: 92, z: 188, y: 14 },
    { x: 138, z: 162, y: 18, left: 'fall', right: 'wall' },
    { x: 152, z: 118, y: 21 },
    { x: 128, z: 84, y: 23, left: 'guardrail', right: 'wall' },
    { x: 92, z: 66, y: 25 },
    { x: 78, z: 30, y: 27, left: 'wall', right: 'fall' },
    { x: 100, z: -4, y: 29 },
    { x: 150, z: -10, y: 31, left: 'wall', right: 'guardrail' },
    { x: 205, z: 10, y: 34 },
    { x: 250, z: 48, y: 38, left: 'wall', right: 'fall' },
    { x: 282, z: 102, y: 42 },
    { x: 288, z: 165, y: 46, left: 'wall', right: 'guardrail' },
    { x: 262, z: 222, y: 50 },
    { x: 212, z: 262, y: 53, left: 'fall', right: 'wall' },
    { x: 150, z: 282, y: 55 },
    { x: 88, z: 292, y: 55, left: 'guardrail', right: 'guardrail' },
    { x: 30, z: 286, y: 53 },
    { x: -24, z: 262, y: 50, left: 'fall', right: 'wall' },
    { x: -58, z: 218, y: 46 },
    { x: -62, z: 170, y: 42, left: 'guardrail', right: 'wall' },
    { x: -96, z: 134, y: 37 },
    { x: -132, z: 102, y: 32, left: 'wall', right: 'fall' },
    { x: -128, z: 56, y: 26 },
    { x: -92, z: 34, y: 20, left: 'guardrail', right: 'guardrail' },
    { x: -70, z: -8, y: 14 },
    { x: -78, z: -56, y: 9, left: 'wall', right: 'fall' },
    { x: -52, z: -88, y: 5 },
    { x: -14, z: -70, y: 2, left: 'wall', right: 'guardrail' },
  ],
  itemBoxes: [
    { at: 0.06, lateral: [-3.5, 3.5] },
    { at: 0.27, lateral: [-3.5, 0, 3.5] },
    { at: 0.5, lateral: [-3.5, 3.5] },
    { at: 0.72, lateral: [-3.5, 0, 3.5] },
  ],
  environment: {
    scenery: 'touge',
    skyTop: 0x2d3a6b,
    skyBottom: 0xf3a064,
    fogColor: 0xc98a6a,
    fogNear: 90,
    fogFar: 520,
    groundColor: 0x3e5a2e,
    roadColor: 0x44434a,
    lineColor: 0xf2e6b8,
    curbColorA: 0xf2e6b8,
    curbColorB: 0x44434a,
    wallColor: 0x8a8378,
    sunColor: 0xffc48a,
    sunIntensity: 2.2,
    ambientSky: 0xa5b4e6,
    ambientGround: 0x4a3a2a,
    ambientIntensity: 1.0,
    night: false,
    groundLevel: -30,
    water: false,
  },
};

// ---------------------------------------------------------------------------
// Course 3 : Neo Harbor — 近未来の港湾都市。高速区間と大きなコーナー、夜のネオン
// ---------------------------------------------------------------------------
const neoHarbor: CourseDef = {
  id: 'harbor',
  name: 'Neo Harbor',
  idPrefix: 'HARBOR',
  description: 'ネオン輝く夜の港湾都市。超高速区間と大きなコーナー。桟橋からの落下に注意。',
  difficultyStars: 2,
  defaultWidth: 18,
  runoffWidth: 0,
  wallHeight: 1.2,
  sampleSpacing: 2,
  checkpointCount: 26,
  checkpointWindow: 50,
  controlPoints: [
    { x: 0, z: -200, y: 0, left: 'wall', right: 'wall' },
    { x: 0, z: -50, y: 0 },
    { x: 0, z: 100, y: 3 },
    { x: 28, z: 200, y: 7 },
    { x: 108, z: 252, y: 9 },
    { x: 210, z: 244, y: 8 },
    { x: 290, z: 190, y: 5 },
    { x: 322, z: 110, y: 2 },
    { x: 312, z: 22, y: 0 },
    { x: 338, z: -58, y: 0 },
    { x: 404, z: -98, y: 0, left: 'wall', right: 'fall' },
    { x: 474, z: -92, y: 0 },
    { x: 522, z: -140, y: 0 },
    { x: 512, z: -222, y: 0, left: 'wall', right: 'wall' },
    { x: 442, z: -272, y: 0 },
    { x: 342, z: -282, y: 2 },
    { x: 252, z: -250, y: 5, left: 'fall', right: 'wall' },
    { x: 180, z: -282, y: 5 },
    { x: 100, z: -322, y: 3, left: 'wall', right: 'wall' },
    { x: 30, z: -302, y: 1 },
  ],
  itemBoxes: [
    { at: 0.07, lateral: [-6, 0, 6] },
    { at: 0.3, lateral: [-5, 5] },
    { at: 0.55, lateral: [-6, 0, 6] },
    { at: 0.8, lateral: [-5, 5] },
  ],
  environment: {
    scenery: 'harbor',
    skyTop: 0x05040f,
    skyBottom: 0x2a1250,
    fogColor: 0x1a0f33,
    fogNear: 120,
    fogFar: 620,
    groundColor: 0x1b1d2a,
    roadColor: 0x26262f,
    lineColor: 0x39f3ff,
    curbColorA: 0xff2d95,
    curbColorB: 0x2a2a38,
    wallColor: 0x3a3d52,
    sunColor: 0x9aa6ff,
    sunIntensity: 1.1,
    ambientSky: 0x6c5cff,
    ambientGround: 0x1a1030,
    ambientIntensity: 1.25,
    night: true,
    groundLevel: -5,
    water: true,
  },
};

export const COURSES: readonly CourseDef[] = [circuitAurora, kageTouge, neoHarbor];

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
