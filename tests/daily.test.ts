import { describe, expect, it } from 'vitest';
import {
  dailyBoard,
  dailyPlayed,
  dailyPlayedLevels,
  dailyResult,
  dailySeed,
  isDailySeed,
  isoDate,
} from '../core/game/daily.ts';
import { generateBoard } from '../core/game/engine.ts';
import type { BoardResult } from '../core/game/progress.ts';
import { emptyProgress, recordSession } from '../core/game/progress.ts';
import { maxBoardScore, DEFAULT_SCORING, LEVEL_MULTIPLIER } from '../core/game/scoring.ts';
import { holesForDifficulty } from '../core/sudoku/generate.ts';
import { taskKey, LEVELS } from '../core/tasks/types.ts';

const config = DEFAULT_SCORING;

function boardResult(over: Partial<BoardResult> = {}): BoardResult {
  return {
    finishedAt: '2026-09-28T12:00:00.000Z',
    seed: 'noe',
    size: 6,
    mode: 'rolig',
    level: 'middels',
    boardDifficulty: 2,
    points: 900,
    durationMs: 60_000,
    taskCount: 17,
    solvedCells: 17,
    hintsUsed: 0,
    mistakes: 0,
    completed: true,
    ...over,
  };
}

describe('dagens brett: alle får det samme', () => {
  it('gir samme oppsett hele dagen, uansett klokkeslett', () => {
    const morgen = dailyBoard(new Date(2026, 8, 28, 7, 15), 'middels');
    const kveld = dailyBoard(new Date(2026, 8, 28, 23, 45), 'middels');
    expect(kveld).toEqual(morgen);
  });

  it('gir samme brett og samme oppgaver for to spillere samme dag', () => {
    for (const level of LEVELS) {
      const oppsett = dailyBoard(new Date(2026, 8, 28), level);
      const a = generateBoard({ ...oppsett, seed: oppsett.seed });
      const b = generateBoard({ ...oppsett, seed: oppsett.seed });

      expect(b.puzzle.cells).toEqual(a.puzzle.cells);
      expect(b.cells.map((c) => c.task?.latex ?? null)).toEqual(
        a.cells.map((c) => c.task?.latex ?? null),
      );
    }
  });

  it('gir et nytt brett neste dag', () => {
    const iDag = dailyBoard(new Date(2026, 8, 28), 'middels');
    const iMorgen = dailyBoard(new Date(2026, 8, 29), 'middels');
    expect(iMorgen.seed).not.toBe(iDag.seed);

    const a = generateBoard({ ...iDag, seed: iDag.seed });
    const b = generateBoard({ ...iMorgen, seed: iMorgen.seed });
    expect(b.puzzle.cells).not.toEqual(a.puzzle.cells);
  });

  it('gir ulike brett på ulike nivåer samme dag', () => {
    const seeds = LEVELS.map((level) => dailyBoard(new Date(2026, 8, 28), level).seed);
    expect(new Set(seeds).size).toBe(LEVELS.length);
  });

  it('bruker temaene som finnes på nivået', () => {
    for (const level of LEVELS) {
      const oppsett = dailyBoard(new Date(2026, 8, 28), level);
      expect(oppsett.topics.length).toBeGreaterThan(0);
      expect(oppsett.level).toBe(level);
    }
  });

  it('holder seg til brettstørrelser som gir nok variasjon', () => {
    // 4x4 er utelatt med vilje: bare fire mulige svar gjentar de samme malene.
    for (let dag = 0; dag < 60; dag += 1) {
      for (const level of LEVELS) {
        const oppsett = dailyBoard(new Date(2026, 0, 1 + dag), level);
        expect([6, 9]).toContain(oppsett.size);
        expect([1, 2, 3]).toContain(oppsett.boardDifficulty);
      }
    }
  });

  it('varierer størrelse og hulltall over tid', () => {
    const størrelser = new Set<number>();
    const hull = new Set<number>();
    for (let dag = 0; dag < 60; dag += 1) {
      const oppsett = dailyBoard(new Date(2026, 0, 1 + dag), 'middels');
      størrelser.add(oppsett.size);
      hull.add(oppsett.boardDifficulty);
    }
    expect(størrelser.size).toBeGreaterThan(1);
    expect(hull.size).toBeGreaterThan(1);
  });

  it('bygger et gyldig brett med unike oppgaver', () => {
    for (const level of LEVELS) {
      const oppsett = dailyBoard(new Date(2026, 8, 28), level);
      const board = generateBoard({ ...oppsett, seed: oppsett.seed });

      const tekster = new Set<string>();
      for (const cell of board.cells) {
        if (cell.task === null) continue;
        expect(cell.task.answer).toBe(cell.solution);
        expect(cell.task.verify()).toBe(true);
        const key = taskKey(cell.task);
        expect(tekster.has(key), `${level} gjentar: ${key}`).toBe(false);
        tekster.add(key);
      }
      expect(tekster.size).toBeGreaterThan(0);
    }
  });
});

