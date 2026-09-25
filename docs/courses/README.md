# コースとコースギミック

## コースの種類

| raceType | 表示 | ルール |
|---|---|---|
| `circuit` | CIRCUIT 周回コース | 閉じた周回路。3周 (`game.laps`)。0番のチェックポイント = スタート/ゴールライン |
| `pointToPoint` | POINT TO POINT 一本道 | 開いた道。スタートライン (`startS`) → 中間チェックポイント → ゴールライン (`goalS`)。周回なし |

Point to Point の道は、最初の制御点 = 助走路の始まり、最後の制御点 = 退避路の終わり。
スタートラインは始まりから `preludeLength` (既定 60m)、ゴールラインは終わりから `runoutLength` (既定 200m) の位置
(`config/game.ts` の `raceTypeConfig.pointToPoint`、コースごとに `pointToPoint` で上書き可)。
区間名 (`pointToPoint.sectionNames`、チェックポイント数と同じ個数) は HUD に表示される。

## コース一覧 (24)

| ID | 名前 | 種類 | ★ | 接頭辞 | 主なギミック | 背景 |
|---|---|---|---|---|---|---|
| aurora | Circuit Aurora | circuit | 1 | AURORA | 芝ランオフ | CircuitScenery |
| harbor | Neo Harbor | circuit | 2 | HARBOR | 落下区間 (桟橋)、夜 | HarborScenery |
| airport | AIRPORT RUSH | circuit | 2 | AIRPORT | draftZone (滑走路)、speedGate、wind (windsock・ジェット噴射)、cross (手荷物カート) | AirportScenery |
| mall | MEGA MALL | circuit | 2 | MALL | splash (噴水)、conveyor (動く歩道)、spin + turnstile (回転扉)、らせん | MallScenery |
| school | SCHOOL FESTIVAL CHAOS | circuit | 2 | SCHOOL | 分離帯 + gate + speedGate (Shortcut Gate)、tunnel school (廊下)、splash (スプリンクラー)、cross + float (山車) | SchoolScenery |
| windfarm | WIND FARM HILLS | circuit | 2 | WINDFARM | bank、小ジャンプ、wind (windsock) | WindfarmScenery |
| touge | Kage Touge | circuit | 3 | TOUGE | 高低差、落下区間 | TougeScenery |
| aqua | AQUA SHIFT | circuit | 3 | AQUA | transform (水中)、glass tunnel、boostPad、jump + gap | AquaScenery |
| volcano | VOLCANO ISLAND | circuit | 3 | VOLCANO | sand / dirt、rock tunnel (溶岩洞窟)、drop (噴石)、jump + gap (溶岩の川) | VolcanoScenery |
| cloud | CLOUD KINGDOM | circuit | 3 | CLOUD | glass (虹の橋)、platform ×2、jump + gap、fall 区間 | CloudScenery |
| space | SPACE STATION | circuit | 3 | SPACE | spin + turnstile、magnet + bank 40°、space tunnel (窓) + speedBonus + draftZone、jump + gap | SpaceScenery |
| rain | RAIN CITY | circuit | 3 | RAIN | wet (全面)、splash (水たまり)、city tunnel + speedBonus、weather rain | RainScenery |
| skyline | SKYLINE ZERO | circuit | 4 | SKYLINE | jump + gap、glass、wind、bank、fall 区間 | SkylineScenery |
| frost | FROSTBITE PASS | circuit | 4 | FROST | snow / ice、ice tunnel、jump + gap、氷の橋 | FrostScenery |
| magma | MAGMA FACTORY | circuit | 4 | MAGMA | gate (交互)、slide (ピストン)、conveyor、jump + gap | MagmaScenery |
| jungle | JUNGLE TEMPLE RUN | circuit | 4 | JUNGLE | dirt / mud / water、log、pillar (分岐)、rock tunnel、jump + gap | JungleScenery |
| toybox | TOYBOX MAYHEM | circuit | 4 | TOYBOX | seesaw、spin、cross (列車)、wind (扇風機)、連続 jump、conveyor | ToyboxScenery |
| neon | NEON GRAVITY | circuit | 5 | NEON | 立体交差、bank 52°、neon tunnel、jump + gap | NeonScenery |
| tokyo | TOKYO MIDNIGHT EXPRESS | pointToPoint | 2 | TOKYO | city tunnel + speedBonus + draftZone、speedGate、らせんジャンクション、夜 | TokyoScenery |
| coastal | COASTAL SUNSET DRIVE | pointToPoint | 2 | COASTAL | splash (周期的な波)、bank、rock tunnel、入り江の橋 | CoastalScenery |
| northern | NORTHERN LIGHTS | pointToPoint | 2 | NORTHERN | snow / ice (凍った湖)、ice tunnel、cross + reindeer、weather aurora、夜 | NorthernScenery |
| europe | EUROPE GRAND TOUR | pointToPoint | 2 | EUROPE | cobble、分離帯 + drawbridge + speedGate (Dynamic Route Split)、rock tunnel | EuropeScenery |
| alpine | ALPINE ZERMATT RUN | pointToPoint | 3 | ALPINE | drop (落石)、snow (ヘアピン内側・雪道)、rock tunnel (ギャラリー)、ice (氷河)、weather snow | AlpineScenery |
| desert | DESERT CANYON RUN | pointToPoint | 3 | DESERT | sand、wind (windsock)、rock tunnel (洞窟)、jump + gap、drop、weather sandstorm (区間) | DesertScenery |

