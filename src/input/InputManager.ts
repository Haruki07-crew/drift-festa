/**
 * 入力状態の管理。
 *
 * キーを押している状態を保持する方式 (KeyboardEvent の単発処理ではない) なので、
 * 複数キーの同時押し (2人プレイ含む) を正しく扱える。
 * ゲーム画面の外 (ページ全体) の通常操作は妨害しない。preventDefault は
 * gameActive の間、ゲーム用キーとゲーム画面上のマウス操作にのみ行う。
 */
import { GAME_PREVENT_DEFAULT_KEYS } from '../config/controls';

export type KeyListener = (code: string, event: KeyboardEvent) => void;

export class InputManager {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly mousePressed = new Set<number>();
  private readonly keyListeners = new Set<KeyListener>();
  private wheelAccum = 0;
  private mouseDx = 0;
  private mouseDy = 0;
  private target: HTMLElement | null = null;
  /** キー設定で運転に割り当てたキー (ゲーム中はブラウザ標準動作を止める) */
  private gameKeys = new Set<string>();

  /** マウスの最新のクライアント座標 */
  mouseX = 0;
  mouseY = 0;
  /** レース中 (ゲーム用キーのブラウザ標準動作を抑止する) */
  gameActive = false;
  /** マウス操作を捕捉するか (BATTLE DUEL 中のみ true) */
  captureMouse = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.gameActive && (GAME_PREVENT_DEFAULT_KEYS.includes(e.code) || this.gameKeys.has(e.code))) {
      e.preventDefault();
    }
    if (!e.repeat) {
      this.pressed.add(e.code);
    }
    this.down.add(e.code);
    for (const l of this.keyListeners) l(e.code, e);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    // Shift 同時押し時に keyup が届かないブラウザ対策: 修飾キーの状態を同期
    if (!e.shiftKey) {
      this.down.delete('ShiftLeft');
      this.down.delete('ShiftRight');
    }
  };

  private readonly onBlur = (): void => {
    // ウィンドウ外へフォーカスが移ったらキーが押しっぱなしにならないよう全解除
    this.down.clear();
    this.mouseDown.clear();
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.captureMouse) return;
    // 中央クリックのオートスクロール等を抑止
    e.preventDefault();
    this.mouseDown.add(e.button);
    this.mousePressed.add(e.button);
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    this.mouseDown.delete(e.button);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.captureMouse) return;
    e.preventDefault();
    this.wheelAccum += e.deltaY;
  };

  private readonly onContextMenu = (e: MouseEvent): void => {
    if (this.gameActive) e.preventDefault();
  };

  private readonly onAuxClick = (e: MouseEvent): void => {
    if (this.captureMouse) e.preventDefault();
  };

  /** @param target ゲーム画面の要素 (マウス関連の抑止はこの要素上のみ) */
  attach(target: HTMLElement): void {
    this.target = target;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('wheel', this.onWheel, { passive: false });
    target.addEventListener('contextmenu', this.onContextMenu);
    target.addEventListener('auxclick', this.onAuxClick);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    if (this.target) {
      this.target.removeEventListener('mousedown', this.onMouseDown);
      this.target.removeEventListener('wheel', this.onWheel);
      this.target.removeEventListener('contextmenu', this.onContextMenu);
      this.target.removeEventListener('auxclick', this.onAuxClick);
    }
    this.target = null;
    this.keyListeners.clear();
  }

  /** 運転に割り当てたキーを登録 (キー設定で ' や / などを使ってもブラウザの検索などが動かないように) */
  setGameKeys(codes: readonly string[]): void {
    this.gameKeys = new Set(codes);
  }

  addKeyListener(listener: KeyListener): () => void {
    this.keyListeners.add(listener);
    return () => this.keyListeners.delete(listener);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  anyDown(codes: readonly string[]): boolean {
    for (const c of codes) {
      if (this.down.has(c)) return true;
    }
    return false;
  }

  /** 前回の endFrame() 以降に押されたか */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  anyPressed(codes: readonly string[]): boolean {
    for (const c of codes) {
      if (this.pressed.has(c)) return true;
    }
    return false;
  }

  isMouseDown(button: number): boolean {
    return this.mouseDown.has(button);
  }

  wasMousePressed(button: number): boolean {
    return this.mousePressed.has(button);
  }

  /** 前回の取得以降のホイール移動量 (取得でリセット) */
  consumeWheel(): number {
    const w = this.wheelAccum;
    this.wheelAccum = 0;
    return w;
  }

  /** 前回の取得以降のマウス移動量 (取得でリセット) */
  consumeMouseDelta(): { dx: number; dy: number } {
    const r = { dx: this.mouseDx, dy: this.mouseDy };
    this.mouseDx = 0;
    this.mouseDy = 0;
    return r;
  }

  /** フレームの最後に呼ぶ (押下エッジをリセット) */
  endFrame(): void {
    this.pressed.clear();
    this.mousePressed.clear();
  }

  releaseAll(): void {
    this.down.clear();
    this.pressed.clear();
    this.mouseDown.clear();
    this.mousePressed.clear();
    this.wheelAccum = 0;
    this.mouseDx = 0;
    this.mouseDy = 0;
  }
}
