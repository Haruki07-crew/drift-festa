/** 小さな DOM ヘルパー (フレームワーク不使用) */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** textContent が変わった時だけ書き換える (毎フレーム更新の HUD 用) */
export function setText(e: HTMLElement, text: string): void {
  if (e.textContent !== text) e.textContent = text;
}

export function setStyle(e: HTMLElement, prop: string, value: string): void {
  if (e.style.getPropertyValue(prop) !== value) e.style.setProperty(prop, value);
}

export function toggleClass(e: HTMLElement, cls: string, on: boolean): void {
  if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
}

export function colorHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
