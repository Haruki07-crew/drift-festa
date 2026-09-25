# DEVELOPMENT_STATUS

> 複数セッションにまたがる開発の永続的な作業状態。作業開始時に必ず読むこと。
> 読む順: GAME_SPEC.md (正式仕様) → claude.md → ai_workflow.md → このファイル
> (specification.md は初版 v1 の原本。最新仕様は GAME_SPEC.md)

## 最終更新
2026-09-25 (Session 3 / Claude Opus 5.5) — **v3.0.0 完了** (依頼 .ai-local/requests/2026-09-25_course-expansion-and-quality-improvements.md の全項目)
未コミット (ユーザーの指示があるまでコミット・push しない)

## 現在の状態: v3.0.0

### 完成した内容 (依頼書の章番号)
- [x] 2〜4 既存コースの品質確認と Road Safety Corridor
      - 原因: 地形の高さを最寄りの1区間だけで決めていた → 近くの全道路区間から上限を計算 (Terrain.ts + RoadClearance.terrainLimit)
      - 修正した侵入: Kage Touge / Frost / Jungle の地形、Aurora のゲート柱、Aqua の魚、Neon の柱とリング、Jungle の滝・崖・吊り橋、Toybox の本と鉛筆
      - `npm run check:courses` が背景を Node 上で組み立てて侵入を自動検出 (巨大な板は道路上の点で検査)。**全24コース OK**
      - 構造検査 (scripts/lib/courseStructureCheck.ts)、デバッグ F6 (水色=安全帯 / 緑=地形が上がり始める線 / 赤柱=侵入 / START・GOAL の柱)
      - 既存10コースは 3 か所ずつスクショでも目視確認済み (道路を覆う地形・背景物なし)
- [x] 5 コースアウト後の操作不能 6秒 → 2秒 (physics.respawn.lockSeconds、衝突無効 3.5秒)。README/仕様/あそびかた更新、テストあり
- [x] 6 夜の視認性: ヘッドライト (CarModel.addHeadlight)、NightGuides.ts (誘導灯・矢印看板・反射材)、街灯、
      カメラの先読み (ChaseCamera.applyTrackLook、cameraConfig.trackLook)。Harbor の路面を明るく
- [x] 7/15 raceType circuit / pointToPoint (Track 開いた道・RaceProgress・HUD・ミニマップ追従・結果画面・START/GOAL ゲート・端の壁)
- [x] 8/18 コース選択: タイプ → やさしい順のカード (src/ui/screens/CourseSelect.ts、CourseInfo.ts、config/courseInfo.ts)
- [x] 9/17 ★の定義と付け直し: ★1×1 ★2×9 ★3×8 ★4×5 ★5×1 (europe ★2、toybox ★4)
- [x] 10/12 新コース14本 (計24)。全コースに highlight (見せ場) と tips
      P2P: tokyo★2 coastal★2 northern★2 europe★2 alpine★3 desert★3
      Circuit: airport★2 mall★2 school★2 windfarm★2 volcano★3 cloud★3 space★3 rain★3
      依頼書の要素 (alpine の 村→森→雪道→氷河→山頂 の上り、coastal の橋、desert の洞窟・石橋・オアシス、volcano の洞窟、
      mall のフードコート・屋上駐車場、school の廊下・巨大な机と椅子、cloud の巨大風車、space の巨大窓、northern のトンネル、
      europe の山・湖・トンネル) も反映済み
- [x] 11 ギミック: Speed Gate / Slipstream + Draft Zone / Draft Tunnel / Tunnel Speed / Bank Assist (bank) / Water Splash /
      Mud / Ice / Moving Bridge (drawbridge) / Rotating Gate (turnstile) / Falling Object (drop) / Shortcut Gate (school の体育館) /
      Moving Platform / Magnetic Road / Dynamic Route Split (europe の運河)。天候 (雨/砂嵐/雪/オーロラ)
