/**
 * デバッグモード (DEBUG_MODE)。NPC や車両物理の調整用。
 *
 * F3: 情報オーバーレイ (FPS・速度・速度ベクトル・ステア/ブレーキ入力・グリップ・横滑り・
 *     チェックポイント・NPC ID/難易度/性格/目標速度/状態 など)
 * F6: 3D 表示 (NPC レーシングライン・現在ターゲット・チェックポイント・コライダー・
 *     速度ベクトル・アイテムボックス・弾丸軌道・コースギミック
 *     [ブーストパッド範囲 / 路面タイプ / 変形区間 / 横風 / コンベア / ジャンプ台 / 動く障害物の当たり判定]、
 *     Road Safety Corridor (水色) / 地形が上がり始める線 (緑) / 地形・背景物の侵入点 (赤い柱)、
 *     夜コースのヘッドライト照射範囲)
 * F4: 情報を表示する車を切替
 *
 * Festival Mode (npm run festival) では無効。
 */
import * as THREE from 'three';
import type { BattleManager } from '../battle/BattleManager';
import { gimmickConfig, type SurfaceKind } from '../config/gimmicks';
import { nightVisibilityConfig } from '../config/graphics';
import { physicsConfig } from '../config/physics';
import { itemsConfig } from '../config/items';
import { msToKmh } from '../core/math';
import type { RaceCar } from '../game/RaceCar';
import type { RaceWorld } from '../game/RaceWorld';
import { ResourceBag } from '../render/dispose';
import { el } from '../ui/dom';
import { buildCorridorGizmo, buildIntrusionMarkers, buildRaceLineMarkers, gimmicksAt } from './CourseDebugGizmos';

export function isDebugAllowed(): boolean {
  return !__FESTIVAL__;
}

export function debugRequestedByUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}

const COLLIDER_SEGMENTS = 14;
const HEADLIGHT_SEGMENTS = 6;

export class DebugManager {
  overlayVisible = false;
  gizmosVisible = false;
  private readonly overlay: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly world: RaceWorld;
  private readonly battle: BattleManager | null;
  private focusIndex = 0;
  private gizmos: THREE.Group | null = null;
  private readonly bag = new ResourceBag();
  private targetMarkers: THREE.Mesh[] = [];
  private dynamicLines: THREE.LineSegments | null = null;
  private dynamicPositions: Float32Array | null = null;
  private dynamicColors: Float32Array | null = null;
  private overlayTimer = 0;
  /** 安全帯への侵入 (F6 を初めて押したときに検査。null = 未検査) */
  private intrusionCount: number | null = null;
  fps = 0;
  /** 追加で表示する1行 (BGM の状態など) */
  extraInfo: (() => string) | null = null;

  constructor(scene: THREE.Scene, world: RaceWorld, battle: BattleManager | null, container: HTMLElement, focusCar: RaceCar) {
    this.scene = scene;
    this.world = world;
    this.battle = battle;
    this.overlay = el('pre', 'debug-overlay');
    this.overlay.hidden = true;
    container.append(this.overlay);
    this.focusIndex = Math.max(0, world.cars.indexOf(focusCar));
  }

  toggleOverlay(): void {
    this.overlayVisible = !this.overlayVisible;
    this.overlay.hidden = !this.overlayVisible;
  }

  toggleGizmos(): void {
    this.gizmosVisible = !this.gizmosVisible;
    if (this.gizmosVisible && !this.gizmos) this.buildGizmos();
    if (this.gizmos) this.gizmos.visible = this.gizmosVisible;
  }

  cycleFocus(): void {
    this.focusIndex = (this.focusIndex + 1) % this.world.cars.length;
  }

  private get focus(): RaceCar {
    return this.world.cars[this.focusIndex]!;
  }

