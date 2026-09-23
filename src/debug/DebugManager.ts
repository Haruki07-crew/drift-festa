/**
 * デバッグモード (DEBUG_MODE)。NPC や車両物理の調整用。
 *
 * F3: 情報オーバーレイ (FPS・速度・速度ベクトル・ステア/ブレーキ入力・グリップ・横滑り・
 *     チェックポイント・NPC ID/難易度/性格/目標速度/状態 など)
 * F6: 3D 表示 (NPC レーシングライン・現在ターゲット・チェックポイント・コライダー・
 *     速度ベクトル・アイテムボックス・弾丸軌道)
 * F4: 情報を表示する車を切替
 *
 * Festival Mode (npm run festival) では無効。
 */
import * as THREE from 'three';
import type { BattleManager } from '../battle/BattleManager';
import { physicsConfig } from '../config/physics';
import { itemsConfig } from '../config/items';
import { msToKmh } from '../core/math';
import type { RaceCar } from '../game/RaceCar';
import type { RaceWorld } from '../game/RaceWorld';
import { ResourceBag } from '../render/dispose';
import { el } from '../ui/dom';

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
  fps = 0;

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

    // 毎フレーム更新する線 (コライダー・速度ベクトル・弾丸軌道)
    const maxSegments = this.world.cars.length * (COLLIDER_SEGMENTS * 2 + 2) + 80;
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
    lines.push(`maxSpeedMul ${b.maxSpeedMul.toFixed(2)}  airborne ${b.airborne}  collidable ${b.collidable}`);
    lines.push(`track s ${b.trackS.toFixed(1)} lat ${b.trackLateral.toFixed(2)}  CP next ${p.nextCheckpoint} last ${p.lastCheckpoint}`);
    lines.push(`lap ${p.lap} passed ${p.passed} key ${p.progressKey.toFixed(3)} pos ${c.position}  lock ${c.lockTimer.toFixed(1)} ghost ${c.ghostTimer.toFixed(1)}`);
    if (c.npc && c.pattern) {
      const d = c.npc.debug;
      const pt = c.pattern;
      lines.push(`NPC ${pt.id}  ${pt.difficulty} / ${pt.personality}`);
      lines.push(`  target speed ${msToKmh(d.targetSpeed).toFixed(1)} km/h  state ${d.state}  mistake ${d.mistake ?? '-'}`);
      lines.push(`  line off ${d.lineOffset.toFixed(2)} avoid ${d.avoidOffset.toFixed(2)} avoiding ${d.avoidingId ?? '-'}`);
      lines.push(`  target (${d.targetX.toFixed(1)}, ${d.targetZ.toFixed(1)})  react ${pt.reactionTime.toFixed(2)} noise ${pt.steeringNoise.toFixed(3)}`);
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
        `${String(car.position).padStart(2)} ${tag.padEnd(18)} ${car.spec.name.padEnd(13)} ${msToKmh(car.body.speed).toFixed(0).padStart(3)}km/h lap ${car.progress.lap} ${car.npc ? car.npc.debug.state : ''}`,
      );
    }
    return lines.join('\n');
  }

  dispose(): void {
    this.overlay.remove();
    if (this.gizmos) this.gizmos.removeFromParent();
    this.bag.dispose();
    this.targetMarkers = [];
  }
}
