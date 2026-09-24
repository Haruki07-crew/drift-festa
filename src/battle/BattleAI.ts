/**
 * BATTLE DUEL の NPC 射撃・アイテムAI (機械学習なし)。
 *
 * - 偏差射撃: 相手の現在位置・速度から未来位置を予測 (PredictiveAim)
 * - 難易度で 反応速度 / 照準誤差 / 予測精度 / 発射判断 / 弾薬節約 を変える
 * - 強制命中は使用しない (照準がずれていれば普通に外れる)
 * - アイテム: HPが減ったら Recovery、直線で Boost、アイテムボックスへ寄せる
 */
import { battleConfig, type BattleAiDifficulty } from '../config/battle';
import type { NpcDifficulty } from '../config/npc';
import { SeededRandom, clamp } from '../core/math';
import type { Track } from '../courses/Track';
import type { ItemBoxField } from '../items/ItemBoxes';
import type { Combatant } from './Combatant';
import { perturbDirection, solveIntercept, type Vec3 } from './PredictiveAim';

const gun = battleConfig.gun;
/** 射撃できる前方の角度範囲 (プレイヤーの画面と同程度にして公平にする) [rad] */
const FORWARD_CONE = (70 * Math.PI) / 180;

export interface AiDebug {
  aimX: number;
  aimY: number;
  aimZ: number;
  wantsFire: boolean;
  predictedTime: number | null;
}

export class BattleAI {
  readonly self: Combatant;
  readonly opponent: Combatant;
  readonly cfg: BattleAiDifficulty;
  private readonly track: Track;
  private readonly boxes: ItemBoxField;
  private readonly rng: SeededRandom;
  private thinkTimer = 0;
  private aimDir: Vec3 | null = null;
  private wantsFire = false;
  private itemTimer = 0;
  readonly debug: AiDebug = { aimX: 0, aimY: 0, aimZ: 0, wantsFire: false, predictedTime: null };

  constructor(self: Combatant, opponent: Combatant, difficulty: NpcDifficulty, track: Track, boxes: ItemBoxField, seed: number) {
    this.self = self;
    this.opponent = opponent;
    this.cfg = battleConfig.ai[difficulty];
    this.track = track;
    this.boxes = boxes;
    this.rng = new SeededRandom(seed);
  }

