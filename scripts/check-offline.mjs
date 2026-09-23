/**
 * ビルド成果物 (dist/) に外部 URL への参照が含まれていないか検査する。
 *   npm run build && npm run check:offline
 *
 * XML 名前空間 (http://www.w3.org/...) など、通信を伴わない文字列は許可リストで除外する。
 * 実行時の通信ゼロの最終確認は README「オフライン検証」の手順 (DevTools で Offline) も行うこと。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
// jcgt.org: three.js のシェーダーコメント内の論文引用 (通信なし)
const ALLOW = [/^https:\/\/jcgt\.org\//, /^https?:\/\/www\.w3\.org\//, /^http:\/\/localhost/, /^https?:\/\/github\.com\/mrdoob\/three\.js/, /^https?:\/\/threejs\.org\/docs/];
const URL_RE = /\bhttps?:\/\/[^\s"'`)<>]+/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let files;
try {
  files = walk(DIST).filter((f) => /\.(html|js|css|json|svg)$/.test(f));
} catch {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(1);
}

const found = new Map();
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0];
    if (ALLOW.some((re) => re.test(url))) continue;
    if (!found.has(url)) found.set(url, f);
  }
}

if (found.size === 0) {
  console.log(`OK: ${files.length} ファイルを検査。外部 URL の参照はありません。`);
} else {
  console.log(`注意: 外部 URL らしき文字列が ${found.size} 件あります (コメントやエラーメッセージ内の場合は問題なし):`);
  for (const [url, f] of found) console.log(`  ${url}  (${f})`);
  process.exitCode = 1;
}
