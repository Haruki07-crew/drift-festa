# AI_WORKFLOW.md

# Purpose

このプロジェクトではClaudeとChatGPTを併用して開発する。

どのAIを使用しても、

- 同じゲーム仕様
- 同じ設計思想
- 同じドキュメント
- 同じConfig
- 同じ作業状態 (DEVELOPMENT_STATUS.md)

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
DEVELOPMENT_STATUS.md
関連コード
現在のGit diff
現在のbranch
発生しているエラー
```

AIは関連コードを確認してから変更する。

---

# Prompt History (廃止)

Claude / ChatGPT へ送ったプロンプトを Git リポジトリへ履歴として保存する運用はやめた。

- `docs/prompts/` は必須の管理対象ではない (`.gitignore` 済み。過去のファイルはローカルに残してよい)
- AI への一時的な依頼ファイル・メモは `.ai-local/` に置く (`.gitignore` 済み。GitHub へ push しない)
- プロンプト履歴を Git へ commit することを必須にしない

作業の引き継ぎ (利用制限・コンテキスト切れ・別セッション・別AI) には
**`DEVELOPMENT_STATUS.md`** を使う。これは削除せず、大きな変更・機能完成・バグ発見のたびに更新する。

---

# AI Handoff

別のAIへ作業を引き継ぐ場合、そのAIはまず、

1. `GAME_SPEC.md`
2. `DEVELOPMENT_STATUS.md`
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
[ ] Ultimate (最強) NPC
[ ] BATTLE DUEL
[ ] 10コース (各コースのギミック)
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