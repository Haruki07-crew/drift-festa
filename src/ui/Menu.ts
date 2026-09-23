/**
 * キーボード (矢印 + Enter / Esc) とマウスの両方で操作できる汎用メニュー。
 * 文化祭で初めて触る人でも迷わないよう、フォーカス中の項目を大きく強調する。
 */
import { controlsConfig } from '../config/controls';
import { el } from './dom';

export interface MenuOption {
  label: string;
  sub?: string;
  /** 項目内に追加表示する要素 */
  extra?: HTMLElement;
  disabled?: boolean;
  onSelect: () => void;
  /** ← → で値を変える項目 (設定画面など) */
  onAdjust?: (dir: number) => void;
  className?: string;
}

export interface MenuOptions {
  title: string;
  subtitle?: string;
  options: MenuOption[];
  /** グリッドの列数 (1 = 縦並び) */
  columns?: number;
  initialIndex?: number;
  onBack?: () => void;
  onFocus?: (index: number) => void;
  hint?: string;
  /** メニューの横に表示する詳細パネル */
  side?: HTMLElement;
  className?: string;
}

export type UiSound = 'move' | 'confirm' | 'back' | 'denied';

export class Menu {
  readonly root: HTMLElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly opts: MenuOptions;
  private index: number;
  private readonly columns: number;
  private readonly playSound: (s: UiSound) => void;

  constructor(opts: MenuOptions, playSound: (s: UiSound) => void) {
    this.opts = opts;
    this.playSound = playSound;
    this.columns = Math.max(1, opts.columns ?? 1);
    this.root = el('div', `screen menu-screen ${opts.className ?? ''}`);
    const header = el('div', 'menu-header');
    header.append(el('h2', 'menu-title', opts.title));
    if (opts.subtitle) header.append(el('p', 'menu-subtitle', opts.subtitle));
    this.root.append(header);

    const body = el('div', 'menu-body');
    const list = el('div', `menu-list ${this.columns > 1 ? 'grid' : ''}`);
    list.style.setProperty('--cols', String(this.columns));
    opts.options.forEach((o, i) => {
      const b = el('button', `menu-item ${o.className ?? ''}`);
      b.type = 'button';
      b.append(el('span', 'menu-label', o.label));
      if (o.sub !== undefined) b.append(el('span', 'menu-sub', o.sub));
      if (o.extra) b.append(o.extra);
      if (o.disabled) b.classList.add('disabled');
      b.addEventListener('mouseenter', () => this.focus(i, false));
      b.addEventListener('click', () => {
        this.focus(i, false);
        this.activate();
      });
      this.buttons.push(b);
      list.append(b);
    });
    body.append(list);
    if (opts.side) body.append(opts.side);
    this.root.append(body);

    const footer = el('div', 'menu-footer');
    const back = opts.onBack
      ? (() => {
          const bb = el('button', 'menu-back', '◀ もどる (Esc)');
          bb.type = 'button';
          bb.addEventListener('click', () => this.back());
          return bb;
        })()
      : null;
    if (back) footer.append(back);
    footer.append(el('span', 'menu-hint', opts.hint ?? '↑↓←→ で選ぶ　Enter で決定'));
    this.root.append(footer);

    this.index = Math.min(Math.max(0, opts.initialIndex ?? 0), opts.options.length - 1);
    this.focus(this.index, false);
  }

  get focusedIndex(): number {
    return this.index;
  }

  focus(i: number, sound = true): void {
    const n = this.buttons.length;
    if (n === 0) return;
    const next = ((i % n) + n) % n;
    if (sound && next !== this.index) this.playSound('move');
    this.buttons[this.index]?.classList.remove('focused');
    this.index = next;
    const b = this.buttons[this.index]!;
    b.classList.add('focused');
    b.scrollIntoView({ block: 'nearest' });
    this.opts.onFocus?.(this.index);
  }

  activate(): void {
    const o = this.opts.options[this.index];
    if (!o) return;
    if (o.disabled) {
      this.playSound('denied');
      return;
    }
    this.playSound('confirm');
    o.onSelect();
  }

  back(): void {
    if (this.opts.onBack) {
      this.playSound('back');
      this.opts.onBack();
    }
  }

  /** ラベルを更新 (設定画面の値表示など) */
  setLabel(i: number, label: string, sub?: string): void {
    const b = this.buttons[i];
    if (!b) return;
    const l = b.querySelector('.menu-label');
    if (l) l.textContent = label;
    const s = b.querySelector('.menu-sub');
    if (s && sub !== undefined) s.textContent = sub;
  }

  handleKey(code: string): boolean {
    const m = controlsConfig.menu;
    const cols = this.columns;
    const o = this.opts.options[this.index];
    if (m.left.includes(code)) {
      if (o?.onAdjust) {
        o.onAdjust(-1);
        this.playSound('move');
      } else if (cols > 1) this.focus(this.index - 1);
      return true;
    }
    if (m.right.includes(code)) {
      if (o?.onAdjust) {
        o.onAdjust(1);
        this.playSound('move');
      } else if (cols > 1) this.focus(this.index + 1);
      return true;
    }
    if (m.up.includes(code)) {
      this.focus(this.index - cols);
      return true;
    }
    if (m.down.includes(code)) {
      this.focus(this.index + cols);
      return true;
    }
    if (m.confirm.includes(code)) {
      this.activate();
      return true;
    }
    if (m.back.includes(code)) {
      this.back();
      return true;
    }
    return false;
  }
}
