import { describe, expect, it } from 'vitest';
import type { Board } from '../core/game/engine.ts';
import { cellAt, generateBoard } from '../core/game/engine.ts';
import type { ErrorMode } from '../core/game/scoring.ts';
import { DEFAULT_SCORING, cellAward } from '../core/game/scoring.ts';
import type { Session } from '../core/game/session.ts';
import {
  boardElapsedMs,
  cellElapsedMs,
  cellProgress,
  checkBoard,
  clearActive,
  countTasks,
  focusCell,
  hintView,
  startSession,
  submitValue,
  takeHint,
  taskTimings,
  toggleActiveNote,
  unsolvedCount,
} from '../core/game/session.ts';
import { ALL_TOPICS } from '../core/tasks/types.ts';

const config = DEFAULT_SCORING;

function board(seed: string): Board {
  return generateBoard({
    size: 9,
    topics: ALL_TOPICS,
    taskDifficulty: 3,
    boardDifficulty: 2,
    seed,
  });
}

function session(seed: string, mode: ErrorMode, now = 0): Session {
  return startSession({ board: board(seed), mode, now });
}

/** Et galt, men lovlig, tall for cellen. */
function wrongValue(current: number, size: number): number {
  return current === size ? 1 : current + 1;
}

/** Spiller gjennom hele brettet med riktige svar. */
function playThrough(start: Session, msPerCell: number): Session {
  let s = start;
  let now = s.startedAt;
  for (const cell of start.board.cells) {
    if (cell.given) continue;
    s = focusCell(s, cell.row, cell.col, now);
    now += msPerCell;
    s = submitValue(s, cell.solution, now);
  }
  return s;
}

describe('spilløkt: oppstart', () => {
  it('starter på første celle med oppgave og med klokken i gang', () => {
    const s = session('start', 'streng', 1_000);
    expect(s.status).toBe('spiller');
    expect(s.active).not.toBeNull();
    expect(s.score.points).toBe(0);
    expect(s.score.livesLeft).toBe(config.lives);

    if (s.active === null) return;
    const cell = cellAt(s.board, s.active.row, s.active.col);
    expect(cell.given).toBe(false);
    expect(cellProgress(s, s.active.row, s.active.col).activeSince).toBe(1_000);
  });

  it('teller celler med oppgave', () => {
    const s = session('telling', 'rolig');
    expect(countTasks(s.board)).toBe(unsolvedCount(s));
    expect(countTasks(s.board)).toBeGreaterThan(0);
  });
});

