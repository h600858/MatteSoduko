import { describe, expect, it } from 'vitest';
import type { BoardResult } from '../core/game/progress.ts';
import {
  MAX_BOARD_HISTORY,
  emptyProgress,
  loadProgress,
  migrate,
  recordSession,
} from '../core/game/progress.ts';
import type { PersonalRecord } from '../core/game/records.ts';
import {
  MIN_BOARDS_FOR_PERCENTILE,
  advanceStreak,
  daysBetween,
  emptyStreak,
  localDate,
  personalPercentile,
  recordKey,
  parseRecordKey,
  shareOfMax,
  streakView,
  updateRecords,
} from '../core/game/records.ts';
import { DEFAULT_SCORING, maxBoardScore } from '../core/game/scoring.ts';

const config = DEFAULT_SCORING;

function boardResult(over: Partial<BoardResult> = {}): BoardResult {
  return {
    finishedAt: '2026-09-28T18:00:00.000Z',
    seed: 'brett',
    size: 6,
    mode: 'rolig',
    level: 'middels',
    points: 1000,
    durationMs: 300_000,
    taskCount: 17,
    solvedCells: 17,
    hintsUsed: 0,
    mistakes: 0,
    completed: true,
    ...over,
  };
}

/** Et brett spilt på en gitt lokal dato, klokka 18. */
function paaDato(år: number, måned: number, dag: number, over: Partial<BoardResult> = {}) {
  return boardResult({ finishedAt: new Date(år, måned - 1, dag, 18).toISOString(), ...over });
}

describe('dager på rad', () => {
  it('starter på null', () => {
    expect(emptyStreak()).toEqual({ current: 0, longest: 0, lastDate: null });
  });

  it('teller opp for hver nye dag', () => {
    let s = emptyStreak();
    s = advanceStreak(s, '2026-09-01');
    expect(s.current).toBe(1);
    s = advanceStreak(s, '2026-09-02');
    s = advanceStreak(s, '2026-09-03');
    expect(s).toEqual({ current: 3, longest: 3, lastDate: '2026-09-03' });
  });

  it('teller flere brett samme dag som én dag', () => {
    let s = advanceStreak(emptyStreak(), '2026-09-01');
    s = advanceStreak(s, '2026-09-01');
    s = advanceStreak(s, '2026-09-01');
    expect(s.current).toBe(1);
  });

  it('starter på nytt når en dag hoppes over', () => {
    let s = emptyStreak();
    for (const dag of ['2026-09-01', '2026-09-02', '2026-09-03']) s = advanceStreak(s, dag);
    s = advanceStreak(s, '2026-09-05');
    expect(s.current).toBe(1);
    // Den lengste rekken huskes selv om den brytes.
    expect(s.longest).toBe(3);
  });

  it('går aldri bakover på et brett med eldre dato', () => {
    let s = advanceStreak(emptyStreak(), '2026-09-10');
    s = advanceStreak(s, '2026-09-11');
    const før = s;
    s = advanceStreak(s, '2026-09-05');
    expect(s).toEqual(før);
  });

  it('krysser månedsskifte og årsskifte', () => {
    let s = advanceStreak(emptyStreak(), '2026-01-31');
    s = advanceStreak(s, '2026-02-01');
    expect(s.current).toBe(2);

    let n = advanceStreak(emptyStreak(), '2026-12-31');
    n = advanceStreak(n, '2027-01-01');
    expect(n.current).toBe(2);
  });

  it('teller døgn riktig over sommertidsovergangen', () => {
    // Siste helg i oktober, da klokka stilles tilbake i Norge.
    expect(daysBetween('2026-10-24', '2026-10-25')).toBe(1);
    expect(daysBetween('2026-10-25', '2026-10-26')).toBe(1);
  });

  it('bruker lokal dato, ikke UTC', () => {
    // 23:30 lokal tid er neste dag i UTC om sommeren. Rekken skal følge
    // kalenderen spilleren faktisk ser på.
    expect(localDate(new Date(2026, 5, 3, 23, 30))).toBe('2026-06-03');
    expect(localDate(new Date(2026, 5, 3, 0, 15))).toBe('2026-06-03');
  });
});

