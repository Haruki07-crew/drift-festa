# CLAUDE.md

## Project Overview

このリポジトリは、文化祭で実際に使用するブラウザ3Dカーレースゲームです。

プロジェクト全体の正式仕様は必ず、

`GAME_SPEC.md`

を参照してください。

`GAME_SPEC.md` がゲーム仕様に関するSource of Truthです。

このファイルと `GAME_SPEC.md` が競合する場合は、`GAME_SPEC.md` を優先してください。

---

# Before Working

コード変更を開始する前に必ず以下を確認してください。

1. `GAME_SPEC.md`
2. `AI_WORKFLOW.md`
3. `README.md`
4. 関連する `src/config/*`
5. 関連する既存実装
6. `DEVELOPMENT_STATUS.md` (作業の引き継ぎ状況)
7. 必要に応じて `CHANGELOG.md`

既存設計を確認せず、新しいシステムを重複実装しないでください。

---

# Core Rules

以下は必須です。

- ユーザー要件を勝手に削除しない
- 仕様を簡略化して別物にしない
- ダミー実装で完了扱いしない
- TODOだけ残して完了扱いしない
- 動いている既存機能を不用意に壊さない
- 設定可能な値をロジックへハードコードしない
- 巨大な単一ファイルを作らない
- TypeScriptの型安全性を維持する
- `any`を安易に使わない
- デバッグ機能を壊さない
- オフライン動作を壊さない
- ランタイムの外部通信を追加しない

---

# Architecture

基本技術：

- TypeScript
- Vite
- Three.js
- 物理エンジン
- HTML/CSS
- Web Audio API
- LocalStorage

ゲームロジックとUIを可能な限り分離してください。

推奨責務：

```text
core
game
vehicles
physics
npc
battle
courses
items
input
camera
audio
ui
debug
storage
config
```

既存のディレクトリ構成が合理的な場合は、無理に変更しないでください。

---

# Configuration First

ゲームバランス値は設定ファイルへ集約してください。

例：

```text
src/config/cars.ts
src/config/physics.ts
src/config/npc.ts
src/config/battle.ts
src/config/courses/      (1コース1ファイル)
src/config/gimmicks.ts   (コースギミック共通の調整値)
src/config/controls.ts
src/config/items.ts
```

以下のような値をコード内へ直接散在させないこと。

- 最高速度
- 加速
- グリップ
- NPC速度
- NPC反応速度
- HP
- Bullet Damage
- Bullet Speed
- Item Respawn
- Boost Duration
- Boost Multiplier

ゲームバランス調整を**値の変更だけで行える設計**を維持してください。

---

# Gameplay Integrity

変更後は以下を意識してください。

- PURE RACE 2〜8台
- 1〜2プレイヤー
- NPC (Weak / Normal / Strong / Ultimate)
- 10コース (各コース固有のギミック)
- 3周
- 順位
- チェックポイント
- コースアウト復帰
- Split Screen
- BATTLE DUEL
- Gun
- Item
- LocalStorage
- Offline Runtime

機能追加によって別モードを壊さないこと。

---

# Input

複数キー同時入力が必須です。

入力は状態管理方式で実装してください。

操作方法 (v2 で統一。`src/config/controls.ts` の `drivingBindings`):

```text
PURE RACE 1人      : A=前進 F=後退 E=右 W=左 Space=ドリフト
PURE RACE 2人 P1   : A=前進 F=後退 E=右 W=左 Space=ドリフト
PURE RACE 2人 P2   : ↑=前進 ↓=後退 →=右 ←=左 Enter=ドリフト
```

1人プレイで矢印キーをメイン操作に戻さないでください。
A/F/E/W を一般的な WASD へ勝手に変更しないでください。

BATTLE DUEL：

```text
A = Forward
F = Reverse
E = Right
W = Left
Space = Drift
Mouse = Aim
Left Click = Fire
Right Click = Center Aim
Wheel = Inventory Select
Middle Click = Use
4 = Drop Item
```

---

# NPC

NPCは、

`Base Racing Line + Runtime Correction`

方式です。

単純なWaypoint追従のみへ変更しないでください。

難易度は Weak / Normal / Strong / Ultimate (最強) の4段階。1コースあたり、

```text
Weak     : 30
Normal   : 30
Strong   : 30
Ultimate : 30
```

合計120パターン。10コース合計で最大1200パターンを扱います。

NPCの強さを不公平な車両性能ブーストで実現しないでください。
最強 (Ultimate) も運転精度 (ライン・ブレーキング・反応・ミス率・ギミック/路面の理解) だけで強くします。

Rubber Bandingは使用しません。ワープ・強制勝利も禁止です。

NPC はコースギミック (ブーストパッド・動く障害物・路面) を理解して走ります。
新しいギミックを追加したら、NPC が扱えるか `npm run sim` で必ず確認してください。

---

# Battle AI