describe('spilløkt: klokker', () => {
  it('lar brettklokken gå og stopper den når brettet er ferdig', () => {
    const s = session('klokke', 'rolig', 0);
    expect(boardElapsedMs(s, 5_000)).toBe(5_000);

    const ferdig = playThrough(s, 1_000);
    expect(ferdig.status).toBe('fullført');
    const stoppet = boardElapsedMs(ferdig, 999_999);
    expect(stoppet).toBe(ferdig.finishedAt);
  });

  it('teller bare tid på cellen som er aktiv', () => {
    const s0 = session('celleklokke', 'rolig', 0);
    const a = s0.board.cells.filter((cell) => !cell.given);
    const first = a[0];
    const second = a[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;

    let s = focusCell(s0, first.row, first.col, 0);
    // Ti sekunder på den første cellen.
    s = focusCell(s, second.row, second.col, 10_000);

    expect(cellElapsedMs(s, first.row, first.col, 30_000)).toBe(10_000);
    // Den andre cellen har bare gått i 20 sekunder av de 30.
    expect(cellElapsedMs(s, second.row, second.col, 30_000)).toBe(20_000);
  });

  it('summerer tiden når man kommer tilbake til en celle', () => {
    const s0 = session('retur', 'rolig', 0);
    const open = s0.board.cells.filter((cell) => !cell.given);
    const a = open[0];
    const b = open[1];
    if (a === undefined || b === undefined) return;

    let s = focusCell(s0, a.row, a.col, 0);
    s = focusCell(s, b.row, b.col, 4_000);
    s = focusCell(s, a.row, a.col, 9_000);
    expect(cellElapsedMs(s, a.row, a.col, 11_000)).toBe(4_000 + 2_000);
  });

  it('lagrer tiden cellen tok da den ble løst', () => {
    const s0 = session('lagret-tid', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, target.solution, 7_500);

    const progress = cellProgress(s, target.row, target.col);
    expect(progress.solvedMs).toBe(7_500);
    // Klokken skal ikke gå videre på en løst celle.
    expect(cellElapsedMs(s, target.row, target.col, 60_000)).toBe(7_500);
  });
});

describe('spilløkt: streng modus', () => {
  it('markerer feil med én gang og koster ett liv', () => {
    const s0 = session('streng', 'streng', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, wrongValue(target.solution, s.board.size), 1_000);

    expect(cellAt(s.board, target.row, target.col).status).toBe('konflikt');
    expect(s.score.livesLeft).toBe(config.lives - 1);
    expect(s.score.mistakes).toBe(1);
    expect(s.score.points).toBe(-config.wrongPenalty);
    expect(s.status).toBe('spiller');
  });

  it('krever ikke at feilen bryter en sudokuregel for å bli markert', () => {
    const s0 = session('streng-uten-kollisjon', 'streng', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    // Finn et galt tall som ikke allerede står i rad, kolonne eller blokk.
    const taken = new Set<number>();
    for (let i = 0; i < s0.board.size; i += 1) {
      taken.add(cellAt(s0.board, target.row, i).solution);
      taken.add(cellAt(s0.board, i, target.col).solution);
    }
    const harmless = Array.from({ length: s0.board.size }, (_u, i) => i + 1).find(
      (v) => v !== target.solution && !taken.has(v),
    );

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, harmless ?? wrongValue(target.solution, s0.board.size), 1_000);
    expect(cellAt(s.board, target.row, target.col).status).toBe('konflikt');
    expect(s.score.mistakes).toBe(1);
  });

  it('avslutter spillet når livene er brukt opp', () => {
    const s0 = session('tapt', 'streng', 0);
    const open = s0.board.cells.filter((cell) => !cell.given);
    let s = s0;
    let now = 0;

    for (let i = 0; i < config.lives; i += 1) {
      const cell = open[i];
      if (cell === undefined) break;
      now += 1_000;
      s = focusCell(s, cell.row, cell.col, now);
      s = submitValue(s, wrongValue(cell.solution, s.board.size), now + 500);
    }

    expect(s.score.livesLeft).toBe(0);
    expect(s.status).toBe('tapt');
    expect(s.finishedAt).not.toBeNull();

    // Ingen flere trekk godtas.
    const etter = submitValue(s, 1, now + 5_000);
    expect(etter).toBe(s);
  });

  it('trekker ikke to ganger for det samme gale svaret', () => {
    const s0 = session('dobbelttrekk', 'streng', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;
    const wrong = wrongValue(target.solution, s0.board.size);

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, wrong, 1_000);
    const etterFørste = s.score.livesLeft;
    s = submitValue(s, wrong, 2_000);

    expect(s.score.livesLeft).toBe(etterFørste);
    expect(s.score.mistakes).toBe(1);
  });
});

describe('spilløkt: rolig modus', () => {
  it('markerer ingenting før man sjekker', () => {
    const s0 = session('rolig', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, wrongValue(target.solution, s.board.size), 1_000);

    expect(s.showErrors).toBe(false);
    expect(cellAt(s.board, target.row, target.col).status).toBe('fylt');
    expect(s.score.mistakes).toBe(0);
    expect(s.score.points).toBe(0);

    const sjekket = checkBoard(s, 2_000);
    expect(sjekket.showErrors).toBe(true);
    expect(cellAt(sjekket.board, target.row, target.col).status).toBe('konflikt');
    expect(sjekket.score.mistakes).toBe(1);
    // Rolig modus koster ikke liv.
    expect(sjekket.score.livesLeft).toBe(config.lives);
    expect(sjekket.status).toBe('spiller');
  });

  it('trekker bare én gang selv om man sjekker flere ganger', () => {
    const s0 = session('gjentatt-sjekk', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, wrongValue(target.solution, s.board.size), 1_000);
    s = checkBoard(s, 2_000);
    const etterFørsteSjekk = s.score.mistakes;
    s = checkBoard(s, 3_000);
    s = checkBoard(s, 4_000);

    expect(s.score.mistakes).toBe(etterFørsteSjekk);
  });

  it('skjuler markeringen igjen når spilleren retter', () => {
    const s0 = session('retting', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, wrongValue(target.solution, s.board.size), 1_000);
    s = checkBoard(s, 2_000);
    expect(s.showErrors).toBe(true);

    s = submitValue(s, target.solution, 3_000);
    expect(s.showErrors).toBe(false);
    expect(cellAt(s.board, target.row, target.col).status).toBe('fylt');
  });
});

describe('spilløkt: hint', () => {
  it('gir første løsningssteg på nivå 1 og fasit på nivå 2', () => {
    const s0 = session('hint', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given && cell.task !== null);
    if (target === undefined || target.task === null) return;

    let s = focusCell(s0, target.row, target.col, 0);
    expect(hintView(s)).toEqual({ level: 0, steps: [], answer: null });

    s = takeHint(s);
    const nivaa1 = hintView(s);
    expect(nivaa1.level).toBe(1);
    expect(nivaa1.steps).toEqual([target.task.steps[0]]);
    expect(nivaa1.answer).toBeNull();
    expect(s.score.hintsUsed).toBe(1);

    s = takeHint(s);
    const nivaa2 = hintView(s);
    expect(nivaa2.level).toBe(2);
    expect(nivaa2.answer).toBe(target.solution);
    expect(nivaa2.steps).toEqual(target.task.steps);
    expect(s.score.hintsUsed).toBe(2);

    // Nivå 2 er taket.
    const etter = takeHint(s);
    expect(etter).toBe(s);
  });

  it('koster poeng, og et hjulpet svar gir mindre uttelling', () => {
    const s0 = session('hintpris', 'rolig', 0);
    const open = s0.board.cells.filter((cell) => !cell.given);
    const rent = open[0];
    const hjulpet = open[1];
    if (rent === undefined || hjulpet === undefined) return;

    let a = focusCell(s0, rent.row, rent.col, 0);
    a = submitValue(a, rent.solution, 1_000);
    const utenHint = a.score.points;

    let b = focusCell(s0, hjulpet.row, hjulpet.col, 0);
    b = takeHint(b);
    b = submitValue(b, hjulpet.solution, 1_000);

    expect(b.score.points).toBeLessThan(utenHint);
    expect(utenHint).toBe(cellAward(config, { seconds: 1, hintLevel: 0 }));
    expect(b.score.points).toBe(
      cellAward(config, { seconds: 1, hintLevel: 1 }) - config.hintPenalty[1],
    );
  });

  it('gir ikke hint på låste celler', () => {
    const s0 = session('hint-laast', 'rolig', 0);
    const given = s0.board.cells.find((cell) => cell.given);
    if (given === undefined) return;

    const s = takeHint(focusCell(s0, given.row, given.col, 0));
    expect(s.score.hintsUsed).toBe(0);
    expect(hintView(s)).toEqual({ level: 0, steps: [], answer: null });
  });
});

describe('spilløkt: celleoperasjoner', () => {
  it('låser en celle som er løst riktig', () => {
    const s0 = session('laas', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = submitValue(s, target.solution, 1_000);
    const låst = s;

    expect(submitValue(s, wrongValue(target.solution, s.board.size), 2_000)).toBe(låst);
    expect(clearActive(s, 2_000)).toBe(låst);
    expect(toggleActiveNote(s, 3)).toBe(låst);
  });

  it('lar en tom celle få notater, og starter klokken igjen etter tømming', () => {
    const s0 = session('notat', 'rolig', 0);
    const target = s0.board.cells.find((cell) => !cell.given);
    if (target === undefined) return;

    let s = focusCell(s0, target.row, target.col, 0);
    s = toggleActiveNote(s, 4);
    s = toggleActiveNote(s, 8);
    expect([...cellAt(s.board, target.row, target.col).notes].sort()).toEqual([4, 8]);

    s = submitValue(s, wrongValue(target.solution, s.board.size), 1_000);
    expect(cellAt(s.board, target.row, target.col).notes.size).toBe(0);

    s = clearActive(s, 2_000);
    expect(cellAt(s.board, target.row, target.col).userValue).toBeNull();
    expect(cellProgress(s, target.row, target.col).activeSince).not.toBeNull();
  });
});

describe('spilløkt: fullføring', () => {
  it('fullfører brettet og gir fullførtbonus', () => {
    const s0 = session('fullfor', 'streng', 0);
    const ferdig = playThrough(s0, 1_000);

    expect(ferdig.status).toBe('fullført');
    expect(unsolvedCount(ferdig)).toBe(0);
    expect(ferdig.score.solvedCells).toBe(countTasks(s0.board));
    expect(ferdig.score.mistakes).toBe(0);
    expect(ferdig.score.livesLeft).toBe(config.lives);

    // Grunnpoeng for hver celle, pluss fullførtbonus, som et nedre anslag.
    const minimum = countTasks(s0.board) * config.basePerCell + config.completionBonus;
    expect(ferdig.score.points).toBeGreaterThanOrEqual(minimum);
  });

  it('gir høyere poengsum for et raskt brett enn for et tregt', () => {
    const raskt = playThrough(session('tempo', 'rolig', 0), 2_000);
    const tregt = playThrough(session('tempo', 'rolig', 0), 200_000);
    expect(raskt.score.points).toBeGreaterThan(tregt.score.points);
  });

  it('leverer tid per oppgave til statistikken', () => {
    const s0 = session('statistikk', 'rolig', 0);
    const ferdig = playThrough(s0, 3_000);
    const timings = taskTimings(ferdig, 999_999);

    expect(timings).toHaveLength(countTasks(s0.board));
    for (const timing of timings) {
      expect(timing.solved).toBe(true);
      expect(timing.solvedMs).toBe(3_000);
      expect(timing.templateId.length).toBeGreaterThan(0);
      expect(timing.hintLevel).toBe(0);
      expect(timing.wrongAttempts).toBe(0);
    }
  });

  it('tar ikke imot flere trekk etter fullføring', () => {
    const ferdig = playThrough(session('etterpaa', 'rolig', 0), 1_000);
    expect(submitValue(ferdig, 1, 999_999)).toBe(ferdig);
    expect(takeHint(ferdig)).toBe(ferdig);
    expect(checkBoard(ferdig, 999_999)).toBe(ferdig);
  });
});
