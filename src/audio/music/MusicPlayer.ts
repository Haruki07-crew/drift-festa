/**
 * BGM の再生 (Web Audio API でシンセ・ドラムを実行時に合成)。
 *
 * - Composer が作った小節ごとの音符を、AudioContext の時計で少し先まで予約して鳴らす
 *   (requestAnimationFrame ではなくタイマーで予約するので、描画が重くてもリズムが崩れない)
 * - 効果音とは別の音量 (設定画面の「BGM の音量」)。ポーズ中は小さくする
 * - 曲の切り替えはフェードアウト → 次の曲。不要になったノードはすべて disconnect する
 * - AudioContext は最初のキー/クリックで作られる (ブラウザの自動再生制限)。それまでは再生を予約だけしておく
 */
import { musicConfig, type SynthSpec } from '../../config/music';
import { musicThemeFor } from '../../config/musicThemes';
import type { AudioManager } from '../AudioManager';
import { STEPS_PER_BAR, composeSong, type ComposedSong, type NoteEvent } from './Composer';

interface Playing {
  id: string;
  song: ComposedSong;
  /** この曲だけの出力 (フェード用) */
  out: GainNode;
  delayIn: GainNode;
  delayNodes: AudioNode[];
  bar: number;
  step: number;
  /** 次の16分音符を鳴らす時刻 (AudioContext の時間)。null = まだ始まっていない */
  nextTime: number | null;
}

export class MusicPlayer {
  private readonly audio: AudioManager;
  private bus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private current: Playing | null = null;
  private pendingId: string | null = null;
  private volume: number;
  private paused = false;
  private finalStretch = false;
  private timer = 0;
  private readonly songCache = new Map<string, ComposedSong>();

  constructor(audio: AudioManager, volume: number) {
    this.audio = audio;
    this.volume = volume;
    this.timer = window.setInterval(() => this.tick(), musicConfig.schedulerIntervalMs);
  }

  /** 曲を再生する (コース ID または 'menu')。同じ曲が流れていれば何もしない */
  play(id: string): void {
    this.finalStretch = false;
    if (this.current?.id === id || (!this.current && this.pendingId === id)) return;
    this.fadeOutCurrent();
    this.pendingId = id;
  }

  stop(): void {
    this.fadeOutCurrent();
    this.pendingId = null;
  }

  setVolume(v: number): void {
    this.volume = v;
    this.applyBusGain(0.05);
  }

