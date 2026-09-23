/**
 * UIテーマの適用。CSS変数を <html> に設定し、data-theme 属性でテーマ固有の装飾を切り替える。
 */
import { UI_THEMES, type UiThemeId } from '../config/themes';

export function applyTheme(id: UiThemeId): void {
  const theme = UI_THEMES[id];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  root.dataset.theme = id;
}
