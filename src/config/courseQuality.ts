/**
 * コース品質の安全策 (Road Safety Corridor) の設定。
 *
 * Road Safety Corridor = 車が走れる範囲 (路面 + 路肩 + 芝のランオフ) を壁の内側まで広げた帯。
 * この帯の中・路面の少し上〜頭上 heightAbove までに、地形や背景物 (木・岩・建物・看板) があってはいけない。
 *
 * - 地形 (Terrain) は生成時にこの帯より低くなるよう高さを制限する (terrain.*)
 * - `npm run check:courses` で全コースの地形・背景物の侵入を自動検出する
 * - デバッグ表示 (F6) で帯を可視化する
 */
export const courseQualityConfig = {
  corridor: {
    /** 帯の外側の余白 [m] (壁のあるところは壁の内面まで) */
    margin: 0.1,
    /** 柵のない路肩の外側の余白 [m] */
    fallEdgeMargin: 0.5,
    /** 路面からこの高さ [m] より上にある物を「道路にかかっている」とみなす (縁石・白線などは除外) */
    heightTolerance: 0.35,
    /** 路面からこの高さ [m] までを検査 (トンネル天井・ゲートの梁など高い物は対象外) */
    heightAbove: 4.5,
  },
  terrain: {
    /** 帯の中の地形は路面よりこれだけ低くする [m] */
    belowRoad: 0.45,
    /** 帯の外側で、地形を路面より低く保つ幅 [m] (地形メッシュの格子が道路をまたいで盛り上がらないよう、格子1マス分以上) */
    flatBand: 7.5,
    /** その先で地形が上がってよい最大勾配 (高さ / 水平距離) */
    maxSlope: 1.15,
  },
  scenery: {
    /** 木・岩などを帯の外側からこれ以上離して置く [m] (枝・葉の張り出しを考慮) */
    minClearance: 6,
  },
  /** コース形状の検査 (npm run check:courses) の基準 */
  structure: {
    /** これより急なカーブ (最小半径 [m]) は NG / 警告 */
    minRadiusError: 9,
    minRadiusWarn: 14,
    /** これより狭い道幅 [m] は NG / 警告 */
    minWidthError: 8,
    minWidthWarn: 10,
    /** チェックポイント間隔の上限 [m] (広すぎるとショートカット判定が甘くなる) */
    maxCheckpointSpacing: 160,
    /** ジャンプの着地後に必要な道路の長さ [m] */
    landingRunout: 30,
    /** 着地区間の最小半径 [m] (着地直後の急カーブは不公平) */
    landingMinRadius: 45,
    /** NPC のライン (理想ライン) の横移動の急さ [m/m] の警告値 */
    maxLineLateralRate: 0.55,
    /** Point to Point の始点と終点がこれより近いと「周回路では?」と警告 [m] */
    p2pMinEndDistance: 150,
  },
  check: {
    /** 三角形の内部を調べる間隔 [m] */
    sampleStep: 2,
    /** これより大きい三角形 (地面・海などの巨大な板) は頂点のみ検査 */
    maxTriangleSize: 60,
  },
};
