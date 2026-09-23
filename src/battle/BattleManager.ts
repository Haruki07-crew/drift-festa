/**
 * BATTLE DUEL の戦闘全体 (タイヤHP・銃・弾丸・アイテム・NPC射撃AI) を管理する。
 * RaceWorld (走行) の上に重ねて動作する。描画は BattleView / HUD 側。
 */
import { battleConfig } from '../config/battle';
import type { ItemKind } from '../config/items';
import type { NpcDifficulty } from '../config/npc';
import type { RaceCar } from '../game/RaceCar';
import type { RaceWorld } from '../game/RaceWorld';
import { ItemBoxField } from '../items/ItemBoxes';
import { rollItem } from '../items/Inventory';
import { BattleAI } from './BattleAI';
import { BulletSystem, type BulletHit } from './BulletSystem';
import { Combatant, type ItemUseOutcome } from './Combatant';
import type { Vec3 } from './PredictiveAim';

export interface BattleEvents {
  onShot?: (shooter: Combatant) => void;
  onHit?: (target: Combatant, shooter: Combatant | undefined, damage: number) => void;
  onFlatTire?: (target: Combatant) => void;
  onItemPickup?: (c: Combatant, kind: ItemKind) => void;
  onItemBoxFull?: (c: Combatant) => void;
  onItemUse?: (c: Combatant, kind: ItemKind, outcome: ItemUseOutcome) => void;
  onItemDrop?: (c: Combatant, kind: ItemKind) => void;
}

export class BattleManager {
  readonly player: Combatant;
  readonly npc: Combatant;
  readonly combatants: Combatant[];
  readonly bullets: BulletSystem;
  readonly boxes: ItemBoxField;
  readonly ai: BattleAI;
  private readonly world: RaceWorld;
  private readonly events: BattleEvents;
  private readonly hits: BulletHit[] = [];
  private readonly random: () => number;
  private fullNoticeCooldown = 0;

  /** プレイヤーの照準方向 (AimController が毎フレーム更新) */
  playerAimDir: Vec3 | null = null;
  /** 発射ボタンが押されている */
  playerFireHeld = false;

  constructor(world: RaceWorld, playerCar: RaceCar, npcCar: RaceCar, difficulty: NpcDifficulty, events: BattleEvents, random: () => number = Math.random) {
    this.world = world;
    this.events = events;
    this.random = random;
    this.player = new Combatant(playerCar);
    this.npc = new Combatant(npcCar);
    this.combatants = [this.player, this.npc];
    this.bullets = new BulletSystem(world.track);
    this.boxes = new ItemBoxField(world.track);
    this.ai = new BattleAI(this.npc, this.player, difficulty, world.track, this.boxes, npcCar.pattern?.seed ?? 1);
    this.ai.onItemUsed = (kind) => this.events.onItemUse?.(this.npc, kind, 'used');
  }

  combatantOf(car: RaceCar): Combatant | undefined {
    return this.combatants.find((c) => c.car === car);
  }

  /** 固定ステップごとに呼ぶ (RaceWorld.step の後) */
  step(dt: number): void {
    const started = this.world.raceStarted;
    for (const c of this.combatants) c.update(dt);
    this.boxes.update(dt);
    if (this.fullNoticeCooldown > 0) this.fullNoticeCooldown -= dt;

    // --- 射撃 ---
    if (started) {
      const p = this.player;
      if (this.playerFireHeld && this.playerAimDir && this.canFire(p)) {
        this.fire(p, this.playerAimDir);
      }
      const aiDir = this.ai.update(dt, started);
      if (aiDir && this.canFire(this.npc)) {
        this.fire(this.npc, aiDir);
      }
    }

    // --- 弾丸 ---
    this.hits.length = 0;
    this.bullets.update(dt, this.world.cars, this.hits);
    for (const h of this.hits) {
      const target = this.combatantOf(h.target);
      if (!target) continue;
      const shooter = this.combatants.find((c) => c.car.id === h.bullet.ownerId);
      const wasFlat = target.tire.isFlat;
      const dmg = target.tire.hitByBullet();
      target.hitFlash = battleConfig.hitFeedback.flashSeconds;
      if (shooter) shooter.shotsHit++;
      this.events.onHit?.(target, shooter, dmg);
      if (!wasFlat && target.tire.isFlat) this.events.onFlatTire?.(target);
    }

    // --- アイテムボックス ---
    for (const c of this.combatants) {
      const b = c.car.body;
      if (b.airborne) continue;
      const full = c.inventory.isFull;
      const box = this.boxes.tryPickup(b.x, b.y, b.z, !full);
      if (box) {
        const kind = rollItem(this.random);
        c.inventory.add(kind);
        this.events.onItemPickup?.(c, kind);
      } else if (full && c === this.player && this.fullNoticeCooldown <= 0 && this.touchingActiveBox(c)) {
        this.fullNoticeCooldown = 1.5;
        this.events.onItemBoxFull?.(c);
      }
    }
  }

  private touchingActiveBox(c: Combatant): boolean {
    const b = c.car.body;
    return this.boxes.boxes.some((box) => box.active && Math.hypot(box.x - b.x, box.z - b.z) < 2.6);
  }

  private canFire(c: Combatant): boolean {
    return c.fireCooldown <= 0 && !c.car.isLocked && !c.car.progress.finished && !c.car.body.airborne && c.inventory.totalAmmo > 0;
  }

  private fire(c: Combatant, dir: Vec3): void {
    if (!c.inventory.consumeAmmo()) return;
    c.fireCooldown = battleConfig.gun.fireInterval;
    c.shotsFired++;
    this.bullets.fire(c.car, dir.x, dir.y, dir.z, c.bulletSpeedMul);
    this.events.onShot?.(c);
  }

  // --- プレイヤーのアイテム操作 (フレームごとの入力) ---

  cycleItem(direction: number): void {
    this.player.inventory.cycle(direction);
  }

  usePlayerItem(): void {
    const slot = this.player.inventory.selectedSlot;
    if (!slot) {
      this.events.onItemUse?.(this.player, 'recovery', 'empty');
      return;
    }
    const kind = slot.kind;
    const outcome = this.player.useSelected();
    this.events.onItemUse?.(this.player, kind, outcome);
  }

  dropPlayerItem(): void {
    const removed = this.player.inventory.dropSelected();
    if (removed) this.events.onItemDrop?.(this.player, removed.kind);
  }
}
