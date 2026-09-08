import { describe, expect, it } from 'vitest';
import { generateBoard } from '../core/game/engine.ts';
import type { BoardResult, Progress } from '../core/game/progress.ts';
import {
  MAX_BOARD_HISTORY,
  PROGRESS_VERSION,
  accuracy,
  averageMs,
  emptyProgress,
  loadProgress,
  overallStats,
  progressSchema,
  recordSession,
  sessionRecord,
  templateSummaries,
  wasAttempted,
} from '../core/game/progress.ts';
import type { TaskTiming } from '../core/game/session.ts';
import { focusCell, startSession, submitValue, takeHint } from '../core/game/session.ts';
import { ALL_TOPICS } from '../core/tasks/types.ts';

function timing(overrides: Partial<TaskTiming> = {}): TaskTiming {
  return {
    templateId: 'func.verdi',
    answer: 4,
    elapsedMs: 5_000,
    solvedMs: 5_000,
    hintLevel: 0,
    wrongAttempts: 0,
    solved: true,
    ...overrides,
  };
}

function boardResult(overrides: Partial<BoardResult> = {}): BoardResult {
  return {
    finishedAt: '2026-09-08T12:00:00.000Z',
    seed: 'test',
    size: 9,
    mode: 'rolig',
    taskDifficulty: 3,
    boardDifficulty: 2,
    points: 1000,
    durationMs: 60_000,
    taskCount: 5,
    solvedCells: 5,
    hintsUsed: 0,
    mistakes: 0,
    completed: true,
    ...overrides,
  };
}

describe('loadProgress: en korrupt fil skal aldri krasje appen', () => {
  it('gir tom fremdrift uten advarsel når det ikke finnes noen fil', () => {
    for (const input of [null, undefined, '', '   ']) {
      const result = loadProgress(input);
      expect(result.progress).toEqual(emptyProgress());
      expect(result.warning).toBeNull();
    }
  });

  it('gir tom fremdrift med advarsel når filen ikke er gyldig JSON', () => {
    const result = loadProgress('{ dette er ikke json');
    expect(result.progress).toEqual(emptyProgress());
    expect(result.warning).toContain('JSON');
  });

  it('gir tom fremdrift med advarsel når innholdet har feil form', () => {
    const rubbish: unknown[] = [
      42,
      'en streng',
      [],
      {},
      { version: PROGRESS_VERSION },
      { version: 999, templates: {}, boards: [] },
      { version: PROGRESS_VERSION, templates: null, boards: [] },
      { version: PROGRESS_VERSION, templates: {}, boards: null },
      // Negative tellere gir ingen mening.
      {
        version: PROGRESS_VERSION,
        templates: {
          'func.verdi': {
            attempts: -1,
            correct: 0,
            solvedMs: 0,
            hinted: 0,
            wrongAttempts: 0,
            lastSeen: '2026-09-08T12:00:00.000Z',
          },
        },
        boards: [],
      },
      // Ugyldig dato.
      {
        version: PROGRESS_VERSION,
        templates: {
          'func.verdi': {
            attempts: 1,
            correct: 1,
            solvedMs: 10,
            hinted: 0,
            wrongAttempts: 0,
            lastSeen: 'i går',
          },
        },
        boards: [],
      },
      // Ukjent modus.
      { version: PROGRESS_VERSION, templates: {}, boards: [{ ...boardResult(), mode: 'brutal' }] },
    ];

    for (const input of rubbish) {
      const result = loadProgress(input);
      expect(result.progress, `godtok ${JSON.stringify(input)}`).toEqual(emptyProgress());
      expect(result.warning, `manglet advarsel for ${JSON.stringify(input)}`).not.toBeNull();
    }
  });

  it('kaster aldri, uansett hva den får inn', () => {
    const nasty: unknown[] = [
      Number.NaN,
      Symbol('x'),
      () => 1,
      new Map(),
      { version: PROGRESS_VERSION, templates: { a: { attempts: 'mange' } }, boards: [] },
      '{"version":1,"templates":{},"boards":[{}]}',
    ];
    for (const input of nasty) {
      expect(() => loadProgress(input)).not.toThrow();
    }
  });

  it('leser tilbake det som ble skrevet', () => {
    const progress: Progress = recordSession(emptyProgress(), {
      timings: [timing(), timing({ templateId: 'deriv.polynom2', solved: false, solvedMs: null })],
      board: boardResult(),
    });

    const roundTrip = loadProgress(JSON.stringify(progress, null, 2));
    expect(roundTrip.warning).toBeNull();
    expect(roundTrip.progress).toEqual(progress);
  });

  it('godtar en tom, men gyldig, fremdrift', () => {
    const result = loadProgress(JSON.stringify(emptyProgress()));
    expect(result.warning).toBeNull();
    expect(result.progress).toEqual(emptyProgress());
  });
});

