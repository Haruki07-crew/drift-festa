# アーキテクチャ

## レイヤー

```text
main.ts → core/App ──┬─ ui/ (SetupFlow, CourseSelect, 各画面, UIManager, MenuBackdrop)
                     ├─ render/RenderContext (WebGLRenderer は1つだけ)
                     ├─ input/InputManager, audio/AudioManager, storage/StorageManager
                     ├─ audio/music/MusicPlayer (BGM。Composer がテーマから曲を組み立て、先読み予約で再生)
                     └─ game/RaceSession (1レースごとに生成・dispose)
                          ├─ game/RaceWorld  ← 描画非依存のレース本体 (ヘッドレスで動く)
                          │    ├─ courses/Track (中心線。周回コース = 閉じた道 / Point to Point = 開いた道)
                          │    ├─ physics/ (VehiclePhysics, TrackCollision (+ 道の両端の壁・動的な切れ目), CarCollision)
                          │    ├─ gimmicks/GimmickSystem (路面・パッド・加速ゲート・ジャンプ・風・障害物・足場・跳ね橋…)
                          │    ├─ npc/NpcDriver (RacingLine, NpcPatterns)
                          │    ├─ スリップストリーム (RaceWorld.applySlipstream)
                          │    └─ game/RaceProgress (周回 / Point to Point・CP・順位・タイム差)
                          ├─ battle/BattleManager (BATTLE DUEL のみ)
                          ├─ courses/CourseView (路面・背景・ギミックの見た目・夜の誘導灯・START/GOAL ゲート・天候)
                          ├─ vehicles/CarModel (夜はヘッドライト), render/ParticleSystem
                          ├─ camera/ChaseCamera, ui/Hud, audio/CarSound
                          └─ debug/DebugManager
```

## 1フレームの流れ (RaceSession.update)

1. システムキー (Esc / デバッグ) の処理
2. フェーズ進行: intro (カメラ回り込み) → countdown (3,2,1,GO) → racing → finishing → done
3. 固定タイムステップ (1/120 s) で:
   人間の入力読み取り → `RaceWorld.step` (ギミックの時計 → NPC判断 → 車両物理 → 壁/落下/着地 → ギミック適用 →
   車同士 → 障害物 → 復帰 → 周回/順位) → `BattleManager.step`
4. 見た目の更新 (車モデル・パーティクル・カメラ・音・HUD)
5. プレイヤーごとのビューポートで描画 (2人プレイは scissor で左右分割)

## 設計方針

- **設定駆動**: バランス値はすべて `src/config/`。ロジックに数値を散在させない
- **描画とロジックの分離**: RaceWorld / RaceProgress / NPC / Battle ロジックは Three.js 非依存 → テストとシミュレーションが可能
- **リソース管理**: RaceSession.dispose() で Geometry / Material / Texture / 影マップ / 音ノード / DOM / イベントを解放。
  `__app.stats` で連続レース時の GPU リソース数が増えないことを確認済み
- **座標系**: heading=0 で +Z 向き。右方向 = (-cos h, sin h)。heading 増加 = 左旋回
- **周回と開いた道**: 周回を前提にした処理 (s の折り返し・次のサンプル) は `Track.closed` / `wrapS` / `deltaS` /
  `forwardDistance` / `nextIndex` / `segmentCount` / `hasSegment` を使う (Point to Point で終点→始点の区間を作らない)
- **コース品質**: `courses/RoadClearance` (Road Safety Corridor) を地形生成・背景配置・`check:courses`・デバッグ表示で共通利用

## コース検証 (Node)

`scripts/check-courses.ts` は `scripts/lib/headlessDom.ts` (Canvas などの最小スタブ) を入れて `CourseView` を Node 上で組み立て、
`RoadClearance.scanIntrusions` で道路への侵入を調べる。描画はしないので GPU は不要。
