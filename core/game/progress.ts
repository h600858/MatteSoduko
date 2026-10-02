/**
 * Fremdrift og statistikk.
 *
 * Filen på disk valideres med et Zod-skjema ved lesing. En korrupt eller
 * utdatert fil skal aldri kunne krasje appen: da starter vi på nytt med tom
 * fremdrift og sier fra om hvorfor.
 *
 * Ingenting her rører filsystemet. Lesing og skriving skjer i Electrons
 * hovedprosess, denne modulen tar bare imot og gir fra seg data.
 */
import { z } from 'zod';
import type { Level } from '../tasks/types.ts';
import { LEVELS } from '../tasks/types.ts';
import type { PersonalRecord } from './records.ts';
import {
  advanceStreak,
  emptyStreak,
  localDate,
  updateRecords,
} from './records.ts';
import { boardAward } from './scoring.ts';
import type { Session, TaskTiming } from './session.ts';
import { boardElapsedMs, countTasks, taskTimings } from './session.ts';

export const PROGRESS_VERSION = 5;

/**
 * Versjon 1 lagret oppgavenivået som tallet 1, 2 eller 3. Versjon 2 lagrer
 * skolenivået som tekst. Alt innhold i versjon 1 var MAT102-stoff, altså
 * videregående og universitet, så de gamle tallene oversettes deretter.
 */
const V1_NIVAA: Readonly<Record<number, Level>> = {
  1: 'middels',
  2: 'middels',
  3: 'vanskelig',
};

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'forventet en ISO-dato',
});

export const templateStatsSchema = z.object({
  /** Hvor mange ganger malen har vært i spill på et brett spilleren rørte. */
  attempts: z.number().int().nonnegative(),
  /** Hvor mange av dem som endte riktig. */
  correct: z.number().int().nonnegative(),
  /** Samlet tid på de løste cellene. Grunnlaget for gjennomsnittet. */
  solvedMs: z.number().nonnegative(),
  /** Hvor mange ganger spilleren måtte ta hint. */
  hinted: z.number().int().nonnegative(),
  /** Antall gale svar, summert. */
  wrongAttempts: z.number().int().nonnegative(),
  lastSeen: isoDate,
});

export type TemplateStats = z.infer<typeof templateStatsSchema>;

export const boardResultSchema = z.object({
  finishedAt: isoDate,
  seed: z.string(),
  size: z.number().int().positive(),
  mode: z.enum(['streng', 'rolig']),
  level: z.enum(LEVELS as unknown as [Level, ...Level[]]),
  points: z.number().int(),
  durationMs: z.number().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  solvedCells: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  mistakes: z.number().int().nonnegative(),
  completed: z.boolean(),
});

export type BoardResult = z.infer<typeof boardResultSchema>;

/**
 * Formen brettene hadde til og med versjon 4, da hulltallet var en innstilling
 * spilleren kunne velge. Nå graves hvert brett så hardt størrelsen tillater, og
 * antall hull leses av taskCount i stedet.
 */
const legacyBoardResultSchema = boardResultSchema.extend({
  boardDifficulty: z.number().int().min(1).max(3),
});

/**
 * Totalen som samles opp over tid.
 *
 * Lagres som egne tall, ikke utledet av brettlista: historikken kappes ved
 * hundre brett, og da ville en utledet total plutselig begynt å synke.
 */
export const lifetimeSchema = z.object({
  points: z.number().int(),
  boardsPlayed: z.number().int().nonnegative(),
  boardsCompleted: z.number().int().nonnegative(),
  cellsSolved: z.number().int().nonnegative(),
  msPlayed: z.number().nonnegative(),
});

export type Lifetime = z.infer<typeof lifetimeSchema>;

/** Dager på rad. Lagres for seg, av samme grunn som totalen. */
export const streakSchema = z.object({
  current: z.number().int().nonnegative(),
  longest: z.number().int().nonnegative(),
  lastDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

/** Beste poengsum og beste tid per nivå og brettstørrelse. */
export const personalRecordSchema = z.object({
  points: z.number().int(),
  durationMs: z.number().nonnegative(),
  finishedAt: isoDate,
  seed: z.string(),
});

export const progressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  lifetime: lifetimeSchema,
  streak: streakSchema,
  /** Nøkkel er «nivå:størrelse», f.eks. «middels:9». */
  records: z.record(z.string(), personalRecordSchema),
  templates: z.record(z.string(), templateStatsSchema),
  /** Nyeste først. */
  boards: z.array(boardResultSchema),
});

