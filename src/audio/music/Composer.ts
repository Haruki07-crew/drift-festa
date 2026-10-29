/**
 * BGM の作曲 (音を鳴らさない純粋なロジック。テスト対象)。
 *
 * テーマ (config/musicThemes.ts) とジャンル (config/music.ts) から、曲全体の小節ごとの音符を組み立てる。
 * 乱数は seed から作るので、同じテーマなら毎回まったく同じ曲になる。
 *
 * メロディの作り方:
 * - 4小節のフレーズを作り、リズムは「1小節目・2小節目・1小節目・終わり」の形でくり返して覚えやすくする
 * - 強拍 (拍の頭) はその小節のコードの音、弱拍は前の音から近い音へ動く (跳びすぎない)
 * - 1つ目のフレーズはコードの5度などで「問いかけ」、2つ目は主音で「答え」で終わる
 */
import { MUSIC_STYLES, SCALES, musicConfig, type MusicLayer, type MusicSection, type MusicStylePreset, type ScaleId } from '../../config/music';
import type { MusicTheme } from '../../config/musicThemes';

export const STEPS_PER_BAR = 16;

export type MusicVoice = 'kick' | 'snare' | 'hat' | 'openHat' | 'perc' | 'bass' | 'arp' | 'pad' | 'lead';

export interface NoteEvent {
  voice: MusicVoice;
  /** 小節内の16分音符の位置 0..15 */
  step: number;
  /** 長さ [16分音符いくつぶん] */
  length: number;
  /** MIDI ノート番号 (ドラムは 0) */
  midi: number;
  /** 強さ 0..1 */
  velocity: number;
}

export interface ComposedBar {
  section: MusicSection['name'];
  /** この小節のコードの構成音 (MIDI) */
  chord: number[];
  /** step ごとの音符 (長さ 16) */
  steps: NoteEvent[][];
}

export interface ComposedSong {
  theme: MusicTheme;
  style: MusicStylePreset;
  bars: ComposedBar[];
  /** ループで戻る小節番号 */
  loopStartBar: number;
}

/** seed から再現できる乱数 (mulberry32) */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** スケールの degree 番目 (0 = 主音。7 以上は1オクターブ上) の音 */
export function degreeToMidi(root: number, scale: ScaleId, degree: number): number {
  const s = SCALES[scale];
  const octave = Math.floor(degree / s.length);
  const idx = ((degree % s.length) + s.length) % s.length;
  return root + octave * 12 + s[idx]!;
}

/**
 * スケールの degree 番目の音から3度ずつ積んだ和音。
 * ルートが root〜root+11 に入るようにそろえる (コードが変わっても音域が飛ばない)。
 */
export function chordFor(root: number, scale: ScaleId, degree: number, size: 3 | 4): number[] {
  const notes: number[] = [];
  for (let i = 0; i < size; i++) notes.push(degreeToMidi(root, scale, degree + i * 2));
  const shift = Math.floor((notes[0]! - root) / 12) * 12;
  return notes.map((n) => n - shift);
}

/** メロディに使う音の一覧 (low..high、ペンタトニックなら5音) */
export function melodyPitches(theme: MusicTheme, style: MusicStylePreset): number[] {
  const s = SCALES[theme.scale];
  let degrees = s.map((_, i) => i);
  if (style.lead.pentatonic) {
    // 長3度があれば メジャーペンタ (1 2 3 5 6)、なければ マイナーペンタ (1 b3 4 5 b7)
    degrees = s[2] === 4 ? [0, 1, 2, 4, 5] : [0, 2, 3, 4, 6];
  }
  const [lo, hi] = style.lead.range;
  const out: number[] = [];
  for (let oct = -1; oct <= 3; oct++) {
    for (const d of degrees) {
      const m = theme.root + oct * 12 + s[d]!;
      if (m >= theme.root + lo && m <= theme.root + hi) out.push(m);
    }
  }
  return out.sort((a, b) => a - b);
}

interface PatternHit {
  step: number;
  length: number;
  char: string;
}

/** リズム文字列を「どの step で鳴らし、何 step のばすか」に変換。barIndex で2小節以上のパターンにも対応 */
export function parsePattern(pattern: string, barIndex = 0): PatternHit[] {
  const bars = Math.max(1, Math.floor(pattern.length / STEPS_PER_BAR));
  const offset = (barIndex % bars) * STEPS_PER_BAR;
  const hits: PatternHit[] = [];
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const c = pattern[offset + i] ?? '.';
    if (c === '.' || c === '-') continue;
    let len = 1;
    while (i + len < STEPS_PER_BAR && pattern[offset + i + len] === '-') len++;
    hits.push({ step: i, length: len, char: c });
  }
  return hits;
}