describe('rekken sett fra i dag', () => {
  const streak = { current: 4, longest: 9, lastDate: '2026-09-28' };

  it('er i boks når dagen er brukt', () => {
    const v = streakView(streak, new Date(2026, 8, 28, 20));
    expect(v).toEqual({ current: 4, longest: 9, playedToday: true, atRisk: false });
  });

  it('lever, men står i fare, dagen etter', () => {
    const v = streakView(streak, new Date(2026, 8, 29, 8));
    expect(v.current).toBe(4);
    expect(v.playedToday).toBe(false);
    expect(v.atRisk).toBe(true);
  });

  it('er brutt etter en hoppet dag', () => {
    const v = streakView(streak, new Date(2026, 8, 30, 8));
    expect(v.current).toBe(0);
    expect(v.atRisk).toBe(false);
    // Den lengste står fortsatt.
    expect(v.longest).toBe(9);
  });

  it('tåler at ingenting er spilt ennå', () => {
    expect(streakView(emptyStreak(), new Date())).toEqual({
      current: 0,
      longest: 0,
      playedToday: false,
      atRisk: false,
    });
  });
});

describe('personlige rekorder', () => {
  it('setter rekord på første fullførte brett', () => {
    const { records, beat } = updateRecords({}, boardResult({ points: 900 }));
    expect(beat).toBe('begge');
    expect(records[recordKey('middels', 6)]?.points).toBe(900);
  });

  it('teller ikke brett som ble forlatt', () => {
    const { records, beat } = updateRecords({}, boardResult({ completed: false }));
    expect(beat).toBeNull();
    expect(Object.keys(records)).toHaveLength(0);
  });

  it('holder på det beste av poeng og tid hver for seg', () => {
    let records: Record<string, PersonalRecord> = {};
    records = updateRecords(records, boardResult({ points: 1200, durationMs: 400_000 })).records;

    // Bedre tid, dårligere poeng: begge rekordene skal stå.
    const etter = updateRecords(records, boardResult({ points: 800, durationMs: 200_000 }));
    expect(etter.beat).toBe('tid');
    expect(etter.records[recordKey('middels', 6)]).toMatchObject({
      points: 1200,
      durationMs: 200_000,
    });
  });

  it('melder ikke rekord når brettet var dårligere på begge', () => {
    const records = updateRecords({}, boardResult({ points: 1200, durationMs: 200_000 })).records;
    const etter = updateRecords(records, boardResult({ points: 900, durationMs: 300_000 }));
    expect(etter.beat).toBeNull();
    expect(etter.records[recordKey('middels', 6)]?.points).toBe(1200);
  });

  it('holder rekorder atskilt per nivå og størrelse', () => {
    let records: Record<string, PersonalRecord> = {};
    records = updateRecords(records, boardResult({ level: 'enkel', size: 6, points: 500 })).records;
    records = updateRecords(records, boardResult({ level: 'ultra', size: 9, points: 9000 })).records;

    expect(Object.keys(records).sort()).toEqual(['enkel:6', 'ultra:9']);
    expect(records['enkel:6']?.points).toBe(500);
  });

  it('kan lese nøkkelen tilbake', () => {
    expect(parseRecordKey(recordKey('vanskelig', 9))).toEqual({ level: 'vanskelig', size: 9 });
    expect(parseRecordKey('tull')).toBeNull();
    expect(parseRecordKey('middels:7')).toBeNull();
  });

  it('muterer ikke rekordene den får inn', () => {
    const før: Record<string, PersonalRecord> = {};
    updateRecords(før, boardResult());
    expect(Object.keys(før)).toHaveLength(0);
  });
});

describe('målestokker uten andre spillere', () => {
  it('regner ut hvor stor andel av det mulige brettet ga', () => {
    const board = boardResult({ points: 2000, taskCount: 17, level: 'middels' });
    const tak = maxBoardScore(config, 17, 'middels');
    expect(shareOfMax(config, board)).toBeCloseTo(2000 / tak, 6);
  });

  it('gir aldri en negativ andel', () => {
    expect(shareOfMax(config, boardResult({ points: -500 }))).toBe(0);
  });

  it('krever nok grunnlag før den sier noe om persentil', () => {
    let progress = emptyProgress();
    for (let i = 0; i < MIN_BOARDS_FOR_PERCENTILE - 1; i += 1) {
      progress = recordSession(progress, {
        timings: [],
        board: boardResult({ points: 500 + i, seed: `gammel-${i}` }),
      });
    }
    expect(personalPercentile(progress, boardResult({ points: 9999 }))).toBeNull();
  });

  it('måler mot dine egne tidligere brett på samme nivå', () => {
    let progress = emptyProgress();
    for (let i = 0; i < 10; i += 1) {
      progress = recordSession(progress, {
        timings: [],
        board: boardResult({ points: 100 * (i + 1), seed: `gammel-${i}` }),
      });
    }

    // 1100 slår alle ti.
    expect(personalPercentile(progress, boardResult({ points: 1100, seed: 'ny' }))).toBe(1);
    // 550 slår de fem laveste.
    expect(personalPercentile(progress, boardResult({ points: 550, seed: 'ny' }))).toBe(0.5);
    // 50 slår ingen.
    expect(personalPercentile(progress, boardResult({ points: 50, seed: 'ny' }))).toBe(0);
  });

  it('blander ikke inn brett fra andre nivåer', () => {
    let progress = emptyProgress();
    for (let i = 0; i < 10; i += 1) {
      progress = recordSession(progress, {
        timings: [],
        board: boardResult({ level: 'ultra', points: 9000, seed: `ultra-${i}` }),
      });
    }
    // Ingen middels-brett å måle mot, selv om det finnes ti brett totalt.
    expect(personalPercentile(progress, boardResult({ level: 'middels' }))).toBeNull();
  });
});

