/**
 * コースギミックの共通設定と定義の型。
 *
 * 各コースは CourseDef.gimmicks に下記の GimmickDef を並べるだけでギミックを追加できる。
 * 位置は周回上の割合 (0..1、スタートライン = 0) で指定するので、コースの長さを変えても崩れない。
 * 範囲 (from/to) が 1 をまたぐ場合 (例: from 0.95, to 0.05) は周回をまたいだ範囲として扱う。
 *
 * ギミックの種類:
 *   surface    : 路面 (雪・氷・土・泥・浅い水・ガラス・金属)。グリップ/加速/抵抗が変わる
 *   boostPad   : 踏むと短時間加速
 *   jump       : ジャンプ台 (上向きの速度を与える)
 *   gap        : 道路のない区間 (落ちたらコースアウト扱い)。通常は jump の gap 指定で自動生成する
 *   transform  : 変形区間 (underwater = 水中走行モード。見た目とハンドリングが変わる)
 *   wind       : 横風 (予告 → 吹く → 止む を一定周期で繰り返す)
 *   conveyor   : コンベア (路面ごと車を運ぶ。速い物はブーストコンベア)
 *   obstacle   : 障害物 (静止 / 横移動 / 開閉ゲート / 回転)。予測可能な周期で動く
 *   seesaw     : シーソー道路 (一定周期で傾きが変わる)
 *   tunnel     : トンネルの見た目。speedBonus でトンネル加速 (Tunnel Speed)
 *
 * v3 で追加:
 *   speedGate  : くぐると加速するゲート (ブーストパッドより強く長い。NPC も狙う)
 *   draftZone  : スリップストリーム (前の車の真後ろで加速) が強くなる区間 (Draft Tunnel 等)
 *                ※ スリップストリーム自体は全コース共通の仕組み (slipstream 設定)
 *   splash     : 水しぶき区間 (水たまり・打ち寄せる波)。period 指定で波のように周期的に来る
 *   platform   : 横へ動く足場 (Moving Platform)。足場の外は落下
 *   drawbridge : 周期的に上がる跳ね橋 (Moving Bridge)。上がる前に手前の遮断機が閉まる
 *   obstacle の motion 'drop' : 落下物 (Falling Object)。落ちる場所に予告の影が出る
 *   obstacle の motion 'spin' + style 'turnstile' : 回転ゲート (Rotating Gate)
 *   surface の sand / wet / cobble / magnet : 砂・濡れた路面・石畳・磁力道路 (Magnetic Road)
 *
 * 組み合わせで作るもの:
 *   Shortcut Gate / Dynamic Route Split : 中央分離帯 (obstacle static) で道を2車線に分け、
 *     片方にだけ開閉ゲート・跳ね橋・別の路面を置く。NPC は到達時刻の状態から車線を選ぶ
 *   Bank Assist : 制御点の bank (バンク角) + bank.gripBonus
 */

export type SurfaceKind = 'road' | 'snow' | 'ice' | 'dirt' | 'mud' | 'water' | 'glass' | 'metal' | 'sand' | 'wet' | 'cobble' | 'magnet';

export interface SurfaceProps {
  label: string;
  /** 横グリップ倍率 */
  grip: number;
  /** 加速倍率 */
  accel: number;
  /** 追加の減速 [m/s^2] */
  drag: number;
  /** 最高速度倍率 */
  maxSpeedMul: number;
  /** 路面の色 (見た目) */
  color: number;
  /** 路面の反射感 (0..1、氷・ガラス用) */
  shine: number;
  /** 半透明の路面 (ガラス) */
  transparent?: boolean;
}

export type ObstacleMotion =
  /** 動かない (倒木・柱・中央分離帯) */
  | { kind: 'static'; lateral: number }
  /** 横方向へ往復 (sin 波)。lateral(t) = center + amplitude * sin(2π t / period + phase) */
  | { kind: 'slide'; center: number; amplitude: number; period: number; phase?: number }
  /** 開閉ゲート。period のうち closedFraction の間だけ閉まる。閉まる前に warnSeconds 予告 */
  | { kind: 'gate'; lateral: number; period: number; closedFraction: number; phase?: number }
  /** その場で回転する棒 (回転する積み木など) */
  | { kind: 'spin'; lateral: number; period: number; phase?: number }
  /** 横切る列車: 片側から反対側へ一定速度で横断し、待機して戻る (予告あり) */
  | { kind: 'cross'; amplitude: number; period: number; crossFraction: number; phase?: number }
  /**
   * 落下物: 周期ごとに laterals の位置へ順番に落ちてくる。落ちる前に予告 (影) が出て、
   * 落ちた後しばらく道路に残ってから消える (drop 設定)
   */
  | { kind: 'drop'; laterals: number[]; period: number; phase?: number };

