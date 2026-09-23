/**
 * 画面 (Screen) の切替とキー入力の振り分け。
 */
import type { AudioManager } from '../audio/AudioManager';
import type { InputManager } from '../input/InputManager';
import { Menu, type MenuOptions, type UiSound } from './Menu';

export interface Screen {
  root: HTMLElement;
  handleKey?(code: string): boolean;
  /** 毎フレーム呼ばれる (結果画面の自動復帰など) */
  update?(dt: number): void;
  dispose?(): void;
}

export class UIManager {
  readonly layer: HTMLElement;
  private current: Screen | null = null;
  private readonly audio: AudioManager;
  private readonly removeKeyListener: () => void;
  /** 最後に操作された時刻 (無操作での自動復帰用) */
  lastInteraction = performance.now();

  constructor(layer: HTMLElement, input: InputManager, audio: AudioManager) {
    this.layer = layer;
    this.audio = audio;
    this.removeKeyListener = input.addKeyListener((code, e) => {
      this.lastInteraction = performance.now();
      if (this.current?.handleKey?.(code)) {
        e.preventDefault();
      }
    });
    layer.addEventListener('pointerdown', () => {
      this.lastInteraction = performance.now();
    });
  }

  readonly playSound = (s: UiSound): void => {
    const map = { move: 'uiMove', confirm: 'uiConfirm', back: 'uiBack', denied: 'itemDenied' } as const;
    this.audio.play(map[s]);
  };

  show(screen: Screen): void {
    this.clear();
    this.current = screen;
    this.layer.append(screen.root);
    this.lastInteraction = performance.now();
    // 表示アニメーション
    requestAnimationFrame(() => screen.root.classList.add('visible'));
  }

  /** Menu を画面として表示するショートカット */
  showMenu(opts: MenuOptions): Menu {
    const menu = new Menu(opts, this.playSound);
    this.show({ root: menu.root, handleKey: (c) => menu.handleKey(c) });
    return menu;
  }

  get hasScreen(): boolean {
    return this.current !== null;
  }

  update(dt: number): void {
    this.current?.update?.(dt);
  }

  clear(): void {
    if (this.current) {
      this.current.dispose?.();
      this.current.root.remove();
      this.current = null;
    }
  }

  dispose(): void {
    this.clear();
    this.removeKeyListener();
  }
}
