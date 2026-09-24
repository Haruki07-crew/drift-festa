/**
 * 空・霧・ライト・遠景 (山並み / 星) の生成。
 */
import * as THREE from 'three';
import type { QualityPreset } from '../../config/graphics';
import { graphicsConfig } from '../../config/graphics';
import { SeededRandom } from '../../core/math';
import type { ResourceBag } from '../../render/dispose';
import type { Track } from '../Track';
import { flatten, paint } from './SceneryUtils';

export class CourseEnvironment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly center: THREE.Vector3;
  readonly radius: number;
  private readonly sunOffset: THREE.Vector3;

  constructor(track: Track, scene: THREE.Scene, preset: QualityPreset, bag: ResourceBag) {
    const env = track.def.environment;
    const b = track.bounds;
    this.center = new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    this.radius = span / 2 + preset.drawDistance * 0.6;
    this.group.name = 'environment';

    scene.background = new THREE.Color(env.skyBottom);
    scene.fog = new THREE.Fog(env.fogColor, env.fogNear, Math.min(env.fogFar, preset.drawDistance));

    // --- 空 (グラデーションの球) ---
    const skyGeo = bag.add(new THREE.SphereGeometry(this.radius, 24, 14));
    const top = new THREE.Color(env.skyTop);
    const bottom = new THREE.Color(env.skyBottom);
    const pos = skyGeo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, Math.min(1, pos.getY(i) / this.radius + 0.1));
      c.copy(bottom).lerp(top, Math.pow(t, 0.6));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const skyMat = bag.add(
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.copy(this.center);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.group.add(sky);

    // --- ライト ---
    const hemi = new THREE.HemisphereLight(env.ambientSky, env.ambientGround, env.ambientIntensity);
    this.group.add(hemi);
    this.sun = new THREE.DirectionalLight(env.sunColor, env.sunIntensity);
    this.sunOffset = new THREE.Vector3(-0.55, 0.75, -0.35).normalize().multiplyScalar(120);
    this.sun.position.copy(this.sunOffset);
    this.sun.castShadow = preset.shadows;
    if (preset.shadows) {
      const r = graphicsConfig.shadowRadius;
      this.sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
      const cam = this.sun.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = 320;
      this.sun.shadow.bias = -0.0008;
      this.sun.shadow.normalBias = 0.04;
    }
    this.group.add(this.sun, this.sun.target);

    // --- 太陽 / 月 ---
    const discGeo = bag.add(new THREE.CircleGeometry(env.night ? 18 : 30, 20));
    const discMat = bag.add(
      new THREE.MeshBasicMaterial({ color: env.night ? 0xf2f0ff : 0xfff4d0, fog: false, transparent: true, opacity: 0.9 }),
    );
    const disc = new THREE.Mesh(discGeo, discMat);
    const dir = this.sunOffset.clone().normalize();
    disc.position.copy(this.center).addScaledVector(dir, this.radius * 0.9);
    disc.lookAt(this.center);
    disc.renderOrder = -9;
    this.group.add(disc);

    // --- 星 (夜) ---
    if (env.night) {
      const rng = new SeededRandom(7);
      const starPos: number[] = [];
      for (let i = 0; i < 600; i++) {
        const theta = rng.range(0, Math.PI * 2);
        const phi = rng.range(0.08, Math.PI / 2);
        const r = this.radius * 0.95;
        starPos.push(
          this.center.x + r * Math.cos(phi) * Math.cos(theta),
          r * Math.sin(phi),
          this.center.z + r * Math.cos(phi) * Math.sin(theta),
        );
      }
      const starGeo = bag.add(new THREE.BufferGeometry());
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      const starMat = bag.add(new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
      const stars = new THREE.Points(starGeo, starMat);
      stars.renderOrder = -8;
      this.group.add(stars);
    }

    // --- 遠景の山並み ---
    this.buildDistantMountains(track, span, bag);
    scene.add(this.group);
  }

  private buildDistantMountains(track: Track, span: number, bag: ResourceBag): void {
    const env = track.def.environment;
    const rng = new SeededRandom(track.def.id.length * 97 + 13);
    const kind = env.scenery;
    // 遠景の山は屋外の自然のコースだけ (都市・空中・室内のコースには出さない)
    const count = kind === 'circuit' || kind === 'touge' || kind === 'frost' || kind === 'jungle' || kind === 'aqua' ? 26 : 0;
    if (count === 0) return;
    const baseGeo = flatten(new THREE.ConeGeometry(1, 1, 5, 1));
    baseGeo.translate(0, 0.5, 0);
    const mountainColor = new THREE.Color(env.groundColor).lerp(new THREE.Color(env.fogColor), 0.55).getHex();
    paint(baseGeo, mountainColor);
    const mat = bag.add(new THREE.MeshLambertMaterial({ vertexColors: true }));
    bag.add(baseGeo);
    const mesh = new THREE.InstancedMesh(baseGeo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.range(-0.08, 0.08);
      const dist = span / 2 + rng.range(180, 320);
      const h = kind === 'touge' ? rng.range(110, 240) : rng.range(35, 90);
      const w = h * rng.range(1.4, 2.4);
      p.set(this.center.x + Math.cos(a) * dist, env.groundLevel - 5, this.center.z + Math.sin(a) * dist);
      s.set(w, h, w * rng.range(0.7, 1.2));
      q.setFromAxisAngle(up, rng.range(0, Math.PI));
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
  }

  /** 影の範囲を注目点 (プレイヤー車) に追従させる */
  follow(x: number, y: number, z: number): void {
    this.sun.target.position.set(x, y, z);
    this.sun.position.set(x + this.sunOffset.x, y + this.sunOffset.y, z + this.sunOffset.z);
  }
}
