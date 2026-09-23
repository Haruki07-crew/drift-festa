/**
 * UIテーマ設定。
 *
 * テーマはタイトル画面・メニュー・HUD・パネル・ボタン・フォント・UIエフェクト・色合いを変更する。
 * コースや車の物理性能は変更しない。
 *
 * フォントは外部取得禁止 (オフライン要件) のため、OS に標準搭載されたフォントのみを指定する。
 */

export type UiThemeId = 'arcade' | 'futuristic' | 'touge' | 'neon';

export interface UiTheme {
  id: UiThemeId;
  label: string;
  /** CSS 変数 (--name: value) */
  vars: Record<string, string>;
}

const JP_SANS = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Meiryo", "Noto Sans JP", sans-serif';
const JP_SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "MS PMincho", "Noto Serif JP", serif';

export const UI_THEMES: Record<UiThemeId, UiTheme> = {
  arcade: {
    id: 'arcade',
    label: 'Arcade',
    vars: {
      '--font-display': `"Arial Black", "Helvetica Neue", ${JP_SANS}`,
      '--font-body': `"Helvetica Neue", Arial, ${JP_SANS}`,
      '--font-mono': '"SF Mono", Menlo, Consolas, monospace',
      '--c-bg': '#1b1f3a',
      '--c-bg-grad': 'linear-gradient(160deg, #ff5f6d 0%, #ffc371 45%, #2b86c5 100%)',
      '--c-panel': 'rgba(20, 22, 48, 0.86)',
      '--c-panel-border': '#ffd23f',
      '--c-text': '#ffffff',
      '--c-text-dim': '#c9cbe6',
      '--c-accent': '#ffd23f',
      '--c-accent-2': '#ff4f79',
      '--c-good': '#3ddc84',
      '--c-bad': '#ff4d4d',
      '--c-btn': '#2b3a8c',
      '--c-btn-hover': '#ff4f79',
      '--c-btn-text': '#ffffff',
      '--radius': '14px',
      '--border-w': '3px',
      '--shadow': '0 6px 0 rgba(0,0,0,0.35)',
      '--hud-shadow': '0 3px 0 rgba(0,0,0,0.55)',
      '--glow': '0 0 0 transparent',
      '--title-transform': 'skewX(-8deg)',
      '--letter': '0.02em',
    },
  },
  futuristic: {
    id: 'futuristic',
    label: 'Futuristic',
    vars: {
      '--font-display': `"Avenir Next", "Segoe UI", ${JP_SANS}`,
      '--font-body': `"Avenir Next", "Segoe UI", ${JP_SANS}`,
      '--font-mono': '"SF Mono", Menlo, Consolas, monospace',
      '--c-bg': '#0a1018',
      '--c-bg-grad': 'radial-gradient(ellipse at 50% 20%, #1b3a55 0%, #0a1018 70%)',
      '--c-panel': 'rgba(10, 24, 36, 0.78)',
      '--c-panel-border': '#6fe3ff',
      '--c-text': '#e6f7ff',
      '--c-text-dim': '#8fb3c7',
      '--c-accent': '#6fe3ff',
      '--c-accent-2': '#b98cff',
      '--c-good': '#6fffc1',
      '--c-bad': '#ff6f8a',
      '--c-btn': 'rgba(111, 227, 255, 0.08)',
      '--c-btn-hover': 'rgba(111, 227, 255, 0.3)',
      '--c-btn-text': '#e6f7ff',
      '--radius': '2px',
      '--border-w': '1px',
      '--shadow': '0 0 18px rgba(111, 227, 255, 0.18)',
      '--hud-shadow': '0 0 8px rgba(111, 227, 255, 0.6)',
      '--glow': '0 0 12px rgba(111, 227, 255, 0.55)',
      '--title-transform': 'none',
      '--letter': '0.18em',
    },
  },
  touge: {
    id: 'touge',
    label: 'Japanese Touge',
    vars: {
      '--font-display': JP_SERIF,
      '--font-body': JP_SANS,
      '--font-mono': '"SF Mono", Menlo, Consolas, monospace',
      '--c-bg': '#141010',
      '--c-bg-grad': 'linear-gradient(180deg, #2b1d2e 0%, #a4453a 55%, #e8a15e 100%)',
      '--c-panel': 'rgba(24, 16, 14, 0.84)',
      '--c-panel-border': '#e8d9b0',
      '--c-text': '#f5ecd7',
      '--c-text-dim': '#bba98a',
      '--c-accent': '#e03a2f',
      '--c-accent-2': '#e8d9b0',
      '--c-good': '#9fd36b',
      '--c-bad': '#e03a2f',
      '--c-btn': 'rgba(245, 236, 215, 0.06)',
      '--c-btn-hover': '#e03a2f',
      '--c-btn-text': '#f5ecd7',
      '--radius': '0px',
      '--border-w': '2px',
      '--shadow': '4px 4px 0 rgba(0,0,0,0.45)',
      '--hud-shadow': '2px 2px 0 rgba(0,0,0,0.8)',
      '--glow': '0 0 0 transparent',
      '--title-transform': 'none',
      '--letter': '0.08em',
    },
  },
  neon: {
    id: 'neon',
    label: 'Neon',
    vars: {
      '--font-display': `"Futura", "Trebuchet MS", ${JP_SANS}`,
      '--font-body': `"Trebuchet MS", "Helvetica Neue", ${JP_SANS}`,
      '--font-mono': '"SF Mono", Menlo, Consolas, monospace',
      '--c-bg': '#07020f',
      '--c-bg-grad': 'linear-gradient(180deg, #07020f 0%, #230a3d 60%, #3d0a4f 100%)',
      '--c-panel': 'rgba(18, 4, 32, 0.82)',
      '--c-panel-border': '#ff2d95',
      '--c-text': '#fdf0ff',
      '--c-text-dim': '#c09ad0',
      '--c-accent': '#ff2d95',
      '--c-accent-2': '#39f3ff',
      '--c-good': '#39ff9e',
      '--c-bad': '#ff3b5c',
      '--c-btn': 'rgba(255, 45, 149, 0.08)',
      '--c-btn-hover': 'rgba(255, 45, 149, 0.4)',
      '--c-btn-text': '#fdf0ff',
      '--radius': '10px',
      '--border-w': '2px',
      '--shadow': '0 0 22px rgba(255, 45, 149, 0.35)',
      '--hud-shadow': '0 0 10px rgba(255, 45, 149, 0.9), 0 0 2px #fff',
      '--glow': '0 0 16px rgba(57, 243, 255, 0.7)',
      '--title-transform': 'none',
      '--letter': '0.06em',
    },
  },
};

export const DEFAULT_THEME: UiThemeId = 'arcade';

export const THEME_ORDER: readonly UiThemeId[] = ['arcade', 'futuristic', 'touge', 'neon'];