  /**
   * @returns このステップで撃つ方向 (撃たない場合は null)
   */
  update(dt: number, raceStarted: boolean): Vec3 | null {
    const me = this.self.car;
    const body = me.body;
    this.updateItemSeeking();
    if (!raceStarted || me.isLocked || me.progress.finished) return null;

    this.updateItems(dt);

    // --- 照準の更新 (反応時間ごと) ---
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = this.cfg.reactionTime * this.rng.range(0.8, 1.2);
      this.think();
    }
    if (!this.wantsFire || !this.aimDir) return null;
    if (this.self.fireCooldown > 0 || this.self.inventory.totalAmmo <= 0) return null;
    // 自分の向きが変わって前方の範囲から外れたら撃たない
    const fwdDot = this.aimDir.x * body.forwardX + this.aimDir.z * body.forwardZ;
    const horiz = Math.hypot(this.aimDir.x, this.aimDir.z) || 1;
    if (fwdDot / horiz < Math.cos(FORWARD_CONE)) return null;
    return this.aimDir;
  }

  private think(): void {
    const me = this.self.car.body;
    const target = this.opponent.car.body;
    this.wantsFire = false;
    if (!target.collidable || target.airborne || this.opponent.car.progress.finished) return;
    const muzzle = { x: me.x, y: me.y + gun.muzzleHeight, z: me.z };
    const tpos = { x: target.x, y: target.y + 0.7, z: target.z };
    const dist = Math.hypot(tpos.x - muzzle.x, tpos.z - muzzle.z);
    const ammo = this.self.inventory.totalAmmo;
    if (ammo <= 0 || dist > this.cfg.fireRange) return;
    if (ammo <= this.cfg.conserveAmmoBelow && dist > this.cfg.conserveRange) return;

    const speed = gun.muzzleVelocity * this.self.bulletSpeedMul;
    const sol = solveIntercept(
      muzzle,
      { x: me.vx, y: 0, z: me.vz },
      tpos,
      { x: target.vx, y: 0, z: target.vz },
      speed,
      this.cfg.predictionAccuracy,
    );
    // 距離を考えた発砲判断: 命中までの時間が長すぎる (避けられやすい) なら撃たない
    if (sol.time === null || sol.time > this.cfg.maxInterceptTime) return;
    // 照準誤差 (反応ごとに引き直す。強制命中はしない)
    const dir = perturbDirection(
      sol.dir,
      this.rng.gaussian() * this.cfg.aimErrorRad,
      this.rng.gaussian() * this.cfg.aimErrorRad * 0.5,
    );
    const toTargetX = (tpos.x - muzzle.x) / (dist || 1);
    const toTargetZ = (tpos.z - muzzle.z) / (dist || 1);
    const fwd = toTargetX * me.forwardX + toTargetZ * me.forwardZ;
    if (fwd < Math.cos(FORWARD_CONE)) return;
    // 照準が合っているか (予測方向と誤差入りの方向のずれ)
    const agreement = dir.x * sol.dir.x + dir.y * sol.dir.y + dir.z * sol.dir.z;
    if (Math.acos(clamp(agreement, -1, 1)) > this.cfg.fireAngleTolerance * 3) return;
    this.aimDir = dir;
    this.wantsFire = this.rng.next() < this.cfg.fireDecisionRate;
    this.debug.aimX = muzzle.x + dir.x * dist;
    this.debug.aimY = muzzle.y + dir.y * dist;
    this.debug.aimZ = muzzle.z + dir.z * dist;
    this.debug.wantsFire = this.wantsFire;
    this.debug.predictedTime = sol.time;
  }

  private updateItems(dt: number): void {
    this.itemTimer += dt;
    if (this.itemTimer < this.cfg.itemDecisionDelay) return;
    const c = this.self;
    if (c.tire.hp <= this.cfg.recoveryHpThreshold && c.inventory.indexOf('recovery') >= 0) {
      if (c.useKind('recovery') === 'used') {
        this.itemTimer = 0;
        this.onItemUsed?.('recovery');
      }
      return;
    }
    const behind = this.opponent.car.progress.progressKey > this.self.car.progress.progressKey + 0.05;
    const wantBoost = this.straightAhead() || (this.cfg.boostWhenBehind && behind && this.straightAhead(40));
    if (!c.boosting && c.inventory.indexOf('boost') >= 0 && wantBoost) {
      if (c.useKind('boost') === 'used') {
        this.itemTimer = 0;
        this.onItemUsed?.('boost');
      }
    }
  }

  /** アイテム使用時のコールバック (音・表示用) */
  onItemUsed: ((kind: 'recovery' | 'boost') => void) | null = null;

  private straightAhead(length = this.cfg.boostStraightLength): boolean {
    const s = this.self.car.body.trackS;
    const len = length;
    for (let d = 0; d < len; d += 6) {
      if (Math.abs(this.track.curvatureAt(s + d)) > 0.005) return false;
    }
    return true;
  }

  /** インベントリに空きがあれば、前方のアイテムボックスへ寄せる */
  private updateItemSeeking(): void {
    const driver = this.self.car.npc;
    if (!driver) return;
    const inv = this.self.inventory;
    const needsItem = inv.totalAmmo < 4 || (inv.indexOf('recovery') < 0 && this.self.tire.hp < 80) || inv.slots.length < 2;
    if (inv.isFull || (this.cfg.seekItemsOnlyWhenNeeded && !needsItem)) {
      driver.extraOffset = 0;
      return;
    }
    const s = this.self.car.body.trackS;
    const lat = this.self.car.body.trackLateral;
    let best: { lateral: number; ds: number } | null = null;
    for (const b of this.boxes.boxes) {
      if (!b.active) continue;
      const ds = this.track.deltaS(s, b.s);
      if (ds < 10 || ds > 90) continue;
      if (!best || Math.abs(b.lateral - lat) < Math.abs(best.lateral - lat) || ds < best.ds - 20) {
        best = { lateral: b.lateral, ds };
      }
    }
    if (!best) {
      driver.extraOffset = 0;
      return;
    }
    const lineOff = driver.line.offsetAt(s + best.ds);
    const max = this.cfg.itemSeekMaxOffset;
    driver.extraOffset = clamp(best.lateral - lineOff, -max, max);
  }
}
