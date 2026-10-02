import { describe, expect, it } from 'vitest';
import type { Board } from '../core/game/engine.ts';
import { cellAt, generateBoard } from '../core/game/engine.ts';
import type { ErrorMode } from '../core/game/scoring.ts';
import { DEFAULT_SCORING } from '../core/game/scoring.ts';
import type { Session } from '../core/game/session.ts';
import {
  activeLock,
  cellElapsedMs,
  cellLock,
  cellProgress,
  focusCell,
  lockedCells,
  startSession,
  submitValue,
  unsolvedCount,
} from '../core/game/session.ts';
import { ALLE_TEMAER, NIVAA } from './helpers.ts';

const config = DEFAULT_SCORING;

function board(seed: string, size: 4 | 6 | 9 = 9): Board {
  return generateBoard({
    size,
    topics: ALLE_TEMAER,
    level: NIVAA,
    seed,
  });
}

function session(seed: string, mode: ErrorMode = 'rolig', size: 4 | 6 | 9 = 9): Session {
  return startSession({ board: board(seed, size), mode, now: 0 });
}

/** Et galt, men lovlig, tall for cellen. */
function feil(riktig: number, size: number, forskyv = 1): number {
  return ((riktig - 1 + forskyv) % size) + 1;
}

/** Fyller inn gale svar til cellen sperres. */
function sperr(s: Session, row: number, col: number, now = 1_000): Session {
  let ut = focusCell(s, row, col, now);
  const riktig = cellAt(ut.board, row, col).solution;
  for (let i = 0; i < config.wrongAttemptsBeforeLock; i += 1) {
    ut = submitValue(ut, feil(riktig, ut.board.size, i + 1), now + i * 100);
  }
  return ut;
}

describe('sperre etter gale svar', () => {
  it('sperrer cellen etter oppgitt antall gale svar', () => {
    const s0 = session('sperre');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    let s = focusCell(s0, mål.row, mål.col, 0);
    const riktig = mål.solution;

    // Første gale svar skal ikke sperre.
    s = submitValue(s, feil(riktig, s.board.size, 1), 1_000);
    expect(cellLock(s, mål.row, mål.col, 1_000).locked).toBe(false);

    // Det andre skal.
    s = submitValue(s, feil(riktig, s.board.size, 2), 2_000);
    const lås = cellLock(s, mål.row, mål.col, 2_000);
    expect(lås.locked).toBe(true);
    expect(lås.cellsLeft).toBe(config.unlockAfterCells);
    expect(lås.msLeft).toBe(config.unlockAfterMs);
  });

  it('avviser flere forsøk mens cellen er sperret', () => {
    const s0 = session('avvis');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    const sperret = sperr(s0, mål.row, mål.col);
    const før = sperret;

    // Selv det riktige svaret avvises. Ellers kunne man prøvd seg videre.
    const etter = submitValue(sperret, mål.solution, 3_000);
    expect(etter).toBe(før);
    expect(cellAt(etter.board, mål.row, mål.col).userValue).not.toBe(mål.solution);
  });

  it('stopper klokken på cellen mens den er sperret', () => {
    const s0 = session('klokke');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    const sperret = sperr(s0, mål.row, mål.col, 1_000);
    const vedSperring = cellElapsedMs(sperret, mål.row, mål.col, 1_100);

    // Spilleren kan ikke jobbe med cellen, og skal ikke miste tidsbonus på å vente.
    expect(cellElapsedMs(sperret, mål.row, mål.col, 120_000)).toBe(vedSperring);
    expect(cellProgress(sperret, mål.row, mål.col).activeSince).toBeNull();
  });

  it('teller cellen som sperret i oversikten', () => {
    const s0 = session('oversikt');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    const sperret = sperr(s0, mål.row, mål.col);
    expect(lockedCells(sperret, 2_000).size).toBe(1);
    expect(lockedCells(s0, 2_000).size).toBe(0);
  });

  it('sperrer bare cellen det gjelder', () => {
    const s0 = session('bare-én');
    const åpne = s0.board.cells.filter((cell) => !cell.given);
    const a = åpne[0];
    const b = åpne[1];
    if (a === undefined || b === undefined) return;

    const s = sperr(s0, a.row, a.col);
    expect(cellLock(s, a.row, a.col, 2_000).locked).toBe(true);
    expect(cellLock(s, b.row, b.col, 2_000).locked).toBe(false);
  });
});