function nearestIndex(pitches: readonly number[], target: number): number {
  let best = 0;
  for (let i = 1; i < pitches.length; i++) {
    if (Math.abs(pitches[i]! - target) < Math.abs(pitches[best]! - target)) best = i;
  }
  return best;
}

/** chord の音 (オクターブ違い含む) のうち、pitches の中で cur に近いものを選ぶ */
function chordToneNear(pitches: readonly number[], chord: readonly number[], cur: number, rng: () => number): number {
  const classes = new Set(chord.map((n) => ((n % 12) + 12) % 12));
  const candidates = pitches
    .map((p, i) => ({ p, i }))
    .filter((x) => classes.has(x.p % 12))
    .sort((a, b) => Math.abs(a.p - pitches[cur]!) - Math.abs(b.p - pitches[cur]!));
  if (candidates.length === 0) return cur;
  // 一番近い音を中心に、ときどき2番目 (同じ音の連続ばかりにならないように)
  const pick = candidates.length > 1 && rng() < 0.35 ? 1 : 0;
  return candidates[pick]!.i;
}

/** 4小節のメロディ。ending: 'open' = 問いかけ (5度・3度で終わる)、'close' = 答え (主音で終わる) */
function composePhrase(
  rng: () => number,
  pitches: readonly number[],
  chords: readonly number[][],
  rhythms: readonly number[],
  style: MusicStylePreset,
  ending: 'open' | 'close',
  startIndex: number,
): { events: NoteEvent[][]; lastIndex: number } {
  const out: NoteEvent[][] = [];
  let cur = startIndex;
  for (let b = 0; b < 4; b++) {
    const chord = chords[b]!;
    const hits = parsePattern(style.lead.rhythms[rhythms[b]!]!);
    const events: NoteEvent[] = [];
    hits.forEach((h, k) => {
      const lastOfPhrase = b === 3 && k === hits.length - 1;
      if (lastOfPhrase) {
        // フレーズの終わり: 答えは主音 (コードのルート)、問いかけはコードの他の音
        const targets = ending === 'close' ? [chord[0]!] : chord.slice(1, 3);
        const classes = new Set(targets.map((n) => n % 12));
        const options = pitches.map((p, i) => ({ p, i })).filter((x) => classes.has(x.p % 12));
        if (options.length > 0) {
          options.sort((x, y) => Math.abs(x.i - cur) - Math.abs(y.i - cur));
          cur = options[0]!.i;
        }
      } else if (h.step % 4 === 0) {
        cur = chordToneNear(pitches, chord, cur, rng);
      } else {
        const r = rng();
        const move = r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
        cur = Math.max(0, Math.min(pitches.length - 1, cur + move));
      }
      // 音域の端に張り付いたら中央へ戻す
      if (cur <= 0 || cur >= pitches.length - 1) cur = Math.max(1, Math.min(pitches.length - 2, cur));
      const accent = h.step % 4 === 0 ? 1 : 0.8;
      events.push({ voice: 'lead', step: h.step, length: h.length, midi: pitches[cur]!, velocity: accent });
    });
    out.push(events);
  }
  return { events: out, lastIndex: cur };
}

function emptySteps(): NoteEvent[][] {
  return Array.from({ length: STEPS_PER_BAR }, () => []);
}

function velocityOf(c: string): number {
  return c === 'X' ? 1 : 0.72;
}

