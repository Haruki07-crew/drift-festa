import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR, chordFor, composeSong, parsePattern } from '../src/audio/music/Composer';
import { COURSES } from '../src/config/courses';
import { MUSIC_STYLES, SCALES, musicConfig, type MusicStyleId } from '../src/config/music';
import { MENU_MUSIC_ID, MUSIC_THEMES, musicThemeFor } from '../src/config/musicThemes';
import { StorageManager, sanitizeSaveData } from '../src/storage/StorageManager';

const formBars = musicConfig.form.reduce((n, s) => n + s.bars, 0);

describe('BGM themes', () => {
  it('every course (and the menu) has its own theme', () => {
    expect(MUSIC_THEMES[MENU_MUSIC_ID]).toBeDefined();
    for (const c of COURSES) {
      expect(MUSIC_THEMES[c.id], c.id).toBeDefined();
      expect(musicThemeFor(c.id)).toBe(MUSIC_THEMES[c.id]);
    }
    // 未登録の ID はメニューの曲
    expect(musicThemeFor('no-such-course')).toBe(MUSIC_THEMES[MENU_MUSIC_ID]);
  });

  it('theme values are in sensible ranges', () => {
    for (const [id, t] of Object.entries(MUSIC_THEMES)) {
      expect(MUSIC_STYLES[t.style], id).toBeDefined();
      expect(t.bpm, id).toBeGreaterThanOrEqual(80);
      expect(t.bpm, id).toBeLessThanOrEqual(180);
      expect(t.root, id).toBeGreaterThanOrEqual(40);
      expect(t.root, id).toBeLessThanOrEqual(60);
      for (const d of [...t.progression, ...t.bProgression]) {
        expect(Number.isInteger(d) && d >= 0 && d < 7, `${id} degree ${d}`).toBe(true);
      }
    }
  });

  it('no two themes share the same seed (melodies differ)', () => {
    const seeds = Object.values(MUSIC_THEMES).map((t) => t.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('style patterns use valid characters and whole bars', () => {
    const check = (p: string, allowed: RegExp, label: string): void => {
      expect(p.length % STEPS_PER_BAR, label).toBe(0);
      expect(allowed.test(p), label).toBe(true);
    };
    for (const [id, s] of Object.entries(MUSIC_STYLES) as [MusicStyleId, (typeof MUSIC_STYLES)[MusicStyleId]][]) {
      const d = s.drums;
      for (const p of [d.kick, d.snare, d.hat, d.fill, d.openHat, d.perc]) if (p) check(p, /^[xX.]+$/, `${id} drums`);
      check(s.bass.pattern, /^[ROFT.-]+$/, `${id} bass`);
      if (s.arp) check(s.arp.pattern, /^[0-4.-]+$/, `${id} arp`);
      if (s.pad?.pattern) check(s.pad.pattern, /^[x.-]+$/, `${id} pad`);
      for (const r of s.lead.rhythms) {
        check(r, /^[x.-]+$/, `${id} lead`);
        expect(parsePattern(r).length, `${id} lead rhythm has notes`).toBeGreaterThan(0);
      }
    }
  });
});

describe('composer', () => {
  it('parses ties into note lengths', () => {
    expect(parsePattern('x--.x...........')).toEqual([
      { step: 0, length: 3, char: 'x' },
      { step: 4, length: 1, char: 'x' },
    ]);
    // 2小節パターンは小節番号で切り替わる
    const two = 'x...............' + '....x...........';
    expect(parsePattern(two, 1)[0]!.step).toBe(4);
  });

  it('builds chords from the scale', () => {
    // C メジャーの I = C E G、V = G B D (ルートは root〜root+11 にそろう)
    expect(chordFor(48, 'major', 0, 3)).toEqual([48, 52, 55]);
    expect(chordFor(48, 'major', 4, 3)).toEqual([55, 59, 62]);
    // 7 度を超える degree もオクターブを戻す
    expect(chordFor(48, 'minor', 5, 4)[0]).toBe(56);
  });

  it('is deterministic and follows the song form', () => {
    for (const id of Object.keys(MUSIC_THEMES)) {
      const a = composeSong(MUSIC_THEMES[id]!);
      const b = composeSong(MUSIC_THEMES[id]!);
      expect(JSON.stringify(a.bars), id).toBe(JSON.stringify(b.bars));
      expect(a.bars.length).toBe(formBars);
      expect(a.loopStartBar).toBe(musicConfig.form[0]!.bars);
      for (const bar of a.bars) expect(bar.steps.length).toBe(STEPS_PER_BAR);
    }
  });

  it('melody notes stay in the key and in range', () => {
    for (const [id, theme] of Object.entries(MUSIC_THEMES)) {
      const song = composeSong(theme);
      const classes = new Set(SCALES[theme.scale].map((i) => (theme.root + i) % 12));
      const [lo, hi] = song.style.lead.range;
      let leadNotes = 0;
      for (const bar of song.bars) {
        for (const step of bar.steps) {
          for (const e of step) {
            expect(e.velocity, id).toBeGreaterThan(0);
            expect(e.velocity, id).toBeLessThanOrEqual(1);
            expect(e.step + e.length, id).toBeLessThanOrEqual(STEPS_PER_BAR);
            if (e.voice !== 'lead') continue;
            leadNotes++;
            expect(classes.has(e.midi % 12), `${id} ${e.midi}`).toBe(true);
            expect(e.midi, id).toBeGreaterThanOrEqual(theme.root + lo);
            expect(e.midi, id).toBeLessThanOrEqual(theme.root + hi);
          }
        }
      }
      expect(leadNotes, id).toBeGreaterThan(40);
    }
  });

  it('intro has no melody, A section ends on the tonic, A2 starts like A', () => {
    const song = composeSong(MUSIC_THEMES['touge']!);
    const leadOf = (bar: number) => song.bars[bar]!.steps.flat().filter((e) => e.voice === 'lead');
    const intro = musicConfig.form[0]!.bars;
    for (let b = 0; b < intro; b++) expect(leadOf(b)).toEqual([]);
    const aStart = intro;
    const aEnd = aStart + 7;
    const last = leadOf(aEnd).at(-1)!;
    expect(last.midi % 12).toBe(song.bars[aEnd]!.chord[0]! % 12);
    const a2Start = aStart + 16;
    expect(song.bars[a2Start]!.section).toBe('A2');
    expect(leadOf(a2Start)).toEqual(leadOf(aStart));
  });

  it('different courses get different melodies', () => {
    const melody = (id: string) =>
      JSON.stringify(composeSong(MUSIC_THEMES[id]!).bars.map((b) => b.steps.flat().filter((e) => e.voice === 'lead').map((e) => [e.step, e.midi])));
    const all = COURSES.map((c) => melody(c.id));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('BGM volume setting', () => {
  it('has a default and is clamped when loaded', () => {
    const s = new StorageManager({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
    expect(s.settings.bgmVolume).toBe(musicConfig.defaultVolume);
    expect(sanitizeSaveData({ settings: { bgmVolume: 5 } }).settings.bgmVolume).toBe(1);
    expect(sanitizeSaveData({ settings: { bgmVolume: -1 } }).settings.bgmVolume).toBe(0);
    expect(sanitizeSaveData({ settings: { bgmVolume: 'x' } }).settings.bgmVolume).toBe(musicConfig.defaultVolume);
  });
});
