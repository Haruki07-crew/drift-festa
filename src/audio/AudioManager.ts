/**
 * 効果音 (Web Audio API による実行時合成)。
 *
 * 音声ファイルを使わないので外部取得が一切なく、完全オフラインで動作する。BGM は audio/music/MusicPlayer (別の音量)。
 * ブラウザの自動再生制限のため、最初のユーザー操作 (キー/クリック) で AudioContext を開始する。
 */
import { audioConfig } from '../config/audio';

export type SfxName =
  | 'uiMove'
  | 'uiConfirm'
  | 'uiBack'
  | 'countdown'
  | 'go'
  | 'lap'
  | 'finalLap'
  | 'goal'
  | 'fall'
  | 'respawn'
  | 'gun'
  | 'hit'
  | 'itemPickup'
  | 'itemUse'
  | 'itemDenied'
  | 'boost'
  | 'recovery'
  | 'boostPad'
  | 'jump';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume: number;
  private readonly unlockHandler = (): void => this.unlock();

  constructor(volume: number) {
    this.volume = volume;
    window.addEventListener('keydown', this.unlockHandler);
    window.addEventListener('pointerdown', this.unlockHandler);
  }

  /** 最初のユーザー操作で AudioContext を開始 */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoise(this.ctx);
      } catch (err) {
        console.warn('[Audio] Web Audio API を利用できません', err);
        return;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get output(): GainNode | null {
    return this.master;
  }

  get noise(): AudioBuffer | null {
    return this.noiseBuffer;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }

  /** 一時停止中などに全体をミュート */
  setMuted(muted: boolean): void {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 効果音を鳴らす。pan: -1 (左) .. 1 (右)、intensity: 音量倍率 */
  play(name: SfxName, pan = 0, intensity = 1): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    const sfx = audioConfig.sfx;
    const t = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(out);
    const cleanupAfter = (seconds: number): void => {
      window.setTimeout(() => panner.disconnect(), seconds * 1000 + 200);
    };

    switch (name) {
      case 'uiMove':
        this.tone(panner, 'square', 660, 0.05, sfx.uiVolume * 0.5, t);
        cleanupAfter(0.1);
        break;
      case 'uiConfirm':
        this.tone(panner, 'square', 880, 0.06, sfx.uiVolume, t);
        this.tone(panner, 'square', 1320, 0.08, sfx.uiVolume, t + 0.06);
        cleanupAfter(0.2);
        break;
      case 'uiBack':
        this.tone(panner, 'square', 520, 0.06, sfx.uiVolume, t);
        this.tone(panner, 'square', 390, 0.08, sfx.uiVolume, t + 0.06);
        cleanupAfter(0.2);
        break;
      case 'countdown':
        this.tone(panner, 'sine', 740, 0.28, sfx.countdownVolume, t);
        cleanupAfter(0.4);
        break;
      case 'go':
        this.tone(panner, 'sine', 1480, 0.6, sfx.countdownVolume, t);
        this.tone(panner, 'triangle', 740, 0.6, sfx.countdownVolume * 0.6, t);
        cleanupAfter(0.8);
        break;
      case 'lap':
        this.tone(panner, 'triangle', 988, 0.12, sfx.goalVolume * 0.7, t);
        this.tone(panner, 'triangle', 1319, 0.2, sfx.goalVolume * 0.7, t + 0.12);
        cleanupAfter(0.5);
        break;
      case 'finalLap':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(panner, 'triangle', f, 0.14, sfx.goalVolume * 0.7, t + i * 0.1));
        cleanupAfter(0.7);
        break;
      case 'goal':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          this.tone(panner, 'square', f, i === 5 ? 0.6 : 0.13, sfx.goalVolume * 0.5, t + i * 0.13),
        );
        cleanupAfter(1.6);
        break;
      case 'fall':
        this.sweep(panner, 'sawtooth', 600, 80, 0.9, sfx.fallVolume * 0.5, t);
        cleanupAfter(1.1);
        break;
      case 'respawn':
        this.sweep(panner, 'sine', 300, 900, 0.35, sfx.fallVolume * 0.6, t);
        cleanupAfter(0.5);
        break;
      case 'gun':
        this.noiseBurst(panner, 0.09, sfx.gunVolume * intensity, 2400, t);
        this.sweep(panner, 'square', 900, 120, 0.08, sfx.gunVolume * 0.5 * intensity, t);
        cleanupAfter(0.2);
        break;
      case 'hit':
        this.noiseBurst(panner, 0.16, sfx.hitVolume * intensity, 900, t);
        this.tone(panner, 'square', 180, 0.12, sfx.hitVolume * 0.6 * intensity, t);
        cleanupAfter(0.3);
        break;
      case 'itemPickup':
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone(panner, 'triangle', f, 0.07, sfx.itemVolume, t + i * 0.05));
        cleanupAfter(0.4);
        break;
      case 'itemUse':
        this.tone(panner, 'triangle', 660, 0.08, sfx.itemVolume, t);
        this.tone(panner, 'triangle', 990, 0.12, sfx.itemVolume, t + 0.07);
        cleanupAfter(0.3);
        break;
      case 'itemDenied':
        this.tone(panner, 'square', 200, 0.15, sfx.itemVolume * 0.6, t);
        cleanupAfter(0.3);
        break;
      case 'boost':
        this.sweep(panner, 'sawtooth', 200, 1200, 0.5, sfx.itemVolume * 0.6, t);
        this.noiseBurst(panner, 0.5, sfx.itemVolume * 0.5, 1800, t);
        cleanupAfter(0.7);
        break;
      case 'boostPad':
        this.sweep(panner, 'sawtooth', 300, 900, 0.3, sfx.itemVolume * 0.45, t);
        cleanupAfter(0.4);
        break;
      case 'jump':
        this.sweep(panner, 'triangle', 260, 620, 0.25, sfx.itemVolume * 0.5, t);
        cleanupAfter(0.35);
        break;
      case 'recovery':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(panner, 'sine', f, 0.18, sfx.itemVolume, t + i * 0.08));
        cleanupAfter(0.7);
        break;
    }
  }

  /** 衝突音 (強さで音量と音色が変わる) */
  playImpact(speed: number, pan = 0): void {
    const ctx = this.ctx;
    const out = this.master;
    if (!ctx || !out) return;
    const t = ctx.currentTime;
    const intensity = Math.min(1, speed / 18);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    this.noiseBurst(panner, 0.12 + intensity * 0.18, audioConfig.sfx.collisionVolume * (0.3 + intensity * 0.7), 500 + intensity * 900, t);
    this.tone(panner, 'triangle', 90 + intensity * 40, 0.15, audioConfig.sfx.collisionVolume * intensity * 0.8, t);
    window.setTimeout(() => panner.disconnect(), 600);
  }

  private tone(dest: AudioNode, type: OscillatorType, freq: number, duration: number, volume: number, start: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private sweep(dest: AudioNode, type: OscillatorType, from: number, to: number, duration: number, volume: number, start: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    g.gain.setValueAtTime(volume, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noiseBurst(dest: AudioNode, duration: number, volume: number, cutoff: number, start: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(g).connect(dest);
    src.start(start, Math.random() * 0.5);
    src.stop(start + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.unlockHandler);
    window.removeEventListener('pointerdown', this.unlockHandler);
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
