/**
 * 周回・チェックポイント・順位・タイム差の計算 (純粋ロジック。テスト対象)。
 *
 * - 見えないチェックポイントを順番に通過した場合のみ周回として認める
 *   → 逆走による不正周回・スタートライン往復・大幅ショートカットを防止
 * - 順位は「周回数 → 通過チェックポイント → 次チェックポイントまでの進行度」で算出
 * - Point to Point (closed = false): チェックポイントの最後がゴールライン。周回はなく、
 *   スタートライン通過で計時開始 → 中間チェックポイントを順に通過 → ゴールライン通過でゴール
 * - タイム差は、前の車が自分の現在地点を通過した時刻との差で算出 (+1.42s 表示用)
 */

export interface CourseTiming {
  /** 1周の長さ [m] (Point to Point は道全体の長さ) */
  length: number;
  /**
   * チェックポイントの s 位置 (0番 = スタートライン、等間隔)。
   * Point to Point では最後の要素がゴールライン。
   */
  checkpoints: readonly number[];
  /** 周回数 (Point to Point は 1) */
  laps: number;
  /** 周回コースか (省略時 true)。false = Point to Point */
  closed?: boolean;
  /** 1フレームでこれ以上 s が飛んだらワープ/ショートカットとみなし、通過判定しない [m] */
  maxStep: number;
}

/** タイム差計算用の記録間隔 [m] */
export const TIMING_MARK_SPACING = 5;

export class RaceProgress {
  readonly timing: CourseTiming;
  /** 通過したチェックポイントの総数 (最初のスタートライン通過で 1) */
  passed = 0;
  /** 現在の周回 (0 = スタート前、1..laps) */
  lap = 0;
  finished = false;
  finishTime: number | null = null;
  lapStartTime = 0;
  bestLap: number | null = null;
  lapTimes: number[] = [];
  /** 最後に取得した s */
  private lastS: number | null = null;
  /** 最後の進行度 (チェックポイント単位の連続値) */
  progressKey = 0;
  /** レース距離の目盛りごとの通過時刻 */
  private readonly marks: Float64Array;
  private highestMark = -1;

  constructor(timing: CourseTiming) {
    this.timing = timing;
    const totalMarks = Math.ceil(((timing.laps + 1) * timing.length) / TIMING_MARK_SPACING) + 4;
    this.marks = new Float64Array(totalMarks).fill(NaN);
  }

  get checkpointCount(): number {
    return this.timing.checkpoints.length;
  }

  get closed(): boolean {
    return this.timing.closed !== false;
  }

  /** 次に通過すべきチェックポイント番号 */
  get nextCheckpoint(): number {
    if (!this.closed) return Math.min(this.passed, this.checkpointCount - 1);
    return this.passed % this.checkpointCount;
  }

  /** 最後に通過したチェックポイント番号 (スタート前は -1) */
  get lastCheckpoint(): number {
    if (this.passed === 0) return -1;
    if (!this.closed) return Math.min(this.passed - 1, this.checkpointCount - 1);
    return (this.passed - 1) % this.checkpointCount;
  }

  /** HUD表示用の周回 (1..laps) */
  get displayLap(): number {
    return Math.min(this.timing.laps, Math.max(1, this.lap));
  }

  /** チェックポイント間隔 [m] */
  get segmentLength(): number {
    if (!this.closed) {
      const cps = this.timing.checkpoints;
      return (cps[cps.length - 1]! - cps[0]!) / Math.max(1, cps.length - 1);
    }
    return this.timing.length / this.checkpointCount;
  }

  /** スタートからゴールまでの総距離 [m] */
  get totalDistance(): number {
    if (!this.closed) return this.segmentLength * (this.checkpointCount - 1);
    return this.timing.length * this.timing.laps;
  }

  /** レースの進み具合 0..1 (ゴール = 1) */
  get completion(): number {
    if (this.finished) return 1;
    return clamp01(this.raceDistance / this.totalDistance);
  }

  /** ゴールまでの残り距離 [m] */
  get remainingDistance(): number {
    return Math.max(0, this.totalDistance - Math.max(0, this.raceDistance));
  }

  /**
   * 現在の区間番号 (Point to Point の HUD 用)。スタート前 = 0、区間 1..(checkpointCount - 1)。
   */
  get section(): number {
    if (this.passed === 0) return 0;
    return Math.min(this.passed, this.checkpointCount - 1);
  }

  /** レース距離 [m] (スタートラインからの累積。スタート前はマイナス) */
  get raceDistance(): number {
    return (this.progressKey - 1) * this.segmentLength;
  }

  /**
   * 毎フレーム呼ぶ。
   * @param s コース上の位置
   * @param onTrack コース付近にいるか (大きく外れている場合は通過判定しない)
   * @param time レース経過時間 [s]
   * @returns このフレームで周回が完了した場合 true
   */
  update(s: number, onTrack: boolean, time: number): boolean {
    let lapCompleted = false;
    if (!this.finished && this.lastS !== null && onTrack) {
      const step = this.delta(this.lastS, s);
      if (step > 0 && step <= this.timing.maxStep) {
        const cpS = this.timing.checkpoints[this.nextCheckpoint]!;
        const a = this.delta(this.lastS, cpS);
        if (a >= 0 && a < step) {
          lapCompleted = this.passCheckpoint(time);
        }
      }
    }
    this.lastS = s;
    this.updateProgressKey(s);
    this.recordMarks(time);
    return lapCompleted;
  }

