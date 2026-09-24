/**
 * 1レース分の実行単位。RaceWorld (ロジック) に 描画・入力・音・HUD・バトル・デバッグ を結び付ける。
 * レース終了時に dispose() で全リソース (Three.js / 音 / DOM / イベント) を解放する。
 */
import * as THREE from 'three';
import type { AudioManager } from '../audio/AudioManager';
import { CarSound } from '../audio/CarSound';
import { AimController } from '../battle/AimController';
import { BattleManager } from '../battle/BattleManager';
import { BulletView } from '../battle/BulletSystem';
import type { Combatant } from '../battle/Combatant';
import { ChaseCamera } from '../camera/ChaseCamera';
import { audioConfig } from '../config/audio';
import { battleConfig } from '../config/battle';
import { getCourseDef } from '../config/courses';
import { controlsConfig, drivingBindings } from '../config/controls';
import { gameConfig } from '../config/game';
import { ITEM_DEFS } from '../config/items';
import { cameraConfig } from '../config/graphics';
import { physicsConfig } from '../config/physics';
import { CourseView } from '../courses/CourseView';
import { Track } from '../courses/Track';
import { DebugManager } from '../debug/DebugManager';
import type { InputManager } from '../input/InputManager';
import { PlayerController } from '../input/PlayerController';
import { ItemBoxView } from '../items/ItemBoxes';
import { NpcDriver } from '../npc/NpcDriver';
import { generateNpcPatterns } from '../npc/NpcPatterns';
import { RacingLine, computeIdealOffsets, computeSpeedProfile } from '../npc/RacingLine';
import { ParticleSystem, BOOST_STYLE, SMOKE_STYLE, SPARK_STYLE } from '../render/ParticleSystem';
import type { RenderContext, Viewport } from '../render/RenderContext';
import type { GameSettings } from '../storage/StorageManager';
import { Hud } from '../ui/Hud';
import { PLAYER_COLORS } from '../ui/Minimap';
import { CarModel } from '../vehicles/CarModel';
import type { RaceCar } from './RaceCar';
import { computeGap } from './RaceProgress';
import { buildRaceCars, normalizeSetup, type RaceSetup } from './RaceSetup';
import { RaceWorld } from './RaceWorld';

export interface RaceSessionDeps {
  render: RenderContext;
  input: InputManager;
  audio: AudioManager;
  /** 現在の設定を返す (設定画面で変更されても最新値を参照するため関数で渡す) */
  settings: () => Readonly<GameSettings>;
  hudLayer: HTMLElement;
  debugEnabled: boolean;
}

export interface RaceResultEntry {
  position: number;
  name: string;
  carId: string;
  carName: string;
  isHuman: boolean;
  playerIndex: number;
  finishTime: number | null;
  bestLap: number | null;
  respawns: number;
  patternId: string | null;
}

export interface BattleResultInfo {
  won: boolean;
  playerHp: number;
  shotsFired: number;
  shotsHit: number;
}

export interface RaceResult {
  setup: RaceSetup;
  courseName: string;
  entries: RaceResultEntry[];
  battle: BattleResultInfo | null;
}

type Phase = 'intro' | 'countdown' | 'racing' | 'finishing' | 'done';

interface PlayerView {
  car: RaceCar;
  camera: ChaseCamera;
  hud: Hud;
  viewport: Viewport;
  sound: CarSound;
  controller: PlayerController;
  pan: number;
}

/** コースごとの幾何・理想ラインのキャッシュ (レースを繰り返しても再計算しない) */
const trackCache = new Map<string, { track: Track; ideal: Float32Array }>();

function getTrack(courseId: string): { track: Track; ideal: Float32Array } {
  let entry = trackCache.get(courseId);
  if (!entry) {
    const track = Track.build(getCourseDef(courseId));
    entry = { track, ideal: computeIdealOffsets(track) };
    trackCache.set(courseId, entry);
  }
  return entry;
}

export class RaceSession {
  readonly setup: RaceSetup;
  readonly world: RaceWorld;
  readonly battle: BattleManager | null;
  onFinished: ((result: RaceResult) => void) | null = null;
  onPauseRequest: (() => void) | null = null;
  paused = false;

