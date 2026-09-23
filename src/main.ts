/**
 * エントリーポイント。
 */
import './ui/styles.css';
import { App } from './core/App';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app が見つかりません');
}

try {
  const app = new App(root);
  app.start();
  // 開発・長時間稼働テスト用 (コンソールから window.__app.stats で確認)
  (window as unknown as { __app: App }).__app = app;
} catch (err) {
  console.error(err);
  root.innerHTML = `<div class="fatal"><h1>起動できませんでした</h1><p>WebGL に対応したブラウザ (Chrome 推奨) で開いてください。</p><pre>${String(err)}</pre></div>`;
}