export type Progress = z.infer<typeof progressSchema>;

/** Hvor mange brettresultater vi tar vare på. */
export const MAX_BOARD_HISTORY = 100;

export function emptyLifetime(): Lifetime {
  return { points: 0, boardsPlayed: 0, boardsCompleted: 0, cellsSolved: 0, msPlayed: 0 };
}

export function emptyProgress(): Progress {
  return {
    version: PROGRESS_VERSION,
    lifetime: emptyLifetime(),
    streak: emptyStreak(),
    records: {},
    templates: {},
    boards: [],
  };
}

export interface LoadResult {
  progress: Progress;
  /** Satt når filen ikke kunne brukes. UI-et kan vise den. */
  warning: string | null;
}

/**
 * Leser fremdrift fra det som lå på disk. Kaster aldri.
 *
 * `raw` er med vilje `unknown`: den kommer fra en fil som kan være hva som
 * helst, og skal behandles som ukjent til skjemaet har sagt sitt.
 */
export function loadProgress(raw: unknown): LoadResult {
  if (raw === null || raw === undefined) {
    return { progress: emptyProgress(), warning: null };
  }

  let data: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.trim() === '') {
      return { progress: emptyProgress(), warning: null };
    }
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        progress: emptyProgress(),
        warning: 'Fremdriftsfilen var ikke gyldig JSON. Statistikken starter på nytt.',
      };
    }
  }

  // Eldre filer løftes til gjeldende versjon før skjemaet får se dem, slik at
  // statistikk ikke går tapt bare fordi formatet har endret seg.
  const løftet = migrate(data);

  const parsed = progressSchema.safeParse(løftet);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first === undefined ? '' : ` (${first.path.join('.')}: ${first.message})`;
    return {
      progress: emptyProgress(),
      warning: `Fremdriftsfilen hadde uventet innhold${where}. Statistikken starter på nytt.`,
    };
  }

  return { progress: parsed.data, warning: null };
}

/** Versjon 1: oppgavenivået var et tall, og totalen fantes ikke. */
const v1Schema = z.object({
  version: z.literal(1),
  templates: z.record(z.string(), templateStatsSchema),
  boards: z.array(
    legacyBoardResultSchema
      .omit({ level: true })
      .extend({ taskDifficulty: z.number().int().min(1).max(3) }),
  ),
});

/** Versjon 4: rekke og rekorder på plass, men hulltallet var ennå en innstilling. */
const v4Schema = z.object({
  version: z.literal(4),
  lifetime: lifetimeSchema,
  streak: streakSchema,
  records: z.record(z.string(), personalRecordSchema),
  templates: z.record(z.string(), templateStatsSchema),
  boards: z.array(legacyBoardResultSchema),
});

/** Versjon 3: total på plass, men verken rekke eller rekorder. */
const v3Schema = z.object({
  version: z.literal(3),
  lifetime: lifetimeSchema,
  templates: z.record(z.string(), templateStatsSchema),
  boards: z.array(legacyBoardResultSchema),
});

/** Versjon 2: skolenivå på plass, men fortsatt ingen total. */
const v2Schema = z.object({
  version: z.literal(2),
  templates: z.record(z.string(), templateStatsSchema),
  boards: z.array(legacyBoardResultSchema),
});

/**
 * Løfter en gammel fremdriftsfil til gjeldende versjon, ett steg om gangen.
 *
 * Kjenner den ikke igjen formatet, sendes innholdet videre urørt. Da er det
 * skjemaet som avgjør om det kan brukes, og brukeren får en melding om hva som
 * var galt i stedet for en stille sletting.
 */