describe('recordSession', () => {
  it('summerer forsøk, riktige, tid, hint og feilsvar per mal', () => {
    let progress = emptyProgress();

    progress = recordSession(progress, {
      timings: [
        timing({ templateId: 'func.verdi', solvedMs: 4_000 }),
        timing({ templateId: 'func.verdi', solvedMs: 6_000, hintLevel: 1 }),
        timing({ templateId: 'deriv.eksp', solved: false, solvedMs: null, wrongAttempts: 2 }),
      ],
      board: boardResult(),
    });

    const verdi = progress.templates['func.verdi'];
    expect(verdi).toBeDefined();
    expect(verdi?.attempts).toBe(2);
    expect(verdi?.correct).toBe(2);
    expect(verdi?.solvedMs).toBe(10_000);
    expect(verdi?.hinted).toBe(1);
    expect(averageMs(verdi!)).toBe(5_000);
    expect(accuracy(verdi!)).toBe(1);

    const eksp = progress.templates['deriv.eksp'];
    expect(eksp?.attempts).toBe(1);
    expect(eksp?.correct).toBe(0);
    expect(eksp?.solvedMs).toBe(0);
    expect(eksp?.wrongAttempts).toBe(2);
    expect(averageMs(eksp!)).toBeNull();
    expect(accuracy(eksp!)).toBe(0);
  });

  it('legger seg oppå tidligere fremdrift', () => {
    let progress = recordSession(emptyProgress(), {
      timings: [timing({ solvedMs: 2_000 })],
      board: boardResult(),
    });
    progress = recordSession(progress, {
      timings: [timing({ solvedMs: 8_000 })],
      board: boardResult({ finishedAt: '2026-09-09T12:00:00.000Z' }),
    });

    const stats = progress.templates['func.verdi'];
    expect(stats?.attempts).toBe(2);
    expect(averageMs(stats!)).toBe(5_000);
    expect(stats?.lastSeen).toBe('2026-09-09T12:00:00.000Z');
  });

  it('teller ikke celler spilleren aldri var innom', () => {
    // Et brett man gir opp tidlig skal ikke sende alle de urørte cellene inn
    // som bomskudd. Ellers ville den adaptive vektingen trukket feil slutning.
    const urørt = timing({
      templateId: 'deriv.kjerne',
      solved: false,
      solvedMs: null,
      elapsedMs: 0,
      wrongAttempts: 0,
      hintLevel: 0,
    });
    expect(wasAttempted(urørt)).toBe(false);

    const progress = recordSession(emptyProgress(), {
      timings: [urørt, timing()],
      board: boardResult({ completed: false }),
    });

    expect(progress.templates['deriv.kjerne']).toBeUndefined();
    expect(progress.templates['func.verdi']?.attempts).toBe(1);
  });

  it('regner en celle som forsøkt så snart den er rørt', () => {
    expect(wasAttempted(timing({ solved: false, solvedMs: null, elapsedMs: 3_000 }))).toBe(true);
    expect(
      wasAttempted(timing({ solved: false, solvedMs: null, elapsedMs: 0, wrongAttempts: 1 })),
    ).toBe(true);
    expect(
      wasAttempted(timing({ solved: false, solvedMs: null, elapsedMs: 0, hintLevel: 1 })),
    ).toBe(true);
  });

  it('legger nyeste brett først og holder historikken avgrenset', () => {
    let progress = emptyProgress();
    for (let i = 0; i < MAX_BOARD_HISTORY + 25; i += 1) {
      progress = recordSession(progress, {
        timings: [],
        board: boardResult({ seed: `brett-${i}` }),
      });
    }

    expect(progress.boards).toHaveLength(MAX_BOARD_HISTORY);
    expect(progress.boards[0]?.seed).toBe(`brett-${MAX_BOARD_HISTORY + 24}`);
    // Resultatet skal fortsatt være gyldig etter kutting.
    expect(progressSchema.safeParse(progress).success).toBe(true);
  });

  it('muterer ikke fremdriften den får inn', () => {
    const før = recordSession(emptyProgress(), { timings: [timing()], board: boardResult() });
    const kopi = JSON.parse(JSON.stringify(før)) as Progress;
    recordSession(før, { timings: [timing()], board: boardResult() });
    expect(før).toEqual(kopi);
  });
});

