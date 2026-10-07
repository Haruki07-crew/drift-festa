/**
 * キー設定 (運転キーの割り当て) のロジック。描画や DOM に依存しない (テスト対象)。
 *
 * - 保存データの検証 (壊れた・重複した・使えないキーは初期設定へ戻す)
 * - キーの割り当て: 別の操作で使っているキーを選んだら、その操作と入れ替える (どの操作もキーがなくならない)
 * - 画面表示用のキー名
 */
import {
  BINDING_PLAYERS,
  DEFAULT_KEY_BINDINGS,
  DRIVE_ACTIONS,
  RESERVED_DRIVE_KEYS,
  type BindingPlayer,
  type DriveAction,
  type DriveBindings,
  type KeyBindingSet,
} from '../config/controls';

export function cloneBindings(set: Readonly<KeyBindingSet>): KeyBindingSet {
  const copy = (b: DriveBindings): DriveBindings => ({
    forward: [...b.forward],
    reverse: [...b.reverse],
    right: [...b.right],
    left: [...b.left],
    drift: [...b.drift],
  });
  return { p1: copy(set.p1), p2: copy(set.p2) };
}

export function defaultKeyBindings(): KeyBindingSet {
  return cloneBindings(DEFAULT_KEY_BINDINGS);
}

export function isReservedKey(code: string): boolean {
  return RESERVED_DRIVE_KEYS.includes(code);
}

/** 全プレイヤー・全操作のキーを列挙 */
function allKeys(set: Readonly<KeyBindingSet>): { player: BindingPlayer; action: DriveAction; code: string }[] {
  const out: { player: BindingPlayer; action: DriveAction; code: string }[] = [];
  for (const player of BINDING_PLAYERS) {
    for (const action of DRIVE_ACTIONS) {
      for (const code of set[player][action]) out.push({ player, action, code });
    }
  }
  return out;
}

/**
 * 保存データのキー設定を検証する。形が正しく、使えないキーがなく、どのキーも1つの操作だけに
 * 割り当てられていればそのまま使う。そうでなければ初期設定に戻す (半端に直すと操作が分かりにくくなるため)。
 */
export function sanitizeKeyBindings(raw: unknown): KeyBindingSet {
  if (typeof raw !== 'object' || raw === null) return defaultKeyBindings();
  const r = raw as Record<string, unknown>;
  const result = defaultKeyBindings();
  for (const player of BINDING_PLAYERS) {
    const p = r[player];
    if (typeof p !== 'object' || p === null) return defaultKeyBindings();
    for (const action of DRIVE_ACTIONS) {
      const codes = (p as Record<string, unknown>)[action];
      if (!Array.isArray(codes) || codes.length === 0 || codes.length > 4) return defaultKeyBindings();
      if (!codes.every((c) => typeof c === 'string' && c.length > 0 && c.length <= 32 && !isReservedKey(c))) return defaultKeyBindings();
      result[player][action] = [...(codes as string[])];
    }
  }
  const seen = new Set<string>();
  for (const k of allKeys(result)) {
    if (seen.has(k.code)) return defaultKeyBindings();
    seen.add(k.code);
  }
  return result;
}

export type AssignResult =
  | { ok: true; bindings: KeyBindingSet; swapped: { player: BindingPlayer; action: DriveAction } | null }
  | { ok: false; reason: 'reserved' };

/**
 * player の action に code を割り当てる (その操作のキーは code の1つだけになる)。
 * code を別の操作 (自分・相手どちらでも) が使っていたら、その操作には action の元のキーを渡して入れ替える。
 */
export function assignKey(set: Readonly<KeyBindingSet>, player: BindingPlayer, action: DriveAction, code: string): AssignResult {
  if (isReservedKey(code)) return { ok: false, reason: 'reserved' };
  const next = cloneBindings(set);
  const previous = [...next[player][action]];
  let swapped: { player: BindingPlayer; action: DriveAction } | null = null;
  for (const k of allKeys(set)) {
    if (k.code !== code || (k.player === player && k.action === action)) continue;
    const other = next[k.player][k.action].filter((c) => c !== code);
    // 相手の操作にキーが残らない時は、こちらの元のキーを渡す
    next[k.player][k.action] = other.length > 0 ? other : previous;
    swapped = { player: k.player, action: k.action };
  }
  next[player][action] = [code];
  return { ok: true, bindings: next, swapped };
}

export function sameBindings(a: Readonly<KeyBindingSet>, b: Readonly<KeyBindingSet>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** 割り当てられている全キー (ゲーム中にブラウザの標準動作を止めるキーの一覧に使う) */
export function boundKeys(set: Readonly<KeyBindingSet>): string[] {
  return allKeys(set).map((k) => k.code);
}

const SPECIAL_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'テンキー Enter',
  ShiftLeft: '左 Shift',
  ShiftRight: '右 Shift',
  ControlLeft: '左 Ctrl',
  ControlRight: '右 Ctrl',
  AltLeft: '左 Alt',
  AltRight: '右 Alt',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlRo: 'ろ',
  IntlYen: '¥',
};

/** KeyboardEvent.code → 画面に出すキー名 (KeyA → A、Digit1 → 1、Numpad5 → テンキー 5) */
export function keyLabel(code: string): string {
  const special = SPECIAL_LABELS[code];
  if (special) return special;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `テンキー ${code.slice(6)}`;
  if (code.startsWith('Numpad')) return `テンキー ${code.slice(6)}`;
  return code;
}

/** 1つの操作のキー名 (複数あれば「 / 」でつなぐ) */
export function actionLabel(set: Readonly<KeyBindingSet>, player: BindingPlayer, action: DriveAction): string {
  return set[player][action].map(keyLabel).join(' / ');
}
