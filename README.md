# DRIFT FESTA — 文化祭用 3D ローポリ カーレース

ブラウザで動く後方視点の 3D カーレースゲームです。文化祭で PC を1台置いて、
小さい子から大人までその場ですぐ遊べることを目標にしています。
**実行時はインターネット接続不要 (完全オフライン)** です。

- PURE RACE: 1〜2人 (左右分割画面) + CPU で合計 2〜8 台、3周レース
- BATTLE DUEL: 1人 vs CPU。銃とアイテムで妨害しながら 3周レース
- 架空の車 10 台 (FF / FR / MR / AWD)、コース 3 つ、CPU の強さ 3 段階
- 音はすべて Web Audio API で実行時に合成 (音声ファイルなし)、BGM なし

---

## 目次

1. [必要環境](#必要環境)
2. [セットアップ](#セットアップ)
3. [開発・ビルド・起動](#開発ビルド起動)
4. [文化祭当日の起動 (担当者向け)](#文化祭当日の起動-担当者向け)
5. [操作方法](#操作方法)
6. [デバッグ方法](#デバッグ方法)
7. [設定ファイル (バランス調整)](#設定ファイル-バランス調整)
8. [ディレクトリ構造](#ディレクトリ構造)
9. [テスト・検証コマンド](#テスト検証コマンド)
10. [オフラインについて](#オフラインについて)
11. [トラブルシューティング](#トラブルシューティング)
12. [外部アセットとライセンス](#外部アセットとライセンス)
13. [AI 開発履歴](#ai-開発履歴)

---

## 必要環境

| 項目 | 推奨 |
|---|---|
| OS | Windows 10/11, macOS 13 以降 (Linux も可) |
| ブラウザ | **Google Chrome 最新版** (Edge / Firefox / Safari も動作想定) |
| Node.js | **v20 以上 (推奨 v22 LTS)**。開発・ビルド時のみ必要 |
| npm | Node.js 付属のもの (v10 以上) |
| GPU | WebGL2 対応。内蔵 GPU でも「低」画質なら動作 |
| 入力 | キーボード (BATTLE DUEL はマウスも) |

## セットアップ

インターネットに繋がる環境で1回だけ実行します。

```bash
git clone <repository-url>
cd club_game_proj
npm install
```

> npm install で `EACCES` (権限エラー) が出る場合は、npm のキャッシュ権限の問題です。
> `sudo chown -R $(id -u):$(id -g) ~/.npm` を実行するか、
> `npm_config_cache=/tmp/npmcache npm install` のように別のキャッシュ場所を指定してください。

## 開発・ビルド・起動

```bash
npm run dev        # 開発サーバー http://localhost:5173 (デバッグ機能 ON)
npm run build      # 型チェック + 本番ビルド (dist/ に出力)
npm run preview    # ビルド成果物を http://localhost:4173 で確認
npm test           # 自動テスト (Vitest)
```

## 文化祭当日の起動 (担当者向け)

**当日はこの章だけ読めば OK です。インターネットは不要です。**

1. PC の電源を入れ、ターミナル (Windows は「PowerShell」または「コマンドプロンプト」) を開く
2. 次を入力して Enter

   ```bash
   cd club_game_proj   # このフォルダの場所に合わせる
   npm run festival
   ```

3. 自動でブラウザが開き、タイトル画面が出ます (開かない場合は Chrome で `http://localhost:4173` を開く)
4. 画面をクリック → **F11** (Mac は Ctrl+Cmd+F) で全画面にする。ゲーム内の「設定 → フルスクリーン」でも可
5. 終わるときはターミナルで **Ctrl + C**

`npm run festival` は「本番ビルド (デバッグ機能 OFF) → ローカルサーバー起動 → ブラウザを開く」を行います。
2回目以降でビルド済みなら `npm run festival:serve` でビルドを省略して起動できます。

- 結果画面で 60 秒操作がないと自動でタイトルへ戻ります (設定で変更可)
- 画質が重いと感じたら「設定 → グラフィック品質 → 低」
- 事前準備: 前日までに `npm install` と `npm run festival` を一度成功させておくこと

## 操作方法

### PURE RACE (1人)

| キー | 動作 |
|---|---|
| ↑ | 前進 |
| ↓ | ブレーキ / 後退 |
| ← → | ハンドル |
| Shift | ドリフト |

### PURE RACE (2人・左右分割)

| | Player 1 (左画面) | Player 2 (右画面) |
|---|---|---|
| 前進 | ↑ | **A** |
| 後退 | ↓ | **F** |
| 右 | → | **E** |
| 左 | ← | **W** |
| ドリフト | Shift | **Enter** |

> P2 の **A / F / E / W** (前 / 後 / 右 / 左) は、小さい子でも小指〜人差し指で操作しやすいよう
> 意図的に決めた配置です。一般的な WASD に変更しないでください。

### BATTLE DUEL (1人)

| 操作 | 動作 |
|---|---|
| A / F / E / W | 前進 / 後退 / 右 / 左 |
| Space | ドリフト |
| マウス移動 | 照準カーソルを動かす (カメラは自動) |
| 左クリック | 発砲 (長押しで連射) |
| 右クリック | 照準を画面中央へ |
| ホイール | アイテム選択 |
| ホイールクリック | 選択中のアイテムを使う |
| 4 | 選択中のアイテムを捨てる |

ゲーム画面をクリックするとマウスカーソルが画面内に固定されます (Esc で解除 → ポーズ)。

### 共通

- **Esc**: ポーズ (再開 / リスタート / 設定 / タイトルへ)。2人プレイ中もゲーム全体が止まります
- メニュー: 矢印キー + Enter、Esc / Backspace で戻る。マウスでも操作可

### ルール

- 全コース3周。最初にゴールした車が勝ち
- 柵のない場所から落ちると、最後に通過したチェックポイントへ戻り **6 秒間操作不能**
- BATTLE DUEL: タイヤHP 100 (車全体で1つ)。0 になると最高速度 50%。Recovery で全回復
- アイテム最大3個。Recovery / Boost (8秒 最高速+20% 弾速+40%) / Gun (銃+弾10発)

## デバッグ方法

`npm run dev` で起動するとデバッグ機能が有効です。本番ビルドでも URL に `?debug=1` を付けると有効
(`npm run festival` のビルドでは常に無効)。

| キー | 内容 |
|---|---|
| F3 | 情報オーバーレイ: FPS・速度・速度ベクトル・ステア/ブレーキ入力・グリップ・横滑り角・ドリフト量・チェックポイント・NPC の ID / 難易度 / 性格 / 目標速度 / 状態 / ミス / 回避 |
| F6 | 3D 表示: NPC のレーシングライン・現在のターゲット点・チェックポイント・コライダー・速度ベクトル・アイテムボックス範囲・弾丸軌道 |
| F4 | 情報を表示する車を切替 |
| F8 | プレイヤー車を自動運転 (動作確認用) |
| F9 | 時間の早送り x1 / x4 |

ブラウザのコンソールで `__app.stats` を実行すると、レース回数・GPU のジオメトリ/テクスチャ数・ヒープ使用量を確認できます (メモリリーク確認用)。

## 設定ファイル (バランス調整)

ゲームバランスは **`src/config/` の数値を変えるだけ**で調整できます (ロジックの変更は不要)。

| ファイル | 内容 |
|---|---|
| `cars.ts` | 10 車種の最高速度・加速・ブレーキ・グリップ・ドリフト・重量・耐久力・駆動方式・見た目 |
| `physics.ts` | 車両物理 (ステアリング、グリップ、ドリフト、駆動方式ごとの癖、衝突、コースアウト復帰 6 秒 など) |
| `npc.ts` | NPC 難易度ごとの能力レンジ、性格、レーシングライン・速度計画、回避・追い越し |
| `battle.ts` | タイヤHP、銃 (連射間隔・弾速・射程・ダメージ・耐久力による軽減)、NPC 射撃 AI |
| `items.ts` | アイテム抽選確率、所持数、Boost 効果、弾数、ボックス再出現時間 (8 秒) |
| `courses.ts` | コース形状 (制御点)、道幅、路肩の種類 (壁/ガードレール/芝/落下)、アイテムボックス位置、色 |
| `controls.ts` | キー割り当て |
| `graphics.ts` | 画質プリセット (低/中/高)、カメラ演出 |
| `audio.ts` | 効果音の音量・エンジン音 |
| `themes.ts` | UI テーマ 4 種 (Arcade / Futuristic / Japanese Touge / Neon) |
| `game.ts` | 周回数、カウントダウン、ゴール後の待ち時間、グリッド |

調整例:

- **CPU が少し速すぎる** → `npc.ts` の該当難易度の `cornerSpeedFactor` / `brakingFactor` を少し下げる
- **ドリフトしにくい** → `physics.ts` の `drift.baseGripMul` を下げる、または車の `drift` を上げる
- **弾が強すぎる** → `battle.ts` の `gun.baseDamage` を下げる / `fireInterval` を上げる
- **コースを追加** → `courses.ts` の `COURSES` に定義を追加し `npm run check:courses` で重なりを確認

## ディレクトリ構造

```text
.
├── README.md / GAME_SPEC.md / CLAUDE.md / AI_WORKFLOW.md(ai_workflow.md)
├── CHANGELOG.md / LICENSES.md / DEVELOPMENT_STATUS.md
├── index.html / vite.config.ts / tsconfig*.json / package.json
├── public/                 静的ファイル (favicon)。models/ textures/ sounds/ fonts/ は将来用
├── scripts/
│   ├── check-courses.ts    コース形状の検証 (長さ・最小半径・重なり)
│   ├── sim-race.ts         ヘッドレス NPC レースシミュレーション
│   └── check-offline.mjs   ビルド成果物の外部 URL 検査
├── src/
│   ├── main.ts             エントリーポイント
│   ├── core/               App (画面遷移・メインループ)、math
│   ├── config/             ★ 調整用の設定値
│   ├── courses/            Track (中心線・射影)、メッシュ生成、背景 (scenery/)
│   ├── physics/            車両物理、コース衝突、車同士の衝突
│   ├── vehicles/           車の 3D モデル、操作入力の型
│   ├── game/               RaceWorld (描画非依存のレース本体)、RaceSession、周回・順位
│   ├── npc/                レーシングライン、NPC パターン (90/コース)、NPC ドライバー
│   ├── battle/             タイヤHP、弾丸、偏差射撃、射撃 AI、照準
│   ├── items/              インベントリ、アイテムボックス
│   ├── input/              InputManager (キー状態管理)、PlayerController
│   ├── camera/             追従カメラ
│   ├── audio/              効果音合成、エンジン音
│   ├── render/             レンダラー、パーティクル、リソース解放
│   ├── ui/                 HUD、ミニマップ、メニュー、各画面、CSS
│   ├── debug/              デバッグ表示
│   └── storage/            LocalStorage
├── tests/                  Vitest の自動テスト
└── docs/                   設計資料・AI プロンプト履歴 (docs/prompts/)
```

詳細は `docs/architecture/README.md` を参照。

## テスト・検証コマンド

```bash
npm test                 # 順位計算・チェックポイント・周回・アイテム抽選・LocalStorage・車両設定・
                         # NPCパターン・ダメージ計算・車両物理・偏差射撃 のテスト
npm run typecheck        # TypeScript 型チェック (strict)
npm run check:courses    # コース形状の検証
npm run sim              # 全コース × 全難易度で NPC が3周完走できるか (描画なし)
npm run sim -- touge strong 3   # コース・難易度・試行回数を指定
npm run build && npm run check:offline   # ビルド成果物に外部 URL がないか
```

## オフラインについて

- 実行時に CDN・外部フォント・外部画像・外部 3D モデル・外部音声・外部 API を一切使いません
- 3D モデル (車・背景) はコードで生成、テクスチャは Canvas で実行時生成、音は Web Audio で合成、
  フォントは OS 標準フォントのみ
- `npm install` はオンラインで1回だけ必要。以降の `npm run festival` はオフラインで動きます

### オフライン検証の手順 (リリース前)

1. `npm run festival` で起動
2. Chrome の DevTools (F12) → Network タブ → 「Offline」を選択してページを再読み込み
3. タイトル / PURE RACE 1P・2P / NPC / BATTLE DUEL / 3 コース / 音 / 設定保存 が動くことを確認
4. Network タブで localhost 以外へのリクエストが 0 件であること

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| ゲームを再起動したい | ブラウザを再読み込み (F5 / Cmd+R)。直らなければターミナルで Ctrl+C → `npm run festival:serve` |
| 画面が固まった・重い | 設定 → グラフィック品質 → 低。ブラウザの他のタブを閉じる |
| 音が出ない | 一度キー入力かクリックをする (ブラウザの自動再生制限)。設定の効果音音量、PC の音量を確認 |
| キーが効かない | ゲーム画面を一度クリックしてフォーカスを戻す。IME (日本語入力) を OFF にする |
| 2人で同時押しすると一部効かない | キーボードの同時押し制限 (ゴースティング) です。別のキーボードを使うと改善することがあります |
| マウスの照準が動かない | ゲーム画面をクリック (ポインターロック)。設定でマウス感度を調整 |
| 保存データを消したい | 設定 → ベストタイムを消す。全設定の初期化は DevTools → Application → Local Storage → `club-racing-festival:v1` を削除 |
| フルスクリーンにしたい | F11 (Mac: Ctrl+Cmd+F)、または 設定 → フルスクリーン |
| `npm run festival` でブラウザが開かない | 手動で Chrome を開き `http://localhost:4173` へ |
| ポート 4173 が使用中 | 前回のサーバーが残っています。ターミナルを閉じる / PC を再起動 |

## 外部アセットとライセンス

外部の 3D モデル・テクスチャ・音声・フォントは使用していません。詳細は [LICENSES.md](LICENSES.md)。
使用している npm パッケージ: three (MIT)。開発用: vite, typescript, vitest, vite-node (いずれも MIT)。

## AI 開発履歴

このプロジェクトは AI (Claude / ChatGPT) を併用して開発しています。重要な依頼は
`docs/prompts/` に記録しています。ルールは `ai_workflow.md` / `CLAUDE.md` を参照。
作業の引き継ぎ状況は `DEVELOPMENT_STATUS.md` に記録しています。