export type ObstacleStyle =
  | 'gate'
  | 'block'
  | 'train'
  | 'spinner'
  | 'log'
  | 'pillar'
  | 'piston'
  | 'rock'
  | 'crate'
  | 'turnstile'
  | 'cart'
  | 'divider'
  | 'reindeer'
  | 'float';

export type TunnelStyle = 'glass' | 'rock' | 'ice' | 'neon' | 'metal' | 'city' | 'space' | 'school';

export type TransformMode = 'underwater';

export type GimmickDef =
  | { type: 'surface'; from: number; to: number; surface: SurfaceKind; lateralMin?: number; lateralMax?: number }
  | { type: 'boostPad'; at: number; lateral: number; width?: number; length?: number }
  | {
      type: 'jump';
      at: number;
      /** 上向きの初速 [m/s] */
      launch: number;
      /** ジャンプ台の直後に作る道路の切れ目の長さ [m] (省略 = 切れ目なし) */
      gap?: number;
      lateralMin?: number;
      lateralMax?: number;
      length?: number;
    }
  | { type: 'gap'; from: number; to: number }
  | { type: 'transform'; from: number; to: number; mode: TransformMode }
  | {
      type: 'wind';
      from: number;
      to: number;
      force: number;
      period: number;
      activeFraction: number;
      phase?: number;
      /** 見た目: fan = 巨大扇風機 (既定)、windsock = 吹き流し (屋外の自然の風) */
      style?: 'fan' | 'windsock';
    }
  | { type: 'conveyor'; from: number; to: number; speed: number; lateralMin?: number; lateralMax?: number }
  | { type: 'obstacle'; at: number; motion: ObstacleMotion; length: number; width: number; height: number; style: ObstacleStyle }
  | { type: 'seesaw'; from: number; to: number; tilt: number; period: number; phase?: number }
  | {
      type: 'tunnel';
      from: number;
      to: number;
      style: TunnelStyle;
      height?: number;
      /** トンネル加速 (Tunnel Speed): 中での最高速度の上乗せ (0.05 = +5%) */
      speedBonus?: number;
    }
  | { type: 'speedGate'; at: number; lateral: number; width?: number }
  | {
      type: 'draftZone';
      from: number;
      to: number;
      /** スリップストリーム効果の倍率 (1.8 = 1.8倍) */
      multiplier: number;
    }
  | {
      type: 'splash';
      from: number;
      to: number;
      lateralMin?: number;
      lateralMax?: number;
      /** 周期 [s] (省略 = 常に水たまり)。指定すると波のように周期的に来る */
      period?: number;
      /** 波が道路にかかっている割合 0..1 */
      activeFraction?: number;
      phase?: number;
    }
  | {
      type: 'platform';
      from: number;
      to: number;
      /** 足場の幅 [m] */
      width: number;
      /** 横移動の振幅 [m] (中心 = コース中心) */
      amplitude: number;
      period: number;
      phase?: number;
    }
  | {
      type: 'drawbridge';
      from: number;
      to: number;
      /** 跳ね橋がかかっている車線 (横位置の範囲) [m] */
      lateralMin: number;
      lateralMax: number;
      period: number;
      /** 橋が上がっている (通れない) 割合 0..1 */
      openFraction: number;
      phase?: number;
    };

export type GimmickType = GimmickDef['type'];

