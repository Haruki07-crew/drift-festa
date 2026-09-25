/**
 * 天候 (v3): 雨・砂嵐・雪の粒子と、オーロラの空。
 *
 * 粒子はコース全体ではなく「見ている車の周り」だけに出して軽くする (2人プレイは2か所)。
 * 天候が強い区間 (WeatherDef.zones) の霧は RaceSession が画面ごとに切り替える (fogFor)。
 */
import * as THREE from 'three';
import type { WeatherDef } from '../config/courses';
import { weatherConfig, type QualityPreset } from '../config/graphics';
import { SeededRandom } from '../core/math';
import type { ResourceBag } from '../render/dispose';
import type { Track } from './Track';
import { makeRoundSprite } from './scenery/SceneryKit';

interface Emitter {
  points: THREE.Points | THREE.LineSegments;
  positions: Float32Array;
  /** 粒子ごとの位置 (中心からの相対) */
  rel: Float32Array;
  count: number;
}

export class Weather {
  readonly group = new THREE.Group();
  readonly def: WeatherDef | null;
  private readonly track: Track;
  private readonly emitters: Emitter[] = [];
  private readonly aurora: THREE.MeshBasicMaterial[] = [];
  /** 天候が強い区間で空を覆うもや (区間の中にいる画面だけ表示) */
  private readonly haze: THREE.Mesh | null = null;
  private readonly rng = new SeededRandom(9090);
  private time = 0;

