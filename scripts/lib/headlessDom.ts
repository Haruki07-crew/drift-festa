/**
 * Node でコースの描画データ (CourseView) を組み立てるための最小限の document スタブ。
 * Canvas は getContext が null を返すので、テクスチャ生成は色なしで進む (検査には影響しない)。
 */
export function installHeadlessDom(): void {
  const g = globalThis as unknown as { document?: unknown; window?: unknown };
  if (g.document) return;
  const fakeCanvas = (): Record<string, unknown> => ({
    width: 0,
    height: 0,
    style: {},
    getContext: () => null,
    addEventListener: () => undefined,
  });
  g.document = { createElement: () => fakeCanvas(), createElementNS: () => fakeCanvas() };
  g.window = g.window ?? { devicePixelRatio: 1 };
}
