/**
 * 軽量パーティクル (タイヤスモーク・火花)。固定長のプールを使い回し、実行中にメモリを確保しない。
 */
import * as THREE from 'three';

export interface ParticleStyle {
  color: number;
  /** 開始サイズ [m相当] */
  startSize: number;
  endSize: number;
  startAlpha: number;
  lifetime: number;
  /** 上昇速度 [m/s] */
  rise: number;
  drag: number;
  gravity: number;
  additive: boolean;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(uColor, a);
  }
`;

export class ParticleSystem {
  readonly points: THREE.Points;
  private readonly style: ParticleStyle;
  private readonly capacity: number;
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly vel: Float32Array;
  private readonly age: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private next = 0;

  constructor(style: ParticleStyle, capacity: number) {
    this.style = style;
    this.capacity = Math.max(1, capacity);
    const n = this.capacity;
    this.positions = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    this.alphas = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(Infinity);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(style.color) },
        uScale: { value: 300 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: style.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** 画面の高さに応じてポイントサイズを調整 */
  setViewportHeight(px: number): void {
    this.material.uniforms.uScale!.value = px * 0.9;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy + this.style.rise;
    this.vel[i * 3 + 2] = vz;
    this.age[i] = 0;
  }

  update(dt: number): void {
    const s = this.style;
    const drag = Math.exp(-s.drag * dt);
    for (let i = 0; i < this.capacity; i++) {
      const age = this.age[i]!;
      if (age >= s.lifetime) {
        this.alphas[i] = 0;
        continue;
      }
      const a = age + dt;
      this.age[i] = a;
      const t = a / s.lifetime;
      this.vel[i * 3]! *= drag;
      this.vel[i * 3 + 2]! *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1]! * drag - s.gravity * dt;
      this.positions[i * 3]! += this.vel[i * 3]! * dt;
      this.positions[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.positions[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.sizes[i] = s.startSize + (s.endSize - s.startSize) * t;
      this.alphas[i] = s.startAlpha * (1 - t);
    }
    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export const SMOKE_STYLE: ParticleStyle = {
  color: 0xdedede,
  startSize: 1.2,
  endSize: 4.2,
  startAlpha: 0.28,
  lifetime: 0.9,
  rise: 0.9,
  drag: 1.8,
  gravity: 0,
  additive: false,
};

export const SPARK_STYLE: ParticleStyle = {
  color: 0xffb040,
  startSize: 0.35,
  endSize: 0.08,
  startAlpha: 1,
  lifetime: 0.45,
  rise: 1.5,
  drag: 2.5,
  gravity: 14,
  additive: true,
};

export const BOOST_STYLE: ParticleStyle = {
  color: 0x55d6ff,
  startSize: 0.9,
  endSize: 0.2,
  startAlpha: 0.9,
  lifetime: 0.35,
  rise: 0.2,
  drag: 3,
  gravity: 0,
  additive: true,
};

/** 水しぶき (水たまり・波の区間を走った時) */
export const SPLASH_STYLE: ParticleStyle = {
  color: 0xdff4ff,
  startSize: 0.9,
  endSize: 2.6,
  startAlpha: 0.55,
  lifetime: 0.55,
  rise: 3.5,
  drag: 2,
  gravity: 9,
  additive: false,
};
