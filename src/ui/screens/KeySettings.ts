/**
 * キー設定画面 (設定 → キー設定)。
 *
 * 項目を選ぶ (Enter / クリック) と「キーを押してください」になり、次に押したキーが割り当てられる。
 * - 別の操作で使っているキーを押したら、その操作と入れ替える (どの操作もキーがなくならない)
 * - Esc はキャンセル。ポーズ・デバッグ・アイテムを捨てる などのキーは割り当てられない
 * - 「すべて初期設定に戻す」で A/F/E/W + Space (1P) / 矢印 + Enter (2P) に戻す
 * 変更はすぐ LocalStorage に保存される。文化祭モードでは起動時に初期設定へ戻る。
 */
import { BINDING_PLAYERS, DRIVE_ACTIONS, DRIVE_ACTION_LABELS, type BindingPlayer, type DriveAction } from '../../config/controls';
import { actionLabel, assignKey, defaultKeyBindings, keyLabel, sameBindings } from '../../input/KeyBindings';
import type { GameSettings, StorageManager } from '../../storage/StorageManager';
import { el } from '../dom';
import { Menu, type MenuOption } from '../Menu';
import type { UIManager } from '../UIManager';

const PLAYER_LABELS: Record<BindingPlayer, string> = {
  p1: '1P',
  p2: '2P',
};

/** 画面の説明に出す、各プレイヤーのキーが使われる場面 */
const PLAYER_NOTES: Record<BindingPlayer, string> = {
  p1: '1P = 1人プレイ・2人プレイの左画面・BATTLE DUEL',
  p2: '2P = 2人プレイの右画面',
};

export function showKeySettings(
  ui: UIManager,
  storage: StorageManager,
  onChanged: (settings: Readonly<GameSettings>) => void,
  onBack: () => void,
): void {
  const rows: { player: BindingPlayer; action: DriveAction }[] = [];
  // 2列で 左 = 1P、右 = 2P になるよう、操作ごとに 1P → 2P の順で並べる
  for (const action of DRIVE_ACTIONS) for (const player of BINDING_PLAYERS) rows.push({ player, action });
  const resetIndex = rows.length;
  const backIndex = rows.length + 1;

  let capturing: number | null = null;
  let confirmReset = false;
  const status = el('div', 'key-settings-status', '');

  const setStatus = (text: string, kind: 'info' | 'warn' = 'info'): void => {
    status.textContent = text;
    status.className = `key-settings-status ${kind}`;
  };

  const options: MenuOption[] = [
    ...rows.map((_, i) => ({
      label: '',
      sub: '',
      className: 'key-row',
      onSelect: () => {
        capturing = i;
        confirmReset = false;
        setStatus('変えたいキーを押してください (Esc でキャンセル)');
        refresh();
      },
    })),
    {
      label: '',
      sub: '',
      onSelect: () => {
        if (sameBindings(storage.settings.keyBindings, defaultKeyBindings())) {
          setStatus('すでに初期設定です');
          return;
        }
        if (!confirmReset) {
          confirmReset = true;
          refresh();
          return;
        }
        storage.resetKeyBindings();
        onChanged(storage.settings);
        confirmReset = false;
        setStatus('初期設定 (1P = A/F/E/W + Space、2P = 矢印 + Enter) に戻しました');
        refresh();
      },
    },
    { label: '', sub: '', onSelect: () => onBack() },
  ];

  const menu = new Menu(
    {
      title: 'キー設定',
      subtitle: `${PLAYER_NOTES.p1}　/　${PLAYER_NOTES.p2}`,
      className: 'settings-menu key-settings-menu',
      columns: 2,
      options,
      onBack,
      hint: '↑↓←→ で選ぶ　Enter / クリックで変更',
    },
    ui.playSound,
  );
  menu.root.querySelector('.menu-body')?.after(status);

  const refresh = (): void => {
    const keys = storage.settings.keyBindings;
    rows.forEach((r, i) => {
      const name = `${PLAYER_LABELS[r.player]} ${DRIVE_ACTION_LABELS[r.action]}`;
      if (capturing === i) menu.setLabel(i, `${name}: ？`, 'キーを押してください');
      else menu.setLabel(i, `${name}: ${actionLabel(keys, r.player, r.action)}`, 'Enter / クリックで変更');
    });
    menu.setLabel(resetIndex, confirmReset ? 'もう一度 Enter で初期設定に戻す' : 'すべて初期設定に戻す', '1P = A/F/E/W + Space、2P = 矢印 + Enter');
    menu.setLabel(backIndex, 'もどる', '変更はすぐ保存されます');
  };

  const capture = (code: string): void => {
    const i = capturing;
    if (i === null) return;
    const row = rows[i]!;
    capturing = null;
    if (code === 'Escape') {
      ui.playSound('back');
      setStatus('キャンセルしました');
      refresh();
      return;
    }
    const result = assignKey(storage.settings.keyBindings, row.player, row.action, code);
    if (!result.ok) {
      ui.playSound('denied');
      setStatus(`「${keyLabel(code)}」はポーズやデバッグ用なので使えません`, 'warn');
      refresh();
      return;
    }
    storage.updateSettings({ keyBindings: result.bindings });
    onChanged(storage.settings);
    ui.playSound('confirm');
    const name = `${PLAYER_LABELS[row.player]} ${DRIVE_ACTION_LABELS[row.action]}`;
    if (result.swapped) {
      const other = `${PLAYER_LABELS[result.swapped.player]} ${DRIVE_ACTION_LABELS[result.swapped.action]}`;
      setStatus(
        `${name} を「${keyLabel(code)}」にしました。${other} と入れ替えて、${other} は「${actionLabel(result.bindings, result.swapped.player, result.swapped.action)}」になりました`,
        'warn',
      );
    } else {
      setStatus(`${name} を「${keyLabel(code)}」にしました`);
    }
    refresh();
  };

  ui.show({
    root: menu.root,
    handleKey: (code, event) => {
      if (capturing !== null) {
        // 項目を選んだ Enter の押しっぱなし (連続入力) は無視する
        if (event?.repeat) return true;
        capture(code);
        return true;
      }
      return menu.handleKey(code);
    },
  });
  setStatus('変えたい操作を選んでください');
  refresh();
}
