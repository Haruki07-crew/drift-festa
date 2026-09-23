/**
 * アイテムインベントリ (最大3枠)。純粋ロジック・テスト対象。
 *
 * Gun は「銃 + 弾10発」のセットで1枠を使う。弾はスロットごとに管理する。
 */
import { itemsConfig, type ItemKind } from '../config/items';

export interface ItemSlot {
  kind: ItemKind;
  /** Gun の残弾 (それ以外は 0) */
  ammo: number;
}

export type UseResult = 'used' | 'empty' | 'hpFull' | 'notUsable';

export class Inventory {
  readonly capacity: number;
  readonly slots: ItemSlot[] = [];
  /** 選択中のスロット番号 */
  selected = 0;

  constructor(capacity = itemsConfig.maxInventory) {
    this.capacity = capacity;
  }

  get isFull(): boolean {
    return this.slots.length >= this.capacity;
  }

  get selectedSlot(): ItemSlot | undefined {
    return this.slots[this.selected];
  }

  /** アイテムを追加。満杯なら false (アイテムボックスは消費しない) */
  add(kind: ItemKind): boolean {
    if (this.isFull) return false;
    this.slots.push({ kind, ammo: kind === 'gun' ? itemsConfig.gun.ammoPerPickup : 0 });
    if (this.slots.length === 1) this.selected = 0;
    return true;
  }

  /** 選択を移動 (ホイール)。 */
  cycle(direction: number): void {
    const n = this.slots.length;
    if (n === 0) {
      this.selected = 0;
      return;
    }
    const step = direction > 0 ? 1 : -1;
    this.selected = (((this.selected + step) % n) + n) % n;
  }

  /** 選択中のアイテムを捨てる */
  dropSelected(): ItemSlot | undefined {
    if (this.slots.length === 0) return undefined;
    const [removed] = this.slots.splice(this.selected, 1);
    this.clampSelection();
    return removed;
  }

  removeAt(index: number): void {
    this.slots.splice(index, 1);
    this.clampSelection();
  }

  count(kind: ItemKind): number {
    return this.slots.filter((s) => s.kind === kind).length;
  }

  indexOf(kind: ItemKind): number {
    return this.slots.findIndex((s) => s.kind === kind);
  }

  /** 発砲に使う Gun スロット (選択中が Gun ならそれ、そうでなければ最初の弾ありの Gun) */
  gunSlotIndex(): number {
    const sel = this.slots[this.selected];
    if (sel && sel.kind === 'gun' && sel.ammo > 0) return this.selected;
    return this.slots.findIndex((s) => s.kind === 'gun' && s.ammo > 0);
  }

  get totalAmmo(): number {
    let total = 0;
    for (const s of this.slots) if (s.kind === 'gun') total += s.ammo;
    return total;
  }

  /** 1発消費する。撃てた場合 true */
  consumeAmmo(): boolean {
    const idx = this.gunSlotIndex();
    if (idx < 0) return false;
    const slot = this.slots[idx]!;
    slot.ammo--;
    if (slot.ammo <= 0 && itemsConfig.gun.removeWhenEmpty) {
      this.removeAt(idx);
    }
    return true;
  }

  clear(): void {
    this.slots.length = 0;
    this.selected = 0;
  }

  private clampSelection(): void {
    if (this.slots.length === 0) this.selected = 0;
    else if (this.selected >= this.slots.length) this.selected = this.slots.length - 1;
  }
}

/** 重み付き抽選 (仕様: 全アイテム同確率。重みは items.ts で変更可) */
export function rollItem(random: () => number, weights: Record<ItemKind, number> = itemsConfig.dropWeights): ItemKind {
  const entries = Object.entries(weights) as [ItemKind, number][];
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (total <= 0) {
    throw new Error('rollItem: all weights are zero');
  }
  let r = random() * total;
  for (const [kind, w] of entries) {
    const weight = Math.max(0, w);
    if (r < weight) return kind;
    r -= weight;
  }
  return entries[entries.length - 1]![0];
}