  private buildGizmos(): void {
    const g = new THREE.Group();
    g.name = 'debug-gizmos';
    const track = this.world.track;

    // NPC のレーシングライン
    for (const car of this.world.cars) {
      const npc = car.npc;
      if (!npc) continue;
      const pts: number[] = [];
      const line = npc.line;
      for (let i = 0; i < line.xs.length; i++) {
        pts.push(line.xs[i]!, track.samples[i]!.y + 0.25, line.zs[i]!);
      }
      const geo = this.bag.add(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const mat = this.bag.add(new THREE.LineBasicMaterial({ color: car.spec.visual.bodyColor, depthTest: false, transparent: true, opacity: 0.8 }));
      const loop = new THREE.LineLoop(geo, mat);
      loop.renderOrder = 20;
      g.add(loop);
      const marker = new THREE.Mesh(
        this.bag.add(new THREE.SphereGeometry(0.45, 8, 6)),
        this.bag.add(new THREE.MeshBasicMaterial({ color: car.spec.visual.bodyColor, depthTest: false })),
      );
      marker.renderOrder = 21;
      this.targetMarkers.push(marker);
      g.add(marker);
    }

    // チェックポイント
    const cpPts: number[] = [];
    for (const s of track.checkpoints) {
      const p = track.pointAt(s);
      const rx = -p.tz;
      const rz = p.tx;
      const hw = p.halfWidth;
      cpPts.push(p.x - rx * hw, p.y + 0.2, p.z - rz * hw, p.x + rx * hw, p.y + 0.2, p.z + rz * hw);
      cpPts.push(p.x - rx * hw, p.y, p.z - rz * hw, p.x - rx * hw, p.y + 4, p.z - rz * hw);
      cpPts.push(p.x + rx * hw, p.y, p.z + rz * hw, p.x + rx * hw, p.y + 4, p.z + rz * hw);
    }
    const cpGeo = this.bag.add(new THREE.BufferGeometry());
    cpGeo.setAttribute('position', new THREE.Float32BufferAttribute(cpPts, 3));
    const cp = new THREE.LineSegments(cpGeo, this.bag.add(new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false })));
    cp.renderOrder = 20;
    g.add(cp);

    // アイテムボックスの取得範囲
    if (this.battle) {
      const r = itemsConfig.itemBox.pickupRadius;
      const sphere = this.bag.add(new THREE.SphereGeometry(r, 10, 6));
      const wire = this.bag.add(new THREE.MeshBasicMaterial({ color: 0xff66ff, wireframe: true }));
      for (const b of this.battle.boxes.boxes) {
        const m = new THREE.Mesh(sphere, wire);
        m.position.set(b.x, b.y + 1, b.z);
        g.add(m);
      }
    }

    // コースギミック (静的な範囲)
    this.buildGimmickGizmos(g);

    // Road Safety Corridor と 侵入点、スタート/ゴールライン
    g.add(buildCorridorGizmo(track, this.bag));
    g.add(buildRaceLineMarkers(track, this.bag));
    const courseRoot = this.scene.getObjectByName('course');
    if (courseRoot) {
      const { group, reports } = buildIntrusionMarkers(track, courseRoot, this.bag);
      this.intrusionCount = reports.length;
      for (const r of reports) console.warn(`[debug] road corridor intrusion: ${r.object} x${r.count} at s=${r.worst.s.toFixed(0)} h=${r.worst.height.toFixed(2)}`);
      g.add(group);
    }