/** 曲全体を組み立てる */
export function composeSong(theme: MusicTheme): ComposedSong {
  const style = MUSIC_STYLES[theme.style];
  const rng = createRng(theme.seed);
  const pitches = melodyPitches(theme, style);
  const chordOf = (degree: number): number[] => chordFor(theme.root, theme.scale, degree, style.chordSize);

  // セクションごとのメロディ (A と A2 は前半が同じで覚えやすく、後半だけ変える)
  const rhythmCount = style.lead.rhythms.length;
  const pickRhythms = (): number[] => {
    const a = Math.floor(rng() * rhythmCount);
    const b = Math.floor(rng() * rhythmCount);
    const end = Math.floor(rng() * rhythmCount);
    return [a, b, a, end];
  };
  const progChords = (prog: readonly number[]): number[][] => [0, 1, 2, 3].map((i) => chordOf(prog[i % prog.length]!));
  // メロディは主音の1オクターブ上あたりから始める
  const mid = nearestIndex(pitches, theme.root + 12);

  const melodyFor = (prog: readonly number[]): NoteEvent[][] => {
    const chords = progChords(prog);
    const rhythms = pickRhythms();
    const first = composePhrase(rng, pitches, chords, rhythms, style, 'open', mid);
    // 後半: 同じリズムで始め、最後の小節だけ変えて答える
    const secondRhythms = [rhythms[0]!, rhythms[1]!, rhythms[2]!, Math.floor(rng() * rhythmCount)];
    const second = composePhrase(rng, pitches, chords, secondRhythms, style, 'close', first.lastIndex);
    return [...first.events, ...second.events];
  };
  const melodyA = melodyFor(theme.progression);
  const melodyB = melodyFor(theme.bProgression);
  const melodyA2 = [...melodyA.slice(0, 4), ...melodyFor(theme.progression).slice(4)];

  const bars: ComposedBar[] = [];
  let loopStartBar = 0;
  musicConfig.form.forEach((section, sIdx) => {
    if (sIdx === musicConfig.loopFrom) loopStartBar = bars.length;
    const prog = section.progression === 'b' ? theme.bProgression : theme.progression;
    const melody = section.name === 'A' ? melodyA : section.name === 'B' ? melodyB : section.name === 'A2' ? melodyA2 : null;
    for (let b = 0; b < section.bars; b++) {
      const chord = chordOf(prog[b % prog.length]!);
      const steps = emptySteps();
      const has = (l: MusicLayer): boolean => section.layers.includes(l);
      const add = (e: NoteEvent): void => {
        steps[e.step]!.push(e);
      };
      const lastBar = b === section.bars - 1;

      // ドラム
      const d = style.drums;
      if (has('kick')) for (const h of parsePattern(d.kick, b)) add({ voice: 'kick', step: h.step, length: 1, midi: 0, velocity: velocityOf(h.char) });
      if (has('snare')) {
        for (const h of parsePattern(lastBar ? d.fill : d.snare, b)) add({ voice: 'snare', step: h.step, length: 1, midi: 0, velocity: velocityOf(h.char) });
      }
      if (has('hat')) {
        for (const h of parsePattern(d.hat, b)) add({ voice: 'hat', step: h.step, length: 1, midi: 0, velocity: velocityOf(h.char) * (0.8 + rng() * 0.2) });
        if (d.openHat) for (const h of parsePattern(d.openHat, b)) add({ voice: 'openHat', step: h.step, length: 1, midi: 0, velocity: velocityOf(h.char) });
      }
      if (has('perc') && d.perc) for (const h of parsePattern(d.perc, b)) add({ voice: 'perc', step: h.step, length: 1, midi: 0, velocity: velocityOf(h.char) * (0.75 + rng() * 0.25) });

      // ベース
      if (has('bass')) {
        const low = chord[0]!;
        for (const h of parsePattern(style.bass.pattern, b)) {
          const midi = h.char === 'O' ? low + 12 : h.char === 'F' ? low + 7 : h.char === 'T' ? chord[1]! : low;
          add({ voice: 'bass', step: h.step, length: h.length, midi, velocity: 0.9 });
        }
      }
      // アルペジオ
      if (has('arp') && style.arp) {
        for (const h of parsePattern(style.arp.pattern, b)) {
          const n = Number(h.char);
          if (!Number.isFinite(n)) continue;
          const midi = chord[n % chord.length]! + 12 * Math.floor(n / chord.length);
          add({ voice: 'arp', step: h.step, length: h.length, midi, velocity: h.step % 4 === 0 ? 0.9 : 0.7 });
        }
      }
      // パッド (コード)
      if (has('pad') && style.pad) {
        for (const h of parsePattern(style.pad.pattern ?? 'x---------------', b)) {
          for (const n of chord) add({ voice: 'pad', step: h.step, length: h.length, midi: n, velocity: 0.8 });
        }
      }
      // メロディ
      if (has('lead') && melody) {
        for (const e of melody[b % melody.length]!) add(e);
      }
      bars.push({ section: section.name, chord, steps });
    }
  });

  return { theme, style, bars, loopStartBar };
}
