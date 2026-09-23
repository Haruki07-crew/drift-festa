/**
 * 人間プレイヤーの車の連続音 (エンジン音 + タイヤのスキール音)。
 * エンジン音は速度と仮想ギアに応じてピッチが変化する。
 */
import { audioConfig } from '../config/audio';
import { clamp } from '../core/math';
import type { VehicleBody } from '../physics/VehicleBody';
import type { AudioManager } from './AudioManager';

export class CarSound {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private tireGain: GainNode | null = null;
  private readonly audio: AudioManager;
  private ctxRef: AudioContext | null = null;
  private readonly pan: number;

  constructor(audio: AudioManager, pan: number) {
    this.audio = audio;
    this.pan = pan;
    this.tryInit();
  }

  private tryInit(): void {
    const ctx = this.audio.context;
    const out = this.audio.output;
    if (!ctx || !out || this.ctxRef) return;
    this.ctxRef = ctx;
    const e = audioConfig.engine;
    const panner = ctx.createStereoPanner();
    panner.pan.value = this.pan;
    panner.connect(out);

    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = e.idleFrequency;
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    this.osc2.frequency.value = e.idleFrequency / 2;
    const sub = ctx.createGain();
    sub.gain.value = 0.5;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = e.filterBase;
    this.filter.Q.value = 3;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.osc1.connect(this.filter);
    this.osc2.connect(sub).connect(this.filter);
    this.filter.connect(this.engineGain).connect(panner);

    const noise = this.audio.noise;
    this.tireGain = ctx.createGain();
    this.tireGain.gain.value = 0;
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = audioConfig.tire.frequency;
      band.Q.value = 6;
      src.connect(band).connect(this.tireGain).connect(panner);
      src.start();
      this.sources.push(src);
      this.nodes.push(band);
    }
    this.osc1.start();
    this.osc2.start();
    this.sources.push(this.osc1, this.osc2);
    this.nodes.push(panner, sub, this.filter, this.engineGain, this.tireGain);
  }

  update(body: VehicleBody, active: boolean): void {
    this.tryInit();
    const ctx = this.ctxRef;
    if (!ctx || !this.osc1 || !this.osc2 || !this.filter || !this.engineGain || !this.tireGain) return;
    const e = audioConfig.engine;
    const t = ctx.currentTime;
    const ratio = clamp(Math.abs(body.forwardSpeed) / Math.max(1, body.maxSpeed / body.maxSpeedMul), 0, 1.2);
    // 仮想ギア: 各ギア内で回転数が上がり、シフトアップで下がる
    const gearPos = ratio * e.gears;
    const gear = Math.min(e.gears - 1, Math.floor(gearPos));
    const inGear = gearPos - gear;
    const rpm = 0.3 + 0.7 * (gear === 0 ? inGear : 0.35 + inGear * 0.65);
    const freq = e.idleFrequency + (e.maxFrequency - e.idleFrequency) * rpm;
    this.osc1.frequency.setTargetAtTime(freq, t, 0.05);
    this.osc2.frequency.setTargetAtTime(freq / 2, t, 0.05);
    this.filter.frequency.setTargetAtTime(e.filterBase + freq * e.filterPerFrequency * (0.6 + body.throttleInput * 0.6), t, 0.08);
    const vol = active ? e.volume * (0.55 + body.throttleInput * e.throttleVolumeBoost + ratio * 0.2) : 0;
    this.engineGain.gain.setTargetAtTime(vol, t, 0.08);

    const slip = Math.abs(body.lateralSpeed);
    const tireCfg = audioConfig.tire;
    const tireVol =
      active && !body.airborne && body.surface === 'road'
        ? clamp((slip - tireCfg.slipThreshold) / 6, 0, 1) * tireCfg.volume + (body.brakeInput > 0 && body.forwardSpeed > 12 ? 0.06 : 0)
        : 0;
    this.tireGain.gain.setTargetAtTime(tireVol, t, 0.06);
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // 既に停止済み
      }
      s.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    this.sources.length = 0;
    this.nodes.length = 0;
    this.ctxRef = null;
  }
}
