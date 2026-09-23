/**
 * レースのロジック本体 (描画・音・UI に依存しない)。
 *
 * 固定タイムステップで以下を進める:
 *   NPC判断 → 車両物理 → コース衝突 (壁・落下) → 車同士の衝突 → 復帰処理 → 周回・順位
 * 描画側 (RaceSession) はイベントを購読して音や演出を出す。
 * 描画なしでも動くため、ヘッドレスのシミュレーション検証 (scripts/sim-race.ts) にも使える。
 */
import { gameConfig } from '../config/game';
import { physicsConfig } from '../config/physics';
import type { Track, TrackPoint } from '../courses/Track';
import { NpcDriver, type TrafficCar } from '../npc/NpcDriver';
import { RacingLine, computeIdealOffsets, computeSpeedProfile } from '../npc/RacingLine';
import { resolveCarCollisions, type CarContact } from '../physics/CarCollision';
import { TrackCollision } from '../physics/TrackCollision';
import { stepVehicle } from '../physics/VehiclePhysics';
import { resetControls } from '../vehicles/VehicleControls';
import type { RaceCar } from './RaceCar';
import { computeRanking, type RankEntry } from './RaceProgress';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceWorldEvents {
  onWallImpact?: (car: RaceCar, speed: number) => void;
  onCarContact?: (a: RaceCar, b: RaceCar, speed: number) => void;
  onFall?: (car: RaceCar) => void;
  onRespawn?: (car: RaceCar) => void;
  onLap?: (car: RaceCar, lapTime: number) => void;
  onFinish?: (car: RaceCar, position: number) => void;
}

export class RaceWorld {
  readonly track: Track;
  readonly cars: RaceCar[];
  readonly events: RaceWorldEvents;
  readonly idealOffsets: Float32Array;
  phase: RacePhase = 'countdown';
  /** GO! からの経過時間 [s] */
  time = 0;
  /** 最初の車がゴールした時刻 */
  winnerTime: number | null = null;
  /** 順位順の車ID */
  ranking: number[] = [];
  finishOrder: number[] = [];

  private readonly trackCollision: TrackCollision;
  private readonly traffic: TrafficCar[];
  private readonly contacts: CarContact[] = [];
  private readonly rankEntries: RankEntry[];
  private readonly bodyToCar = new Map<object, RaceCar>();
  private readonly tmpPoint: TrackPoint = { x: 0, y: 0, z: 0, tx: 0, tz: 1, halfWidth: 5 };
  private readonly bodies;

  constructor(track: Track, cars: RaceCar[], events: RaceWorldEvents = {}, idealOffsets?: Float32Array) {
    this.track = track;
    this.cars = cars;
    this.events = events;
    this.trackCollision = new TrackCollision(track);
    this.idealOffsets = idealOffsets ?? computeIdealOffsets(track);
    this.traffic = cars.map((c) => ({ id: c.id, body: c.body }));
    this.rankEntries = cars.map((c) => ({ id: c.id, progress: c.progress }));
    this.bodies = cars.map((c) => c.body);
    for (const c of cars) this.bodyToCar.set(c.body, c);

    // NPC ドライバーの準備 (パターンごとの基本ラインと速度計画)
    for (const car of cars) {
      if (car.kind === 'npc' && car.pattern) {
        const p = car.pattern;
        const line = RacingLine.blend(track, this.idealOffsets, p.lineBlend, p.lineOffset);
        const profile = computeSpeedProfile(line, car.spec, p);
        car.npc = new NpcDriver(p, car.id, car.body, track, line, profile);
      }
    }
    this.placeOnGrid();
  }

  /** スターティンググリッドに並べる (cars の並び順 = グリッド順) */
  placeOnGrid(): void {
    const g = gameConfig.grid;
    const L = this.track.length;
    this.cars.forEach((car, i) => {
      const row = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      const s = L - g.firstRowOffset - row * g.rowSpacing - (side > 0 ? g.rowSpacing * 0.35 : 0);
      const p = this.track.worldAt(s, side * g.lateralOffset, this.tmpPoint);
      car.body.place(p.x, p.y, p.z, Math.atan2(p.tx, p.tz));
      this.trackCollision.resolve(car.body);
      car.progress.teleport(car.body.trackS);
      car.npc?.reset();
    });
    this.updateRanking();
  }

  get raceStarted(): boolean {
    return this.phase !== 'countdown';
  }

  startRace(): void {
    this.phase = 'racing';
    this.time = 0;
  }

