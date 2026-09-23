/**
 * レース結果画面。順位・タイム・ベストラップ・使用車・コースを表示し、
 * もう一度 / 車を変更 / コースを変更 / タイトルへ戻る を選べる。
 * 一定時間操作がなければタイトルへ自動復帰 (設定で変更・無効化可能)。
 */
import { gameConfig } from '../../config/game';
import { formatRaceTime } from '../../game/RaceProgress';
import type { RaceResult } from '../../game/RaceSession';
import { el, setText } from '../dom';
import { Menu } from '../Menu';
import type { Screen, UIManager } from '../UIManager';

export interface ResultActions {
  retry: () => void;
  changeCar: () => void;
  changeCourse: () => void;
  title: () => void;
}

export interface RecordFlags {
  playerIndex: number;
  newRaceRecord: boolean;
  newLapRecord: boolean;
}

export function showResult(
  ui: UIManager,
  result: RaceResult,
  records: RecordFlags[],
  idleReturnSeconds: number,
  actions: ResultActions,
): void {
  const root = el('div', 'screen result-screen');
  const isBattle = result.setup.mode === 'battle';
  const humanWinner = result.entries[0]?.isHuman ?? false;

  const head = el('div', 'result-head');
  let title = 'RESULT';
  if (isBattle && result.battle) title = result.battle.won ? 'YOU WIN!' : 'YOU LOSE...';
  else if (humanWinner) title = result.setup.humanCarIds.length > 1 ? `P${(result.entries[0]?.playerIndex ?? 0) + 1} WIN!` : 'YOU WIN!';
  head.append(el('h2', `result-title ${humanWinner || result.battle?.won ? 'win' : ''}`, title));
  head.append(el('div', 'result-course', `${result.courseName} ・ ${isBattle ? 'BATTLE DUEL' : 'PURE RACE'} ・ ${gameConfig.laps} LAPS`));
  root.append(head);

  const table = el('table', 'result-table');
  const thead = el('thead');
  const hr = el('tr');
  for (const h of ['順位', 'ドライバー', '車', 'タイム', 'ベストラップ']) hr.append(el('th', '', h));
  thead.append(hr);
  table.append(thead);
  const tbody = el('tbody');
  for (const e of result.entries) {
    const tr = el('tr', e.isHuman ? `human p${e.playerIndex}` : '');
    tr.append(el('td', 'pos', String(e.position)));
    const name = el('td', 'name', e.name);
    const rec = records.find((r) => r.playerIndex === e.playerIndex && e.isHuman);
    if (rec?.newRaceRecord) name.append(el('span', 'badge', 'NEW RECORD'));
    tr.append(name);
    tr.append(el('td', 'car', e.carName));
    tr.append(el('td', 'time', e.finishTime !== null ? formatRaceTime(e.finishTime) : 'DNF'));
    const lap = el('td', 'lap', formatRaceTime(e.bestLap));
    if (rec?.newLapRecord) lap.append(el('span', 'badge', 'BEST LAP'));
    tr.append(lap);
    tbody.append(tr);
  }
  table.append(tbody);
  root.append(table);

  if (result.battle) {
    const b = result.battle;
    const acc = b.shotsFired > 0 ? Math.round((b.shotsHit / b.shotsFired) * 100) : 0;
    root.append(el('div', 'result-battle', `命中 ${b.shotsHit} / ${b.shotsFired} 発 (${acc}%) ・ 残りタイヤHP ${Math.ceil(b.playerHp)}`));
  }

  const menu = new Menu(
    {
      title: '',
      className: 'result-menu',
      columns: 4,
      options: [
        { label: 'もう一度', onSelect: actions.retry },
        { label: '車を変更', onSelect: actions.changeCar },
        { label: 'コースを変更', onSelect: actions.changeCourse },
        { label: 'タイトルへ', onSelect: actions.title },
      ],
      hint: '← → で選ぶ　Enter で決定',
    },
    ui.playSound,
  );
  root.append(menu.root);
  const idle = el('div', 'result-idle');
  root.append(idle);

  let idleTimer = idleReturnSeconds;
  const screen: Screen = {
    root,
    handleKey: (code) => {
      idleTimer = idleReturnSeconds;
      return menu.handleKey(code);
    },
    update: (dt) => {
      if (idleReturnSeconds <= 0) return;
      const sinceInput = (performance.now() - ui.lastInteraction) / 1000;
      idleTimer = idleReturnSeconds - sinceInput;
      setText(idle, idleTimer < 15 ? `${Math.max(0, Math.ceil(idleTimer))} 秒後にタイトルへ戻ります` : '');
      if (idleTimer <= 0) {
        idleTimer = Infinity;
        actions.title();
      }
      void dt;
    },
  };
  ui.show(screen);
}