★ の定義: ★1 とてもかんたん / ★2 はじめての人向け / ★3 ふつう / ★4 むずかしい / ★5 上級者向け (★2 が最多になるように付ける)。

## コースの追加手順

1. `src/config/courses/<id>.ts` を作り `CourseDef` を export する。`raceType`・`highlight` (見せ場)・`tips` (攻略) も書く
2. `src/config/courses/index.ts` の `COURSES` に追加。新しい背景なら `types.ts` の `SceneryKind` に追加
3. `npm run check:courses -- <id> --fast --cp --ppm <DIR>` で形 (重なり・最小半径・構造) と、制御点ごとの割合 (ギミック配置の目安)、
   俯瞰図 (PPM) を確認
4. `gimmicks` 配列にギミックを並べる (位置はコース全長に対する割合 0..1)
5. 背景は `src/courses/scenery/<Name>Scenery.ts` を作り `CourseView.ts` の `SCENERY_BUILDERS` へ登録。
   共通部品は `scenery/SceneryKit.ts` (道路沿いの配置・街灯・ビル・山並み・地面タイル・橋脚・ケーブル・看板)。
   **道路沿いの物は `roadsidePoint` / `alongRoad` で安全帯の外に置く**。地形は `buildTerrain` (baseHeight / palette で形と色)
6. `npm run check:courses -- <id>` で **Road Safety Corridor** (地形・背景物の道路への侵入) を確認
7. `npm run sim -- <id>` で全難易度の NPC が完走できるか確認 (`--verbose` で復帰の場所と理由)
8. `?debug&race=<id>&at=0.3` で実際の見た目を確認 (F6 で安全帯・侵入点、F3 でいまいる場所のギミック)

## Road Safety Corridor (道路の安全帯)

- 定義: `src/courses/RoadClearance.ts` (`drivableExtent`・`RoadCorridor`・`scanIntrusions`)、値は `config/courseQuality.ts`
- 帯 = 路面 + 路肩 + 芝のランオフ (壁の内面まで)。帯の中の 路面 +0.35m〜+4.5m に物があると侵入 (頭上の物は対象外)
- 地形 (`Terrain.ts`): 高さ = min(地形の関数, `RoadCorridor.terrainLimit`)。**最寄りの1区間ではなく近くの全区間**から上限を計算するので、
  上下に重なる道・近接するヘアピンでも別の区間の山肌が道路を覆わない
- 検査 (`scripts/lib/courseSceneCheck.ts`): 背景を Node 上で組み立て (DOM スタブ)、全メッシュの三角形を調べる。
  巨大な板 (地面・海) は道路上の点の真上/真下を調べる。意図して道路上に置く物は `userData.clearanceExempt = true`
  (道路自身・ギミック・天候・端の壁など。海中区間の海面のように設計上の例外はコメントで理由を書く)
- 構造検査 (`scripts/lib/courseStructureCheck.ts`): 周回は閉ループ / P2P は非閉ループ・助走路と退避路の長さ・CP の順番と間隔・
  ゴール・極端な曲率・狭い道・ジャンプの着地・NPC 理想ラインの急な横移動

## ギミックの仕組み