describe('statistikk', () => {
  it('sorterer malene med svakeste treffprosent først', () => {
    const progress = recordSession(emptyProgress(), {
      timings: [
        timing({ templateId: 'lett' }),
        timing({ templateId: 'lett' }),
        timing({ templateId: 'middels' }),
        timing({ templateId: 'middels', solved: false, solvedMs: null }),
        timing({ templateId: 'vanskelig', solved: false, solvedMs: null }),
        timing({ templateId: 'vanskelig', solved: false, solvedMs: null }),
      ],
      board: boardResult(),
    });

    expect(templateSummaries(progress).map((row) => row.templateId)).toEqual([
      'vanskelig',
      'middels',
      'lett',
    ]);
  });

  it('setter den tregeste først når treffprosenten er lik', () => {
    const progress = recordSession(emptyProgress(), {
      timings: [
        timing({ templateId: 'rask', solvedMs: 1_000 }),
        timing({ templateId: 'treg', solvedMs: 90_000 }),
      ],
      board: boardResult(),
    });

    expect(templateSummaries(progress).map((row) => row.templateId)).toEqual(['treg', 'rask']);
  });

  it('oppsummerer totaler', () => {
    let progress = recordSession(emptyProgress(), {
      timings: [timing(), timing({ solved: false, solvedMs: null })],
      board: boardResult({ points: 800, hintsUsed: 2, mistakes: 1 }),
    });
    progress = recordSession(progress, {
      timings: [timing()],
      board: boardResult({ points: 1500, completed: false, hintsUsed: 1, mistakes: 3 }),
    });

    const totals = overallStats(progress);
    expect(totals.boardsPlayed).toBe(2);
    expect(totals.boardsCompleted).toBe(1);
    expect(totals.totalPoints).toBe(2300);
    expect(totals.bestPoints).toBe(1500);
    expect(totals.cellsAttempted).toBe(3);
    expect(totals.cellsCorrect).toBe(2);
    expect(totals.hintsUsed).toBe(3);
    expect(totals.mistakes).toBe(4);
  });

  it('tåler tom fremdrift', () => {
    expect(templateSummaries(emptyProgress())).toEqual([]);
    expect(overallStats(emptyProgress())).toEqual({
      boardsPlayed: 0,
      boardsCompleted: 0,
      totalPoints: 0,
      bestPoints: null,
      cellsAttempted: 0,
      cellsCorrect: 0,
      hintsUsed: 0,
      mistakes: 0,
    });
  });
});

describe('sessionRecord: fra ekte spilløkt til lagret fremdrift', () => {
  it('fanger opp det som faktisk skjedde i økten', () => {
    const board = generateBoard({
      size: 4,
      topics: ALL_TOPICS,
      taskDifficulty: 3,
      boardDifficulty: 2,
      seed: 'lagring',
    });

    let s = startSession({ board, mode: 'streng', now: 0 });
    const open = board.cells.filter((cell) => !cell.given);
    const first = open[0];
    const second = open[1];
    if (first === undefined || second === undefined) return;

    // Én celle løses etter et hint, én celle får et galt svar.
    s = focusCell(s, first.row, first.col, 0);
    s = takeHint(s);
    s = submitValue(s, first.solution, 4_000);

    s = focusCell(s, second.row, second.col, 4_000);
    s = submitValue(s, second.solution === board.size ? 1 : second.solution + 1, 9_000);

    const record = sessionRecord(s, 12_000);

    expect(record.board.seed).toBe('lagring');
    expect(record.board.mode).toBe('streng');
    expect(record.board.completed).toBe(false);
    expect(record.board.taskCount).toBe(open.length);
    expect(record.board.solvedCells).toBe(1);
    expect(record.board.hintsUsed).toBe(1);
    expect(record.board.mistakes).toBe(1);
    expect(record.board.durationMs).toBe(12_000);
    expect(Number.isNaN(Date.parse(record.board.finishedAt))).toBe(false);

    const løst = record.timings.find(
      (t) => t.templateId === (first.task?.templateId ?? ''),
    );
    expect(løst?.hintLevel).toBe(1);

    // Og resultatet skal kunne lagres og leses tilbake.
    const progress = recordSession(emptyProgress(), record);
    const roundTrip = loadProgress(JSON.stringify(progress));
    expect(roundTrip.warning).toBeNull();
    expect(roundTrip.progress).toEqual(progress);
  });
});
