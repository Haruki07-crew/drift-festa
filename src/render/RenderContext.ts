/**
 * WebGLRenderer の生成・リサイズ・画質設定・分割画面描画。
 * アプリ全体で1つだけ生成し、レースごとに作り直さない (長時間稼働対策)。
 */
import * as THREE from 'three';
import { graphicsConfig, type GraphicsQuality, type QualityPreset } from '../config/graphics';

export interface Viewport {
  /** 0..1 の正規化座標 (左下原点ではなく左上原点) */
  x: number;
  y: number;
  width: number;
  height: number;
}

export class RenderContext {
  renderer: THREE.WebGLRenderer;
  readonly container: HTMLElement;
  quality: GraphicsQuality;
  private antialias: boolean;
  private readonly onResize = (): void => this.resize();
  width = 1;
  height = 1;

  constructor(container: HTMLElement, quality: GraphicsQuality) {
    this.container = container;
    this.quality = quality;
    this.antialias = this.preset.antialias;
    this.renderer = this.createRenderer();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  get preset(): QualityPreset {
    return graphicsConfig.presets[this.quality];
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: this.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'game-canvas';
    renderer.domElement.tabIndex = 0;
    this.container.prepend(renderer.domElement);
    this.applyPreset(renderer);
    return renderer;
  }

  private applyPreset(renderer: THREE.WebGLRenderer): void {
    const p = this.preset;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.maxPixelRatio) * p.renderScale);
    renderer.shadowMap.enabled = p.shadows;
  }

  /**
   * 画質を変更する。アンチエイリアスの切替はコンテキストの作り直しが必要なため、
   * レース中でないとき (recreateAllowed) のみ行う。
   * @returns レンダラーを作り直した場合 true
   */
  setQuality(quality: GraphicsQuality, recreateAllowed: boolean): boolean {
    this.quality = quality;
    const wantAA = this.preset.antialias;
    if (wantAA !== this.antialias && recreateAllowed) {
      this.antialias = wantAA;
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
      this.renderer = this.createRenderer();
      this.resize();
      return true;
    }
    this.applyPreset(this.renderer);
    this.resize();
    return false;
  }

  resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.renderer.setSize(this.width, this.height, true);
  }

  /** ビューポートを指定して描画 (分割画面用) */
  renderViewport(scene: THREE.Scene, camera: THREE.PerspectiveCamera, vp: Viewport): void {
    const r = this.renderer;
    const x = Math.floor(vp.x * this.width);
    const w = Math.floor(vp.width * this.width);
    const h = Math.floor(vp.height * this.height);
    // WebGL は左下原点
    const y = Math.floor((1 - vp.y - vp.height) * this.height);
    const aspect = w / Math.max(1, h);
    if (Math.abs(camera.aspect - aspect) > 1e-4) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    r.setViewport(x, y, w, h);
    r.setScissor(x, y, w, h);
    r.setScissorTest(true);
    r.render(scene, camera);
  }

  clear(color: number): void {
    const r = this.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, this.width, this.height);
    r.setClearColor(color, 1);
    r.clear();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
