# アーキテクチャ

## レイヤー

```text
main.ts → core/App ──┬─ ui/ (SetupFlow, 各画面, UIManager, MenuBackdrop)
                     ├─ render/RenderContext (WebGLRenderer は1つだけ)
                     ├─ input/InputManager, audio/AudioManager, storage/StorageManager
                     └─ game/RaceSession (1レースごとに生成・dispose)
                          ├─ game/RaceWorld  ← 描画非依存のレース本体 (ヘッドレスで動く)
                          │    ├─ physics/ (VehiclePhysics, TrackCollision, CarCollision)
                          │    ├─ npc/NpcDriver (RacingLine, NpcPatterns)
                          │    └─ game/RaceProgress (周回・CP・順位・タイム差)
                          ├─ battle/BattleManager (BATTLE DUEL のみ)
                          ├─ courses/CourseView, vehicles/CarModel, render/ParticleSystem
                          ├─ camera/ChaseCamera, ui/Hud, audio/CarSound
                          └─ debug/DebugManager
```

## 1フレームの流れ (RaceSession.update)

1. システムキー (Esc / デバッグ) の処理
2. フェーズ進行: intro (カメラ回り込み) → countdown (3,2,1,GO) → racing → finishing → done
3. 固定タイムステップ (1/120 s) で:
   人間の入力読み取り → `RaceWorld.step` (NPC判断 → 車両物理 → 壁/落下 → 車同士 → 復帰 → 周回/順位) → `BattleManager.step`
4. 見た目の更新 (車モデル・パーティクル・カメラ・音・HUD)
5. プレイヤーごとのビューポートで描画 (2人プレイは scissor で左右分割)

## 設計方針

- **設定駆動**: バランス値はすべて `src/config/`。ロジックに数値を散在させない
- **描画とロジックの分離**: RaceWorld / RaceProgress / NPC / Battle ロジックは Three.js 非依存 → テストとシミュレーションが可能
- **リソース管理**: RaceSession.dispose() で Geometry / Material / Texture / 影マップ / 音ノード / DOM / イベントを解放。
  `__app.stats` で連続レース時の GPU リソース数が増えないことを確認済み
- **座標系**: heading=0 で +Z 向き。右方向 = (-cos h, sin h)。heading 増加 = 左旋回
