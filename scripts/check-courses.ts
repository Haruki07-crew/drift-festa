/**
 * コース形状の検証スクリプト。
 *   npm run check:courses            → 全長 / 最小半径 / 近接区間のクリアランス / 構造 (種類・CP・ジャンプ着地・
 *                                      NPC ライン) / Road Safety Corridor (地形・背景物の侵入) を検査
 *   npm run check:courses -- --ppm D → D/<course>.ppm に俯瞰図を出力 (確認用)
 *
 * 新しいコースを追加したら必ず実行し、コース同士の重なり (交差) がないか確認すること。
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COURSES } from '../src/config/courses';
import { Track } from '../src/courses/Track';
import { checkCourseScene } from './lib/courseSceneCheck';
import { checkCourseStructure } from './lib/courseStructureCheck';

const args = process.argv.slice(2);
const ppmIndex = args.indexOf('--ppm');
const ppmDir = ppmIndex >= 0 ? args[ppmIndex + 1] : undefined;
const printCps = args.includes('--cp');
/** --fast: 地形・背景物の侵入検査 (Road Safety Corridor) を省略 */
const fast = args.includes('--fast');
const only = args.find((a) => !a.startsWith('--') && a !== ppmDir);

let failed = false;

for (const def of COURSES) {
  if (only && def.id !== only) continue;
  const track = Track.build(def);
  if (printCps) {
    // 制御点ごとの周回上の割合 (ギミック配置の目安)
    const line = def.controlPoints
      .map((cp, i) => {
        const pr = track.project(cp.x, cp.z, undefined);
        return `P${i}=${(pr.s / track.length).toFixed(3)}`;
      })
      .join(' ');
    console.log(`${def.id} cp: ${line}`);
  }
  const n = track.samples.length;
  let maxK = 0;
  let maxKAt = 0;
  for (const s of track.samples) {
    if (Math.abs(s.curvature) > maxK) {
      maxK = Math.abs(s.curvature);
      maxKAt = s.s;
    }
  }
  // 近接チェック: 距離が離れた (周回上で 80m 以上) サンプル同士の水平距離
  let minClear = Infinity;
  let minPair = [0, 0];
  const step = 2;
  for (let i = 0; i < n; i += step) {
    const a = track.samples[i]!;
    for (let j = i + step; j < n; j += step) {
      const b = track.samples[j]!;
      if (Math.abs(track.deltaS(a.s, b.s)) < 80) continue;
      // 立体交差 (十分な高低差がある) は重なりとみなさない
      if (Math.abs(a.y - b.y) > 6) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z) - a.halfWidth - b.halfWidth - def.runoffWidth * 2;
      if (d < minClear) {
        minClear = d;
        minPair = [a.s, b.s];
      }
    }
  }
  const lapSecondsAt150 = track.raceLength / (150 / 3.6);
  const ok = minClear > 4;
  if (!ok) failed = true;
  console.log(
    `${def.id.padEnd(8)} [${track.closed ? 'circuit' : 'P2P'}] length=${track.length.toFixed(0)}m race=${track.raceLength.toFixed(0)}m samples=${n} ` +
      `minRadius=${(1 / maxK).toFixed(1)}m@s=${maxKAt.toFixed(0)} ` +
      `minClearance=${minClear.toFixed(1)}m (s=${minPair[0]!.toFixed(0)} vs ${minPair[1]!.toFixed(0)}) ` +
      `y=[${track.bounds.minY.toFixed(0)},${track.bounds.maxY.toFixed(0)}] ` +
      `${track.closed ? 'lap' : 'run'}@150kmh≈${lapSecondsAt150.toFixed(0)}s ${ok ? 'OK' : 'NG (overlap!)'}`,
  );

  const structure = checkCourseStructure(track);
  for (const issue of structure) {
    if (issue.level === 'NG') failed = true;
    console.log(`         structure: ${issue.level} ${issue.message}`);
  }
  if (structure.length === 0) console.log('         structure: OK');

  // Road Safety Corridor: 地形・背景物が走れる範囲に覆いかぶさっていないか
  if (!fast) {
    const intrusions = checkCourseScene(def);
    if (intrusions.length === 0) {
      console.log(`         road corridor: OK (地形・背景物の侵入なし)`);
    } else {
      failed = true;
      for (const r of intrusions) {
        console.log(
          `         road corridor: NG ${r.object} x${r.count} 最大 路面+${r.worst.height.toFixed(2)}m ` +
            `(s=${r.worst.s.toFixed(0)} 周回${((r.worst.s / track.length) * 100).toFixed(1)}% lateral=${r.worst.lateral.toFixed(1)})`,
        );
      }
    }
  }

  if (ppmDir) {
    const size = 600;
    const b = track.bounds;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 60;
    const scale = size / span;
    const img = new Uint8Array(size * size * 3).fill(30);
    const plot = (x: number, z: number, r: number, g: number, bl: number): void => {
      const px = Math.floor((x - b.minX + 30) * scale);
      const py = Math.floor((b.maxZ + 30 - z) * scale);
      if (px < 0 || py < 0 || px >= size || py >= size) return;
      const o = (py * size + px) * 3;
      img[o] = r;
      img[o + 1] = g;
      img[o + 2] = bl;
    };
    for (const s of track.samples) {
      for (let w = -s.halfWidth; w <= s.halfWidth; w += 1) {
        const shade = Math.floor(120 + ((s.y - b.minY) / (b.maxY - b.minY + 1e-6)) * 120);
        plot(s.x + s.rx * w, s.z + s.rz * w, shade, shade, shade);
      }
      const edgeColor = (e: string): [number, number, number] =>
        e === 'fall' ? [255, 60, 60] : e === 'grass' ? [60, 200, 60] : e === 'guardrail' ? [240, 240, 80] : [80, 160, 255];
      const [lr, lg, lb] = edgeColor(s.left);
      const [rr, rg, rb] = edgeColor(s.right);
      plot(s.x - s.rx * s.halfWidth, s.z - s.rz * s.halfWidth, lr, lg, lb);
      plot(s.x + s.rx * s.halfWidth, s.z + s.rz * s.halfWidth, rr, rg, rb);
    }
    for (let k = 0; k < 12; k++) {
      const s0 = track.samples[0]!;
      plot(s0.x + s0.rx * (k - 6), s0.z + s0.rz * (k - 6), 255, 0, 255);
    }
    const header = `P6 ${size} ${size} 255\n`;
    writeFileSync(join(ppmDir, `${def.id}.ppm`), Buffer.concat([Buffer.from(header), Buffer.from(img)]));
  }
}

if (failed) {
  process.exitCode = 1;
}