- 定義: `src/config/gimmicks.ts` の `GimmickDef` (型) と `gimmickConfig` (調整値)
- 実行: `src/gimmicks/GimmickSystem.ts` と `src/gimmicks/Obstacle.ts` (時刻の関数として決定的に動く障害物)
- 描画: `src/gimmicks/GimmickView.ts` (路面・パッド・ジャンプ・コンベア・風・障害物・シーソー・トンネル) と
  `src/gimmicks/GimmickExtrasView.ts` (加速ゲート・スリップストリーム区間・水しぶき・動く足場・跳ね橋・トンネル加速の照明)
- 道路の切れ目 (`jump` の `gap` / `gap`) とバンク (制御点の `bank`) は `Track` が管理。
  その瞬間だけ道路がない場所 (上がった跳ね橋・足場の外) は `TrackCollision.dynamicGap`
- 物理への反映: `VehicleBody` の `surfaceKind` / `transformMode` / `padBoostTimer` (+ `boostMaxSpeedMul`) / `bank` /
  区間の効果 `zoneMaxSpeedMul` `zoneAccelMul` `zoneGripMul` `zoneDrag` / `draft` を `VehiclePhysics` が参照
- スリップストリームは `RaceWorld.applySlipstream` (全車同じ式)

| v3 のギミック | 書き方 |
|---|---|
| 加速ゲート | `{ type: 'speedGate', at, lateral, width? }` |
| スリップストリーム強化区間 | `{ type: 'draftZone', from, to, multiplier }` (トンネルと重ねると Draft Tunnel) |
| トンネル加速 | `{ type: 'tunnel', ..., speedBonus: 0.04 }` |
| 水しぶき | `{ type: 'splash', from, to, lateralMin?, lateralMax?, period?, activeFraction? }` (period なし = 常に水たまり) |
| 動く足場 | `{ type: 'platform', from, to, width, amplitude, period, phase? }` (道幅は足場の動く範囲より広く、路肩は fall) |
| 跳ね橋 | `{ type: 'drawbridge', from, to, lateralMin, lateralMax, period, openFraction }` (遮断機は自動) |
| 落下物 | `obstacle` の `motion: { kind: 'drop', laterals: [...], period }` + `style: 'rock' / 'crate'` |
| 回転ゲート | `obstacle` の `motion: { kind: 'spin', ... }` + `style: 'turnstile'` |
| 車線分岐 / 近道ゲート | `style: 'divider'` の static obstacle を途切れなく並べ、片方の車線にだけ gate / drawbridge / speedGate / 路面 |
| 路面 | `surface` の `sand` / `wet` / `cobble` / `magnet` |
| 天候 | `environment.weather = { kind: 'rain' / 'sandstorm' / 'snow' / 'aurora', intensity?, zones? }` |
| 風の見た目 | `wind` の `style: 'windsock'` (屋外) / 既定 `'fan'` (扇風機) |

### 設計上の約束

- ギミックはコース専用の if 文にしない (種類ごとの再利用可能な処理)
- 動く物は乱数を使わず周期で動く。閉まる・横切る・落ちる・波が来る前に予告 (ランプ点滅・赤い影・光る水)
- 障害物は PURE RACE で恒久的なダメージを与えない (速度が落ちるだけ)
- 静止物・ゲートは道幅全体を塞がない (テストで確認)
- 道路の切れ目で落ちたら通常のコースアウト扱い (2秒操作不能)。復帰位置は助走距離を確保し、跳ね橋・足場の上や障害物の真後ろは避ける
- ジャンプ中は空中補正で道路の向きへ寄せる (`jump.airAlignRate`)
- ギミックは運転の楽しさを増やすために置く。常に障害物が飛んでくるコースにしない

### NPC とギミック

- 基本ラインは部分的に滑る路面 (波・雪・水たまり) を避ける (`RacingLine.avoidLowGrip`)
- 速度計画はライン上の路面グリップ (× 路面の理解度 `surfaceAwareness`) とバンクのグリップ増加を考慮
- 動く障害物は `adviseObstacles` で到達時刻の位置を予測 (`obstacleAnticipation`)。近い障害物 (`npc.obstacleGroupDistance` 以内) は
  まとめて考え、分離帯の横に入った後は反対側へ移らない。抜けられない時 (閉じたゲート) は開くタイミングに合わせて減速して待つ
- 動く足場は `platformAhead` で到達時刻の足場の中心を狙う
- ブーストパッド・加速ゲートはパッドごとに `gimmickUsage` の確率で狙う
- ジャンプ台の手前では飛び越えられる速度を保つ (`npc.runtime.jumpApproachSpeed`)
- Point to Point のゴール後は退避路の中で止まる
