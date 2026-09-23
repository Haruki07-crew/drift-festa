# DEVELOPMENT_STATUS

> 複数セッションにまたがる開発の永続的な作業状態。作業開始時に必ず読むこと。
> 読む順: specification.md (= GAME_SPEC.md) → claude.md → ai_workflow.md → このファイル

## 最終更新
2026-09-23 (Session 1 / Claude Opus 5.5)

## 現在の状態: v1.0.0 — 仕様の全機能を実装済み・動作確認済み

### 完成している機能
- PURE RACE: 1〜2人 (左右分割・独立HUD/ミニマップ)、2〜8台、NPC、3周、順位、タイム差、CP、コースアウト復帰(6秒)
- BATTLE DUEL: タイヤHP、銃(慣性弾・プール)、アイテム3種・ボックス、偏差射撃AI、マウス照準(ポインターロック)
- 車10台 / コース3 (Aurora・Touge・Harbor) / NPC 270パターン / 性格7種
- UI: タイトル→モード→人数→台数→難易度→車→コース、あそびかた、設定、ポーズ、結果(自動タイトル復帰)
- テーマ4種、合成効果音+エンジン音、LocalStorage、デバッグ (F3/F4/F6/F8/F9、?debug=1)
- Festival Mode (`npm run festival`: 本番ビルド・デバッグ無効・プレビュー起動・ブラウザ自動オープン)

### 確認済み (Session 1)
- `npm run typecheck` / `npm test` (46件) / `npm run build` / `npm run check:offline` すべて OK
- `npm run sim`: 3コース×3難易度で NPC 全車完走
- ヘッドレス Chrome (puppeteer-core をスクラッチに入れて使用。プロジェクト依存には入れていない) で
  タイトル→PURE 1P/2P→BATTLE→結果画面 を確認。コンソールエラー 0、外部リクエスト 0
- 連続13回のレース開始で GPU の geometries/textures/programs が増えない (影マップのリークを修正済み)
- festival ビルドで ?debug=1 を付けてもデバッグ無効

### 未確認 / 人間による確認が必要
- **実機で人間が操作したときの操作感** (ステアの効き・ドリフトの気持ちよさ・NPC の強さのバランス)。
  自動テストとシミュレーションでは検証済みだが、実際に遊んでの調整は未実施
  → 調整は src/config/physics.ts (steering, drift) と npc.ts (cornerSpeedFactor 等)
- 実際の効果音の聞こえ方 (ヘッドレスでは確認できない)
- 20レース以上の実プレイ連続稼働 (自動では13回の再スタートまで確認)
- Windows 環境での `npm run festival`
- キーボードのゴースティング (機種依存)

## 次にやるとよいこと (優先順)
1. 実際に遊んで physics / NPC の数値調整 (F3/F6 デバッグ表示を活用)
2. 文化祭 PC で ai_workflow.md の Festival Release Checklist を実施
3. (任意) Kage Touge にヘアピンを追加するなどコース改善 → `npm run check:courses` と `npm run sim` で検証
4. (任意) Git リポジトリ化 (現状は未初期化)

## 主なファイル
- 全体構成: docs/architecture/README.md
- レース本体: src/game/RaceWorld.ts (ロジック) / RaceSession.ts (描画・入力・音の統合)
- 物理: src/physics/VehiclePhysics.ts、NPC: src/npc/NpcDriver.ts、バトル: src/battle/BattleManager.ts
- 画面遷移: src/core/App.ts, src/ui/screens/SetupFlow.ts

## 既知の注意点
- ~/.npm に root 所有ファイルがあり npm install が EACCES になる環境あり。
  回避: `npm_config_cache=<書込可能ディレクトリ> npm install`、恒久対策: `sudo chown -R 501:20 ~/.npm`
- claude.md / ai_workflow.md は小文字ファイル名 (macOS では CLAUDE.md 等と同一扱い。Linux では要注意)
- specification.md が原本、GAME_SPEC.md はその写し + 実装メモ。仕様変更時は両方の整合に注意