  /** 復帰 (ワープ) 時に呼ぶ。通過判定を行わずに位置だけ更新 */
  teleport(s: number): void {
    this.lastS = s;
    this.updateProgressKey(s);
  }

  private passCheckpoint(time: number): boolean {
    const cp = this.nextCheckpoint;
    this.passed++;
    if (!this.closed) return this.passPointToPoint(cp, time);
    if (cp !== 0) {
      return false;
    }
    // スタートライン通過
    if (this.lap === 0) {
      this.lap = 1;
      this.lapStartTime = time;
      return false;
    }
    const lapTime = time - this.lapStartTime;
    this.lapTimes.push(lapTime);
    if (this.bestLap === null || lapTime < this.bestLap) {
      this.bestLap = lapTime;
    }
    this.lapStartTime = time;
    if (this.lap >= this.timing.laps) {
      this.finished = true;
      this.finishTime = time;
    } else {
      this.lap++;
    }
    return true;
  }

  /** Point to Point: 0番 = スタート (計時開始)、最後 = ゴール */
  private passPointToPoint(cp: number, time: number): boolean {
    if (cp === 0) {
      this.lap = 1;
      this.lapStartTime = time;
      return false;
    }
    if (cp < this.checkpointCount - 1) return false;
    const total = time - this.lapStartTime;
    this.lapTimes.push(total);
    this.bestLap = total;
    this.finished = true;
    this.finishTime = time;
    return true;
  }

  /** from から to への符号付き距離 (周回コースは周回を考慮) */
  private delta(from: number, to: number): number {
    return this.closed ? deltaS(from, to, this.timing.length) : to - from;
  }

  private updateProgressKey(s: number): void {
    if (this.finished) {
      return;
    }
    const nextS = this.timing.checkpoints[this.nextCheckpoint]!;
    const toNext = this.delta(s, nextS);
    const seg = this.segmentLength;
    const frac = clamp01(1 - toNext / seg);
    this.progressKey = this.passed + frac;
  }

  private recordMarks(time: number): void {
    const d = this.raceDistance;
    if (d < 0) return;
    const mark = Math.min(this.marks.length - 1, Math.floor(d / TIMING_MARK_SPACING));
    for (let m = this.highestMark + 1; m <= mark; m++) {
      this.marks[m] = time;
    }
    if (mark > this.highestMark) this.highestMark = mark;
  }

  /** このレース距離の地点を通過した時刻 (未通過なら NaN) */
  timeAtDistance(distance: number): number {
    if (distance < 0) return NaN;
    const mark = Math.floor(distance / TIMING_MARK_SPACING);
    if (mark > this.highestMark || mark >= this.marks.length) return NaN;
    return this.marks[mark]!;
  }

  /** 現在の周回タイム */
  currentLapTime(time: number): number {
    return this.lap === 0 ? 0 : time - this.lapStartTime;
  }
}

export interface RankEntry {
  id: number;
  progress: RaceProgress;
}

/**
 * 順位を計算する。ゴール済みはゴール時刻順、それ以外は進行度順。
 * @returns 順位順に並んだ id 配列
 */
export function computeRanking(entries: readonly RankEntry[]): number[] {
  const sorted = entries.slice().sort((a, b) => {
    const pa = a.progress;
    const pb = b.progress;
    if (pa.finished && pb.finished) {
      return (pa.finishTime ?? 0) - (pb.finishTime ?? 0);
    }
    if (pa.finished) return -1;
    if (pb.finished) return 1;
    if (pb.progressKey !== pa.progressKey) return pb.progressKey - pa.progressKey;
    return a.id - b.id;
  });
  return sorted.map((e) => e.id);
}

/**
 * タイム差 [s]: 前の車 (ahead) が自分 (me) の現在地点を通過してからの経過時間。
 * 計算できない場合は null。
 */
export function computeGap(me: RaceProgress, ahead: RaceProgress, time: number): number | null {
  const myDistance = me.raceDistance;
  if (me.finished && ahead.finished && me.finishTime !== null && ahead.finishTime !== null) {
    return me.finishTime - ahead.finishTime;
  }
  if (myDistance < 0) return null;
  const t = ahead.timeAtDistance(myDistance);
  if (Number.isNaN(t)) return null;
  return Math.max(0, time - t);
}

export function formatGap(gap: number | null): string {
  if (gap === null) return '--';
  return `+${gap.toFixed(2)}s`;
}

/** 1:23.456 形式 */
export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--:--.---';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

function deltaS(from: number, to: number, length: number): number {
  let d = (to - from) % length;
  if (d > length / 2) d -= length;
  else if (d < -length / 2) d += length;
  return d;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
