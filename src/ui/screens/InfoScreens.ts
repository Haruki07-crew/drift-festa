/**
 * 設定画面・あそびかた・ポーズメニュー・ロード中表示。
 */
import { graphicsConfig, type GraphicsQuality } from '../../config/graphics';
import { THEME_ORDER, UI_THEMES } from '../../config/themes';
import type { GameSettings, StorageManager } from '../../storage/StorageManager';
import { el } from '../dom';
import type { MenuOption } from '../Menu';
import type { UIManager } from '../UIManager';

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

export function showHowToPlay(ui: UIManager, onBack: () => void): void {
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
    card('PURE RACE 1P / 2Pの左', [
      ['↑', '前進'],
      ['↓', 'ブレーキ / 後退'],
      ['← →', 'ハンドル'],
      ['Shift', 'ドリフト'],
    ]),
    card('PURE RACE 2Pの右 (P2)', [
      ['A', '前進'],
      ['F', 'ブレーキ / 後退'],
      ['W / E', '左 / 右'],
      ['Enter', 'ドリフト'],
    ]),
    card('BATTLE DUEL', [
      ['A / F', '前進 / 後退'],
      ['W / E', '左 / 右'],
      ['Space', 'ドリフト'],
      ['マウス', '照準を動かす'],
      ['左クリック', '発砲 (長押しで連射)'],
      ['右クリック', '照準を中央へ'],
      ['ホイール', 'アイテム選択'],
      ['ホイールクリック', 'アイテム使用'],
      ['4', 'アイテムを捨てる'],
    ]),
    card('ルール', [
      ['3周', '先にゴールした人の勝ち'],
      ['コースアウト', 'チェックポイントへ戻って6秒操作不能'],
      ['ドリフト', 'キーを押しながらハンドル。逆ハンで角度を調整'],
      ['Esc', 'ポーズ'],
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
