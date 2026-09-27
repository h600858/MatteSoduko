/**
 * Rekker, personlige rekorder og målestokker.
 *
 * Alt her er rene funksjoner over fremdriften. Det finnes ingen tjener og
 * ingen andre spillere, så ingenting måles mot «resten av verden». Det som
 * måles mot, er enten et objektivt tak eller din egen historikk. Begge deler
 * er ekte tall, ikke anslag.
 */
import type { BoardSize } from '../sudoku/grid.ts';
import type { Level } from '../tasks/types.ts';
import type { BoardResult, Progress } from './progress.ts';
import type { ScoringConfig } from './scoring.ts';
import { maxBoardScore } from './scoring.ts';

// ---------- Rekker ----------

export interface StreakState {
  /** Dager på rad til og med i dag, eller til og med i går hvis dagen ikke er brukt. */
  current: number;
  longest: number;
  /** Siste dagen det ble spilt, som YYYY-MM-DD. */
  lastDate: string | null;
}

export function emptyStreak(): StreakState {
  return { current: 0, longest: 0, lastDate: null };
}

/** Datoen som YYYY-MM-DD, etter lokal kalender. */
export function localDate(date: Date): string {
  const år = date.getFullYear();
  const måned = String(date.getMonth() + 1).padStart(2, '0');
  const dag = String(date.getDate()).padStart(2, '0');
  return `${år}-${måned}-${dag}`;
}