describe('dagens brett: datoen', () => {
  it('skriver datoen som YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(isoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('kjenner igjen sin egen seed', () => {
    expect(isDailySeed(dailySeed(new Date(), 'enkel'))).toBe(true);
    expect(isDailySeed('vanlig-brett')).toBe(false);
  });
});

describe('dagens brett: om det er spilt', () => {
  const dato = new Date(2026, 8, 28);

  it('ser tomt ut før man har spilt', () => {
    const progress = emptyProgress();
    expect(dailyPlayed(progress, dato, 'middels')).toBe(false);
    expect(dailyPlayedLevels(progress, dato)).toEqual([]);
    expect(dailyResult(progress, dato, 'middels')).toBeNull();
  });

  it('kjenner igjen et spilt brett på riktig nivå og dag', () => {
    const progress = recordSession(emptyProgress(), {
      timings: [],
      board: boardResult({ seed: dailySeed(dato, 'middels'), points: 1450 }),
    });

    expect(dailyPlayed(progress, dato, 'middels')).toBe(true);
    expect(dailyResult(progress, dato, 'middels')?.points).toBe(1450);

    // Ikke de andre nivåene, og ikke andre dager.
    expect(dailyPlayed(progress, dato, 'enkel')).toBe(false);
    expect(dailyPlayed(progress, new Date(2026, 8, 29), 'middels')).toBe(false);
    expect(dailyPlayedLevels(progress, dato)).toEqual(['middels']);
  });

  it('teller et halvferdig dagens brett som spilt', () => {
    // Man får ett forsøk. Forlater man brettet, er dagen brukt opp.
    const progress = recordSession(emptyProgress(), {
      timings: [],
      board: boardResult({ seed: dailySeed(dato, 'enkel'), completed: false, solvedCells: 3 }),
    });
    expect(dailyPlayed(progress, dato, 'enkel')).toBe(true);
  });
});

describe('maksimal poengsum for et brett', () => {
  it('stiger med antall oppgaver og med nivået', () => {
    expect(maxBoardScore(config, 20, 'middels')).toBeGreaterThan(
      maxBoardScore(config, 10, 'middels'),
    );
    expect(maxBoardScore(config, 20, 'ultra')).toBeGreaterThan(
      maxBoardScore(config, 20, 'enkel'),
    );
  });

  it('følger nivåmultiplikatoren', () => {
    const enkel = maxBoardScore(config, 17, 'enkel');
    const ultra = maxBoardScore(config, 17, 'ultra');
    expect(ultra / enkel).toBeCloseTo(LEVEL_MULTIPLIER.ultra / LEVEL_MULTIPLIER.enkel, 2);
  });

  it('er et tak ingen brett kan gå over', () => {
    // Perfekt spill: alle celler riktig med null tid brukt.
    const taskCount = holesForDifficulty(6, 2);
    const tak = maxBoardScore(config, taskCount, 'middels');
    const perfekt =
      taskCount * (config.basePerCell + config.maxTimeBonus + config.noHintBonus);
    expect(tak).toBeGreaterThan(Math.round(perfekt * LEVEL_MULTIPLIER.middels));
  });

  it('tåler et brett uten oppgaver', () => {
    expect(maxBoardScore(config, 0, 'enkel')).toBe(config.completionBonus);
  });
});
