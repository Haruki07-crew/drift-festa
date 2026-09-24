# CHANGELOG

## [2.0.0] - 2026-09-23

### Changed
- 操作方法を統一: 1人 = A/F/E/W + Space、2人 = P1 A/F/E/W + Space / P2 矢印 + Enter (`drivingBindings`)
- コース設定を 1コース1ファイル (`src/config/courses/`) に分割
- AI プロンプト履歴の Git 管理を廃止 (`docs/prompts/` と `.ai-local/` を `.gitignore`)。引き継ぎは DEVELOPMENT_STATUS.md

### Added
- 新コース 7 つ (計 10): AQUA SHIFT / SKYLINE ZERO / FROSTBITE PASS / MAGMA FACTORY / NEON GRAVITY / JUNGLE TEMPLE RUN / TOYBOX MAYHEM
- コースギミック共通システム (`src/gimmicks/`, `config/gimmicks.ts`): 路面 (雪・氷・土・泥・水・ガラス・鉄板)、ブーストパッド、
  ジャンプ台と道路の切れ目、水中変形、横風、コンベア、動く障害物 (ゲート・ピストン・回転・列車)、シーソー、トンネル、バンク
- 水中走行モードの見た目 (タイヤ格納・ヒレ・プロペラ・水中の霧)、バンクに合わせた車体とカメラの傾き、ジャンプの空中補正
- NPC 難易度「最強 ULTIMATE」(120 パターン / コース)。ギミック・路面・障害物の到達時刻予測に対応
- BATTLE DUEL の最強 NPC (命中までの時間を考えた発砲・戦略的なアイテム使用)
- デバッグ: ギミックの3D表示・NPC の判断状態、`?debug&race=...&at=...` でレースへ直接入る
- テスト追加 (計 79 件): キー割り当て、Ultimate、120 パターン、10 コースのロードと完走、ギミック、BATTLE Ultimate、オフライン

## [1.0.0] - 2026-09-23

### Added
- プロジェクト基盤 (Vite + TypeScript strict + Three.js)、`npm run festival`
- 自前のアーケード車両物理: 加減速・速度依存ステア・横グリップ・横滑り・ドリフト・駆動方式 (FF/FR/MR/AWD)・重量差のある車同士の接触・壁・芝ランオフ・落下
- コース 3 種 (Circuit Aurora / Kage Touge / Neo Harbor)、スプライン中心線、背景 (地形・木・ビル・ネオン)
- 見えないチェックポイント・周回判定・順位計算・タイム差 (+1.42s 形式)
- コースアウト復帰 (最後のチェックポイント、6 秒操作不能、衝突無効時間)
- NPC: 理想ライン (弾性バンド法) + パターン別基本ライン + 速度計画 + リアルタイム補正 (回避・追い越し・追従・ブロック・姿勢復帰・スタック脱出・ミス)
- NPC パターン 90 / コース (Weak / Normal / Strong × 30、合計 270)、性格 7 種、ID 例 `TOUGE_STRONG_017`
- 10 車種 (長所・短所あり)、車選択画面のステータスバー
- PURE RACE 1〜2 人 (左右分割画面・独立 HUD / ミニマップ)、2〜8 台
- BATTLE DUEL: タイヤHP、銃 (慣性のある弾丸・オブジェクトプール)、アイテム 3 種、アイテムボックス、偏差射撃 AI、マウス照準
- HUD、ミニマップ、カウントダウン、結果画面 (自動タイトル復帰)、ポーズ、設定画面、あそびかた
- UI テーマ 4 種、Web Audio 合成の効果音とエンジン音
- LocalStorage (設定・ベストタイム・前回の選択)
- デバッグモード (オーバーレイ・3D ギズモ・自動運転・早送り)
- 自動テスト (Vitest 46 件)、コース検証・NPC シミュレーション・オフライン検査スクリプト