  private readonly deps: RaceSessionDeps;
  private readonly scene = new THREE.Scene();
  private readonly courseView: CourseView;
  private readonly models = new Map<RaceCar, CarModel>();
  private readonly views: PlayerView[] = [];
  private readonly smoke: ParticleSystem;
  private readonly sparks: ParticleSystem;
  private readonly boostFx: ParticleSystem;
  private readonly shadowTexture: THREE.Texture;
  private readonly debug: DebugManager | null;
  private readonly aim: AimController | null;
  private readonly bulletView: BulletView | null;
  private readonly itemBoxView: ItemBoxView | null;
  private readonly aimDir = { x: 0, y: 0, z: 1 };
  private phase: Phase = 'intro';
  private phaseTime = 0;
  private lastCountdown = -1;
  private accumulator = 0;
  private finishTimer = 0;
  private fpsSmoothed = 60;
  private disposed = false;
  /** 通常時の霧 (水中の霧と切り替えるため) */
  private baseFog: { color: number; near: number; far: number } | null = null;
  /** デバッグ: 自動運転中の人間の車 */
  private readonly autopilots = new Map<RaceCar, NpcDriver>();
  private timeScale = 1;

  constructor(rawSetup: RaceSetup, deps: RaceSessionDeps) {
    this.deps = deps;
    this.setup = normalizeSetup(rawSetup);
    const { track, ideal } = getTrack(this.setup.courseId);
    const preset = deps.render.preset;

    // --- ロジック ---
    const cars = buildRaceCars(this.setup, track);
    this.world = new RaceWorld(
      track,
      cars,
      {
        onWallImpact: (car, speed) => this.onImpact(car, speed, true),
        onCarContact: (a, b, speed) => {
          this.onImpact(a, speed, false);
          this.onImpact(b, speed, false);
        },
        onFall: (car) => this.onFall(car),
        onRespawn: (car) => this.onRespawn(car),
        onLap: (car) => this.onLap(car),
        onFinish: (car, pos) => this.onFinish(car, pos),
        onBoostPad: (car) => {
          const v = this.viewOf(car);
          if (v) this.deps.audio.play('boostPad', v.pan);
        },
        onJump: (car) => {
          const v = this.viewOf(car);
          if (v) this.deps.audio.play('jump', v.pan);
        },
        onLanding: (car, speed) => {
          const v = this.viewOf(car);
          if (!v) return;
          v.camera.addShake(speed * cameraConfig.shakePerImpactSpeed * 0.6);
          this.deps.audio.playImpact(speed * 0.6, v.pan);
        },
        onObstacleHit: (car, speed) => this.onImpact(car, speed, true),
      },
      ideal,
    );

    // --- 描画 ---
    this.courseView = new CourseView(track, this.scene, preset, this.world.gimmicks);
    const fog = this.scene.fog;
    this.baseFog = fog instanceof THREE.Fog ? { color: fog.color.getHex(), near: fog.near, far: fog.far } : null;
    this.shadowTexture = makeShadowTexture();
    const humans = cars.filter((c) => c.isHuman);
    const split = humans.length > 1;
    for (const car of cars) {
      const model = new CarModel(
        car.spec,
        {
          ghost: !car.isHuman,
          castShadow: preset.shadows,
          label: split && car.isHuman ? `P${car.playerIndex + 1}` : undefined,
          labelColor: PLAYER_COLORS[car.playerIndex],
        },
        this.shadowTexture,
      );
      this.scene.add(model.root);
      this.models.set(car, model);
    }
    this.smoke = new ParticleSystem(SMOKE_STYLE, preset.maxParticles);
    this.sparks = new ParticleSystem(SPARK_STYLE, Math.floor(preset.maxParticles / 2));
    this.boostFx = new ParticleSystem(BOOST_STYLE, Math.floor(preset.maxParticles / 2));
    this.scene.add(this.smoke.points, this.sparks.points, this.boostFx.points);

    // --- プレイヤーごとのカメラ・HUD・音・操作 ---
    const isBattle = this.setup.mode === 'battle';
    const far = this.courseView.environment.radius * 2.2;
    humans.forEach((car, i) => {
      const viewport: Viewport = split ? { x: i * 0.5, y: 0, width: 0.5, height: 1 } : { x: 0, y: 0, width: 1, height: 1 };
      const camera = new ChaseCamera(far);
      camera.shakeEnabled = deps.settings().cameraShake;
      camera.snap(car.body);
      const hud = new Hud(track, { playerIndex: car.playerIndex, split, battle: isBattle });
      hud.root.style.left = `${viewport.x * 100}%`;
      hud.root.style.width = `${viewport.width * 100}%`;
      deps.hudLayer.append(hud.root);
      const pan = split ? (i === 0 ? -audioConfig.splitPan : audioConfig.splitPan) : 0;
      const bindings = drivingBindings(this.setup.mode, humans.length, car.playerIndex);
      this.views.push({
        car,
        camera,
        hud,
        viewport,
        sound: new CarSound(deps.audio, pan),
        controller: new PlayerController(deps.input, bindings),
        pan,
      });
    });

    // --- BATTLE DUEL ---
    if (isBattle) {
      const player = humans[0]!;
      const npc = cars.find((c) => !c.isHuman)!;
      this.battle = new BattleManager(this.world, player, npc, this.setup.difficulty, {
        onShot: (c) => this.deps.audio.play('gun', c.car.isHuman ? 0 : 0.3, c.car.isHuman ? 1 : 0.6),
        onHit: (target, shooter, dmg) => this.onBulletHit(target, shooter, dmg),
        onFlatTire: (target) => {
          if (target.car.isHuman) this.views[0]?.hud.showToast('パンク！ 最高速度50% — Recoveryで回復', 2.5);
          else this.views[0]?.hud.showToast('相手のタイヤがパンク！', 2);
        },
        onItemPickup: (c, kind) => {
          if (!c.car.isHuman) return;
          this.deps.audio.play('itemPickup');
          this.views[0]?.hud.showToast(`${ITEM_DEFS[kind].icon} ${ITEM_DEFS[kind].name} ゲット！`);
        },
        onItemBoxFull: () => this.views[0]?.hud.showToast('アイテムがいっぱい！ (4キーで捨てる)'),
        onItemUse: (c, kind, outcome) => this.onItemUse(c, kind, outcome),
        onItemDrop: (_c, kind) => this.views[0]?.hud.showToast(`${ITEM_DEFS[kind].name} を捨てた`),
      });
      this.aim = new AimController(deps.input, deps.render.canvas);
      this.aim.onLockLost = () => {
        if (this.phase === 'racing' && !this.paused) this.onPauseRequest?.();
      };
      this.bulletView = new BulletView(battleConfig.gun.poolSize);
      this.scene.add(this.bulletView.mesh);
      this.itemBoxView = new ItemBoxView(this.battle.boxes);
      this.scene.add(this.itemBoxView.group);
      deps.input.captureMouse = true;
    } else {
      this.battle = null;
      this.aim = null;
      this.bulletView = null;
      this.itemBoxView = null;
    }

    this.debug = deps.debugEnabled ? new DebugManager(this.scene, this.world, this.battle, deps.hudLayer, humans[0]!) : null;
    deps.input.gameActive = true;
  }