describe('sperren går opp', () => {
  it('når nok andre celler er løst', () => {
    const s0 = session('opplåsing');
    const åpne = s0.board.cells.filter((cell) => !cell.given);
    const sperret = åpne[0];
    if (sperret === undefined) return;

    let s = sperr(s0, sperret.row, sperret.col);
    expect(cellLock(s, sperret.row, sperret.col, 3_000).locked).toBe(true);

    // Løs de nødvendige cellene, én etter én.
    let now = 3_000;
    for (let i = 1; i <= config.unlockAfterCells; i += 1) {
      const annen = åpne[i];
      if (annen === undefined) break;
      now += 1_000;
      s = focusCell(s, annen.row, annen.col, now);
      s = submitValue(s, annen.solution, now + 100);

      const igjen = config.unlockAfterCells - i;
      const lås = cellLock(s, sperret.row, sperret.col, now + 200);
      if (igjen > 0) {
        expect(lås.locked, `etter ${i} løste celler`).toBe(true);
        expect(lås.cellsLeft).toBe(igjen);
      } else {
        expect(lås.locked, 'etter siste celle').toBe(false);
      }
    }

    // Og nå tar cellen imot svar igjen.
    const etter = submitValue(
      focusCell(s, sperret.row, sperret.col, now + 300),
      sperret.solution,
      now + 400,
    );
    expect(cellAt(etter.board, sperret.row, sperret.col).userValue).toBe(sperret.solution);
  });

  it('når tiden har gått, selv uten at andre celler løses', () => {
    const s0 = session('tid');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    const s = sperr(s0, mål.row, mål.col, 1_000);
    const sperretVed = cellProgress(s, mål.row, mål.col).lockedAt ?? 0;

    expect(cellLock(s, mål.row, mål.col, sperretVed + config.unlockAfterMs - 1).locked).toBe(
      true,
    );
    expect(cellLock(s, mål.row, mål.col, sperretVed + config.unlockAfterMs).locked).toBe(false);
  });

  it('teller ned tiden som gjenstår', () => {
    const s0 = session('nedtelling');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    const s = sperr(s0, mål.row, mål.col, 1_000);
    const sperretVed = cellProgress(s, mål.row, mål.col).lockedAt ?? 0;

    const halvveis = cellLock(s, mål.row, mål.col, sperretVed + config.unlockAfterMs / 2);
    expect(halvveis.msLeft).toBe(config.unlockAfterMs / 2);
  });

  it('krever aldri flere celler enn det finnes igjen', () => {
    // Mot slutten av et brett kan det være færre enn kravet. Da ville sperren
    // aldri gått opp av seg selv, og tiden er eneste vei ut.
    const s0 = session('slutten', 'rolig', 4);
    const åpne = s0.board.cells.filter((cell) => !cell.given);

    // Løs alt bortsett fra to celler.
    let s: Session = s0;
    let now = 0;
    for (const cell of åpne.slice(0, åpne.length - 2)) {
      now += 500;
      s = focusCell(s, cell.row, cell.col, now);
      s = submitValue(s, cell.solution, now + 100);
    }
    expect(unsolvedCount(s)).toBe(2);

    const sisteTo = åpne.slice(-2);
    const mål = sisteTo[0];
    if (mål === undefined) return;

    s = sperr(s, mål.row, mål.col, now + 1_000);
    const lås = cellLock(s, mål.row, mål.col, now + 1_200);
    // Bare én annen celle igjen, så kravet kan ikke være tre.
    expect(lås.cellsLeft).toBeLessThanOrEqual(1);
  });

  it('gir en åpen lås for celler som aldri er sperret', () => {
    const s = session('aldri');
    const mål = s.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;
    expect(cellLock(s, mål.row, mål.col, 999_999)).toEqual({
      locked: false,
      cellsLeft: 0,
      msLeft: 0,
    });
  });
});

describe('sperren i streng modus', () => {
  it('sperrer før alle livene er brukt opp på én celle', () => {
    const s0 = session('streng-sperre', 'streng');
    const mål = s0.board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    const s = sperr(s0, mål.row, mål.col);
    expect(cellLock(s, mål.row, mål.col, 2_000).locked).toBe(true);
    // To feil er brukt, men det tredje livet står igjen.
    expect(s.score.livesLeft).toBe(config.lives - config.wrongAttemptsBeforeLock);
    expect(s.status).toBe('spiller');
  });
});

describe('sperren på den aktive cellen', () => {
  it('følger markøren', () => {
    const s0 = session('aktiv');
    const åpne = s0.board.cells.filter((cell) => !cell.given);
    const a = åpne[0];
    const b = åpne[1];
    if (a === undefined || b === undefined) return;

    let s = sperr(s0, a.row, a.col);
    expect(activeLock(s, 2_000).locked).toBe(true);

    s = focusCell(s, b.row, b.col, 2_500);
    expect(activeLock(s, 2_500).locked).toBe(false);
  });

  it('er åpen når ingen celle er valgt', () => {
    const s = session('ingen-valgt');
    expect(activeLock({ ...s, active: null }, 0).locked).toBe(false);
  });
});
