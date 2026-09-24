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

export const controlsConfig = {
  pureRace: {
    /** 1人プレイ */
    solo: AFEW_SPACE,
    /** 2人プレイ: [P1, P2] */
    twoPlayer: [AFEW_SPACE, ARROWS_ENTER] as readonly DriveBindings[],
  },

  battle: {
    drive: AFEW_SPACE,
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

/**
 * モード・人数・プレイヤー番号から運転操作のキー割り当てを返す (テスト対象)。
 */
export function drivingBindings(mode: 'pure' | 'battle', humanCount: number, playerIndex: number): DriveBindings {
  if (mode === 'battle') return controlsConfig.battle.drive;
  if (humanCount <= 1) return controlsConfig.pureRace.solo;
  return controlsConfig.pureRace.twoPlayer[playerIndex] ?? controlsConfig.pureRace.twoPlayer[0]!;
}