    // 毎フレーム更新する線 (コライダー・速度ベクトル・弾丸軌道・障害物)
    const maxSegments = this.world.cars.length * (COLLIDER_SEGMENTS * 2 + 3 + HEADLIGHT_SEGMENTS) + 80 + this.world.gimmicks.obstacles.length * 4;
    this.dynamicPositions = new Float32Array(maxSegments * 6);
    this.dynamicColors = new Float32Array(maxSegments * 6);
    const dgeo = this.bag.add(new THREE.BufferGeometry());
    dgeo.setAttribute('position', new THREE.BufferAttribute(this.dynamicPositions, 3).setUsage(THREE.DynamicDrawUsage));
    dgeo.setAttribute('color', new THREE.BufferAttribute(this.dynamicColors, 3).setUsage(THREE.DynamicDrawUsage));
    this.dynamicLines = new THREE.LineSegments(dgeo, this.bag.add(new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
    this.dynamicLines.frustumCulled = false;
    this.dynamicLines.renderOrder = 22;
    g.add(this.dynamicLines);

    this.gizmos = g;
    this.scene.add(g);
  }

  update(dt: number): void {
    if (this.gizmosVisible && this.gizmos) this.updateGizmos();
    if (this.overlayVisible) {
      this.overlayTimer -= dt;
      if (this.overlayTimer <= 0) {
        this.overlayTimer = 0.1;
        this.overlay.textContent = this.buildOverlayText();
      }
    }
  }

  private updateGizmos(): void {
    let mi = 0;
    for (const car of this.world.cars) {
      if (!car.npc) continue;
      const m = this.targetMarkers[mi++];
      if (m) m.position.set(car.npc.debug.targetX, car.npc.debug.targetY + 0.5, car.npc.debug.targetZ);
    }
    const pos = this.dynamicPositions;
    const col = this.dynamicColors;
    const lines = this.dynamicLines;
    if (!pos || !col || !lines) return;
    let k = 0;
    const push = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, g: number, b: number): void => {
      if (k + 6 > pos.length) return;
      pos[k] = x0;
      pos[k + 1] = y0;
      pos[k + 2] = z0;
      pos[k + 3] = x1;
      pos[k + 4] = y1;
      pos[k + 5] = z1;
      col[k] = r;
      col[k + 1] = g;
      col[k + 2] = b;
      col[k + 3] = r;
      col[k + 4] = g;
      col[k + 5] = b;
      k += 6;
    };
    const cr = physicsConfig.collision.carRadius;
    const co = physicsConfig.collision.circleOffset;
    for (const car of this.world.cars) {
      const b = car.body;
      const y = b.y + 0.3;
      const on = b.collidable ? 1 : 0.3;
      for (const side of [-1, 1]) {
        const cx = b.x + b.forwardX * co * side;
        const cz = b.z + b.forwardZ * co * side;
        for (let i = 0; i < COLLIDER_SEGMENTS; i++) {
          const a0 = (i / COLLIDER_SEGMENTS) * Math.PI * 2;
          const a1 = ((i + 1) / COLLIDER_SEGMENTS) * Math.PI * 2;
          push(cx + Math.cos(a0) * cr, y, cz + Math.sin(a0) * cr, cx + Math.cos(a1) * cr, y, cz + Math.sin(a1) * cr, 1 * on, 0.9 * on, 0.1 * on);
        }
      }
      // 速度ベクトル (0.5 秒分)
      push(b.x, b.y + 1.5, b.z, b.x + b.vx * 0.5, b.y + 1.5, b.z + b.vz * 0.5, 0.2, 0.6, 1);
    }
    // 夜コース: 人間の車のヘッドライト照射範囲 (水平方向の扇形)
    if (this.world.track.def.environment.night) {
      const h = nightVisibilityConfig.headlights;
      const half = (h.angleDeg * Math.PI) / 180;
      for (const car of this.world.cars) {
        if (!car.isHuman) continue;
        const b = car.body;
        const y = b.y + 0.5;
        let px = b.x;
        let pz = b.z;
        for (let i = 0; i <= HEADLIGHT_SEGMENTS - 2; i++) {
          const a = b.heading - half + (2 * half * i) / (HEADLIGHT_SEGMENTS - 2);
          const x = b.x + Math.sin(a) * h.distance;
          const z = b.z + Math.cos(a) * h.distance;
          push(px, y, pz, x, y, z, 1, 0.95, 0.6);
          px = x;
          pz = z;
        }
        push(px, y, pz, b.x, y, b.z, 1, 0.95, 0.6);
      }
    }
    // 動く障害物の当たり判定 (有効 = 赤、無効 = 灰、予告中 = 黄)
    for (const o of this.world.gimmicks.obstacles) {
      const st = o.state;
      const ax = Math.sin(o.heading);
      const az = Math.cos(o.heading);
      const rx = -az;
      const rz = ax;
      const corners: [number, number][] = [
        [-o.halfLength, -o.halfWidth],
        [o.halfLength, -o.halfWidth],
        [o.halfLength, o.halfWidth],
        [-o.halfLength, o.halfWidth],
      ];
      const [r, gg, bb] = st.active ? [1, 0.15, 0.15] : st.warn ? [1, 0.9, 0.1] : [0.5, 0.5, 0.5];
      const y = o.baseY + 0.4;
      for (let k = 0; k < 4; k++) {
        const a = corners[k]!;
        const c = corners[(k + 1) % 4]!;
        push(o.x + ax * a[0] + rx * a[1], y, o.z + az * a[0] + rz * a[1], o.x + ax * c[0] + rx * c[1], y, o.z + az * c[0] + rz * c[1], r, gg, bb);
      }
    }
    // NPC が狙っているギミックへの線
    for (const car of this.world.cars) {
      const t = car.npc?.debug.gimmickTarget;
      if (!t || !car.npc) continue;
      const b = car.body;
      push(b.x, b.y + 2, b.z, car.npc.debug.targetX, car.npc.debug.targetY + 2, car.npc.debug.targetZ, 1, 0.4, 1);
    }
    if (this.battle) {
      for (const bl of this.battle.bullets.bullets) {
        if (!bl.alive) continue;
        push(bl.ox, bl.oy, bl.oz, bl.x, bl.y, bl.z, 1, 0.3, 0.3);
      }
    }
    lines.geometry.setDrawRange(0, k / 3);
    (lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (lines.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  private buildOverlayText(): string {
    const c = this.focus;
    const b = c.body;
    const p = c.progress;
    const lines: string[] = [];
    lines.push(`DEBUG  FPS ${this.fps.toFixed(0)}   [F3]overlay [F4]car [F6]3D`);
    lines.push(`CAR #${c.id} ${c.displayName} (${c.kind}) ${c.spec.name} ${c.spec.drivetrain}`);
    lines.push(`speed ${msToKmh(b.speed).toFixed(1)} km/h  fwd ${b.forwardSpeed.toFixed(2)} lat ${b.lateralSpeed.toFixed(2)} m/s`);
    lines.push(`vel (${b.vx.toFixed(2)}, ${b.vy.toFixed(2)}, ${b.vz.toFixed(2)})  yawRate ${b.yawRate.toFixed(2)}`);
    lines.push(`steer in ${c.controls.steer.toFixed(2)} smooth ${b.steer.toFixed(2)}  throttle ${b.throttleInput.toFixed(2)} brake ${b.brakeInput.toFixed(2)}`);
    lines.push(`grip ${b.currentGrip.toFixed(1)} m/s2  slip ${((b.slipAngle * 180) / Math.PI).toFixed(1)}deg  drift ${b.driftAmount.toFixed(2)}  surface ${b.surface}`);
    lines.push(`maxSpeedMul ${b.maxSpeedMul.toFixed(2)}  airborne ${b.airborne}(${b.airMode})  collidable ${b.collidable}`);
    const surf = gimmickConfig.surfaces[b.surfaceKind];
    lines.push(
      `surface ${b.surfaceKind} grip x${surf.grip.toFixed(2)} accel x${surf.accel.toFixed(2)}  transform ${b.transformMode ?? '-'}  padBoost ${b.padBoostTimer.toFixed(1)}  bank ${((b.bank * 180) / Math.PI).toFixed(0)}deg`,
    );
    const track = this.world.track;
    const smp = track.samples[Math.floor(track.wrapS(b.trackS) / track.spacing) % track.samples.length]!;
    lines.push(
      `course ${track.def.id} (${track.def.raceType}) ★${track.def.difficultyStars}  length ${track.length.toFixed(0)}m  width ${(smp.halfWidth * 2).toFixed(1)}m  edge L:${smp.left} R:${smp.right}  night ${track.def.environment.night}`,
    );
    lines.push(`gimmick here: ${gimmicksAt(this.world.gimmicks, b.trackS, b.trackLateral).join(', ') || '-'}   corridor intrusions: ${this.intrusionCount ?? '(F6 で検査)'}`);
    if (track.def.environment.night) {
      const h = nightVisibilityConfig.headlights;
      lines.push(`headlight range ${h.distance}m angle ±${h.angleDeg}deg intensity ${h.intensity} (${c.isHuman ? 'ON' : 'NPC: ランプのみ'})`);
    }
    lines.push(`track s ${b.trackS.toFixed(1)} lat ${b.trackLateral.toFixed(2)}  CP next ${p.nextCheckpoint} last ${p.lastCheckpoint}`);
    lines.push(
      `progress ${(p.completion * 100).toFixed(1)}%  remain ${p.remainingDistance.toFixed(0)}m  ` +
        (track.closed ? `lap ${p.lap}/${p.timing.laps}` : `section ${p.section}/${p.checkpointCount - 1}  start s=${track.startS.toFixed(0)} goal s=${track.goalS.toFixed(0)}`),
    );
    lines.push(`lap ${p.lap} passed ${p.passed} key ${p.progressKey.toFixed(3)} pos ${c.position}  lock ${c.lockTimer.toFixed(1)} ghost ${c.ghostTimer.toFixed(1)}`);
    if (c.npc && c.pattern) {
      const d = c.npc.debug;
      const pt = c.pattern;
      lines.push(`NPC ${pt.id}  ${pt.difficulty} / ${pt.personality}`);
      lines.push(`  target speed ${msToKmh(d.targetSpeed).toFixed(1)} km/h  state ${d.state}  mistake ${d.mistake ?? '-'}`);
      lines.push(`  line off ${d.lineOffset.toFixed(2)} avoid ${d.avoidOffset.toFixed(2)} avoiding ${d.avoidingId ?? '-'}`);
      lines.push(`  target (${d.targetX.toFixed(1)}, ${d.targetZ.toFixed(1)})  react ${pt.reactionTime.toFixed(2)} noise ${pt.steeringNoise.toFixed(3)}`);
      lines.push(`  decision: ${d.decision}  gimmick: ${d.gimmickTarget ?? '-'}  usage ${pt.gimmickUsage.toFixed(2)} anticip ${pt.obstacleAnticipation.toFixed(2)} surfAware ${pt.surfaceAwareness.toFixed(2)}`);
    }
    if (this.battle) {
      const cb = this.battle.combatantOf(c);
      if (cb) {
        lines.push(`BATTLE hp ${cb.tire.hp.toFixed(1)} ammo ${cb.inventory.totalAmmo} boost ${cb.boostTimer.toFixed(1)} shots ${cb.shotsHit}/${cb.shotsFired}`);
      }
      const ai = this.battle.ai.debug;
      lines.push(`AI wantsFire ${ai.wantsFire} predicted t ${ai.predictedTime?.toFixed(2) ?? '-'}  bullets ${this.battle.bullets.bullets.filter((x) => x.alive).length}`);
    }
    lines.push('');
    lines.push('ALL CARS');
    for (const id of this.world.ranking) {
      const car = this.world.cars[id]!;
      const tag = car.pattern ? car.pattern.id : car.displayName;
      lines.push(
        `${String(car.position).padStart(2)} ${tag.padEnd(20)} ${car.spec.name.padEnd(13)} ${msToKmh(car.body.speed).toFixed(0).padStart(3)}km/h lap ${car.progress.lap} ${car.npc ? `${car.npc.debug.state} ${car.npc.debug.decision}` : ''}`,
      );
    }
    if (this.extraInfo) lines.push(this.extraInfo());
    return lines.join('\n');
  }

  /** ギミックの静的な範囲を線で描く */
  private buildGimmickGizmos(g: THREE.Group): void {
    const gs = this.world.gimmicks;
    const track = this.world.track;
    const pts: number[] = [];
    const cols: number[] = [];
    const surfaceColor: Record<SurfaceKind, number> = {
      road: 0x888888,
      snow: 0xffffff,
      ice: 0x66ccff,
      dirt: 0xaa7744,
      mud: 0x664422,
      water: 0x2288ff,
      glass: 0x99ffff,
      metal: 0xaaaaaa,
      sand: 0xe8c070,
      wet: 0x3366aa,
      cobble: 0xa09080,
      magnet: 0x4466ff,
    };
    const c = new THREE.Color();
    const seg = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, hex: number): void => {
      c.setHex(hex);
      pts.push(x0, y0, z0, x1, y1, z1);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    };
    /** 範囲の左右の縁を線で描く */
    const zone = (s0: number, len: number, latMin: number, latMax: number, hex: number, dy: number): void => {
      for (let d = 0; d < len; d += 4) {
        for (const l of [latMin, latMax]) {
          const a = track.worldAt(s0 + d, Math.max(-12, Math.min(12, l)));
          const b = track.worldAt(s0 + Math.min(len, d + 4), Math.max(-12, Math.min(12, l)));
          seg(a.x, a.y + dy, a.z, b.x, b.y + dy, b.z, hex);
        }
      }
    };
    for (const z of gs.surfaces) zone(z.s, z.len, z.latMin, z.latMax, surfaceColor[z.kind], 0.3);
    for (const z of gs.transforms) zone(z.s, z.len, -9, 9, 0x0044ff, 1.5);
    for (const z of gs.winds) zone(z.s, z.len, -8, 8, 0xccffff, 2.5);
    for (const z of gs.conveyors) zone(z.s, z.len, z.latMin, z.latMax, 0x00ffaa, 0.6);
    for (const pad of gs.pads) zone(pad.s - pad.halfLength, pad.halfLength * 2, pad.lateral - pad.halfWidth, pad.lateral + pad.halfWidth, 0xff2d95, 0.4);
    for (const j of gs.jumps) zone(j.s, j.len, j.latMin, j.latMax, 0xffd23f, 0.8);
    for (const z of gs.draftZones) zone(z.s, z.len, -6, 6, 0xffaa00, 1.2);
    for (const z of gs.splashes) zone(z.s, z.len, z.latMin, z.latMax, 0x66ccff, 0.5);
    for (const z of gs.platforms) zone(z.s, z.len, -z.amplitude - z.halfWidth, z.amplitude + z.halfWidth, 0xff66ff, 0.7);
    for (const z of gs.drawbridges) zone(z.s, z.len, z.latMin, z.latMax, 0xff3333, 1);
    for (const t of gs.tunnels) if (t.speedBonus > 0) zone(t.s, t.len, -3, 3, 0x00ffff, 1.8);
    const geo = this.bag.add(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const lines = new THREE.LineSegments(geo, this.bag.add(new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
    lines.renderOrder = 20;
    g.add(lines);
  }

  dispose(): void {
    this.overlay.remove();
    if (this.gizmos) this.gizmos.removeFromParent();
    this.bag.dispose();
    this.targetMarkers = [];
  }
}
