/**
 * レースに参加する1台 (人間 or NPC) のロジック上のエンティティ。描画は持たない。
 */
import type { CarSpec } from '../config/cars';
import type { NpcDriver } from '../npc/NpcDriver';
import type { NpcPattern } from '../npc/NpcPatterns';
import { VehicleBody } from '../physics/VehicleBody';
import { createControls, type VehicleControls } from '../vehicles/VehicleControls';
import { RaceProgress, type CourseTiming } from './RaceProgress';

export type RaceCarKind = 'human' | 'npc';

export class RaceCar {
  readonly id: number;
  readonly spec: CarSpec;
  readonly kind: RaceCarKind;
  /** 人間プレイヤー番号 (0 = P1, 1 = P2)。NPC は -1 */
  readonly playerIndex: number;
  readonly pattern: NpcPattern | null;
  readonly body: VehicleBody;
  readonly controls: VehicleControls = createControls();
  readonly progress: RaceProgress;
  readonly displayName: string;
  npc: NpcDriver | null = null;

  /** 復帰後の操作不能の残り時間 [s] */
  lockTimer = 0;
  /** 復帰後の衝突無効の残り時間 [s] */
  ghostTimer = 0;
  /** 逆走している時間 [s] */
  wrongWayTimer = 0;
  /** 現在順位 (1始まり) */
  position = 0;
  /** 落下・復帰回数 (結果表示用) */
  respawnCount = 0;

  constructor(opts: {
    id: number;
    spec: CarSpec;
    kind: RaceCarKind;
    playerIndex: number;
    pattern: NpcPattern | null;
    timing: CourseTiming;
    displayName: string;
  }) {
    this.id = opts.id;
    this.spec = opts.spec;
    this.kind = opts.kind;
    this.playerIndex = opts.playerIndex;
    this.pattern = opts.pattern;
    this.body = new VehicleBody(opts.spec);
    this.progress = new RaceProgress(opts.timing);
    this.displayName = opts.displayName;
  }

  get isHuman(): boolean {
    return this.kind === 'human';
  }

  get isLocked(): boolean {
    return this.lockTimer > 0;
  }
}
