/**
 * NPCの運転ロジック:「基本レーシングライン + リアルタイム補正」。
 *
 * 基本: パターン固有のレーシングラインと速度計画に沿って走る。
 * 補正: 前方車両の回避・追い越し・追従、後続車のブロック、接触後の姿勢復帰、
 *       ラインへの滑らかな復帰 (急に戻らない)、スタック脱出、ミス (難易度・性格依存)。
 *
 * 車両性能には一切手を加えない (ラバーバンドなし)。
 */
import { gimmickConfig } from '../config/gimmicks';
import { npcConfig } from '../config/npc';
import { physicsConfig } from '../config/physics';
import { SeededRandom, approach, clamp, lerp, wrapAngle } from '../core/math';
import { createTrackPoint, type Track, type TrackPoint } from '../courses/Track';
import type { GimmickSystem, ObstacleAdvice } from '../gimmicks/GimmickSystem';
import type { VehicleBody } from '../physics/VehicleBody';
import type { VehicleControls } from '../vehicles/VehicleControls';
import type { NpcPattern } from './NpcPatterns';
import type { RacingLine } from './RacingLine';

const rt = npcConfig.runtime;
const steerCfg = physicsConfig.steering;

export interface TrafficCar {
  id: number;
  body: VehicleBody;
}

type MistakeKind = 'lateBrake' | 'wide' | 'lift' | 'wobble';

export type NpcState = 'racing' | 'recovering' | 'reversing';

/** デバッグ表示用 */
export interface NpcDebugInfo {
  targetX: number;
  targetY: number;
  targetZ: number;
  targetSpeed: number;
  lineOffset: number;
  avoidOffset: number;
  state: NpcState;
  mistake: MistakeKind | null;
  avoidingId: number | null;
  /** 現在狙っている / 避けているギミック (例: "boostPad#2", "obstacle#1") */
  gimmickTarget: string | null;
  /** 判断状態の説明 (Ultimate の判断確認用) */
  decision: string;
}

export class NpcDriver {
  readonly pattern: NpcPattern;
  readonly body: VehicleBody;
  readonly line: RacingLine;
  readonly speedProfile: Float32Array;
  readonly carId: number;
  private readonly track: Track;
  private readonly rng: SeededRandom;
  private readonly tmpPoint: TrackPoint = createTrackPoint();

  /** 現在の目標横オフセット (ライン + 回避) */
  private currentOffset = 0;
  private avoidOffset = 0;
  private avoidTarget = 0;
  private avoidingId: number | null = null;
  private delayedSteer = 0;
  private noisePhase: number;
  private time = 0;

  private state: NpcState = 'racing';
  private stuckTimer = 0;
  private reverseTimer = 0;
  private noProgressTimer = 0;
  private lastProgressS = 0;

  private mistake: MistakeKind | null = null;
  private mistakeTimer = 0;
  private nextMistakeIn: number;
  private mistakeSide = 1;

  private driftCornerDecision = false;
  private driftDecisionS = -1000;

  /** 外部 (BATTLE AI) からの追加横オフセット [m] (アイテムボックスへ寄る等) */
  extraOffset = 0;
  /** 外部からの速度上限倍率 */
  speedCapMul = 1;
  /** 動けなくなって復帰を要求している */
  wantsRespawn = false;
  /** 閉じたゲート (遮断機) が開くのを待っている (この間は「動けない」とみなさない) */
  private waitingForGate = false;

  readonly debug: NpcDebugInfo = {
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    targetSpeed: 0,
    lineOffset: 0,
    avoidOffset: 0,
    state: 'racing',
    mistake: null,
    avoidingId: null,
    gimmickTarget: null,
    decision: '',
  };

  private readonly gimmicks: GimmickSystem | null;
  private readonly advice: ObstacleAdvice = { lateral: null, speedCap: Infinity, obstacle: null };
  /** ブーストパッドを狙うか (パッドごとに gimmickUsage の確率で判断) */
  private padDecisionIndex = -1;
  private padDecision = false;
  /** 障害物を避ける側 (-1 左 / 1 右) と、その判断を保つ残り時間 */
  private obstacleSide = 0;
  private obstacleSideTimer = 0;