  constructor(track: Track, preset: QualityPreset, bag: ResourceBag, viewers: number) {
    this.track = track;
    this.def = track.def.environment.weather ?? null;
    this.group.name = 'weather';
    this.group.userData.clearanceExempt = true;
    const def = this.def;
    if (!def) return;
    const intensity = def.intensity ?? 1;
    const zone = def.zones?.[0];
    if (zone) {
      const b = track.bounds;
      const r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 500;
      const hazeMat = bag.add(
        new THREE.MeshBasicMaterial({ color: zone.fogColor ?? 0xd8c0a0, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true, opacity: 0.92 }),
      );
      const haze = new THREE.Mesh(bag.add(new THREE.SphereGeometry(r, 16, 10)), hazeMat);
      haze.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
      haze.renderOrder = -9;
      haze.frustumCulled = false;
      haze.visible = false;
      haze.name = 'weather-haze';
      this.group.add(haze);
      this.haze = haze;
    }
    if (def.kind === 'aurora') {
      this.buildAurora(bag);
      return;
    }
    const cfg = def.kind === 'rain' ? weatherConfig.rain : def.kind === 'sandstorm' ? weatherConfig.sandstorm : weatherConfig.snow;
    const count = Math.max(50, Math.floor(cfg.count * preset.sceneryDensity * intensity));
    for (let v = 0; v < Math.max(1, viewers); v++) {
      const rel = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        rel[i * 3] = this.rng.range(-cfg.radius, cfg.radius);
        rel[i * 3 + 1] = this.rng.range(0, cfg.height);
        rel[i * 3 + 2] = this.rng.range(-cfg.radius, cfg.radius);
      }
      if (def.kind === 'rain') {
        const positions = new Float32Array(count * 6);
        const geo = bag.add(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        const mat = bag.add(new THREE.LineBasicMaterial({ color: weatherConfig.rain.color, transparent: true, opacity: weatherConfig.rain.opacity, depthWrite: false }));
        const lines = new THREE.LineSegments(geo, mat);
        lines.frustumCulled = false;
        this.group.add(lines);
        this.emitters.push({ points: lines, positions, rel, count });
      } else {
        const positions = new Float32Array(count * 3);
        const geo = bag.add(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        const c = def.kind === 'sandstorm' ? weatherConfig.sandstorm : weatherConfig.snow;
        const mat = bag.add(
          new THREE.PointsMaterial({ color: c.color, size: c.size, map: bag.add(makeRoundSprite()), alphaTest: 0.3, transparent: true, opacity: c.opacity, depthWrite: false }),
        );
        const pts = new THREE.Points(geo, mat);
        pts.frustumCulled = false;
        this.group.add(pts);
        this.emitters.push({ points: pts, positions, rel, count });
      }
    }
  }

  /** オーロラ: 空に揺れる光の帯 (夜のコース用) */
  private buildAurora(bag: ResourceBag): void {
    const cfg = weatherConfig.aurora;
    const b = this.track.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    for (let k = 0; k < cfg.ribbons; k++) {
      const geo = bag.add(new THREE.PlaneGeometry(cfg.length, 90, 48, 1));
      const pos = geo.getAttribute('position');
      // 帯を波打たせる
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x / 140 + k) * 70 + Math.sin(x / 57 + k * 2) * 25);
      }
      geo.computeVertexNormals();
      const mat = bag.add(
        new THREE.MeshBasicMaterial({
          color: cfg.colors[k % cfg.colors.length]!,
          transparent: true,
          opacity: 0.22,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      const m = new THREE.Mesh(geo, mat);
      m.position.set(cx + (k - cfg.ribbons / 2) * 90, cfg.height + k * 25, cz - 300 + k * 160);
      m.rotation.set(0.35, k * 0.5, 0);
      m.renderOrder = -5;
      this.group.add(m);
      this.aurora.push(mat);
    }
  }

  /**
   * 見ている車の位置 (最大 viewers 個) の周りに粒子を出す。
   * zones がある天候 (砂嵐など) は、見ている車が区間の中にいる時だけ粒子を出す。
   * @param viewS 見ている車のコース上の位置 (centers と同じ順)
   */
  update(dt: number, centers: readonly THREE.Vector3[], viewS: readonly number[] = []): void {
    this.time += dt;
    const def = this.def;
    if (!def) return;
    if (def.kind === 'aurora') {
      this.aurora.forEach((m, k) => (m.opacity = 0.3 + 0.14 * Math.sin(this.time * 0.4 + k * 1.7)));
      return;
    }
    this.emitters.forEach((e, v) => {
      const c = centers[v] ?? centers[0];
      if (!c) {
        e.points.visible = false;
        return;
      }
      const s = viewS[v] ?? viewS[0];
      if (def.zones && s !== undefined && this.fogFor(s) === null) {
        e.points.visible = false;
        return;
      }
      e.points.visible = true;
      this.step(e, c, dt, def.kind);
    });
  }

  private step(e: Emitter, c: THREE.Vector3, dt: number, kind: WeatherDef['kind']): void {
    const rel = e.rel;
    const pos = e.positions;
    if (kind === 'rain') {
      const cfg = weatherConfig.rain;
      for (let i = 0; i < e.count; i++) {
        let y = rel[i * 3 + 1]! - cfg.fallSpeed * dt;
        if (y < -2) y += cfg.height;
        rel[i * 3 + 1] = y;
        const x = c.x + rel[i * 3]!;
        const z = c.z + rel[i * 3 + 2]!;
        const wy = c.y + y;
        pos[i * 6] = x;
        pos[i * 6 + 1] = wy;
        pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + cfg.slant * cfg.dropLength;
        pos[i * 6 + 4] = wy + cfg.dropLength;
        pos[i * 6 + 5] = z;
      }
    } else if (kind === 'sandstorm') {
      const cfg = weatherConfig.sandstorm;
      const r = cfg.radius;
      for (let i = 0; i < e.count; i++) {
        let x = rel[i * 3]! + cfg.windSpeed * dt;
        if (x > r) x -= 2 * r;
        rel[i * 3] = x;
        pos[i * 3] = c.x + x;
        pos[i * 3 + 1] = c.y + rel[i * 3 + 1]! + Math.sin(this.time * 3 + i) * 0.3;
        pos[i * 3 + 2] = c.z + rel[i * 3 + 2]!;
      }
    } else {
      const cfg = weatherConfig.snow;
      for (let i = 0; i < e.count; i++) {
        let y = rel[i * 3 + 1]! - cfg.fallSpeed * dt;
        if (y < -2) y += cfg.height;
        rel[i * 3 + 1] = y;
        pos[i * 3] = c.x + rel[i * 3]! + Math.sin(this.time + i) * 0.8;
        pos[i * 3 + 1] = c.y + y;
        pos[i * 3 + 2] = c.z + rel[i * 3 + 2]!;
      }
    }
    (e.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** 天候が強い区間のもや (空を覆う) を表示するか。画面ごとに描画直前に切り替える */
  setHaze(visible: boolean): void {
    if (this.haze) this.haze.visible = visible;
  }

  /** 位置 s で天候が強い区間の霧 (null = 通常の霧) */
  fogFor(s: number): { near: number; far: number; color?: number } | null {
    const zones = this.def?.zones;
    if (!zones) return null;
    const f = this.track.sToFrac(s);
    for (const z of zones) {
      if (f >= z.from && f < z.to) return { near: z.fogNear, far: z.fogFar, color: z.fogColor };
    }
    return null;
  }
}

