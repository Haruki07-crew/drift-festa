/**
 * BATTLE DUEL での1台分の戦闘状態 (タイヤHP・インベントリ・ブースト・射撃間隔)。
 */
import { itemsConfig } from '../config/items';
import { physicsConfig } from '../config/physics';
import type { RaceCar } from '../game/RaceCar';
import { Inventory } from '../items/Inventory';
import { TireHealth } from './TireHealth';

export type ItemUseOutcome = 'used' | 'hpFull' | 'gunInfo' | 'empty';

export class Combatant {
  readonly car: RaceCar;
  readonly tire: TireHealth;
  readonly inventory = new Inventory();
  /** ブースト残り時間 [s] */
  boostTimer = 0;
  /** 次に撃てるまでの時間 [s] */
  fireCooldown = 0;
  /** 被弾演出用 */
  hitFlash = 0;
  shotsFired = 0;
  shotsHit = 0;

  constructor(car: RaceCar) {
    this.car = car;
    this.tire = new TireHealth(car.spec.durability);
    for (const item of itemsConfig.startingItems) this.inventory.add(item);
  }

  get boosting(): boolean {
    return this.boostTimer > 0;
  }

  /** 弾速倍率 (Boost 中 +40%) */
  get bulletSpeedMul(): number {
    return this.boosting ? itemsConfig.boost.bulletSpeedMultiplier : 1;
  }

  update(dt: number): void {
    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    // タイヤHP0 → 最高速度50%、Boost → +20%
    const flat = this.tire.isFlat ? physicsConfig.flatTireMaxSpeedMul : 1;
    const boost = this.boosting ? itemsConfig.boost.maxSpeedMultiplier : 1;
    this.car.body.maxSpeedMul = flat * boost;
    this.car.body.accelMul = this.boosting ? itemsConfig.boost.accelMultiplier : 1;
  }

  /** 選択中のアイテムを使う */
  useSelected(): ItemUseOutcome {
    const slot = this.inventory.selectedSlot;
    if (!slot) return 'empty';
    switch (slot.kind) {
      case 'recovery':
        if (!this.tire.recover()) return 'hpFull';
        this.inventory.removeAt(this.inventory.selected);
        return 'used';
      case 'boost':
        // 重ね掛けなし: 残り時間を8秒へ戻す
        this.boostTimer = itemsConfig.boost.durationSeconds;
        this.inventory.removeAt(this.inventory.selected);
        return 'used';
      case 'gun':
        return 'gunInfo';
    }
  }

  /** 種類を指定して使う (AI 用) */
  useKind(kind: 'recovery' | 'boost'): ItemUseOutcome {
    const idx = this.inventory.indexOf(kind);
    if (idx < 0) return 'empty';
    const prev = this.inventory.selected;
    this.inventory.selected = idx;
    const r = this.useSelected();
    if (r !== 'used') this.inventory.selected = prev;
    else if (this.inventory.selected >= this.inventory.slots.length) this.inventory.selected = Math.max(0, this.inventory.slots.length - 1);
    return r;
  }
}