export function migrate(data: unknown): unknown {
  let current: unknown = data;

  const v1 = v1Schema.safeParse(current);
  if (v1.success) {
    current = {
      version: 2,
      templates: v1.data.templates,
      boards: v1.data.boards.map((board) => {
        const { taskDifficulty, ...resten } = board;
        return { ...resten, level: V1_NIVAA[taskDifficulty] ?? 'middels' };
      }),
    };
  }

  const v2 = v2Schema.safeParse(current);
  if (v2.success) {
    // Totalen fantes ikke før versjon 3. Den beste tilnærmingen er å summere
    // brettene vi fortsatt har. Har historikken allerede blitt kappet, er noen
    // gamle poeng tapt, men det er bedre enn å starte på null.
    current = {
      version: 3,
      lifetime: v2.data.boards.reduce<Lifetime>(
        (sum, board) => ({
          points: sum.points + board.points,
          boardsPlayed: sum.boardsPlayed + 1,
          boardsCompleted: sum.boardsCompleted + (board.completed ? 1 : 0),
          cellsSolved: sum.cellsSolved + board.solvedCells,
          msPlayed: sum.msPlayed + board.durationMs,
        }),
        emptyLifetime(),
      ),
      templates: v2.data.templates,
      boards: v2.data.boards,
    };
  }

  const v3 = v3Schema.safeParse(current);
  if (v3.success) {
    // Rekke og rekorder fantes ikke før versjon 4. De bygges av brettene vi
    // fortsatt har. Er historikken kappet, er noen gamle dager tapt, men det
    // er bedre enn å starte på null.
    const eldsteFørst = [...v3.data.boards].reverse();

    let streak = emptyStreak();
    let records: Record<string, PersonalRecord> = {};
    for (const board of eldsteFørst) {
      streak = advanceStreak(streak, localDate(new Date(board.finishedAt)));
      records = updateRecords(records, board).records;
    }

    current = {
      version: 4,
      lifetime: v3.data.lifetime,
      streak,
      records,
      templates: v3.data.templates,
      boards: v3.data.boards,
    };
  }

  const v4 = v4Schema.safeParse(current);
  if (v4.success) {
    // Hulltallet sluttet å være en innstilling i versjon 5. Feltet fjernes, og
    // ingenting går tapt: taskCount har alltid vært det faktiske hulltallet.
    current = {
      version: 5,
      lifetime: v4.data.lifetime,
      streak: v4.data.streak,
      records: v4.data.records,
      templates: v4.data.templates,
      boards: v4.data.boards.map((board) => {
        const { boardDifficulty: _ubrukt, ...resten } = board;
        return resten;
      }),
    };
  }

  return current;
}

function emptyStats(lastSeen: string): TemplateStats {
  return {
    attempts: 0,
    correct: 0,
    solvedMs: 0,
    hinted: 0,
    wrongAttempts: 0,
    lastSeen,
  };
}

/**
 * En celle teller bare hvis spilleren faktisk var innom den.
 *
 * Uten dette ville et brett man ga opp tidlig sende alle de urørte cellene inn
 * i statistikken som bomskudd, og den adaptive vektingen i M7 ville trekke feil
 * konklusjon om hvilke maler som er vanskelige.
 */
export function wasAttempted(timing: TaskTiming): boolean {
  return (
    timing.solved || timing.wrongAttempts > 0 || timing.hintLevel > 0 || timing.elapsedMs > 0
  );
}

export interface SessionRecord {
  timings: readonly TaskTiming[];
  board: BoardResult;
}

/**
 * Gjør en ferdigspilt økt om til noe som kan lagres.
 *
 * Et brett som ble tapt telles også: det sier like mye om hvilke maler som er
 * vanskelige som et brett som ble fullført.
 */
export function sessionRecord(session: Session, now: number): SessionRecord {
  return {
    timings: taskTimings(session, now),
    board: {
      finishedAt: new Date(session.finishedAt ?? now).toISOString(),
      seed: session.board.seed,
      size: session.board.size,
      mode: session.mode,
      level: session.board.level,
      points: boardAward(session.config, {
        rawPoints: session.score.points,
        completed: session.status === 'fullført',
        seconds: boardElapsedMs(session, now) / 1000,
        taskCount: countTasks(session.board),
        level: session.board.level,
      }),
      durationMs: boardElapsedMs(session, now),
      taskCount: countTasks(session.board),
      solvedCells: session.score.solvedCells,
      hintsUsed: session.score.hintsUsed,
      mistakes: session.score.mistakes,
      completed: session.status === 'fullført',
    },
  };
}