機械学習は不要です。

NPC射撃には可能であればPredictive Aimを使用してください。

難易度は、

- Reaction Time
- Aim Error
- Prediction Accuracy
- Fire Decision

等で調整してください。

強制命中方式は原則使用しません。

---

# Offline Requirement

ゲームを文化祭で遊ぶときはインターネット接続がありません。

開発時のnpm install等はオンラインで構いません。

ただしゲームランタイムでは、

- CDN禁止
- Google Fonts禁止
- 外部API禁止
- 外部モデルURL禁止
- 外部画像URL禁止
- 外部音声URL禁止

です。

必要なファイルはすべてリポジトリまたはビルド成果物へ含めてください。

---

# Festival Operation

文化祭当日に、

```bash
npm run festival
```

程度で起動できる状態を維持してください。

Festival Modeでは、

- Debug OFF
- Production Build
- Offline
- Stable Settings

を基本としてください。

---

# Resource Management

レース終了時には不要なリソースを適切に破棄してください。

特に：

- Three.js Geometry
- Material
- Texture
- EventListener
- Audio
- Physics Body
- Bullet
- NPC
- Scene Object

を確認してください。

文化祭では長時間使用するため、メモリリークを軽視しないでください。

---

# Debugging

NPCや物理を調整しやすいことは重要要件です。

Debug Modeを削除しないでください。

必要に応じて、

- Racing Line
- Checkpoint
- Collider
- NPC Target
- NPC Speed
- Steering
- Velocity
- Bullet Trajectory
- FPS

を可視化してください。

---

# Performance

目標は可能な限り60fps。

特に、

```text
8 Cars
7 NPC
Split Screen
Mini Map
Effects
```

でも実用的な速度を維持してください。

必要に応じて、

- Object Pool
- Instancing
- LOD
- Shadow Quality
- Draw Distance
- Bullet Pool

等を利用してください。

---

# AI Prompt History (廃止)

AI へ送ったプロンプトを Git リポジトリへ履歴として保存する運用はやめました。

- `docs/prompts/` は必須の管理対象ではありません (Git 管理外)
- AI への一時的な依頼ファイル・メモは `.ai-local/` に置き、GitHub へ push しないでください
- 作業の引き継ぎには `DEVELOPMENT_STATUS.md` を使います (下記 Session Continuity)

---

# Documentation

仕様変更を行った場合、必要に応じて以下も更新してください。

- README.md
- GAME_SPEC.md
- CHANGELOG.md
- DEVELOPMENT_STATUS.md
- docs/* (docs/prompts を除く)
- config comments

コードとドキュメントを食い違わせないでください。

---

# Git

ユーザーから明示的な指示がない限り、

- mainへ直接pushしない
- unrelatedな変更を混ぜない
- 大量の自動整形だけの変更を混ぜない
- 秘密情報をcommitしない

コミット可能な粒度を意識してください。

---

# Completion Criteria

「コードを書いた」だけでは完了ではありません。

最低限、

1. Buildが通る
2. TypeScript Errorがない
3. 対象機能が動く
4. 既存機能を壊していない
5. オフライン要件を壊していない
6. 必要なドキュメントを更新
7. 調整可能な値はConfigへ配置

まで確認してください。

---

# Final Principle

このゲームはサンプルコードではありません。

**文化祭で実際に人が遊ぶ完成品です。**

実装判断では、

「動くか」

だけでなく、

「遊んで楽しいか」

「壊れにくいか」

「調整しやすいか」

「当日簡単に起動できるか」

まで考慮してください。
# Session Continuity

このプロジェクトは複数のClaudeセッションにまたがって開発する。

会話履歴だけを作業状態の保存場所にしないこと。

プロジェクト直下の

`DEVELOPMENT_STATUS.md`

を永続的な作業状態として使用する。

作業開始時は必ず、

1. `GAME_SPEC.md` (正式仕様。`specification.md` は初版の原本)
2. `CLAUDE.md`
3. `ai_workflow.md`
4. `DEVELOPMENT_STATUS.md`

を確認する。

`DEVELOPMENT_STATUS.md` が存在しない場合は作成する。

開発中は大きな変更・機能完成・バグ発見のたびに更新する。

特にコンテキスト残量や利用可能時間が少なくなった場合は、
新しい作業を始めるより先に `DEVELOPMENT_STATUS.md` を更新する。

次のセッションが過去の会話を知らなくても、

- 現在どこまで完成しているか
- 次に何を実装するか
- どのファイルを見るべきか
- どのコマンドを実行するか
- 何が壊れているか

を理解できる状態を常に維持する。

タスク完了を報告する前にも `DEVELOPMENT_STATUS.md` を最新状態にする。
GAME_SPEC.md、CLAUDE.md、ai_workflow.md、DEVELOPMENT_STATUS.mdをすべて読んで、
前回の続きから作業を再開してください。