/** Antall døgn mellom to datoer på formen YYYY-MM-DD. */
export function daysBetween(fra: string, til: string): number {
  const a = Date.parse(`${fra}T00:00:00Z`);
  const b = Date.parse(`${til}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Oppdaterer rekken når et brett spilles.
 *
 * Flere brett samme dag teller som én dag. Hopper man over en dag, starter
 * rekken på nytt. Spiller man et brett med en eldre dato enn det siste som er
 * registrert, står rekken stille: den skal ikke kunne gå bakover.
 */
export function advanceStreak(streak: StreakState, playedOn: string): StreakState {
  if (streak.lastDate === null) {
    return { current: 1, longest: Math.max(1, streak.longest), lastDate: playedOn };
  }

  const avstand = daysBetween(streak.lastDate, playedOn);
  if (Number.isNaN(avstand) || avstand < 0) return streak;
  if (avstand === 0) return streak;

  const current = avstand === 1 ? streak.current + 1 : 1;
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastDate: playedOn,
  };
}

export interface StreakView {
  /** Rekken slik den står nå. Null hvis den er brutt. */
  current: number;
  longest: number;
  playedToday: boolean;
  /** True når rekken lever, men dagen ennå ikke er brukt. */
  atRisk: boolean;
}

/**
 * Rekken sett fra i dag.
 *
 * Har man spilt i dag, er rekken i boks. Har man spilt i går, lever den
 * fortsatt, men dagen må brukes. Ellers er den brutt.
 */
export function streakView(streak: StreakState, today: Date): StreakView {
  const iDag = localDate(today);

  if (streak.lastDate === null) {
    return { current: 0, longest: streak.longest, playedToday: false, atRisk: false };
  }

  const avstand = daysBetween(streak.lastDate, iDag);
  if (avstand === 0) {
    return { current: streak.current, longest: streak.longest, playedToday: true, atRisk: false };
  }
  if (avstand === 1) {
    return { current: streak.current, longest: streak.longest, playedToday: false, atRisk: true };
  }
  return { current: 0, longest: streak.longest, playedToday: false, atRisk: false };
}

// ---------- Personlige rekorder ----------

export interface PersonalRecord {
  points: number;
  durationMs: number;
  finishedAt: string;
  seed: string;
}

/** Nøkkelen en rekord lagres under. */
export function recordKey(level: Level, size: number): string {
  return `${level}:${size}`;
}

export function parseRecordKey(key: string): { level: Level; size: BoardSize } | null {
  const [level, size] = key.split(':');
  const tall = Number(size);
  if (level === undefined || (tall !== 4 && tall !== 6 && tall !== 9)) return null;
  return { level: level as Level, size: tall };
}

export interface RecordUpdate {
  records: Record<string, PersonalRecord>;
  /** Satt når brettet slo den gamle rekorden. */
  beat: 'poeng' | 'tid' | 'begge' | null;
}

/**
 * Oppdaterer rekordene med et ferdigspilt brett.
 *
 * Bare fullførte brett teller. En «beste tid» på et brett man ga opp halvveis
 * ville ikke betydd noe, og ville gjort rekorden umulig å slå ærlig.
 */
export function updateRecords(
  records: Readonly<Record<string, PersonalRecord>>,
  board: BoardResult,
): RecordUpdate {
  if (!board.completed) return { records: { ...records }, beat: null };

  const key = recordKey(board.level, board.size);
  const gammel = records[key];
  const ny: PersonalRecord = {
    points: board.points,
    durationMs: board.durationMs,
    finishedAt: board.finishedAt,
    seed: board.seed,
  };

  if (gammel === undefined) {
    return { records: { ...records, [key]: ny }, beat: 'begge' };
  }

  const bedrePoeng = board.points > gammel.points;
  const bedreTid = board.durationMs < gammel.durationMs;
  if (!bedrePoeng && !bedreTid) return { records: { ...records }, beat: null };

  // Rekorden holder på det beste av hver, ikke på ett enkelt brett. Da kan
  // man slå tiden sin uten å miste poengrekorden.
  return {
    records: {
      ...records,
      [key]: {
        points: Math.max(gammel.points, board.points),
        durationMs: Math.min(gammel.durationMs, board.durationMs),
        finishedAt: ny.finishedAt,
        seed: bedrePoeng ? ny.seed : gammel.seed,
      },
    },
    beat: bedrePoeng && bedreTid ? 'begge' : bedrePoeng ? 'poeng' : 'tid',
  };
}

// ---------- Målestokker ----------

/**
 * Hvor stor andel av det mulige brettet ga, fra 0 til 1.
 *
 * Dette er den eneste målestokken som er objektiv uten andre spillere: taket
 * er regnet ut av poengreglene, ikke gjettet.
 */
export function shareOfMax(
  config: ScoringConfig,
  board: BoardResult,
): number | null {
  const tak = maxBoardScore(config, board.taskCount, board.level);
  if (tak <= 0) return null;
  return Math.max(0, board.points / tak);
}

/** Hvor mange tidligere brett vi krever før en persentil sier noe. */
export const MIN_BOARDS_FOR_PERCENTILE = 5;

/**
 * Hvor stor andel av dine egne tidligere brett på samme nivå dette slo.
 *
 * Returnerer null når grunnlaget er for tynt. En «persentil» bygget på to
 * brett er et tall uten innhold, og bør ikke vises.
 */
export function personalPercentile(
  progress: Progress,
  board: BoardResult,
): number | null {
  const tidligere = progress.boards.filter(
    (annet) =>
      annet.level === board.level &&
      annet.completed &&
      !(annet.seed === board.seed && annet.finishedAt === board.finishedAt),
  );

  if (tidligere.length < MIN_BOARDS_FOR_PERCENTILE) return null;
  const slått = tidligere.filter((annet) => board.points > annet.points).length;
  return slått / tidligere.length;
}

// ---------- Oppsummering av et ferdigspilt brett ----------

export interface BoardSummary {
  board: BoardResult;
  /** Andel av det brettet kunne gitt, 0 til 1. */
  shareOfMax: number | null;
  /** Andel av dine egne tidligere brett på samme nivå dette slo. */
  percentile: number | null;
  /** Satt når brettet slo en personlig rekord. */
  record: 'poeng' | 'tid' | 'begge' | null;
}

/**
 * Oppsummerer et brett mot fremdriften slik den var FØR brettet ble banket inn.
 *
 * Rekkefølgen er viktig: regnes dette ut etterpå, er brettet allerede med i
 * historikken og i rekordene, og da vil verken persentilen eller rekorden
 * stemme.
 */
export function summarizeBoard(
  config: ScoringConfig,
  before: Progress,
  board: BoardResult,
): BoardSummary {
  return {
    board,
    shareOfMax: shareOfMax(config, board),
    percentile: personalPercentile(before, board),
    record: updateRecords(before.records, board).beat,
  };
}