/** Legger et ferdigspilt brett inn i fremdriften. Muterer ikke input. */
export function recordSession(progress: Progress, record: SessionRecord): Progress {
  const templates: Record<string, TemplateStats> = { ...progress.templates };
  const seenAt = record.board.finishedAt;

  for (const timing of record.timings) {
    if (!wasAttempted(timing)) continue;

    const current = templates[timing.templateId] ?? emptyStats(seenAt);
    templates[timing.templateId] = {
      attempts: current.attempts + 1,
      correct: current.correct + (timing.solved ? 1 : 0),
      solvedMs: current.solvedMs + (timing.solved ? (timing.solvedMs ?? 0) : 0),
      hinted: current.hinted + (timing.hintLevel > 0 ? 1 : 0),
      wrongAttempts: current.wrongAttempts + timing.wrongAttempts,
      lastSeen: seenAt,
    };
  }

  // Rekken teller dager, ikke brett. Flere brett samme dag er én dag.
  const spiltDato = localDate(new Date(record.board.finishedAt));
  const streak = advanceStreak(progress.streak, spiltDato);
  const { records } = updateRecords(progress.records, record.board);

  return {
    version: PROGRESS_VERSION,
    lifetime: {
      points: progress.lifetime.points + record.board.points,
      boardsPlayed: progress.lifetime.boardsPlayed + 1,
      boardsCompleted: progress.lifetime.boardsCompleted + (record.board.completed ? 1 : 0),
      cellsSolved: progress.lifetime.cellsSolved + record.board.solvedCells,
      msPlayed: progress.lifetime.msPlayed + record.board.durationMs,
    },
    streak,
    records,
    templates,
    boards: [record.board, ...progress.boards].slice(0, MAX_BOARD_HISTORY),
  };
}

/** Gjennomsnittstid per løste celle, i millisekunder. null når malen aldri er løst. */
export function averageMs(stats: TemplateStats): number | null {
  if (stats.correct === 0) return null;
  return stats.solvedMs / stats.correct;
}

/** Andel riktige, 0 til 1. null når malen aldri er forsøkt. */
export function accuracy(stats: TemplateStats): number | null {
  if (stats.attempts === 0) return null;
  return stats.correct / stats.attempts;
}

export interface TemplateSummary extends TemplateStats {
  templateId: string;
  averageMs: number | null;
  accuracy: number | null;
}

/** Statistikk per mal, svakeste først. Det er den listen som er verdt å se på. */
export function templateSummaries(progress: Progress): TemplateSummary[] {
  const rows: TemplateSummary[] = Object.entries(progress.templates).map(
    ([templateId, stats]) => ({
      ...stats,
      templateId,
      averageMs: averageMs(stats),
      accuracy: accuracy(stats),
    }),
  );

  rows.sort((a, b) => {
    const left = a.accuracy ?? 1;
    const right = b.accuracy ?? 1;
    if (left !== right) return left - right;
    // Ved lik treffprosent kommer den som tar lengst tid først.
    return (b.averageMs ?? 0) - (a.averageMs ?? 0);
  });

  return rows;
}

export interface OverallStats {
  boardsPlayed: number;
  boardsCompleted: number;
  totalPoints: number;
  bestPoints: number | null;
  cellsAttempted: number;
  cellsCorrect: number;
  hintsUsed: number;
  mistakes: number;
}

export function overallStats(progress: Progress): OverallStats {
  const stats: OverallStats = {
    boardsPlayed: progress.lifetime.boardsPlayed,
    boardsCompleted: progress.lifetime.boardsCompleted,
    totalPoints: progress.lifetime.points,
    bestPoints: null,
    cellsAttempted: 0,
    cellsCorrect: 0,
    hintsUsed: 0,
    mistakes: 0,
  };

  for (const board of progress.boards) {
    stats.bestPoints =
      stats.bestPoints === null ? board.points : Math.max(stats.bestPoints, board.points);
    stats.hintsUsed += board.hintsUsed;
    stats.mistakes += board.mistakes;
  }

  for (const template of Object.values(progress.templates)) {
    stats.cellsAttempted += template.attempts;
    stats.cellsCorrect += template.correct;
  }

  return stats;
}