  /** 1固定ステップ進める。人間の操作は事前に car.controls へ設定しておく */
  step(dt: number): void {
    const started = this.raceStarted;
    if (started) this.time += dt;

    // --- 操作 ---
    for (const car of this.cars) {
      if (car.npc) {
        car.npc.update(dt, this.traffic, car.controls, started);
      } else if (!started) {
        resetControls(car.controls);
      }
      // ゴール後の人間の車は自動で減速
      if (car.progress.finished && car.isHuman) {
        car.controls.throttle = 0;
        car.controls.brake = 0.4;
        car.controls.drift = false;
      }
      if (!started) {
        // カウントダウン中は動けない (スタートダッシュボーナスなし)
        car.controls.throttle = 0;
      }
    }

    // --- 物理 ---
    for (const car of this.cars) {
      car.body.controlsLocked = car.lockTimer > 0 || !started;
      stepVehicle(car.body, car.controls, dt);
      const impact = this.trackCollision.resolve(car.body);
      if (impact > physicsConfig.collision.impactThreshold) {
        this.events.onWallImpact?.(car, impact);
      }
    }
    this.contacts.length = 0;
    resolveCarCollisions(this.bodies, this.contacts);
    for (const c of this.contacts) {
      if (c.speed > physicsConfig.collision.impactThreshold) {
        const a = this.bodyToCar.get(c.a);
        const b = this.bodyToCar.get(c.b);
        if (a && b) this.events.onCarContact?.(a, b, c.speed);
      }
    }

    // --- 落下・復帰・タイマー ---
    for (const car of this.cars) {
      const body = car.body;
      if (body.airborne && body.airTime > 0 && body.airTime <= dt * 1.01) {
        this.events.onFall?.(car);
      }
      if (body.needsRespawn || (car.npc?.wantsRespawn ?? false)) {
        this.respawn(car);
      }
      if (car.lockTimer > 0) car.lockTimer = Math.max(0, car.lockTimer - dt);
      if (car.ghostTimer > 0) {
        car.ghostTimer = Math.max(0, car.ghostTimer - dt);
        body.collidable = car.ghostTimer <= 0;
      }
    }

    // --- 周回・順位 ---
    for (const car of this.cars) {
      const body = car.body;
      const onTrack = !body.airborne && Math.abs(body.trackLateral) < this.track.def.defaultWidth + this.track.def.runoffWidth + 4;
      const wasFinished = car.progress.finished;
      const lapsBefore = car.progress.lapTimes.length;
      car.progress.update(body.trackS, onTrack && started, this.time);
      if (car.progress.lapTimes.length > lapsBefore) {
        this.events.onLap?.(car, car.progress.lapTimes[car.progress.lapTimes.length - 1]!);
      }
      if (!wasFinished && car.progress.finished) {
        this.finishOrder.push(car.id);
        if (this.winnerTime === null) this.winnerTime = this.time;
        this.events.onFinish?.(car, this.finishOrder.length);
      }
      this.updateWrongWay(car, dt);
    }
    this.updateRanking();
  }

  /** 最後に通過したチェックポイント付近へ復帰させる */
  respawn(car: RaceCar): void {
    const track = this.track;
    const body = car.body;
    const cp = car.progress.lastCheckpoint;
    const s = cp < 0 ? track.length - gameConfig.grid.firstRowOffset : track.checkpoints[cp]!;
    // 他の車と重ならない横位置を探す
    const hw = track.pointAt(s, this.tmpPoint).halfWidth;
    const candidates = [0, -4, 4, -7, 7].filter((l) => Math.abs(l) < hw - 1.5);
    let lateral = 0;
    let bestClear = -Infinity;
    for (const l of candidates) {
      const p = track.worldAt(s, l, this.tmpPoint);
      let clear = Infinity;
      for (const other of this.cars) {
        if (other === car) continue;
        clear = Math.min(clear, Math.hypot(other.body.x - p.x, other.body.z - p.z));
      }
      if (clear > bestClear + 0.5) {
        bestClear = clear;
        lateral = l;
      }
      if (clear > 12) break;
    }
    const p = track.worldAt(s, lateral, this.tmpPoint);
    body.place(p.x, p.y, p.z, Math.atan2(p.tx, p.tz));
    this.trackCollision.resolve(body);
    car.progress.teleport(body.trackS);
    car.lockTimer = physicsConfig.respawn.lockSeconds;
    car.ghostTimer = physicsConfig.respawn.ghostSeconds;
    body.collidable = false;
    car.respawnCount++;
    car.npc?.reset();
    this.events.onRespawn?.(car);
  }

  private updateWrongWay(car: RaceCar, dt: number): void {
    const body = car.body;
    const sample = this.track.sample(body.trackHint ?? 0);
    const dot = body.forwardX * sample.tx + body.forwardZ * sample.tz;
    const movingBack = body.vx * sample.tx + body.vz * sample.tz < -2;
    if (this.raceStarted && !car.progress.finished && (dot < -0.4 || movingBack) && body.speed > 2) {
      car.wrongWayTimer += dt;
    } else {
      car.wrongWayTimer = 0;
    }
  }

  private updateRanking(): void {
    this.ranking = computeRanking(this.rankEntries);
    this.ranking.forEach((id, i) => {
      const car = this.cars[id];
      if (car) car.position = i + 1;
    });
  }

  carById(id: number): RaceCar | undefined {
    return this.cars[id];
  }

  /** 全人間プレイヤーがゴールしたか */
  get allHumansFinished(): boolean {
    return this.cars.every((c) => !c.isHuman || c.progress.finished);
  }
}