  constructor(
    pattern: NpcPattern,
    carId: number,
    body: VehicleBody,
    track: Track,
    line: RacingLine,
    speedProfile: Float32Array,
    gimmicks: GimmickSystem | null = null,
  ) {
    this.pattern = pattern;
    this.gimmicks = gimmicks;
    this.carId = carId;
    this.body = body;
    this.track = track;
    this.line = line;
    this.speedProfile = speedProfile;
    this.rng = new SeededRandom(pattern.seed);
    this.noisePhase = this.rng.range(0, 100);
    this.nextMistakeIn = this.sampleMistakeInterval();
  }

  /** レース開始・復帰時に呼ぶ */
  reset(): void {
    this.currentOffset = this.body.trackLateral;
    this.avoidOffset = 0;
    this.avoidTarget = 0;
    this.delayedSteer = 0;
    this.state = 'racing';
    this.stuckTimer = 0;
    this.reverseTimer = 0;
    this.noProgressTimer = 0;
    this.lastProgressS = this.body.trackS;
    this.mistake = null;
    this.mistakeTimer = 0;
    this.wantsRespawn = false;
  }

  update(dt: number, traffic: readonly TrafficCar[], out: VehicleControls, raceStarted: boolean): void {
    this.time += dt;
    const body = this.body;
    const p = this.pattern;
    const track = this.track;

    if (!raceStarted || body.controlsLocked || body.airborne) {
      out.throttle = 0;
      out.brake = raceStarted ? 0 : 1;
      out.steer = 0;
      out.drift = false;
      if (body.controlsLocked) this.reset();
      return;
    }

    const s = body.trackS;
    const speed = Math.max(0, body.forwardSpeed);
    const sample = track.sample(track.sampleIndexAt(s));
    const hw = sample.halfWidth;

    this.updateMistakes(dt);
    this.updateProgressWatch(dt, s);

    // --- 姿勢の判定 (スピン・逆向き) ---
    const tangentHeading = Math.atan2(sample.tx, sample.tz);
    const headingError = wrapAngle(tangentHeading - body.heading);
    if (this.state === 'racing' && Math.abs(headingError) > rt.recoverAngle) {
      this.state = 'recovering';
    } else if (this.state === 'recovering' && Math.abs(headingError) < rt.recoverAngle * 0.5) {
      this.state = 'racing';
    }

    // --- 目標点 ---
    const lookahead = Math.max(rt.minLookahead, speed * p.lookaheadTime);
    const targetS = s + lookahead;
    const lineOff = this.line.offsetAt(targetS);
    this.updateAvoidance(dt, traffic, s, speed, lineOff, hw);

    const maxOff = Math.max(0, hw - rt.wallMargin);
    let desired = lineOff + this.avoidOffset + this.extraOffset + this.gimmickSeekOffset(s, lineOff);
    if (this.mistake === 'wide') {
      desired += this.mistakeSide * 3.2 * p.mistakeSeverity;
    }
    desired = clamp(desired, -maxOff, maxOff);
    // 動く障害物: 到達時刻の位置を予測して避ける (予測精度は obstacleAnticipation)
    let obstacleSpeedCap = Infinity;
    this.debug.decision = this.avoidingId !== null ? 'overtake/avoid car' : 'follow line';
    if (this.gimmicks && this.gimmicks.obstacles.length > 0) {
      if (this.obstacleSideTimer > 0) this.obstacleSideTimer -= dt;
      else this.obstacleSide = 0;
      const adv = this.gimmicks.adviseObstacles(s, speed, desired, maxOff, p.obstacleAnticipation, this.advice, this.obstacleSide, body.trackLateral);
      if (adv.obstacle) {
        if (adv.lateral !== null) {
          this.obstacleSide = adv.lateral < desired ? -1 : 1;
          this.obstacleSideTimer = 1.5;
        }
        this.debug.gimmickTarget = `obstacle#${adv.obstacle.index}`;
        if (adv.lateral !== null) {
          desired = clamp(adv.lateral, -maxOff, maxOff);
          this.debug.decision = 'dodge obstacle';
        } else {
          this.debug.decision = 'wait for gate';
        }
        obstacleSpeedCap = adv.speedCap;
        // 閉じたゲートの前で待っている / 開閉するゲートのすぐ手前にいる間は、止まっていても復帰させない
        // (ゲートは周期的に必ず開くので、待てば通れる)
        const kind = adv.obstacle.motion.kind;
        const nearGate = (kind === 'gate' || kind === 'cross') && this.track.deltaS(s, adv.obstacle.s) < 20;
        this.waitingForGate = (adv.lateral === null && adv.speedCap < Infinity) || nearGate;
      } else {
        this.waitingForGate = false;
      }
    }
    // 動く足場: 到達時刻の足場の中心を狙う (予測精度は obstacleAnticipation。低いと足場を外して落ちることもある)
    let onPlatform = false;
    if (this.gimmicks && this.gimmicks.platforms.length > 0) {
      const pf = this.gimmicks.platformAhead(s, speed, p.obstacleAnticipation);
      if (pf) {
        const lim = Math.max(0, pf.halfWidth - gimmickConfig.platform.npcMargin);
        desired = clamp(clamp(desired, pf.center - lim, pf.center + lim), -maxOff, maxOff);
        onPlatform = true;
        this.debug.gimmickTarget = 'platform';
        this.debug.decision = pf.ds > 0 ? 'aim platform' : 'ride platform';
      }
    }
    // ラインへは滑らかに戻る (固定ラインへ無理やり戻って壁に突っ込まない)
    const returning = Math.abs(desired) < Math.abs(this.currentOffset);
    // 足場は動くので素早く合わせる
    const rate = onPlatform ? rt.offsetChangeRate * 2 : returning && this.avoidingId === null ? rt.lineReturnRate : rt.offsetChangeRate;
    this.currentOffset = approach(this.currentOffset, desired, rate * dt);
    // 大きくラインを外れている時 (接触後など) は現在地から徐々に寄せる
    const lateralError = body.trackLateral - this.currentOffset;
    const blendedOffset = this.currentOffset + clamp(lateralError, -4, 4) * 0.35;
    const target = track.worldAt(targetS, clamp(blendedOffset, -maxOff, maxOff), this.tmpPoint);

    // --- ステアリング (Pure Pursuit を車の物理モデルで逆算) ---
    const dx = target.x - body.x;
    const dz = target.z - body.z;
    const localRight = dx * body.rightX + dz * body.rightZ;
    const localFwd = dx * body.forwardX + dz * body.forwardZ;
    const dist2 = Math.max(1, localRight * localRight + localFwd * localFwd);
    const curvatureCmd = (2 * localRight) / dist2;
    const refSpeed = Math.max(4, speed);
    const desiredYaw = refSpeed * curvatureCmd;
    const r = refSpeed / steerCfg.highSpeedHalfAuthority;
    const authority =
      steerCfg.maxYawRate * body.spec.handling * Math.min(1, refSpeed / steerCfg.fullAuthoritySpeed) / (1 + r * r);
    let steerCmd = (desiredYaw / Math.max(0.05, authority)) * (rt.steeringGain / 2);
    if (localFwd < 0) {
      // 目標が後ろ → 目一杯切る
      steerCmd = localRight >= 0 ? 1 : -1;
    }
    // 横滑り中はカウンターステア
    steerCmd += body.slipAngle * 0.9;

    // 反応の遅れ + 揺らぎ
    const reaction = Math.max(0.02, p.reactionTime);
    this.delayedSteer += (steerCmd - this.delayedSteer) * (1 - Math.exp(-dt / reaction));
    const noiseAmp = p.steeringNoise * (this.mistake === 'wobble' ? 6 : 1);
    const noise =
      noiseAmp * (Math.sin(this.time * 1.7 + this.noisePhase) * 0.6 + Math.sin(this.time * 4.3 + this.noisePhase * 2) * 0.4);
    let steer = clamp(this.delayedSteer + noise, -1, 1);

    // --- 目標速度 ---
    const leadS = s + speed * 0.12;
    let targetSpeed = this.speedProfile[track.sampleIndexAt(leadS)]!;
    if (this.mistake === 'lateBrake') targetSpeed *= 1 + 0.18 * p.mistakeSeverity;
    if (this.mistake === 'lift') targetSpeed *= 1 - 0.3 * p.mistakeSeverity;
    // ラインから大きく外れていたら控えめに
    const offLine = Math.abs(lateralError);
    if (offLine > 3) targetSpeed *= clamp(1 - (offLine - 3) * 0.04, 0.6, 1);
    targetSpeed = Math.min(targetSpeed, this.followSpeedCap(traffic, s), obstacleSpeedCap);
    targetSpeed *= this.speedCapMul;
    // ジャンプ台の手前では飛び越えられる速度を保つ
    if (this.gimmicks && this.gimmicks.jumpAhead(s, rt.jumpApproachDistance) < rt.jumpApproachDistance) {
      targetSpeed = Math.max(targetSpeed, rt.jumpApproachSpeed);
      this.debug.decision = 'jump approach';
    }

    let throttle = 0;
    let brake = 0;
    let drift = false;

    if (this.state === 'recovering') {
      targetSpeed = Math.min(targetSpeed, 9);
      steer = clamp(-headingError * 1.8, -1, 1);
    }

    const err = targetSpeed - speed;
    if (err > rt.liftThreshold) {
      throttle = clamp(err / 3, 0.35, 1);
    } else if (err < -rt.brakeThreshold) {
      brake = clamp(-err / 6, 0.25, 1);
    } else {
      throttle = 0.25;
    }

    // --- ドリフト (性格と車のドリフト性能に応じて、きついコーナーで使う) ---
    const upcomingK = Math.abs(this.line.curvatureAt(s + speed * 0.5));
    if (upcomingK > rt.driftCurvature && speed > 16) {
      if (Math.abs(this.track.deltaS(this.driftDecisionS, s)) > 40) {
        this.driftDecisionS = s;
        this.driftCornerDecision = this.rng.next() < p.driftTendency * (0.3 + body.spec.drift * 0.7);
      }
      drift = this.driftCornerDecision && Math.abs(steer) > 0.35;
    }

    // --- スタック脱出 (後退) ---
    if (this.state !== 'reversing' && throttle > 0 && speed < 1.5) {
      this.stuckTimer += dt;
      if (this.stuckTimer > rt.stuckSeconds) {
        this.state = 'reversing';
        this.reverseTimer = rt.reverseSeconds;
        this.stuckTimer = 0;
      }
    } else if (speed > 3) {
      this.stuckTimer = 0;
    }
    if (this.state === 'reversing') {
      this.reverseTimer -= dt;
      throttle = 0;
      brake = 1;
      drift = false;
      // 後退中は逆に切って向きを直す
      steer = clamp(headingError * 2, -1, 1);
      if (this.reverseTimer <= 0) {
        this.state = Math.abs(headingError) > rt.recoverAngle ? 'recovering' : 'racing';
      }
    }

    out.throttle = throttle;
    out.brake = brake;
    out.steer = steer;
    out.drift = drift;

    const dbg = this.debug;
    dbg.targetX = target.x;
    dbg.targetY = target.y;
    dbg.targetZ = target.z;
    dbg.targetSpeed = targetSpeed;
    dbg.lineOffset = lineOff;
    dbg.avoidOffset = this.avoidOffset;
    dbg.state = this.state;
    dbg.mistake = this.mistake;
    dbg.avoidingId = this.avoidingId;
  }

