# CHANGELOG

## [3.1.0] - 2026-10-08

### Added
- キー設定: 設定画面の「キー設定」で 1P (1人・2人の P1・BATTLE DUEL) / 2P の運転キー 5 操作を変更できる。
  キーを押して割り当て、使用中のキーは入れ替え、システム用キー (Esc・デバッグ・4 など) は拒否、「すべて初期設定に戻す」。
  LocalStorage に保存 (検証つき)。文化祭モードでは起動時に初期設定へ戻す。あそびかた画面は今のキーを表示
- テスト追加 (計 135 件): 割り当て・入れ替え・拒否・保存/初期化・壊れたデータ

### Changed
- 初期設定は従来どおり (1P = A/F/E/W + Space、2P = 矢印 + Enter)。`DEFAULT_KEY_BINDINGS` に一本化

## [3.0.0] - 2026-09-25

### Added
- コースの種類 `raceType`: CIRCUIT (周回) / **POINT TO POINT (スタート → ゴールの一本道)**。
  開いた道の Track (助走路・退避路・道の両端の壁)、START → 中間チェックポイント → GOAL の判定と順位、
  HUD (進行度 % / 残り距離 / 区間名)、追従ミニマップ + 進行バー、結果画面の平均速度、START / GOAL ゲート
- 新コース 14 本 (計 24): POINT TO POINT = TOKYO MIDNIGHT EXPRESS / ALPINE ZERMATT RUN / COASTAL SUNSET DRIVE /
  DESERT CANYON RUN / NORTHERN LIGHTS / EUROPE GRAND TOUR、CIRCUIT = AIRPORT RUSH / VOLCANO ISLAND / MEGA MALL /
  SCHOOL FESTIVAL CHAOS / CLOUD KINGDOM / SPACE STATION / RAIN CITY / WIND FARM HILLS。それぞれ専用の背景と見せ場
- 新ギミック: 加速ゲート、スリップストリーム (全コース共通) と Draft Zone / Draft Tunnel、トンネル加速、水しぶき (水たまり・周期的な波)、
  動く足場、跳ね橋 (遮断機つき)、落下物 (予告の影)、回転ゲート、中央分離帯による車線分岐 (Dynamic Route Split / Shortcut Gate)、
  路面 砂 / 濡れ / 石畳 / 磁力道路、風の見た目 (吹き流し)、障害物の見た目 (岩・トナカイ・手荷物カート・山車・分離帯)
- 天候: 雨 / 砂嵐 (区間の霧と空のもや) / 雪 / オーロラ
- コース選択画面: タイプ → やさしい順のカード (★・距離・目安タイム・特徴アイコン・見どころ・コース図)
- Road Safety Corridor: 地形の高さ制限 (近くの全道路区間から計算)、`check:courses` の背景侵入検査 (Node 上でシーンを組み立てる) と
  構造検査 (閉ループ/非閉ループ・CP 順・ゴール・急カーブ・狭い道・ジャンプ着地・NPC ライン)、デバッグ表示 (F6)
- 夜の視認性: 人間の車のヘッドライト、カーブ外側の誘導灯・矢印看板・路肩の反射材
- カメラ: 速度と曲率に応じてコースの先を見る注視点、少し高いカメラ
- NPC: 部分的に滑る路面を避けるライン、複数の障害物をまとめて避ける判断・分離帯の反対側へ移れない、ゲート待ち、
  動く足場の予測、P2P のゴール後の停止
- デバッグ: コース種別・進行度・残り距離・区間・道幅・いまいる場所のギミック・スタート/ゴールの柱・ヘッドライト範囲
- テスト追加 (計 125 件): Point to Point、新ギミック、コース一覧/★、選択画面の情報、Road Safety Corridor、復帰 2 秒

### Changed
- コースアウト後の操作不能を 6 秒 → **2 秒** (`physics.respawn.lockSeconds`)、衝突無効時間 3.5 秒
- 難易度 ★ の定義を明確化し付け直し (★2 が最多: ★1×1 ★2×9 ★3×8 ★4×5 ★5×1)。TOYBOX MAYHEM は ★4
- Neo Harbor の路面を少し明るく

### Fixed
- Kage Touge などで山肌の地形が道路を覆っていた問題 (地形の高さを最寄りの1区間だけで決めていたのが原因)
- 背景物の道路への侵入: Circuit Aurora のゲートの柱、AQUA SHIFT の魚の軌道、NEON GRAVITY の柱とリング、
  JUNGLE TEMPLE RUN の滝・崖・吊り橋、TOYBOX MAYHEM の本と鉛筆
- 横並びで接触した NPC 同士が追従ブレーキで2台とも遅くなる問題
- ジャンプの切れ目の中のチェックポイント (着地側へずらす)
- ジャンプの切れ目の下の地形が浅い溝に見えていた問題 (深い谷にする)

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