- [x] 14 NPC: 全24コース × 4難易度で全車完走 (npm run sim)。P2P はゴール後に全車が退避路で停止。
      追加: 滑る路面を避けるライン (avoidLowGrip)、複数障害物の同時判断・分離帯の反対側へ移らない・ゲート待ち、足場の予測、
      横並び接触時の追従ブレーキのデッドロック修正、復帰位置が障害物の真後ろにならない
- [x] 16 ミニマップ: P2P は追従表示 + START/GOAL + 進行バー
- [x] 19 性能: 2P + 8台で重いコース10種 60fps (この Mac のヘッドレス Chrome)。24コース連続で geometry/texture 数が元に戻る (リークなし)
- [x] 20 デバッグ: コース種別・進行度・残り距離・区間・道幅・路肩・現在ギミック・侵入数・ヘッドライト範囲 (F3)、安全帯等 (F6)
- [x] 22 テスト: 下の「実行したテスト」
- [x] ドキュメント: README / GAME_SPEC (10章・12〜14章・21章・31章・39章・実装メモ) / CHANGELOG 3.0.0 / docs/courses / docs/architecture

### v3 の主なファイル
- コース定義: src/config/courses/*.ts (24本)、背景: src/courses/scenery/*Scenery.ts + SceneryKit.ts
- Track (開いた道): src/courses/Track.ts、安全帯: src/courses/RoadClearance.ts、設定 src/config/courseQuality.ts
- 夜: src/courses/NightGuides.ts、ゲート: src/courses/RaceGates.ts、天候: src/courses/Weather.ts
- ギミック: src/gimmicks/GimmickSystem.ts, Obstacle.ts, GimmickView.ts, GimmickExtrasView.ts、設定 src/config/gimmicks.ts
- 進行: src/game/RaceProgress.ts、RaceWorld.ts (スリップストリーム・ゴール後停止)
- 画面: src/ui/screens/CourseSelect.ts、src/ui/Hud.ts、src/ui/Minimap.ts、src/ui/screens/ResultScreen.ts
- 検証: scripts/check-courses.ts + scripts/lib/*、scripts/sim-race.ts

### 実行したテスト (最終)
```text
npm run typecheck      → OK
npm test               → 17 files / 125 tests passed
npm run build          → OK
npm run check:offline  → 外部URLなし
npm run check:courses  → 24コース 重なりなし・構造 NG なし・Road Safety Corridor OK
                         (WARN は既存の意図した難所のみ: aqua/jungle/toybox のヘアピン、frost/toybox の幅 9m)
npm run sim            → 24コース × 4難易度 全車完走、P2P は全車ゴール後に停止
                         Ultimate は4試行平均で Strong 以上 (cloud の優勝タイムのみ 0.6秒遅いが最下位は速い、coastal はほぼ同じ)
ヘッドレス Chrome      → 全24コースのスクショ確認、PURE 1P/2P、BATTLE (P2P の europe でも動作)、P2P の結果画面、
                         コース選択画面、夜コース (harbor/neon/magma/tokyo/northern/rain/space)
```

### 現在のエラー
- なし

## Human Playtest Required (人が遊んで判断が必要)
- カメラ高さと先読み (cameraConfig.height / trackLook) — 酔わないか、先のカーブが見えるか
- 夜コースの明るさ (harbor / neon / magma / tokyo / northern / rain / space の ambientIntensity)
- ヘッドライトの強さ・範囲 (nightVisibilityConfig.headlights)、誘導灯の量
- 氷の滑り具合 (frost、northern の湖、alpine の氷河の直線)、雨の濡れた路面 (wet の grip 0.74) が難しすぎないか
- Boost 強度 (boostPad / speedGate)、スリップストリームの強さ (slipstream.maxSpeedBonus 6%)
- 新コースの難易度 (★の付け方) — 特に cloud の動く足場、space の磁力バンク、desert の砂嵐の霧の濃さ
- Point to Point の長さ (ふつうの CPU で 1:00〜1:33。coastal・europe は短め、tokyo は長め) と、周回コースとの遊び比べ
- 各コースの楽しさ・見せ場が伝わるか、ギミックが運転の邪魔になっていないか
- school の近道ゲート・europe の跳ね橋の周期 (待たされすぎないか)
- 効果音 (新ギミックの専用音はまだ無い)、文化祭 PC (Windows) での FPS と `npm run festival`

## 以前の状態: v2.0.0 — 依頼 (.ai-local/requests/2026-09-23_drift-festa_controls-courses-ultimate-npc.md) を全項目実装済み

### v2 で完成した内容
- [x] 操作変更: 1人 = A/F/E/W + Space、2人 = P1 A/F/E/W + Space / P2 矢印 + Enter、BATTLE = A/F/E/W + Space + マウス
      (src/config/controls.ts の drivingBindings。UI・あそびかた・README・GAME_SPEC・claude.md も更新)
- [x] Ultimate (最強) 難易度: npc.ts / battle.ts / BattleAI / UI (「最強 ULTIMATE」) / storage
- [x] NPC パターン 120 / コース (10コースで 1200)。ID 例 AQUA_ULTIMATE_001
- [x] コースギミック共通システム: src/config/gimmicks.ts (GimmickDef + 調整値)、src/gimmicks/ (GimmickSystem, Obstacle, GimmickView)、
      Track の bank (制御点) と gap (jump の gap 指定)、TrackCollision のジャンプ着地、VehicleBody の路面/変形/パッド
- [x] 新コース 7 つ (計10): src/config/courses/*.ts + src/courses/scenery/*Scenery.ts
- [x] NPC のギミック対応: 障害物の到達時刻予測回避 (避ける側を維持)、ブーストパッド狙い、路面グリップとバンクを考慮した速度計画、
      ジャンプ助走、復帰位置の助走確保 (safeRespawnS)、ジャンプの空中補正
- [x] BATTLE Ultimate: maxInterceptTime・弾薬節約・後方時 Boost・必要時だけアイテム取得 (強制命中なし)
- [x] デバッグ: F6 にギミック表示、F3 に路面/変形/NPC decision。`?debug&race=<id>&diff=..&cars=..&players=..&at=0.4` で直接レース
- [x] 性能: 使っていないコースはシーンに持たない (RaceSession ごとに生成・破棄)。10コース連続でリソース数が増えないことを確認
- [x] プロンプト履歴の運用廃止: .gitignore に .ai-local/ docs/prompts/。docs/prompts は git rm --cached 済み (ローカルに残存)。
      claude.md / ai_workflow.md / README / GAME_SPEC を更新
- [x] ドキュメント: GAME_SPEC.md (5, 10, 10.1, 17, 18, 25.1, 39, 40, 41, 42, 実装メモ)、README、claude.md、ai_workflow.md、
      docs/courses (新規)・npc・controls・battle・architecture、CHANGELOG 2.0.0

### 新コースごとの完成状況 (すべて: 形状・ギミック・背景・NPC完走・画面確認 済み)
| コース | ギミック | 状態 |
|---|---|---|
| AQUA SHIFT | 水中変形 (タイヤ格納・ヒレ・霧)、ガラストンネル、浮上ジャンプ、パッド | 完成 |
| SKYLINE ZERO | 大ジャンプ、透明道路、横風、バンク、柵なし | 完成 |
| FROSTBITE PASS | 雪/氷、氷の洞窟、湖へのジャンプ、氷の橋、氷ショートカット、降雪 | 完成 |
| MAGMA FACTORY | 交互ゲート、ピストン、コンベア (順流/逆流)、溶岩ジャンプ | 完成 |
| NEON GRAVITY | 8の字立体交差、52°バンク + カメラロール、ネオントンネル、ジャンプ | 完成 |
| JUNGLE TEMPLE RUN | 土/泥/川、倒木、分岐 (中央の石壁)、洞窟、吊り橋、滝 | 完成 |
| TOYBOX MAYHEM | シーソー、回転積み木、列車、扇風機の風、バウンド床、レール、鉛筆の橋、本のジャンプ | 完成 |

### Ultimate NPC の完成状況
- 全10コースで完走。Strong より平均で速い (4試行平均の優勝タイム: frost strong 163.4s / ultimate 157.8s、
  magma 112.7s / 106.4s)。1試行だと車・パターンの組み合わせで逆転することはある (ばらつき)

### 実行したテスト (最終)
```text
npm run typecheck      → OK
npm test               → 12 files / 79 tests passed
npm run build          → OK
npm run check:offline  → 外部URLなし
npm run check:courses  → 10コース OK
npm run sim            → 10コース × 4難易度 全車完走 (復帰は各レース 0〜3 回程度)
ヘッドレス Chrome      → 全10コース描画確認、BATTLE (magma)、2P (neon) エラーなし、2P+8台 60fps、
                         10コース連続起動で geometry/texture 数が増えない
```

### 現在のエラー
- なし

### 未確認 / 人間による確認が必要
- 実機で人が操作した時の操作感 (新キー配置、各コースの難しさ、氷の滑り具合、ジャンプの気持ちよさ、ゲートの周期)
- 効果音の聞こえ方 (ヘッドレスでは確認不可)
- Windows での `npm run festival`、20レース以上の実プレイ連続稼働
- 低スペック PC での FPS (特に JUNGLE / FROST の地形と木、AQUA の海)

## 次にやるとよいこと
1. 上の Human Playtest Required を実際に遊んで確認し、src/config/ の値で調整 (gimmicks.ts / graphics.ts / courses/*.ts / npc.ts)
2. 問題がなければユーザーの指示でコミット (v3 はすべて未コミット)
3. 文化祭 PC で ai_workflow.md の Festival Release Checklist
4. (任意) 新ギミックの効果音 (跳ね橋のベル・落石・波・加速ゲート)、★フィルタ

## 次に実行するコマンド
```bash
npm install        # 初回のみ
npm run dev        # http://localhost:5173/?debug&race=tokyo&diff=ultimate&at=0.5
npm test && npm run check:courses && npm run sim
```

## 主なファイル
- 全体構成: docs/architecture/README.md、コースとギミック: docs/courses/README.md
- レース本体: src/game/RaceWorld.ts (ロジック) / RaceSession.ts (描画・入力・音の統合)
- ギミック: src/gimmicks/GimmickSystem.ts, Obstacle.ts, GimmickView.ts / 設定 src/config/gimmicks.ts
- 物理: src/physics/VehiclePhysics.ts, TrackCollision.ts、NPC: src/npc/NpcDriver.ts, RacingLine.ts, NpcPatterns.ts
- バトル: src/battle/BattleManager.ts, BattleAI.ts
- 画面遷移: src/core/App.ts, src/ui/screens/SetupFlow.ts, CourseSelect.ts
- v3 の追加ファイルは上の「v3 の主なファイル」

## 既知の注意点
- ~/.npm に root 所有ファイルがあり npm install が EACCES になる環境あり。
  回避: `npm_config_cache=<書込可能ディレクトリ> npm install`、恒久対策: `sudo chown -R 501:20 ~/.npm`
- 背景の配置は必ず安全帯の外 (SceneryKit.roadsidePoint / alongRoad / buildings は建物の角まで道路から離す)。追加後は check:courses
- 周回を前提にした処理は Track.closed / nextIndex / segmentCount / forwardDistance を使う (P2P で終点→始点の区間を作らない)
- claude.md / ai_workflow.md は小文字ファイル名 (macOS では CLAUDE.md 等と同一扱い。Linux では要注意)
- tsconfig.json は src のみ、tests と scripts は tsconfig.node.json (Node 型あり) で型チェック
- NEON GRAVITY の立体交差: 中心線への射影は前回位置の近傍を探索するので、車の復帰・配置時は trackHint を必ず設定する
  (RaceWorld.placeOnGrid / respawn / placeCarAt で対応済み)
- tmp.md (リポジトリ直下) は Git 管理外にしていない。push 前に削除するか .ai-local/ へ移すこと