describe('rekke og rekorder gjennom fremdriften', () => {
  it('oppdateres når et brett bankes inn', () => {
    let progress = recordSession(emptyProgress(), {
      timings: [],
      board: paaDato(2026, 9, 1, { points: 1500 }),
    });
    progress = recordSession(progress, {
      timings: [],
      board: paaDato(2026, 9, 2, { points: 900, seed: 'b' }),
    });

    expect(progress.streak.current).toBe(2);
    expect(progress.records[recordKey('middels', 6)]?.points).toBe(1500);
  });

  it('mister ikke rekken når bretthistorikken kappes', () => {
    // Samme grunn som for totalen: en utledet rekke ville blitt kortere av seg
    // selv så snart historikken gikk full.
    let progress = emptyProgress();
    const dager = MAX_BOARD_HISTORY + 30;
    for (let i = 0; i < dager; i += 1) {
      const dato = new Date(2026, 0, 1 + i, 18);
      progress = recordSession(progress, {
        timings: [],
        board: boardResult({ finishedAt: dato.toISOString(), seed: `dag-${i}` }),
      });
    }

    expect(progress.boards).toHaveLength(MAX_BOARD_HISTORY);
    expect(progress.streak.current).toBe(dager);
    expect(progress.streak.longest).toBe(dager);
  });

  it('overlever lagring og lesing', () => {
    const progress = recordSession(emptyProgress(), {
      timings: [],
      board: paaDato(2026, 9, 1, { points: 1500 }),
    });
    const tilbake = loadProgress(JSON.stringify(progress));
    expect(tilbake.warning).toBeNull();
    expect(tilbake.progress.streak).toEqual(progress.streak);
    expect(tilbake.progress.records).toEqual(progress.records);
  });
});

describe('migrering fra versjon 3', () => {
  const v3 = {
    version: 3,
    lifetime: {
      points: 2500,
      boardsPlayed: 3,
      boardsCompleted: 3,
      cellsSolved: 40,
      msPlayed: 900_000,
    },
    templates: {},
    // Nyeste først, slik fila lagres. boardDifficulty forsvant i versjon 5,
    // men en fil fra versjon 3 har feltet, så fixturen må ha det også.
    boards: [
      { ...paaDato(2026, 9, 3, { points: 1500, seed: 'c' }), boardDifficulty: 2 },
      { ...paaDato(2026, 9, 2, { points: 700, seed: 'b' }), boardDifficulty: 2 },
      { ...paaDato(2026, 9, 1, { points: 300, seed: 'a' }), boardDifficulty: 1 },
    ],
  };

  it('bygger rekken av brettene som finnes', () => {
    const { progress, warning } = loadProgress(JSON.stringify(v3));
    expect(warning).toBeNull();
    expect(progress.streak.current).toBe(3);
    expect(progress.streak.lastDate).toBe('2026-09-03');
  });

  it('bygger rekordene av brettene som finnes', () => {
    const { progress } = loadProgress(JSON.stringify(v3));
    expect(progress.records[recordKey('middels', 6)]?.points).toBe(1500);
  });

  it('beholder totalen fra versjon 3 urørt', () => {
    const { progress } = loadProgress(JSON.stringify(v3));
    expect(progress.lifetime.points).toBe(2500);
  });

  it('rører ikke en fil som allerede er på gjeldende versjon', () => {
    const v4 = recordSession(emptyProgress(), { timings: [], board: boardResult() });
    expect(migrate(v4)).toEqual(v4);
  });
});