  /** ポーズ中は音量を下げる */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyBusGain(0.15);
  }

  /** 最終ラップ: 少しテンポを上げ、ブレイク (静かな部分) を飛ばす */
  setFinalStretch(on: boolean): void {
    this.finalStretch = on;
  }

  get isFinalStretch(): boolean {
    return this.finalStretch;
  }

  /** デバッグ表示用 */
  get debugText(): string {
    const c = this.current;
    if (!c) return this.pendingId ? `BGM ${this.pendingId} (待機中: キーかクリックで開始)` : 'BGM -';
    const bar = c.song.bars[c.bar];
    return `BGM ${c.song.theme.title} [${c.song.style.label} ${this.bpm(c).toFixed(0)}bpm] bar ${c.bar + 1}/${c.song.bars.length} ${bar?.section ?? ''}${this.finalStretch ? ' FINAL' : ''}`;
  }

  private bpm(c: Playing): number {
    return c.song.theme.bpm * (this.finalStretch ? musicConfig.finalStretch.bpmMultiplier : 1);
  }

  private busGain(): number {
    return this.volume * musicConfig.masterGain * (this.paused ? musicConfig.pausedGain : 1);
  }

  private applyBusGain(timeConstant: number): void {
    const ctx = this.audio.context;
    if (this.bus && ctx) this.bus.gain.setTargetAtTime(this.busGain(), ctx.currentTime, timeConstant);
  }

  private ensureBus(ctx: AudioContext): GainNode {
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = this.busGain();
      // 音が重なって割れないよう軽くまとめる
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.ratio.value = 3;
      this.bus.connect(this.compressor).connect(ctx.destination);
    }
    return this.bus;
  }

  private song(id: string): ComposedSong {
    let s = this.songCache.get(id);
    if (!s) {
      s = composeSong(musicThemeFor(id));
      this.songCache.set(id, s);
    }
    return s;
  }

  private start(ctx: AudioContext, id: string): void {
    const bus = this.ensureBus(ctx);
    const song = this.song(id);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + musicConfig.fadeInSeconds);
    out.connect(bus);

    // ディレイ (やまびこ): 入力 → 遅延 → 出力、遅延 → 高音を削って → 遅延 (くり返し)
    const d = song.style.delay;
    const stepSec = 60 / song.theme.bpm / 4;
    const delayIn = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = Math.min(1.9, d.steps * stepSec);
    const feedback = ctx.createGain();
    feedback.gain.value = d.feedback;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2600;
    const wet = ctx.createGain();
    wet.gain.value = d.wet;
    delayIn.connect(delay);
    delay.connect(damp).connect(feedback).connect(delay);
    delay.connect(wet).connect(out);

    this.current = { id, song, out, delayIn, delayNodes: [delay, feedback, damp, wet], bar: 0, step: 0, nextTime: null };
  }

  private fadeOutCurrent(): void {
    const c = this.current;
    this.current = null;
    if (!c) return;
    const ctx = this.audio.context;
    const fade = musicConfig.fadeOutSeconds;
    if (ctx) {
      c.out.gain.cancelScheduledValues(ctx.currentTime);
      c.out.gain.setValueAtTime(c.out.gain.value, ctx.currentTime);
      c.out.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    }
    // 予約済みの音が鳴り終わってから切り離す
    window.setTimeout(() => {
      c.out.disconnect();
      c.delayIn.disconnect();
      for (const n of c.delayNodes) n.disconnect();
    }, (fade + 1.5) * 1000);
  }

  private tick(): void {
    const ctx = this.audio.context;
    if (!ctx || ctx.state !== 'running') return;
    if (this.pendingId !== null) {
      const id = this.pendingId;
      this.pendingId = null;
      this.start(ctx, id);
    }
    const c = this.current;
    if (!c) return;
    const now = ctx.currentTime;
    // 初回、またはタブが裏に回ってタイマーが止まっていた場合は今から鳴らし直す (遅れた音をまとめて鳴らさない)
    if (c.nextTime === null || c.nextTime < now - 0.1) c.nextTime = now + 0.06;
    const horizon = now + musicConfig.scheduleAheadSeconds;
    while (c.nextTime < horizon) {
      const stepSec = 60 / this.bpm(c) / 4;
      const bar = c.song.bars[c.bar]!;
      const swing = c.step % 2 === 1 ? c.song.style.swing * stepSec : 0;
      for (const e of bar.steps[c.step]!) this.playEvent(ctx, c, e, c.nextTime + swing, stepSec);
      c.nextTime += stepSec;
      c.step++;
      if (c.step >= STEPS_PER_BAR) {
        c.step = 0;
        c.bar++;
        if (c.bar >= c.song.bars.length) c.bar = c.song.loopStartBar;
        if (this.finalStretch && c.song.bars[c.bar]!.section === 'break') c.bar = c.song.loopStartBar;
      }
    }
  }

  // ------------------------------------------------------------------ 楽器

  private playEvent(ctx: AudioContext, c: Playing, e: NoteEvent, t: number, stepSec: number): void {
    const style = c.song.style;
    const drums = style.drums;
    switch (e.voice) {
      case 'kick':
        this.kick(ctx, c.out, t, e.velocity * drums.volume, drums.kickTone ?? 1);
        break;
      case 'snare':
        this.snare(ctx, c.out, t, e.velocity * drums.volume);
        break;
      case 'hat':
        this.noiseHit(ctx, c.out, t, e.velocity * drums.volume * 0.16, 'highpass', 7500, 0.035);
        break;
      case 'openHat':
        this.noiseHit(ctx, c.out, t, e.velocity * drums.volume * 0.12, 'highpass', 6500, 0.22);
        break;
      case 'perc':
        this.perc(ctx, c.out, t, e.velocity * drums.volume, drums.percKind ?? 'tom');
        break;
      case 'bass':
        this.synth(ctx, c, style.bass.synth, e, t, stepSec);
        break;
      case 'arp':
        if (style.arp) this.synth(ctx, c, style.arp.synth, e, t, stepSec);
        break;
      case 'pad':
        if (style.pad) this.synth(ctx, c, style.pad.synth, e, t, stepSec);
        break;
      case 'lead':
        this.synth(ctx, c, style.lead.synth, e, t, stepSec);
        break;
    }
  }

  private synth(ctx: AudioContext, c: Playing, spec: SynthSpec, e: NoteEvent, t: number, stepSec: number): void {
    const freq = 440 * Math.pow(2, (e.midi + spec.octave * 12 - 69) / 12);
    const gateEnd = t + Math.max(spec.attack + 0.01, e.length * stepSec * (spec.gate ?? 1));
    const stopAt = gateEnd + spec.release * 5 + 0.05;
    const detunes = spec.detune ?? [0];
    const peak = (spec.volume * e.velocity) / Math.sqrt(detunes.length);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = spec.resonance ?? 0.7;
    if (spec.cutoffEnv) {
      filter.frequency.setValueAtTime(spec.cutoff + spec.cutoffEnv, t);
      filter.frequency.setTargetAtTime(spec.cutoff, t, Math.max(0.02, spec.decay / 2));
    } else {
      filter.frequency.value = spec.cutoff;
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + spec.attack);
    env.gain.setTargetAtTime(peak * spec.sustain, t + spec.attack, Math.max(0.01, spec.decay / 3));
    env.gain.setTargetAtTime(0, gateEnd, Math.max(0.01, spec.release / 3));

    const nodes: AudioNode[] = [filter, env];
    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (spec.vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = spec.vibrato.rate;
      lfoGain = ctx.createGain();
      // ビブラートは音の出だしから少し遅れてかける
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(spec.vibrato.depthCents, t + 0.25);
      lfo.connect(lfoGain);
      lfo.start(t);
      lfo.stop(stopAt);
      nodes.push(lfo, lfoGain);
    }
    const oscs: OscillatorNode[] = detunes.map((cents) => {
      const osc = ctx.createOscillator();
      osc.type = spec.wave;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      if (lfoGain) lfoGain.connect(osc.detune);
      osc.connect(filter);
      osc.start(t);
      osc.stop(stopAt);
      nodes.push(osc);
      return osc;
    });
    filter.connect(env).connect(c.out);
    if (spec.delaySend) {
      const send = ctx.createGain();
      send.gain.value = spec.delaySend;
      env.connect(send).connect(c.delayIn);
      nodes.push(send);
    }
    oscs[0]!.onended = () => {
      for (const n of nodes) n.disconnect();
    };
  }

  private kick(ctx: AudioContext, dest: AudioNode, t: number, vol: number, tone: number): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150 * tone, t);
    osc.frequency.exponentialRampToValueAtTime(45 * tone, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.85), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.35);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private snare(ctx: AudioContext, dest: AudioNode, t: number, vol: number): void {
    this.noiseHit(ctx, dest, t, vol * 0.32, 'highpass', 1400, 0.14);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(vol * 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private perc(ctx: AudioContext, dest: AudioNode, t: number, vol: number, kind: 'tom' | 'shaker' | 'clave'): void {
    if (kind === 'shaker') {
      this.noiseHit(ctx, dest, t, vol * 0.08, 'bandpass', 5500, 0.05);
      return;
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const tom = kind === 'tom';
    osc.type = tom ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(tom ? 230 : 2200, t);
    if (tom) osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    const len = tom ? 0.22 : 0.04;
    g.gain.setValueAtTime(vol * (tom ? 0.35 : 0.12), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + len + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noiseHit(ctx: AudioContext, dest: AudioNode, t: number, vol: number, type: BiquadFilterType, freq: number, len: number): void {
    const noise = this.audio.noise;
    if (!noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  dispose(): void {
    window.clearInterval(this.timer);
    this.fadeOutCurrent();
    this.pendingId = null;
    this.bus?.disconnect();
    this.compressor?.disconnect();
    this.bus = null;
    this.compressor = null;
    this.songCache.clear();
  }
}