  get isRunning(): boolean {
    return this.phase !== 'done';
  }

  get canPause(): boolean {
    return this.phase !== 'done';
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.accumulator = 0;
    if (paused) {
      this.aim?.releaseLock();
      for (const v of this.views) v.sound.update(v.car.body, false);
    }
    this.deps.input.captureMouse = !paused && this.battle !== null;
  }

  applySettings(settings: Readonly<GameSettings>): void {
    for (const v of this.views) v.camera.shakeEnabled = settings.cameraShake;
  }

  /** 毎フレーム呼ぶ */
  update(frameDt: number): void {
    if (this.disposed) return;
    const dt = Math.min(0.1, frameDt);
    if (dt > 0) this.fpsSmoothed += (1 / dt - this.fpsSmoothed) * 0.05;
    const input = this.deps.input;

    if (input.anyPressed(controlsConfig.system.pause) && this.canPause && !this.paused) {
      this.onPauseRequest?.();
    }
    if (this.debug) {
      if (input.anyPressed(controlsConfig.system.debugToggle)) this.debug.toggleOverlay();
      if (input.anyPressed(controlsConfig.system.debugToggleGizmos)) this.debug.toggleGizmos();
      if (input.anyPressed(controlsConfig.system.debugCycleCar)) this.debug.cycleFocus();
      if (input.anyPressed(controlsConfig.system.debugAutopilot)) this.toggleAutopilot();
      if (input.anyPressed(controlsConfig.system.debugTimeScale)) {
        this.timeScale = this.timeScale === 1 ? 4 : 1;
        this.views[0]?.hud.showToast(`DEBUG 時間 x${this.timeScale}`);
      }
    }

    if (!this.paused) {
      this.updatePhase(dt);
      // 結果画面へ移った (onFinished 内で dispose された) 場合は以降の処理をしない
      if (this.disposed) return;
      this.handleBattleInput();
      // 固定タイムステップで物理を進める
      const step = physicsConfig.fixedTimeStep;
      this.accumulator += dt * this.timeScale;
      const maxSteps = physicsConfig.maxSubSteps * this.timeScale;
      let n = 0;
      while (this.accumulator >= step && n < maxSteps) {
        for (const v of this.views) {
          if (v.car.progress.finished) continue;
          const auto = this.autopilots.get(v.car);
          if (auto) auto.update(step, this.world.cars.map((c) => ({ id: c.id, body: c.body })), v.car.controls, this.world.raceStarted);
          else v.controller.read(v.car.controls);
        }
        this.world.step(step);
        this.battle?.step(step);
        this.accumulator -= step;
        n++;
      }
      if (n >= maxSteps) this.accumulator = 0;
      this.updateVisuals(dt);
    }
    this.renderFrame(dt);
    if (this.debug) {
      this.debug.fps = this.fpsSmoothed;
      this.debug.update(dt);
    }
  }

