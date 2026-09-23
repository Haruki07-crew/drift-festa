/**
 * タイヤHP (車全体で1つ)。純粋ロジック・テスト対象。
 *
 * HP 0 で最高速度が通常の 50% (physicsConfig.flatTireMaxSpeedMul) になる。
 * Recovery で 100 まで完全回復。
 */
import { battleConfig, computeBulletDamage } from '../config/battle';

export class TireHealth {
  readonly max: number;
  hp: number;
  private readonly durability: number;

  constructor(durability: number, max = battleConfig.tire.maxHp) {
    this.max = max;
    this.hp = max;
    this.durability = durability;
  }

  get isFlat(): boolean {
    return this.hp <= 0;
  }

  get isFull(): boolean {
    return this.hp >= this.max;
  }

  get ratio(): number {
    return this.hp / this.max;
  }

  /** 被弾。与えたダメージを返す */
  hitByBullet(): number {
    const dmg = computeBulletDamage(this.durability);
    const before = this.hp;
    this.hp = Math.max(0, this.hp - dmg);
    return before - this.hp;
  }

  /** 完全回復。満タンの場合は false (使用不可) */
  recover(): boolean {
    if (this.isFull) return false;
    this.hp = this.max;
    return true;
  }
}
