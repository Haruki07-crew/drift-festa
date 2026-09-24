import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('offline runtime', () => {
  it('source code does not fetch external resources', () => {
    const files = [...walk('src'), 'index.html'].filter((f) => /\.(ts|css|html)$/.test(f));
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
      expect(text, f).not.toMatch(/\bfetch\(|XMLHttpRequest|@import url\(|fonts\.googleapis/);
    }
  });
});