  /** デバッグ: 人間の車をコース上の割合 frac (0..1) の位置へ移動 */
  debugTeleport(frac: number): void {
    for (const v of this.views) {
      this.world.placeCarAt(v.car, this.world.track.fracToS(frac), 0);
      v.camera.snap(v.car.body);
    }
  }

  /** デバッグ: 人間の車を STRONG 相当の NPC ロジックで自動運転 */
  private toggleAutopilot(): void {
    const track = this.world.track;
    for (const v of this.views) {
      if (this.autopilots.has(v.car)) {
        this.autopilots.delete(v.car);
        continue;
      }
      const pattern = { ...generateNpcPatterns(track.def, 'strong')[0]!, mistakeRatePerMinute: 0 };
      const line = RacingLine.blend(track, this.world.idealOffsets, pattern.lineBlend, 0);
      const driver = new NpcDriver(pattern, v.car.id, v.car.body, track, line, computeSpeedProfile(line, v.car.spec, pattern), this.world.gimmicks);
      driver.reset();
      this.autopilots.set(v.car, driver);
    }
    this.views[0]?.hud.showToast(this.autopilots.size > 0 ? 'DEBUG 自動運転 ON' : 'DEBUG 自動運転 OFF');
  }

  private updatePhase(dt: number): void {
    dt *= this.timeScale;
    this.phaseTime += dt;
    const cd = gameConfig.countdown;
    switch (this.phase) {
      case 'intro': {
        const t = this.phaseTime / cd.introSeconds;
        for (const v of this.views) v.camera.intro(v.car.body, t);
        if (this.phaseTime >= cd.introSeconds) {
          this.phase = 'countdown';
          this.phaseTime = 0;
          for (const v of this.views) v.camera.snap(v.car.body);
        }
        break;
      }
      case 'countdown': {
        const step = Math.floor(this.phaseTime / cd.stepSeconds);
        if (step !== this.lastCountdown && step < 3) {
          this.lastCountdown = step;
          for (const v of this.views) v.hud.showMessage(String(3 - step), '', cd.stepSeconds, 'countdown');
          this.deps.audio.play('countdown');
        }
        if (this.phaseTime >= cd.stepSeconds * 3) {
          this.phase = 'racing';
          this.phaseTime = 0;
          this.world.startRace();
          for (const v of this.views) v.hud.showMessage('GO!', '', cd.goDisplaySeconds, 'go');
          this.deps.audio.play('go');
          this.aim?.center();
        }
        break;
      }
      case 'racing': {
        const g = gameConfig.finish;
        const ended = this.setup.mode === 'battle' ? this.world.finishOrder.length > 0 : this.world.allHumansFinished;
        const timeout =
          g.humanWaitAfterWinnerSeconds > 0 &&
          this.world.winnerTime !== null &&
          this.world.time - this.world.winnerTime > g.humanWaitAfterWinnerSeconds;
        if (ended || timeout) {
          this.phase = 'finishing';
          this.finishTimer = g.resultDelaySeconds;
          if (timeout && !ended) {
            for (const v of this.views) if (!v.car.progress.finished) v.hud.showMessage('TIME UP', '', 3);
          }
        }
        break;
      }
      case 'finishing':
        this.finishTimer -= dt;
        if (this.finishTimer <= 0) {
          this.phase = 'done';
          this.deps.input.gameActive = false;
          this.deps.input.captureMouse = false;
          this.aim?.releaseLock();
          this.onFinished?.(this.buildResult());
        }
        break;
      case 'done':
        break;
    }
  }

