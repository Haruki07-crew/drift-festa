/**
 * キー割り当て設定。
 *
 * KeyboardEvent.code (物理キー位置) で指定する。JIS/US 配列どちらでも同じ位置のキーになる。
 *
 * 操作方法 (v2 で統一):
 *   PURE RACE 1人      : A=前進 F=後退 E=右 W=左 Space=ドリフト
 *   PURE RACE 2人 P1   : A=前進 F=後退 E=右 W=左 Space=ドリフト
 *   PURE RACE 2人 P2   : ↑=前進 ↓=後退 →=右 ←=左 Enter=ドリフト
 *   BATTLE DUEL        : A/F/E/W + Space (+ マウス)
 *
 * 注意: A/F/E/W (前 / 後 / 右 / 左) は仕様上の意図的な配置
 *       (小さい子どもでも小指〜人差し指付近で操作しやすくするため)。一般的な WASD へ変更しないこと。
 *       1人プレイで矢印キーをメイン操作に戻さないこと。
 *
 * キー設定 (v3.1): 上の配置が「初期設定」(DEFAULT_KEY_BINDINGS)。プレイヤーは設定画面の「キー設定」で
 *       P1 (1人プレイ・2人の P1・BATTLE 共通) と P2 の運転操作を変更でき、LocalStorage に保存される。
 *       文化祭モード (npm run festival) では起動時に毎回初期設定へ戻す (keyBindings.resetOnFestivalStart)。
 */

export interface DriveBindings {
  forward: string[];
  reverse: string[];
  right: string[];
  left: string[];
  drift: string[];
}

/** A/F/E/W + Space (1人プレイ・2人プレイの P1・BATTLE DUEL 共通) */
const AFEW_SPACE: DriveBindings = {
  forward: ['KeyA'],
  reverse: ['KeyF'],
  right: ['KeyE'],
  left: ['KeyW'],
  drift: ['Space'],
};

/** 矢印キー + Enter (2人プレイの P2) */
const ARROWS_ENTER: DriveBindings = {
  forward: ['ArrowUp'],
  reverse: ['ArrowDown'],
  right: ['ArrowRight'],
  left: ['ArrowLeft'],
  drift: ['Enter', 'NumpadEnter'],
};

/** 運転操作の種類 (キー設定画面に並べる順) */
export type DriveAction = keyof DriveBindings;
export const DRIVE_ACTIONS: readonly DriveAction[] = ['forward', 'reverse', 'right', 'left', 'drift'];
export const DRIVE_ACTION_LABELS: Record<DriveAction, string> = {
  forward: '前進',
  reverse: 'ブレーキ / 後退',
  right: '右',
  left: '左',
  drift: 'ドリフト',
};

/** プレイヤーごとの運転キー (P1 = 1人プレイ・2人の P1・BATTLE DUEL 共通、P2 = 2人の P2) */
export interface KeyBindingSet {
  p1: DriveBindings;
  p2: DriveBindings;
}

export type BindingPlayer = keyof KeyBindingSet;
export const BINDING_PLAYERS: readonly BindingPlayer[] = ['p1', 'p2'];

/** キー割り当ての初期設定 (設定画面の「初期設定に戻す」もこれに戻す) */
export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindingSet> = {
  p1: AFEW_SPACE,
  p2: ARROWS_ENTER,
};

export const controlsConfig = {
  battle: {
    /** 運転は DEFAULT_KEY_BINDINGS.p1 (キー設定の P1) と共通 */
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

  keyBindings: {
    /** 文化祭モード (npm run festival) では起動時にキー設定を初期設定へ戻す (前の人の変更を残さない) */
    resetOnFestivalStart: true,
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

/**
 * 運転操作に割り当てられないキー (ポーズ・デバッグ・BATTLE のアイテムを捨てる・修飾キー・OS のキー)。
 * これらを運転に使うと、ポーズできない・デバッグが誤作動するなどの問題が起きる。
 */
export const RESERVED_DRIVE_KEYS: readonly string[] = [
  ...controlsConfig.system.pause,
  ...controlsConfig.system.debugToggle,
  ...controlsConfig.system.debugCycleCar,
  ...controlsConfig.system.debugToggleGizmos,
  ...controlsConfig.system.debugAutopilot,
  ...controlsConfig.system.debugTimeScale,
  ...controlsConfig.battle.dropItem,
  'Backspace',
  'Tab',
  'MetaLeft',
  'MetaRight',
  'ContextMenu',
  'CapsLock',
  'F5',
  'F11',
  'F12',
];

/**
 * モード・人数・プレイヤー番号から運転操作のキー割り当てを返す (テスト対象)。
 * @param keys キー設定 (省略時は初期設定)
 */
export function drivingBindings(
  mode: 'pure' | 'battle',
  humanCount: number,
  playerIndex: number,
  keys: Readonly<KeyBindingSet> = DEFAULT_KEY_BINDINGS,
): DriveBindings {
  if (mode === 'battle' || humanCount <= 1) return keys.p1;
  return playerIndex === 1 ? keys.p2 : keys.p1;
}
