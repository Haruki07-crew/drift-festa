/**
 * 設定画面・あそびかた・ポーズメニュー・ロード中表示。
 */
import { graphicsConfig, type GraphicsQuality } from '../../config/graphics';
import { physicsConfig } from '../../config/physics';
import { THEME_ORDER, UI_THEMES } from '../../config/themes';
import { DRIVE_ACTIONS, type BindingPlayer } from '../../config/controls';
import { actionLabel, defaultKeyBindings, sameBindings } from '../../input/KeyBindings';
import type { GameSettings, StorageManager } from '../../storage/StorageManager';
import { el } from '../dom';
import type { MenuOption } from '../Menu';
import type { UIManager } from '../UIManager';
import { showKeySettings } from './KeySettings';

export interface SettingsHooks {
  onChanged: (settings: Readonly<GameSettings>) => void;
  toggleFullscreen: () => void;
  isFullscreen: () => boolean;
}

const QUALITIES: GraphicsQuality[] = ['low', 'medium', 'high'];
const IDLE_CHOICES = [0, 30, 60, 90, 120, 180];

export function showSettings(ui: UIManager, storage: StorageManager, hooks: SettingsHooks, onBack: () => void, inRace: boolean): void {
  let confirmReset = false;
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  const labels = (): [string, string][] => {
    const s = storage.settings;
    return [
      [`効果音の音量: ${pct(s.seVolume)}`, '← → で調整'],
      [`マウス照準の感度: ${s.mouseSensitivity.toFixed(1)}`, '← → で調整 (BATTLE DUEL)'],
      [`キー設定: 1P ${driveSummary(s, 'p1')} / 2P ${driveSummary(s, 'p2')}`, sameBindings(s.keyBindings, defaultKeyBindings()) ? 'Enter で変更 (今は初期設定)' : 'Enter で変更 (変更あり)'],
      [`カメラの揺れ: ${s.cameraShake ? 'ON' : 'OFF'}`, 'Enter / ← → で切替'],
      [`グラフィック品質: ${graphicsConfig.presets[s.graphicsQuality].label}`, inRace ? '一部はレース終了後に反映' : '重い場合は「低」に'],
      [`フルスクリーン: ${hooks.isFullscreen() ? 'ON' : 'OFF'}`, 'Enter で切替'],
      [`UIテーマ: ${UI_THEMES[s.theme].label}`, 'Arcade / Futuristic / Japanese Touge / Neon'],
      [`結果画面から自動でタイトルへ: ${s.idleReturnSeconds > 0 ? `${s.idleReturnSeconds}秒` : 'しない'}`, '文化祭の回転率向け'],
      [confirmReset ? 'もう一度 Enter で本当に初期化' : 'ベストタイムを消す', '保存された記録をリセット'],
      ['もどる', ''],
    ];
  };
  const change = (patch: Partial<GameSettings>): void => {
    storage.updateSettings(patch);
    hooks.onChanged(storage.settings);
    refresh();
  };
  const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length]!;
  const options: MenuOption[] = [
    { label: '', sub: '', onSelect: () => undefined, onAdjust: (d) => change({ seVolume: Math.round(Math.min(1, Math.max(0, storage.settings.seVolume + d * 0.1)) * 10) / 10 }) },
    { label: '', sub: '', onSelect: () => undefined, onAdjust: (d) => change({ mouseSensitivity: Math.round(Math.min(3, Math.max(0.2, storage.settings.mouseSensitivity + d * 0.1)) * 10) / 10 }) },
    {
      label: '',
      sub: '',
      onSelect: () => showKeySettings(ui, storage, hooks.onChanged, () => showSettings(ui, storage, hooks, onBack, inRace)),
    },
    { label: '', sub: '', onSelect: () => change({ cameraShake: !storage.settings.cameraShake }), onAdjust: () => change({ cameraShake: !storage.settings.cameraShake }) },
    {
      label: '',
      sub: '',
      onSelect: () => change({ graphicsQuality: cycle(QUALITIES, storage.settings.graphicsQuality, 1) }),
      onAdjust: (d) => change({ graphicsQuality: cycle(QUALITIES, storage.settings.graphicsQuality, d) }),
    },
    {
      label: '',
      sub: '',
      onSelect: () => {
        hooks.toggleFullscreen();
        window.setTimeout(refresh, 300);
      },
    },
    {
      label: '',
      sub: '',
      onSelect: () => change({ theme: cycle(THEME_ORDER, storage.settings.theme, 1) }),
      onAdjust: (d) => change({ theme: cycle(THEME_ORDER, storage.settings.theme, d) }),
    },
    {
      label: '',
      sub: '',
      onSelect: () => change({ idleReturnSeconds: cycle(IDLE_CHOICES, storage.settings.idleReturnSeconds, 1) }),
      onAdjust: (d) => change({ idleReturnSeconds: cycle(IDLE_CHOICES, storage.settings.idleReturnSeconds, d) }),
    },
    {
      label: '',
      sub: '',
      onSelect: () => {
        if (confirmReset) {
          storage.resetBestTimes();
          confirmReset = false;
        } else {
          confirmReset = true;
        }
        refresh();
      },
    },
    { label: '', sub: '', onSelect: () => onBack() },
  ];
  const menu = ui.showMenu({
    title: '設定',
    className: 'settings-menu',
    options,
    onBack,
    hint: '↑↓ で選ぶ　← → で変更　Enter で決定',
  });
  const refresh = (): void => {
    labels().forEach(([l, s], i) => menu.setLabel(i, l, s));
  };
  refresh();
}