  private handleBattleInput(): void {
    const battle = this.battle;
    const aim = this.aim;
    const view = this.views[0];
    if (!battle || !aim || !view) return;
    const input = this.deps.input;
    const m = controlsConfig.battle.mouse;
    const racing = this.phase === 'racing';
    if (input.wasMousePressed(m.centerAim)) aim.center();
    const wheel = input.consumeWheel();
    if (racing && Math.abs(wheel) > 0) battle.cycleItem(wheel > 0 ? 1 : -1);
    if (racing && input.wasMousePressed(m.useItem)) battle.usePlayerItem();
    if (racing && input.anyPressed(controlsConfig.battle.dropItem)) battle.dropPlayerItem();
    battle.playerFireHeld = racing && input.isMouseDown(m.fire);
  }

  private updateVisuals(dt: number): void {
    const racing = this.phase === 'racing' || this.phase === 'finishing';
    for (const car of this.world.cars) {
      const model = this.models.get(car)!;
      model.update(car.body, dt, car.ghostTimer > 0);
      this.emitEffects(car);
    }
    this.courseView.update(dt);
    this.smoke.update(dt);
    this.sparks.update(dt);
    this.boostFx.update(dt);
    if (this.battle) {
      this.bulletView?.update(this.battle.bullets);
      this.itemBoxView?.update(this.battle.boxes, dt);
    }

    // 影は P1 の周囲に追従
    const focus = this.views[0]?.car.body;
    if (focus) this.courseView.environment.follow(focus.x, focus.y, focus.z);

    for (const v of this.views) {
      if (this.phase !== 'intro') v.camera.update(v.car.body, dt);
      v.sound.update(v.car.body, this.phase !== 'intro');
      this.updateHud(v, dt, racing);
    }
  }

  private updateHud(v: PlayerView, dt: number, racing: boolean): void {
    const car = v.car;
    const world = this.world;
    const aheadId = car.position > 1 ? world.ranking[car.position - 2] : undefined;
    const leaderId = world.ranking[0];
    const ahead = aheadId !== undefined ? world.carById(aheadId) : undefined;
    const leader = leaderId !== undefined ? world.carById(leaderId) : undefined;
    const combatant = this.battle?.combatantOf(car) ?? null;
    const opponent = this.battle ? (combatant === this.battle.player ? this.battle.npc : this.battle.player) : null;
    const hud = v.hud;

    if (racing && !car.progress.finished) {
      if (car.lockTimer > 0) {
        hud.showMessage('COURSE OUT', `復帰まで ${Math.ceil(car.lockTimer)}`, 0.2, 'warn');
      } else if (car.wrongWayTimer > gameConfig.wrongWayWarningSeconds) {
        hud.showMessage('逆走！', 'WRONG WAY', 0.2, 'warn');
      }
    }

    let aimX = 0;
    let aimY = 0;
    if (this.aim && this.battle) {
      const w = this.deps.render.width * v.viewport.width;
      const h = this.deps.render.height * v.viewport.height;
      this.aim.setViewport(w, h);
      this.aim.update(this.deps.settings().mouseSensitivity);
      aimX = this.aim.x;
      aimY = this.aim.y;
      const target = opponent?.car.body ?? null;
      this.battle.playerAimDir = this.aim.computeAimDirection(v.camera.camera, car.body, target, this.aimDir);
    }

    hud.update(
      {
        car,
        totalCars: world.cars.length,
        laps: gameConfig.laps,
        raceTime: world.time,
        gapAhead: ahead ? computeGap(car.progress, ahead.progress, world.time) : null,
        gapLeader: leader && leader !== car ? computeGap(car.progress, leader.progress, world.time) : null,
        cars: world.cars,
        itemBoxes: this.battle ? this.battle.boxes.boxes : null,
        combatant,
        opponent,
        aimX,
        aimY,
        showAim: this.battle !== null && this.phase === 'racing',
      },
      dt,
    );
  }