export const gimmickConfig = {
  surfaces: {
    road: { label: '舗装路', grip: 1, accel: 1, drag: 0, maxSpeedMul: 1, color: 0x3b3e45, shine: 0 },
    snow: { label: '雪', grip: 0.78, accel: 0.85, drag: 1.2, maxSpeedMul: 0.92, color: 0xeef4ff, shine: 0.1 },
    ice: { label: '氷', grip: 0.45, accel: 0.7, drag: 0.2, maxSpeedMul: 1, color: 0xa8dcff, shine: 0.9 },
    dirt: { label: '土', grip: 0.88, accel: 0.92, drag: 0.8, maxSpeedMul: 0.95, color: 0x8a6440, shine: 0 },
    mud: { label: '泥', grip: 0.7, accel: 0.65, drag: 4.5, maxSpeedMul: 0.72, color: 0x5a4028, shine: 0.25 },
    water: { label: '浅い水', grip: 0.82, accel: 0.8, drag: 3, maxSpeedMul: 0.82, color: 0x3a8fb8, shine: 0.7 },
    glass: { label: '透明道路', grip: 1, accel: 1, drag: 0, maxSpeedMul: 1, color: 0x9fe8ff, shine: 0.8, transparent: true },
    metal: { label: '鉄板', grip: 0.92, accel: 1, drag: 0, maxSpeedMul: 1, color: 0x7a7f88, shine: 0.5 },
    sand: { label: '砂', grip: 0.8, accel: 0.84, drag: 1.6, maxSpeedMul: 0.9, color: 0xd9b36a, shine: 0 },
    wet: { label: '濡れた路面', grip: 0.74, accel: 0.93, drag: 0.2, maxSpeedMul: 1, color: 0x2c3340, shine: 0.75 },
    cobble: { label: '石畳', grip: 0.9, accel: 0.95, drag: 0.6, maxSpeedMul: 0.96, color: 0x8a8378, shine: 0.05 },
    magnet: { label: '磁力道路', grip: 1.45, accel: 1, drag: 0, maxSpeedMul: 1, color: 0x2a3a8a, shine: 0.6 },
  } satisfies Record<SurfaceKind, SurfaceProps>,

  boostPad: {
    /** 効果時間 [s] */
    duration: 1.4,
    /** 効果中の最高速度倍率 */
    maxSpeedMul: 1.28,
    /** 踏んだ瞬間に加わる速度 [m/s] */
    kick: 7,
    /** 効果中の加速倍率 */
    accelMul: 1.6,
    /** 既定の大きさ [m] */
    width: 4.5,
    length: 5,
  },

  jump: {
    /** ジャンプ台の既定の長さ [m] */
    length: 4,
    /** これより遅いとジャンプ台で飛ばない [m/s] (低速でゆっくり登る時) */
    minSpeed: 6,
    /** 道路の切れ目の手前で復帰した時に確保する助走距離 [m] */
    respawnRunway: 90,
    /**
     * 空中で進行方向を道路の向きへ寄せる速さ [rad/s] (アーケード的な空中補正)。
     * カーブ上のジャンプでも道路の外へ飛び出しにくくする。0 で補正なし。
     */
    airAlignRate: 1.4,
    /** 道路の端に近づいた時に中央へ戻す強さ [rad/s] */
    airCenterRate: 1.2,
  },

  transform: {
    underwater: {
      /** 旋回の効き倍率 (水中は少しゆっくり曲がる) */
      yawMul: 0.8,
      gripMul: 0.9,
      /** 追加の水の抵抗 [m/s^2] */
      drag: 1.2,
      maxSpeedMul: 0.93,
    },
  } satisfies Record<TransformMode, { yawMul: number; gripMul: number; drag: number; maxSpeedMul: number }>,

  wind: {
    /** 風が吹く前の予告時間 [s] (旗・パーティクルで分かるようにする) */
    warnSeconds: 1.2,
  },

  /** 加速ゲート (くぐると加速) */
  speedGate: {
    duration: 1.8,
    maxSpeedMul: 1.32,
    kick: 8,
    accelMul: 1.7,
    /** 既定の幅 [m] (くぐれる横幅) と判定の前後長さ [m] */
    width: 7,
    length: 4,
    /** ゲートの高さ [m] (見た目) */
    height: 6.5,
  },

  /**
   * スリップストリーム (全コース共通)。前の車の真後ろにつくと空気抵抗が減って速くなる。
   * 車両性能の底上げではなく、誰でも (人間も NPC も) 同じ条件で得られる物理効果。
   */
  slipstream: {
    /** 効果が出る前の車との最大距離 [m] */
    range: 30,
    /** 真後ろとみなす横ずれ [m] */
    lateralWidth: 2.4,
    /** これ以下の速度では効果なし [m/s] */
    minSpeed: 18,
    /** 最大効果時の最高速度の上乗せ */
    maxSpeedBonus: 0.06,
    /** 最大効果時の加速の上乗せ */
    accelBonus: 0.3,
    /** 効果が最大になるまでの時間 [s] (近づいてすぐには効かない) */
    buildUpSeconds: 0.8,
    /** 離れてから効果が消えるまでの時間 [s] */
    fadeSeconds: 0.5,
  },

  /** トンネル加速 (tunnel の speedBonus) の加速の上乗せ (speedBonus 1 あたり) */
  tunnelSpeed: {
    accelPerBonus: 4,
  },

  /** 水しぶき (水たまり・波) */
  splash: {
    grip: 0.8,
    /** 追加の減速 [m/s^2] */
    drag: 2.4,
    /** 波が来る前の予告時間 [s] */
    warnSeconds: 1.2,
  },

  /** 動く足場 */
  platform: {
    /** 足場の端から落ちるまでの余裕 [m] */
    edgeMargin: 0.4,
    /** NPC が狙う足場中央からの余裕 [m] (足場の半幅からこれを引いた範囲を狙う) */
    npcMargin: 1.6,
    /** NPC が足場を見始める距離 [m] */
    npcLookahead: 80,
  },

  /** 跳ね橋 */
  drawbridge: {
    /** 橋が上がる何秒前に遮断機を閉めるか (遮断機の直前を遅い車 (20m/s) が通っても渡り切れる時間) */
    gateLeadSeconds: 4,
    /** 橋が下りてから遮断機を開けるまで [s] */
    gateLagSeconds: 0.6,
    /** 橋が上がる/下りるアニメーションの時間 [s] */
    moveSeconds: 1.2,
    /** 遮断機を橋の手前何 m に置くか */
    gateDistance: 14,
    /** 上がった橋の最大角度 [deg] */
    maxAngleDeg: 62,
  },

  /** 落下物 */
  drop: {
    /** 落ちる前の予告 (影) の時間 [s] */
    warnSeconds: 1.6,
    /** 落下にかかる時間 [s] */
    fallSeconds: 0.45,
    /** 道路に残る時間 [s] */
    restSeconds: 2.2,
    /** 落ちてくる高さ [m] */
    height: 26,
  },

  obstacle: {
    /** 障害物にぶつかった時の反発係数 */
    restitution: 0.35,
    /** 衝突時に失う速度の割合 (恒久的なダメージはなし) */
    speedLoss: 0.35,
    /** ゲートが閉まる前の予告時間 [s] */
    gateWarnSeconds: 1.0,
    /** 横断列車の予告時間 [s] */
    crossWarnSeconds: 1.5,
    /** NPC が障害物を避けるときの余白 [m] */
    npcClearance: 1.6,
  },

  seesaw: {
    /** シーソーの傾きの変化の滑らかさ (大きいほど急に傾く) */
    sharpness: 2.5,
  },

  bank: {
    /** バンク角の sin 1 あたりのグリップ増加 (強いバンクは速く曲がれる) */
    gripBonus: 0.8,
    /** カメラをバンクに合わせて傾ける割合 (0 = 傾けない) */
    cameraRoll: 0.75,
  },

  /** NPC のギミック活用 */
  npc: {
    /** ブーストパッドを狙い始める距離 [m] */
    seekDistance: 70,
    /** ブーストパッドへ寄せる最大の横移動 [m] (gimmickUsage を掛ける) */
    seekMaxOffset: 5,
    /** 障害物を認識する距離 [m] */
    obstacleLookahead: 70,
    /**
     * 一番近い障害物からこの距離 [m] 以内の障害物はまとめて避け方を考える
     * (同じ位置の2枚のゲート・遮断機と中央分離帯)。広すぎると先の障害物に過敏になる
     */
    obstacleGroupDistance: 12,
  },
};

export function surfaceProps(kind: SurfaceKind): SurfaceProps {
  return gimmickConfig.surfaces[kind];
}
