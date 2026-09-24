# DEVELOPMENT_STATUS

> 複数セッションにまたがる開発の永続的な作業状態。作業開始時に必ず読むこと。
> 読む順: GAME_SPEC.md (正式仕様) → claude.md → ai_workflow.md → このファイル
> (specification.md は初版 v1 の原本。最新仕様は GAME_SPEC.md)

## 最終更新
2026-09-23 (Session 2 / Claude Opus 5.5) — v2.0.0 拡張 完了

## 現在の状態: v2.0.0 — 依頼 (.ai-local/requests/2026-09-23_drift-festa_controls-courses-ultimate-npc.md) を全項目実装済み

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
1. 実際に遊んで調整 (src/config/gimmicks.ts、npc.ts、courses/*.ts)。F3/F6 と `?debug&race=..&at=..` を活用
2. 文化祭 PC で ai_workflow.md の Festival Release Checklist
3. (任意) ギミックの効果音を増やす、コースごとの目安タイム表示

## 次に実行するコマンド
```bash
npm install        # 初回のみ
npm run dev        # http://localhost:5173/?debug&race=aqua&diff=ultimate
npm test && npm run sim
```

## 主なファイル
- 全体構成: docs/architecture/README.md、コースとギミック: docs/courses/README.md
- レース本体: src/game/RaceWorld.ts (ロジック) / RaceSession.ts (描画・入力・音の統合)
- ギミック: src/gimmicks/GimmickSystem.ts, Obstacle.ts, GimmickView.ts / 設定 src/config/gimmicks.ts
- 物理: src/physics/VehiclePhysics.ts, TrackCollision.ts、NPC: src/npc/NpcDriver.ts, RacingLine.ts, NpcPatterns.ts
- バトル: src/battle/BattleManager.ts, BattleAI.ts
- 画面遷移: src/core/App.ts, src/ui/screens/SetupFlow.ts

## 既知の注意点
- ~/.npm に root 所有ファイルがあり npm install が EACCES になる環境あり。
  回避: `npm_config_cache=<書込可能ディレクトリ> npm install`、恒久対策: `sudo chown -R 501:20 ~/.npm`
- claude.md / ai_workflow.md は小文字ファイル名 (macOS では CLAUDE.md 等と同一扱い。Linux では要注意)
- tsconfig.json は src のみ、tests と scripts は tsconfig.node.json (Node 型あり) で型チェック
- NEON GRAVITY の立体交差: 中心線への射影は前回位置の近傍を探索するので、車の復帰・配置時は trackHint を必ず設定する
  (RaceWorld.placeOnGrid / respawn / placeCarAt で対応済み)
- tmp.md (リポジトリ直下) は Git 管理外にしていない。push 前に削除するか .ai-local/ へ移すこと