  /**
   * ブーストパッドを狙う横オフセット。パッドごとに gimmickUsage の確率で狙うか決める。
   */
  private gimmickSeekOffset(s: number, lineOff: number): number {
    this.debug.gimmickTarget = null;
    const g = this.gimmicks;
    if (!g || g.pads.length === 0) return 0;
    const cfg = gimmickConfig.npc;
    const hit = g.padAhead(s, 8, cfg.seekDistance);
    if (!hit) return 0;
    if (hit.pad.index !== this.padDecisionIndex) {
      this.padDecisionIndex = hit.pad.index;
      this.padDecision = this.rng.next() < this.pattern.gimmickUsage;
    }
    if (!this.padDecision) return 0;
    this.debug.gimmickTarget = `boostPad#${hit.pad.index}`;
    const max = cfg.seekMaxOffset * this.pattern.gimmickUsage + hit.pad.halfWidth * 0.5;
    return clamp(hit.pad.lateral - lineOff, -max, max);
  }

  /** 前方の車の回避・追い越し判断と、後続車のブロック */
  private updateAvoidance(
    dt: number,
    traffic: readonly TrafficCar[],
    s: number,
    speed: number,
    lineOff: number,
    hw: number,
  ): void {
    const p = this.pattern;
    const track = this.track;
    const maxOff = Math.max(0, hw - rt.wallMargin);
    let bestDs = Infinity;
    let blocker: TrafficCar | null = null;
    let chaser: TrafficCar | null = null;
    let chaserDs = -Infinity;
    const myLat = this.body.trackLateral;

    for (const other of traffic) {
      if (other.id === this.carId || !other.body.collidable || other.body.airborne) continue;
      const ds = track.deltaS(s, other.body.trackS);
      if (ds > 0 && ds < rt.awarenessDistance * p.awarenessMul) {
        const closing = speed - Math.max(0, other.body.forwardSpeed);
        const lateralGap = Math.abs(other.body.trackLateral - (lineOff + this.avoidOffset));
        // 近い or 追いついている車で、進路上にいる
        if (lateralGap < rt.avoidLateralGap && (closing > 0.5 || ds < 12) && ds < bestDs) {
          bestDs = ds;
          blocker = other;
        }
      } else if (ds < 0 && ds > -rt.rearAwarenessDistance * p.awarenessMul && ds > chaserDs) {
        chaserDs = ds;
        chaser = other;
      }
    }

    if (blocker) {
      const oLat = blocker.body.trackLateral;
      const leftTarget = oLat - rt.avoidLateralGap;
      const rightTarget = oLat + rt.avoidLateralGap;
      const leftOk = leftTarget > -maxOff;
      const rightOk = rightTarget < maxOff;
      if (this.avoidingId !== blocker.id) {
        // 新しい相手: 追い越すか判断
        this.avoidingId = blocker.id;
        const wantOvertake = this.rng.next() < 0.35 + p.overtakeTendency * 0.65;
        if (!wantOvertake || (!leftOk && !rightOk)) {
          this.avoidTarget = 0;
        } else {
          // 次のコーナーの内側 (理想ラインが寄っている側) を優先
          const upcoming = this.line.offsetAt(s + 40);
          const preferRight = rightOk && (!leftOk || upcoming > oLat || myLat > oLat);
          const t = preferRight ? rightTarget : leftTarget;
          this.avoidTarget = t - lineOff;
        }
      }
    } else {
      this.avoidingId = null;
      this.avoidTarget = 0;
      // 後続車のブロック (守り重視の性格)
      if (chaser && p.blockTendency > 0.5 && this.rng.next() < dt * 2) {
        const cLat = chaser.body.trackLateral;
        this.avoidTarget = clamp((cLat - lineOff) * 0.4 * p.blockTendency, -2, 2);
      }
    }
    const target = clamp(this.avoidTarget, -maxOff - lineOff, maxOff - lineOff);
    this.avoidOffset = approach(this.avoidOffset, target, rt.offsetChangeRate * dt);
  }