  private emitEffects(car: RaceCar): void {
    const b = car.body;
    if (b.airborne) return;
    const slip = Math.abs(b.lateralSpeed);
    const speed = Math.abs(b.forwardSpeed);
    const smoking = (slip > 4.5 && speed > 6) || (b.brakeInput > 0 && speed > 25) || (b.surface === 'offroad' && speed > 8);
    if (smoking && Math.random() < 0.4) {
      for (const side of [-1, 1]) {
        const x = b.x - b.forwardX * 1.4 + b.rightX * side * 0.8;
        const z = b.z - b.forwardZ * 1.4 + b.rightZ * side * 0.8;
        this.smoke.emit(x, b.y + 0.3, z, b.vx * 0.2 + (Math.random() - 0.5), 0, b.vz * 0.2 + (Math.random() - 0.5));
      }
    }
    const c = this.battle?.combatantOf(car);
    if (((c && c.boosting) || b.padBoostTimer > 0) && Math.random() < 0.8) {
      const x = b.x - b.forwardX * 2.3;
      const z = b.z - b.forwardZ * 2.3;
      this.boostFx.emit(x, b.y + 0.5, z, -b.forwardX * 6 + b.vx * 0.5, 0, -b.forwardZ * 6 + b.vz * 0.5);
    }
  }

  private renderFrame(_dt: number): void {
    const render = this.deps.render;
    render.clear(0x000000);
    for (const v of this.views) {
      const h = render.height * v.viewport.height;
      this.smoke.setViewportHeight(h);
      this.sparks.setViewportHeight(h);
      this.boostFx.setViewportHeight(h);
      this.applyViewFog(v.car);
      render.renderViewport(this.scene, v.camera.camera, v.viewport);
    }
  }

  /** 見ている車が水中なら霧を水中用にする (2人プレイでも画面ごとに切り替わる) */
  private applyViewFog(car: RaceCar): void {
    const fog = this.scene.fog;
    const base = this.baseFog;
    if (!(fog instanceof THREE.Fog) || !base) return;
    const env = this.world.track.def.environment;
    if (car.body.transformMode === 'underwater' && env.underwaterFogColor !== undefined) {
      fog.color.setHex(env.underwaterFogColor);
      fog.near = 10;
      fog.far = 170;
    } else {
      fog.color.setHex(base.color);
      fog.near = base.near;
      fog.far = base.far;
    }
  }

  // --- イベント ---

  private viewOf(car: RaceCar): PlayerView | undefined {
    return this.views.find((v) => v.car === car);
  }

  private onImpact(car: RaceCar, speed: number, wall: boolean): void {
    const v = this.viewOf(car);
    if (wall) {
      const b = car.body;
      for (let i = 0; i < Math.min(12, speed); i++) {
        this.sparks.emit(b.x + b.forwardX * 1.5, b.y + 0.5, b.z + b.forwardZ * 1.5, (Math.random() - 0.5) * 8 + b.vx * 0.3, Math.random() * 4, (Math.random() - 0.5) * 8 + b.vz * 0.3);
      }
    }
    if (!v) return;
    v.camera.addShake(speed * cameraConfig.shakePerImpactSpeed);
    this.deps.audio.playImpact(speed, v.pan);
  }

  private onFall(car: RaceCar): void {
    const v = this.viewOf(car);
    if (!v) return;
    this.deps.audio.play('fall', v.pan);
  }

  private onRespawn(car: RaceCar): void {
    const v = this.viewOf(car);
    if (!v) return;
    v.camera.snap(car.body);
    this.deps.audio.play('respawn', v.pan);
  }

  private onLap(car: RaceCar): void {
    const v = this.viewOf(car);
    if (!v || car.progress.finished) return;
    if (car.progress.lap === gameConfig.laps) {
      v.hud.showMessage('FINAL LAP!', '', 2, 'final');
      this.deps.audio.play('finalLap', v.pan);
    } else {
      v.hud.showMessage(`LAP ${car.progress.lap}`, '', 1.5);
      this.deps.audio.play('lap', v.pan);
    }
  }

