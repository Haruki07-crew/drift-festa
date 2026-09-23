# Prompt Log

## Date

2026-09-23

## AI

Claude (Claude Code / Opus 5.5)

## Purpose

仕様書 (specification.md) に基づき、文化祭用ブラウザ3Dカーレースゲームを新規に作成する。

## Original Prompt

> 仕様書を読みゲーム作成をしてください

(参照ファイル: specification.md, claude.md, ai_workflow.md)

## AI Response Summary

- Vite + TypeScript strict + Three.js でプロジェクトを新規構築
- 自前のアーケード車両物理、3 コース、10 車種、NPC (理想ライン + 補正、270 パターン)、
  PURE RACE 1〜2 人 (分割画面)、BATTLE DUEL (銃・アイテム・偏差射撃 AI)、HUD・ミニマップ・各画面・
  テーマ 4 種・合成効果音・LocalStorage・デバッグモード・Festival Mode を実装
- テスト 46 件、コース検証・NPC シミュレーション・オフライン検査スクリプト、ドキュメント一式

## Adopted Changes

上記すべて (初期実装)。

## Rejected Changes

- 既製の物理エンジン (Rapier 等) は不採用。アーケード挙動の調整しやすさ・オフライン配布の単純さを優先し自前実装とした

## Modified Files

- 新規: package.json, tsconfig*.json, vite.config.ts, index.html, src/**, tests/**, scripts/**, docs/**,
  README.md, GAME_SPEC.md, CHANGELOG.md, LICENSES.md, DEVELOPMENT_STATUS.md, .gitignore

## Test Result

```text
npm run typecheck   → エラーなし
npm test            → 46 passed
npm run build       → 成功
npm run sim         → 3コース × 3難易度で NPC 全車完走
npm run check:offline → 外部URLなし
ヘッドレス Chrome で タイトル → PURE RACE 1P/2P → BATTLE DUEL → 結果画面 を確認、外部リクエスト 0、
連続 13 回のレース開始で GPU リソース数が増えないことを確認
```

## Related Commit

なし (Git リポジトリ未初期化)
