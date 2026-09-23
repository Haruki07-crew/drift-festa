/**
 * キー割り当て設定。
 *
 * KeyboardEvent.code (物理キー位置) で指定する。JIS/US 配列どちらでも同じ位置のキーになる。
 *
 * 注意: PURE RACE Player 2 と BATTLE DUEL の A/F/E/W 配置は仕様上の意図的な配置。
 *       (小さい子どもでも小指〜人差し指付近で操作しやすくするため)
 *       一般的な WASD へ変更しないこと。
 *       前 / 後 / 右 / 左 = A / F / E / W
 */

export interface DriveBindings {
  forward: string[];
  reverse: string[];
  right: string[];
  left: string[];
  drift: string[];
}

export const controlsConfig = {
  pureRace: {
    player1: {
      forward: ['ArrowUp'],
      reverse: ['ArrowDown'],
      right: ['ArrowRight'],
      left: ['ArrowLeft'],
      drift: ['ShiftLeft', 'ShiftRight'],
    } satisfies DriveBindings,
    player2: {
      forward: ['KeyA'],
      reverse: ['KeyF'],
      right: ['KeyE'],
      left: ['KeyW'],
      drift: ['Enter', 'NumpadEnter'],
    } satisfies DriveBindings,
  },

  battle: {
    drive: {
      forward: ['KeyA'],
      reverse: ['KeyF'],
      right: ['KeyE'],
      left: ['KeyW'],
      drift: ['Space'],
    } satisfies DriveBindings,
    /** 選択中アイテムを捨てる */
    dropItem: ['Digit4', 'Numpad4'],
    /** MouseEvent.button の番号 */
    mouse: {
      fire: 0,
      useItem: 1,
      centerAim: 2,
    },
  },

  system: {
    pause: ['Escape'],
    /** デバッグ表示の切替 (Festival Mode では無効) */
    debugToggle: ['F3'],
    /** デバッグ表示の対象車を切替 */
    debugCycleCar: ['F4'],
    /** デバッグ: レーシングライン等の3D表示切替 */
    debugToggleGizmos: ['F6'],
    /** デバッグ: プレイヤー車を自動運転 (動作確認・調整用) */
    debugAutopilot: ['F8'],
    /** デバッグ: 時間の早送り (x1 → x4) */
    debugTimeScale: ['F9'],
  },

  /** メニュー操作 (マウスクリックでも操作可能) */
  menu: {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    confirm: ['Enter', 'NumpadEnter', 'Space'],
    back: ['Escape', 'Backspace'],
  },
};

/** ゲーム中にブラウザ標準動作 (スクロール等) を抑止するキー */
export const GAME_PREVENT_DEFAULT_KEYS: readonly string[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
  'NumpadEnter',
  'Tab',
  'F3',
  'F4',
  'F6',
  'F8',
  'F9',
];
