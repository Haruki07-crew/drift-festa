/**
 * コース選択画面 (v3)。
 *
 * 1. コースのタイプをえらぶ (CIRCUIT 周回コース / POINT TO POINT 一本道)
 * 2. そのタイプのコースをカードで選ぶ (やさしい順)。
 *    カード: 名前・★・距離・目安タイム・特徴のアイコン。横の詳細: コース図・見どころ・説明・攻略・ベストタイム
 */
import { CARS } from '../../config/cars';
import { RACE_TYPE_LABELS, STAR_LABELS } from '../../config/courseInfo';
import { COURSES, type CourseDef, type RaceType } from '../../config/courses';
import { courseSummary, formatApproxTime, formatKm } from '../../courses/CourseInfo';
import { Track } from '../../courses/Track';
import { formatRaceTime } from '../../game/RaceProgress';
import type { StorageManager } from '../../storage/StorageManager';
import { el } from '../dom';
import type { UIManager } from '../UIManager';

const TYPES: RaceType[] = ['circuit', 'pointToPoint'];
const PREVIEW_SIZE = 220;

function carName(id: string): string {
  return CARS.find((c) => c.id === id)?.name ?? id;
}

function stars(n: number): string {
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

export class CourseSelect {
  private readonly ui: UIManager;
  private readonly storage: StorageManager;
  private readonly previewCache = new Map<string, HTMLCanvasElement>();

  constructor(ui: UIManager, storage: StorageManager) {
    this.ui = ui;
    this.storage = storage;
  }

  /** コースのタイプ選択から始める */
  show(onPick: (courseId: string) => void, onBack: () => void): void {
    const pref = COURSES.find((c) => c.id === this.storage.prefs.courseId);
    const initialType = pref?.raceType ?? 'circuit';
    this.showTypes(initialType, onPick, onBack);
  }

  private showTypes(focus: RaceType, onPick: (courseId: string) => void, onBack: () => void): void {
    this.ui.showMenu({
      title: 'コースのタイプをえらぶ',
      subtitle: `全${COURSES.length}コース`,
      className: 'course-type-menu',
      columns: 2,
      initialIndex: TYPES.indexOf(focus),
      options: TYPES.map((type) => {
        const list = COURSES.filter((c) => c.raceType === type);
        const info = RACE_TYPE_LABELS[type];
        const extra = el('div', 'course-type-desc');
        extra.append(el('div', 'course-type-text', info.description));
        extra.append(el('div', 'course-type-count', `${list.length} コース`));
        return {
          label: info.name,
          sub: type === 'circuit' ? '3周レース' : 'スタート → ゴール',
          extra,
          className: `course-type ${type}`,
          onSelect: () => this.showList(type, onPick, () => this.showTypes(type, onPick, onBack)),
        };
      }),
      onBack,
    });
  }

  private showList(type: RaceType, onPick: (courseId: string) => void, onBack: () => void): void {
    const list = COURSES.filter((c) => c.raceType === type)
      .slice()
      .sort((a, b) => a.difficultyStars - b.difficultyStars);
    const pref = this.storage.prefs.courseId;
    const side = el('div', 'course-detail');
    const renderDetail = (i: number): void => this.renderDetail(side, list[i]!);
    this.ui.showMenu({
      title: RACE_TYPE_LABELS[type].name,
      subtitle: `${RACE_TYPE_LABELS[type].description} (やさしい順)`,
      className: `course-menu ${type}`,
      columns: 3,
      initialIndex: Math.max(0, list.findIndex((c) => c.id === pref)),
      side,
      onFocus: renderDetail,
      options: list.map((c) => {
        const sum = courseSummary(c);
        const extra = el('div', 'course-card-extra');
        extra.append(el('div', 'course-card-meta', `${formatKm(sum.totalDistance)} ・ ${formatApproxTime(sum.estimatedSeconds)}`));
        const icons = el('div', 'course-card-icons');
        for (const b of sum.badges.slice(0, 5)) {
          const span = el('span', 'course-icon', b.icon);
          span.title = b.label;
          icons.append(span);
        }
        extra.append(icons);
        return {
          label: c.name,
          sub: stars(c.difficultyStars),
          extra,
          className: `course-card stars-${c.difficultyStars}`,
          onSelect: () => {
            this.storage.updatePrefs({ courseId: c.id });
            onPick(c.id);
          },
        };
      }),
      onBack,
    });
  }

  private renderDetail(side: HTMLElement, c: CourseDef): void {
    const sum = courseSummary(c);
    side.replaceChildren();
    const head = el('div', 'course-detail-head');
    head.append(el('span', `course-type-badge ${c.raceType}`, RACE_TYPE_LABELS[c.raceType].short));
    head.append(el('span', 'course-detail-stars', `${stars(c.difficultyStars)} ${STAR_LABELS[c.difficultyStars] ?? ''}`));
    side.append(el('div', 'course-detail-name', c.name), head);
    side.append(this.preview(c));
    if (c.highlight) side.append(el('div', 'course-detail-highlight', `見どころ: ${c.highlight}`));
    side.append(el('div', 'course-detail-desc', c.description));
    const facts = el('div', 'course-detail-facts');
    const dist = c.raceType === 'circuit' ? `1周 ${formatKm(sum.raceLength)} × ${sum.laps}周` : `スタート→ゴール ${formatKm(sum.raceLength)}`;
    facts.append(el('div', '', dist), el('div', '', `目安タイム ${formatApproxTime(sum.estimatedSeconds)}`));
    side.append(facts);
    const badges = el('div', 'course-detail-badges');
    for (const b of sum.badges) badges.append(el('span', 'course-badge', `${b.icon} ${b.label}`));
    side.append(badges);
    if (c.tips) side.append(el('div', 'course-detail-tips', `攻略: ${c.tips}`));
    const best = this.storage.getBest(c.id);
    const bt = el('div', 'course-best');
    bt.append(el('div', '', `ベストタイム ${formatRaceTime(best.raceTime)}${best.raceCarId ? ` (${carName(best.raceCarId)})` : ''}`));
    if (c.raceType === 'circuit') {
      bt.append(el('div', '', `ベストラップ ${formatRaceTime(best.bestLap)}${best.bestLapCarId ? ` (${carName(best.bestLapCarId)})` : ''}`));
    }
    side.append(bt);
  }

  /** コース図 (高さで色分け。Point to Point はスタートとゴールを表示) */
  private preview(def: CourseDef): HTMLCanvasElement {
    const cached = this.previewCache.get(def.id);
    if (cached) return cached;
    const track = Track.build(def);
    const size = PREVIEW_SIZE;
    const canvas = el('canvas', 'course-preview');
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      const b = track.bounds;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      const scale = (size - 24) / span;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const yr = Math.max(1, b.maxY - b.minY);
      const map = (x: number, z: number): [number, number] => [size / 2 - (x - cx) * scale, size / 2 - (z - cz) * scale];
      ctx.lineCap = 'round';
      for (let i = 0; i < track.segmentCount; i++) {
        const a = track.samples[i]!;
        const c = track.samples[track.nextIndex(i)]!;
        const h = (a.y - b.minY) / yr;
        ctx.strokeStyle = `hsl(${200 - h * 160}, 90%, ${60 + h * 10}%)`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(...map(a.x, a.z));
        ctx.lineTo(...map(c.x, c.z));
        ctx.stroke();
      }
      const dot = (s: number, color: string, label?: string): void => {
        const p = track.pointAt(s);
        const [x, y] = map(p.x, p.z);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        if (label) {
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          // 図の端で文字が切れないように内側へ寄せる
          const tx = Math.max(20, Math.min(size - 20, x));
          const ty = Math.max(12, y - 9);
          ctx.strokeText(label, tx, ty);
          ctx.fillText(label, tx, ty);
        }
      };
      if (track.closed) dot(track.startS, '#ffffff');
      else {
        dot(track.startS, '#3dff8a', 'START');
        dot(track.goalS, '#ff4f79', 'GOAL');
      }
    }
    this.previewCache.set(def.id, canvas);
    return canvas;
  }
}
