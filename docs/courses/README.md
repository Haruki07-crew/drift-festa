# コースとコースギミック

## コース一覧 (10)

| ID | 名前 | 接頭辞 (NPC ID) | 主なギミック |
|---|---|---|---|
| aurora | Circuit Aurora | AURORA | 芝ランオフ |
| touge | Kage Touge | TOUGE | 高低差、落下区間 |
| harbor | Neo Harbor | HARBOR | 落下区間 (桟橋) |
| aqua | AQUA SHIFT | AQUA | transform (水中)、glass tunnel、boostPad、jump + gap、metal / water 路面 |
| skyline | SKYLINE ZERO | SKYLINE | jump + gap、glass 路面、wind、bank、fall 区間 |
| frost | FROSTBITE PASS | FROST | snow / ice 路面、ice tunnel、jump + gap (湖へ)、氷の橋、氷のショートカット (lateralMin) |
| magma | MAGMA FACTORY | MAGMA | gate (交互)、slide (ピストン)、conveyor (順流 / 逆流)、jump + gap、metal tunnel |
| neon | NEON GRAVITY | NEON | 立体交差 (8の字)、bank 最大52°、neon tunnel、jump + gap |
| jungle | JUNGLE TEMPLE RUN | JUNGLE | dirt / mud / water 路面、log (倒木)、pillar (分岐の中央分離)、rock tunnel、jump + gap |
| toybox | TOYBOX MAYHEM | TOYBOX | seesaw、spin (積み木)、cross (列車)、wind (扇風機)、連続 jump (バウンド床)、conveyor (レール)、jump + gap (本) |

## コースの追加手順

1. `src/config/courses/<id>.ts` を作り `CourseDef` を export する (既存コースをコピーすると早い)
2. `src/config/courses/index.ts` の `COURSES` に追加
3. `npm run check:courses -- <id> --cp` で重なり・最小半径と、制御点ごとの周回割合 (ギミック配置の目安) を確認
4. `gimmicks` 配列にギミックを並べる (位置は周回割合 0..1)
5. `npm run sim -- <id>` で全難易度の NPC が完走できるか確認 (`--verbose` で復帰の場所と理由)
6. 背景は `src/courses/scenery/` にビルダーを作り `CourseView.ts` の `SCENERY_BUILDERS` へ登録
   (既存の背景種別を使い回してもよい)

## ギミックの仕組み

- 定義: `src/config/gimmicks.ts` の `GimmickDef` (型) と `gimmickConfig` (調整値)
- 実行: `src/gimmicks/GimmickSystem.ts` (路面・パッド・ジャンプ・変形・風・コンベア・シーソー・障害物・NPC 向け問い合わせ)
  と `src/gimmicks/Obstacle.ts` (時刻の関数として決定的に動く障害物と当たり判定)
- 描画: `src/gimmicks/GimmickView.ts`
- 道路の切れ目 (`jump` の `gap` / `gap`) とバンク (制御点の `bank`) は `Track` が管理
- 物理への反映: `VehicleBody` の `surfaceKind` / `transformMode` / `padBoostTimer` / `bank` を `VehiclePhysics` が参照

### 設計上の約束

- ギミックはコース専用の if 文にしない (種類ごとの再利用可能な処理)
- 動く物は乱数を使わず周期で動く。閉まる・横切る前に予告 (ランプ点滅)
- 障害物は PURE RACE で恒久的なダメージを与えない (速度が落ちるだけ)
- 静止物・ゲートは道幅全体を塞がない (テストで確認)
- 道路の切れ目で落ちたら通常のコースアウト扱い (6秒操作不能)。復帰位置は助走距離を確保 (`jump.respawnRunway`)
- ジャンプ中は空中補正で道路の向きへ寄せる (`jump.airAlignRate`)

### NPC とギミック

- 速度計画はライン上の路面グリップ (× 路面の理解度 `surfaceAwareness`) とバンクのグリップ増加を考慮
- 動く障害物は `adviseObstacles` で到達時刻の位置を予測 (`obstacleAnticipation`) し、避ける側を決めて一定時間維持。
  抜けられない時 (閉じたゲート) は開くタイミングに合わせて減速
- ブーストパッドはパッドごとに `gimmickUsage` の確率で狙う
- ジャンプ台の手前では飛び越えられる速度を保つ (`npc.runtime.jumpApproachSpeed`)
