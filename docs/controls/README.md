# 操作系の設計

- `InputManager` はキーの押下状態 (Set) を保持する方式。keydown の単発処理ではないため同時押しに強い
- `KeyboardEvent.code` (物理キー位置) を使用 → JIS / US 配列の違いに影響されない
- キー割り当ては `src/config/controls.ts` の `drivingBindings(mode, 人数, プレイヤー番号)`
  - 1人: A/F/E/W + Space、2人: P1 = A/F/E/W + Space / P2 = 矢印 + Enter、BATTLE: A/F/E/W + Space
  - A/F/E/W (前/後/右/左) は仕様上の意図的配置。WASD にしない。1人でも矢印をメインにしない
- ウィンドウのフォーカスが外れたら全キーを解除 (押しっぱなし防止)
- ブラウザ標準動作の抑止はレース中かつゲーム用キーのみ。マウス関連 (右クリックメニュー・ホイールスクロール・中クリック) の抑止はゲーム画面上かつ BATTLE DUEL 中のみ
- BATTLE DUEL の照準はポインターロック + 仮想カーソル。ロック解除 (Esc) でポーズ
