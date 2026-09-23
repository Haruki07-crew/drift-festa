# AI_WORKFLOW.md

# Purpose

このプロジェクトではClaudeとChatGPTを併用して開発する。

どのAIを使用しても、

- 同じゲーム仕様
- 同じ設計思想
- 同じドキュメント
- 同じConfig
- 同じ履歴

を参照して開発することを目的とする。

---

# Source of Truth

ゲーム仕様：

`GAME_SPEC.md`

Claude専用ルール：

`CLAUDE.md`

AI共通ルール：

`AI_WORKFLOW.md`

を参照する。

---

# Before AI Coding

AIへコード変更を依頼する際は、可能であれば以下を共有する。

```text
GAME_SPEC.md
AI_WORKFLOW.md
関連コード
現在のGit diff
現在のbranch
発生しているエラー
```

AIは関連コードを確認してから変更する。

---

# Prompt History

重要なAI依頼は、

```text
docs/prompts/
```

へ保存する。

ファイル名：

```text
YYYY-MM-DD_NNN_short-description.md
```

例：

```text
2026-09-23_001_initial-game-spec.md
2026-09-24_002_fix-npc-cornering.md
2026-09-24_003_battle-aim-adjustment.md
```

---

# Prompt Log Template

```markdown
# Prompt Log

## Date

2026-XX-XX

## AI

Claude / ChatGPT

## Purpose

この依頼の目的。

## Original Prompt

ユーザーが実際に送信した内容。

取得できない場合：

> Original prompt unavailable.

と記載し、捏造しない。

## AI Response Summary

AIが提案・変更した内容。

## Adopted Changes

実際に採用したもの。

## Rejected Changes

提案されたが採用しなかったもの。

## Modified Files

- src/...
- src/...

## Test Result

実行した確認。

```text
npm run build
npm test
...
```

## Related Commit

Commit hashが存在する場合のみ記載。
```

---

# Prompt Numbering

番号はAIごとではなく、プロジェクト全体で連番とする。

Claude：

```text
001
003
005
```

ChatGPT：

```text
002
004
006
```

のように混在して問題ない。

時系列を優先する。

---

# AI Handoff

別のAIへ作業を引き継ぐ場合、そのAIはまず、

1. `GAME_SPEC.md`
2. 最新のPrompt Logs
3. Git diff
4. 関連コード

を確認する。

過去の会話だけを前提に実装しない。

---

# Avoid Duplicate Implementations

Claudeが作った仕組みをChatGPTが別実装し、その逆も行うと設計が崩れる。

そのためAIは、

「新しく作る前に既存実装を探す」

こと。

特に、

```text
InputManager
RaceManager
VehicleController
NPCController
ItemManager
BattleManager
AudioManager
StorageManager
DebugManager
```

等を重複作成しない。

---

# Config Driven Development

ゲームバランス調整では、可能な限りロジックを書き換えずConfigを変更する。

例：

```ts
export const strongNpcConfig = {
  reactionTime: 0.12,
  steeringNoise: 0.02,
  brakingAccuracy: 0.93,
};
```

開発者が後から数値だけ変更して調整できることを優先する。

---

# Bug Fix Workflow

バグ修正時は、

1. 原因を特定
2. 関係するコードを確認
3. 最小限の修正
4. Build
5. 再現確認
6. 関連機能確認

を基本とする。

エラーを隠すだけの修正は禁止。

例：

- try/catchで握りつぶす
- 型エラーをanyで回避
- 機能そのものを無効化
- failing codeを削除

などを安易に行わない。

---

# Refactoring

リファクタリングは歓迎する。

ただし、

- ゲーム挙動
- Config値
- 操作方法
- オフライン要件

を意図せず変更しない。

大規模リファクタリングと新機能追加を同時に行う場合は慎重にする。

---

# External Assets

外部アセットを追加する場合、

- URL
- 作者
- ライセンス
- 利用条件

を確認し、

`LICENSES.md`

等へ記録する。

Runtimeで外部URLから取得しない。

---

# Offline Check

定期的に、

ブラウザをOffline状態にしてゲームを確認する。

Network Requestが外部へ発生した場合は修正する。

---

# Festival Release Checklist

文化祭前には最低限以下を確認する。

```text
[ ] npm install済み
[ ] npm run build成功
[ ] npm run festival成功
[ ] インターネットOFFで起動
[ ] 1P PURE RACE
[ ] 2P PURE RACE
[ ] Weak NPC
[ ] Normal NPC
[ ] Strong NPC
[ ] BATTLE DUEL
[ ] 3コース
[ ] 10車種
[ ] アイテム
[ ] 銃
[ ] 音
[ ] LocalStorage
[ ] フルスクリーン
[ ] Esc Pause
[ ] 20レース以上連続確認
[ ] メモリ使用量確認
[ ] FPS確認
[ ] Debug Mode OFF
```

---

# README Rule

READMEは「開発者本人なら分かるREADME」にしない。

初めてこのリポジトリを見る人でも、

```bash
git clone ...
cd ...
npm install
npm run dev
```

まで進められるようにする。

さらに文化祭当日の操作について独立した章を作る。

---

# Culture Festival Operation

文化祭当日の担当者が開発者本人とは限らない前提にする。

当日の操作は可能な限り、

```bash
cd <project>
npm run festival
```

だけにする。

問題発生時用にREADMEへ、

- 再起動方法
- ブラウザ再読み込み
- LocalStorage初期化方法
- フルスクリーン方法
- 音が出ない場合
- キー入力されない場合

等の簡単なトラブルシューティングを書く。

---

# Final Rule

ClaudeとChatGPTのどちらがコードを書いたかは重要ではない。

重要なのは、

**リポジトリ全体が一つの設計思想で維持されていること。**

AIごとに独自設計を増やさず、

既存仕様・既存コード・Config・ドキュメントを読み、

同じプロジェクトを共同開発しているものとして扱う。