  private onFinish(car: RaceCar, position: number): void {
    const v = this.viewOf(car);
    if (!v) return;
    const label = this.setup.mode === 'battle' ? (position === 1 ? 'YOU WIN!' : 'YOU LOSE') : `${position}位`;
    v.hud.showMessage('GOAL!', label, 0, position === 1 ? 'goal win' : 'goal');
    this.deps.audio.play('goal', v.pan);
  }

  private onBulletHit(target: Combatant, shooter: Combatant | undefined, damage: number): void {
    const view = this.views[0];
    if (!view) return;
    if (target.car.isHuman) {
      view.camera.addShake(battleConfig.hitFeedback.cameraShake);
      this.deps.audio.play('hit', 0, 1);
    } else if (shooter?.car.isHuman) {
      this.deps.audio.play('hit', 0.2, 0.6);
      view.hud.showToast(`HIT! -${damage.toFixed(0)}`, 0.6);
    }
    const b = target.car.body;
    for (let i = 0; i < 6; i++) {
      this.sparks.emit(b.x, b.y + 0.8, b.z, (Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6);
    }
  }

  private onItemUse(c: Combatant, kind: keyof typeof ITEM_DEFS, outcome: string): void {
    const hud = this.views[0]?.hud;
    if (!c.car.isHuman) {
      if (outcome === 'used') {
        this.deps.audio.play(kind === 'boost' ? 'boost' : 'recovery', 0.3, 0.6);
        hud?.showToast(kind === 'boost' ? '相手が BOOST を使った！' : '相手がタイヤを回復した！', 1.4);
      }
      return;
    }
    switch (outcome) {
      case 'used':
        this.deps.audio.play(kind === 'boost' ? 'boost' : kind === 'recovery' ? 'recovery' : 'itemUse');
        hud?.showToast(kind === 'boost' ? 'BOOST! 最高速度+20% 弾速+40%' : 'タイヤHP 全回復！');
        break;
      case 'hpFull':
        this.deps.audio.play('itemDenied');
        hud?.showToast('タイヤHPは満タンです');
        break;
      case 'gunInfo':
        hud?.showToast('銃は左クリックで発射！');
        break;
      default:
        this.deps.audio.play('itemDenied');
        hud?.showToast('アイテムを持っていません');
    }
  }

  private buildResult(): RaceResult {
    const world = this.world;
    const entries: RaceResultEntry[] = world.ranking.map((id, i) => {
      const car = world.carById(id)!;
      return {
        position: i + 1,
        name: car.displayName,
        carId: car.spec.id,
        carName: car.spec.name,
        isHuman: car.isHuman,
        playerIndex: car.playerIndex,
        finishTime: car.progress.finishTime,
        bestLap: car.progress.bestLap,
        respawns: car.respawnCount,
        patternId: car.pattern?.id ?? null,
      };
    });
    let battle: BattleResultInfo | null = null;
    if (this.battle) {
      const p = this.battle.player;
      battle = {
        won: world.finishOrder[0] === p.car.id,
        playerHp: p.tire.hp,
        shotsFired: p.shotsFired,
        shotsHit: p.shotsHit,
      };
    }
    return { setup: this.setup, courseName: world.track.def.name, entries, battle };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.deps.input.gameActive = false;
    this.deps.input.captureMouse = false;
    for (const v of this.views) {
      v.sound.dispose();
      v.hud.root.remove();
    }
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.smoke.dispose();
    this.sparks.dispose();
    this.boostFx.dispose();
    this.bulletView?.dispose();
    this.itemBoxView?.dispose();
    this.aim?.dispose();
    this.debug?.dispose();
    this.courseView.dispose();
    this.shadowTexture.dispose();
    this.scene.clear();
    this.scene.background = null;
    this.scene.fog = null;
    this.onFinished = null;
    this.onPauseRequest = null;
    // レンダラー内部のキャッシュ (プログラム等) を整理
    this.deps.render.renderer.renderLists.dispose();
  }
}

/** 車の丸影テクスチャ (実行時生成) */
function makeShadowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