/** 設定一覧に出すキーの要約 (前進/後退/右/左/ドリフト を「A F E W Space」のように) */
function driveSummary(s: Readonly<GameSettings>, player: BindingPlayer): string {
  return DRIVE_ACTIONS.map((a) => actionLabel(s.keyBindings, player, a)).join(' ');
}

/** あそびかた (操作説明は今のキー設定を表示) */
export function showHowToPlay(ui: UIManager, storage: StorageManager, onBack: () => void): void {
  const keys = storage.settings.keyBindings;
  const k = (player: BindingPlayer, action: (typeof DRIVE_ACTIONS)[number]): string => actionLabel(keys, player, action);
  const root = el('div', 'screen howto-screen');
  root.append(el('h2', 'menu-title', 'あそびかた'));
  const grid = el('div', 'howto-grid');
  const card = (title: string, rows: [string, string][]): HTMLElement => {
    const c = el('div', 'howto-card');
    c.append(el('h3', '', title));
    for (const [k, v] of rows) {
      const r = el('div', 'howto-row');
      r.append(el('kbd', '', k), el('span', '', v));
      c.append(r);
    }
    return c;
  };
  grid.append(
    card('PURE RACE 1人 / 2人の P1 (左画面)', [
      [k('p1', 'forward'), '前進'],
      [k('p1', 'reverse'), 'ブレーキ / 後退'],
      [`${k('p1', 'left')} / ${k('p1', 'right')}`, '左 / 右'],
      [k('p1', 'drift'), 'ドリフト'],
    ]),
    card('PURE RACE 2人の P2 (右画面)', [
      [k('p2', 'forward'), '前進'],
      [k('p2', 'reverse'), 'ブレーキ / 後退'],
      [`${k('p2', 'left')} / ${k('p2', 'right')}`, '左 / 右'],
      [k('p2', 'drift'), 'ドリフト'],
    ]),
    card('BATTLE DUEL', [
      [`${k('p1', 'forward')} / ${k('p1', 'reverse')}`, '前進 / 後退'],
      [`${k('p1', 'left')} / ${k('p1', 'right')}`, '左 / 右'],
      [k('p1', 'drift'), 'ドリフト'],
      ['マウス', '照準を動かす'],
      ['左クリック', '発砲 (長押しで連射)'],
      ['右クリック', '照準を中央へ'],
      ['ホイール', 'アイテム選択'],
      ['ホイールクリック', 'アイテム使用'],
      ['4', 'アイテムを捨てる'],
    ]),
    card('ルール', [
      ['3周', '先にゴールした人の勝ち'],
      ['コースアウト', `チェックポイントへ戻って${physicsConfig.respawn.lockSeconds}秒操作不能`],
      ['ドリフト', 'キーを押しながらハンドル。逆ハンで角度を調整'],
      ['Esc', 'ポーズ'],
      ['キー設定', '設定画面で運転のキーを変えられます'],
    ]),
  );
  root.append(grid);
  const back = el('button', 'menu-back', '◀ もどる (Esc)');
  back.type = 'button';
  back.addEventListener('click', () => {
    ui.playSound('back');
    onBack();
  });
  root.append(back);
  ui.show({
    root,
    handleKey: (code) => {
      if (code === 'Escape' || code === 'Backspace' || code === 'Enter') {
        ui.playSound('back');
        onBack();
        return true;
      }
      return false;
    },
  });
}

export interface PauseActions {
  resume: () => void;
  restart: () => void;
  settings: () => void;
  title: () => void;
}

export function showPause(ui: UIManager, actions: PauseActions): void {
  ui.showMenu({
    title: 'PAUSE',
    className: 'pause-menu overlay',
    options: [
      { label: '再開', onSelect: actions.resume },
      { label: 'リスタート', onSelect: actions.restart },
      { label: '設定', onSelect: actions.settings },
      { label: 'タイトルへ戻る', onSelect: actions.title },
    ],
    onBack: actions.resume,
    hint: 'Esc で再開',
  });
}

export function showLoading(ui: UIManager, text: string): void {
  const root = el('div', 'screen loading-screen');
  root.append(el('div', 'loading-spinner'), el('div', 'loading-text', text));
  ui.show({ root });
}