  /** 追い越せない前方の車に追従するための速度上限 */
  private followSpeedCap(traffic: readonly TrafficCar[], s: number): number {
    let cap = Infinity;
    const myLat = this.body.trackLateral;
    for (const other of traffic) {
      if (other.id === this.carId || !other.body.collidable || other.body.airborne) continue;
      const ds = this.track.deltaS(s, other.body.trackS);
      if (ds <= rt.alongsideDistance || ds > rt.awarenessDistance) continue;
      if (Math.abs(other.body.trackLateral - myLat) > 2.6) continue;
      const otherSpeed = Math.max(0, other.body.forwardSpeed);
      const c = otherSpeed + (ds - rt.followGap) * 0.9;
      if (c < cap) cap = c;
    }
    return Math.max(4, cap);
  }

  private updateMistakes(dt: number): void {
    if (this.mistake) {
      this.mistakeTimer -= dt;
      if (this.mistakeTimer <= 0) {
        this.mistake = null;
        this.nextMistakeIn = this.sampleMistakeInterval();
      }
      return;
    }
    this.nextMistakeIn -= dt;
    if (this.nextMistakeIn <= 0) {
      const kinds: MistakeKind[] = ['lateBrake', 'wide', 'lift', 'wobble'];
      this.mistake = this.rng.pick(kinds);
      this.mistakeSide = this.rng.next() < 0.5 ? -1 : 1;
      const d = rt.mistakeDuration;
      this.mistakeTimer = lerp(d.min, d.max, this.rng.next());
    }
  }

  private sampleMistakeInterval(): number {
    const perMin = Math.max(0.001, this.pattern.mistakeRatePerMinute);
    const u = Math.max(1e-6, this.rng.next());
    return (-Math.log(u) / perMin) * 60;
  }

  /** 前進が止まっている時間を監視し、長すぎれば復帰を要求 (NPC のみ) */
  private updateProgressWatch(dt: number, s: number): void {
    const moved = this.track.deltaS(this.lastProgressS, s);
    if (moved > 3 || this.waitingForGate) {
      this.lastProgressS = s;
      this.noProgressTimer = 0;
    } else {
      this.noProgressTimer += dt;
      if (this.noProgressTimer > physicsConfig.respawn.npcStuckRespawnSeconds) {
        this.wantsRespawn = true;
        this.noProgressTimer = 0;
      }
    }
  }
}
