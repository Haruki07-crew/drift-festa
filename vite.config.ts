import { defineConfig } from 'vitest/config';

// 文化祭用: 全アセットをビルド成果物に同梱し、実行時の外部通信を一切行わない。
export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __FESTIVAL__: JSON.stringify(mode === 'festival'),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: mode !== 'festival',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
