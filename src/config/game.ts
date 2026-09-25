/**
 * レース全体の設定。
 */
export const gameConfig = {
  /** 周回数 (仕様: 全コース3周) */
  laps: 3,

  pureRace: {
    minPlayers: 1,
    maxPlayers: 2,
    minCars: 2,
    maxCars: 8,
  },

  countdown: {
    /** 3 → 2 → 1 → GO! の各表示時間 [s] */
    stepSeconds: 1,
    /** GO! 表示の残る時間 [s] */
    goDisplaySeconds: 0.9,
    /** カウントダウン開始前の待ち (カメラ演出) [s] */
    introSeconds: 1.6,
  },

  finish: {
    /**
     * 先頭がゴールしてから、未ゴールの人間プレイヤーを待つ最大時間 [s]。
     * 文化祭の回転率のため。0 以下で無制限。
     */
    humanWaitAfterWinnerSeconds: 45,
    /** 全人間プレイヤーのゴール後、結果画面へ移るまでの待ち [s] */
    resultDelaySeconds: 3,
  },

  grid: {
    /** スタートラインから最前列までの距離 [m] */
    firstRowOffset: 8,
    /** 列の間隔 [m] */
    rowSpacing: 9,
    /** 左右の車の横オフセット [m] */
    lateralOffset: 3.4,
  },

  result: {
    /**
     * 結果画面で無操作のままタイトルへ自動復帰するまでの秒数の既定値。
     * 設定画面から変更可能 (0 = 自動復帰しない)。
     */
    defaultIdleReturnSeconds: 60,
  },

  /** 逆走警告を出すまでの時間 [s] */
  wrongWayWarningSeconds: 1.2,
};

export type RaceMode = 'pure' | 'battle';

/** コースの種類ごとの設定 (v3) */
export const raceTypeConfig = {
  pointToPoint: {
    /** スタートラインの手前の助走路 (グリッド 8台分 + 余裕) [m]。コースごとに上書き可 */
    preludeLength: 60,
    /** ゴールラインの先の減速用の道 [m]。コースごとに上書き可 */
    runoutLength: 200,
    /** スタート〜ゴールの最短距離 [m] (これより短いコース定義はエラー) */
    minRaceLength: 800,
    /** ゴール後のブレーキの強さ (0..1)。退避路の中で止まれるように強めにかける */
    finishBrake: 0.85,
    /** 道の両端の壁の位置 (端からの距離) [m] */
    endWallInset: 3,
    /** ミニマップ (追従表示) に映す範囲の半径 [m]。一本道は長いので自分の周りを拡大して表示する */
    minimapViewRadius: 230,
  },
};
