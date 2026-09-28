/**
 * Spilløkten: brettet i spill, med poeng, liv, hint og klokker.
 *
 * Alle funksjonene er rene og tar tiden inn som et tall (millisekunder), slik
 * at hele forløpet kan spilles gjennom i en test uten å vente på en klokke.
 */
import type { Board, Cell } from './engine.ts';
import {
  applyStatuses,
  cellAt,
  cellIndex,
  conflictIndices,
  effectiveValue,
  isSolved,
  remainingCells,
  setValue,
  toggleNote,
} from './engine.ts';
import type { Concept } from '../tasks/concepts.ts';
import { conceptById } from '../tasks/concepts.ts';
import type { TaskRegistry } from '../tasks/registry.ts';
import { taskRegistry as defaultRegistry } from '../tasks/registry.ts';
import type { ErrorMode, HintLevel, ScoreState, ScoringConfig } from './scoring.ts';
import {
  DEFAULT_SCORING,
  awardCell,
  chargeHint,
  chargeMistake,
  createScoreState,
  isOutOfLives,
} from './scoring.ts';

export interface CellRefLike {
  row: number;
  col: number;
}

export interface CellProgress {
  /** Tid brukt i cellen, summert over alle besøk. */
  readonly elapsedMs: number;
  /** Når cellen ble aktiv sist. null når klokken ikke går. */
  readonly activeSince: number | null;
  readonly hintLevel: HintLevel;
  readonly wrongAttempts: number;
  /** Verdien vi allerede har trukket poeng for, så samme feil ikke koster to ganger. */
  readonly chargedFor: number | null;
  /** Tiden cellen tok da den ble løst. Går videre til statistikken i M6. */
  readonly solvedMs: number | null;
}

export type SessionStatus = 'spiller' | 'fullført' | 'tapt';

export interface Session {
  readonly board: Board;
  readonly mode: ErrorMode;
  readonly config: ScoringConfig;
  readonly score: ScoreState;
  readonly startedAt: number;
  readonly finishedAt: number | null;
  readonly status: SessionStatus;
  /** Cellen klokken går på. */
  readonly active: CellRefLike | null;
  readonly progress: ReadonlyMap<number, CellProgress>;
  /**
   * Om feil vises på brettet akkurat nå. Alltid sant i streng modus. I rolig
   * modus slås det på når spilleren trykker sjekk, og av igjen ved neste
   * endring.
   */
  readonly showErrors: boolean;
}

const EMPTY_PROGRESS: CellProgress = {
  elapsedMs: 0,
  activeSince: null,
  hintLevel: 0,
  wrongAttempts: 0,
  chargedFor: null,
  solvedMs: null,
};

export interface StartSessionOptions {
  board: Board;
  mode: ErrorMode;
  now: number;
  config?: ScoringConfig;
  /** Cellen markøren skal starte på. Standard er første celle med oppgave. */
  startAt?: CellRefLike;
}

function progressFor(session: Session, index: number): CellProgress {
  return session.progress.get(index) ?? EMPTY_PROGRESS;
}

export function cellProgress(session: Session, row: number, col: number): CellProgress {
  return progressFor(session, cellIndex(session.board.size, row, col));
}

function withProgress(
  session: Session,
  index: number,
  patch: Partial<CellProgress>,
): Map<number, CellProgress> {
  const next = new Map(session.progress);
  next.set(index, { ...progressFor(session, index), ...patch });
  return next;
}

/** Stopper klokken på den aktive cellen og legger tiden til totalen. */
function pauseActive(
  session: Session,
  now: number,
): { progress: Map<number, CellProgress>; index: number | null } {
  if (session.active === null) return { progress: new Map(session.progress), index: null };

  const index = cellIndex(session.board.size, session.active.row, session.active.col);
  const current = progressFor(session, index);
  if (current.activeSince === null) {
    return { progress: new Map(session.progress), index };
  }

  const progress = new Map(session.progress);
  progress.set(index, {
    ...current,
    elapsedMs: current.elapsedMs + Math.max(0, now - current.activeSince),
    activeSince: null,
  });
  return { progress, index };
}

/** Regner ut hvilke celler som skal vises som feil. */
function errorIndices(board: Board, showErrors: boolean): Set<number> {
  if (!showErrors) return new Set<number>();

  // Regelbrudd teller alltid.
  const marked = conflictIndices(board);

  // I tillegg regnes svar som ikke stemmer med fasiten som feil. Uten dette
  // ville et galt svar som ennå ikke kolliderer med noe gått upåaktet hen.
  for (const cell of board.cells) {
    if (cell.given || cell.userValue === null) continue;
    if (cell.userValue !== cell.solution) {
      marked.add(cellIndex(board.size, cell.row, cell.col));
    }
  }

  return marked;
}

function restyle(board: Board, showErrors: boolean): Board {
  return applyStatuses(board, errorIndices(board, showErrors));
}

export function startSession({
  board,
  mode,
  now,
  config = DEFAULT_SCORING,
  startAt,
}: StartSessionOptions): Session {
  const first = remainingCells(board)[0];
  const active = startAt ?? (first === undefined ? null : { row: first.row, col: first.col });

  const progress = new Map<number, CellProgress>();
  if (active !== null) {
    progress.set(cellIndex(board.size, active.row, active.col), {
      ...EMPTY_PROGRESS,
      activeSince: now,
    });
  }

  return {
    board: restyle(board, mode === 'streng'),
    mode,
    config,
    score: createScoreState(config),
    startedAt: now,
    finishedAt: null,
    status: 'spiller',
    active,
    progress,
    showErrors: mode === 'streng',
  };
}

/** Flytter markøren. Klokken følger med: den gamle cellen pauses, den nye starter. */
export function focusCell(session: Session, row: number, col: number, now: number): Session {
  if (session.status !== 'spiller') return { ...session, active: { row, col } };
  if (session.active !== null && session.active.row === row && session.active.col === col) {
    return session;
  }

  const { progress } = pauseActive(session, now);
  const index = cellIndex(session.board.size, row, col);
  const cell = cellAt(session.board, row, col);

  // Klokken går bare på celler som faktisk har en oppgave å løse.
  const shouldRun = !cell.given && cell.userValue !== cell.solution;
  progress.set(index, {
    ...(progress.get(index) ?? EMPTY_PROGRESS),
    activeSince: shouldRun ? now : null,
  });

  return { ...session, active: { row, col }, progress };
}

/** Sekunder brukt på hele brettet. Stopper når brettet er ferdig. */
export function boardElapsedMs(session: Session, now: number): number {
  const end = session.finishedAt ?? now;
  return Math.max(0, end - session.startedAt);
}

/** Sekunder brukt på én celle, inkludert tiden som løper akkurat nå. */
export function cellElapsedMs(
  session: Session,
  row: number,
  col: number,
  now: number,
): number {
  const progress = cellProgress(session, row, col);
  const running = progress.activeSince === null ? 0 : Math.max(0, now - progress.activeSince);
  return progress.elapsedMs + running;
}

export function activeCell(session: Session): Cell | null {
  if (session.active === null) return null;
  return cellAt(session.board, session.active.row, session.active.col);
}

/** True når cellen er ferdig og ikke skal kunne endres mer. */
export function isCellLocked(cell: Cell): boolean {
  return cell.given || cell.userValue === cell.solution;
}

/**
 * Skriver et svar i den aktive cellen.
 *
 * Riktig svar låser cellen og gir poeng. Feil svar koster poeng med én gang i
 * streng modus, og først ved sjekk i rolig modus.
 */
export function submitValue(session: Session, value: number, now: number): Session {
  if (session.status !== 'spiller' || session.active === null) return session;

  const { row, col } = session.active;
  const cell = cellAt(session.board, row, col);
  if (isCellLocked(cell)) return session;
  if (value < 1 || value > session.board.size) return session;

  const index = cellIndex(session.board.size, row, col);
  const correct = value === cell.solution;

  if (correct) {
    const elapsedMs = cellElapsedMs(session, row, col, now);
    const progressAfter = progressFor(session, index);

    const board = setValue(session.board, row, col, value, false);
    const progress = new Map(session.progress);
    progress.set(index, {
      ...progressAfter,
      elapsedMs,
      activeSince: null,
      solvedMs: elapsedMs,
    });

    // Poengsummen i økten er råpoengene: det spilleren tjener inn celle for
    // celle. Fullførtbonus, tidsbonus og nivåmultiplikator legges på først når
    // brettet bankes inn på totalen, i boardAward().
    const score = awardCell(session.score, session.config, {
      seconds: elapsedMs / 1000,
      hintLevel: progressAfter.hintLevel,
    });

    const solved = isSolved(board);
    const finishedAt = solved ? now : null;

    const showErrors = session.mode === 'streng';
    return {
      ...session,
      board: restyle(board, showErrors),
      score,
      progress,
      finishedAt,
      status: solved ? 'fullført' : 'spiller',
      showErrors,
    };
  }

  // Feil svar.
  const board = setValue(session.board, row, col, value, false);
  const previous = progressFor(session, index);
  const alreadyCharged = previous.chargedFor === value;

  const score =
    session.mode === 'streng' && !alreadyCharged
      ? chargeMistake(session.score, session.config, 'streng')
      : session.score;

  const progress = new Map(session.progress);
  progress.set(index, {
    ...previous,
    wrongAttempts: previous.wrongAttempts + 1,
    chargedFor: session.mode === 'streng' ? value : previous.chargedFor,
  });

  const showErrors = session.mode === 'streng';
  const lost = isOutOfLives(score, session.mode);

  return {
    ...session,
    board: restyle(board, showErrors),
    score,
    progress,
    status: lost ? 'tapt' : 'spiller',
    finishedAt: lost ? now : null,
    showErrors,
  };
}

/** Tømmer den aktive cellen. Låste og løste celler røres ikke. */
export function clearActive(session: Session, now: number): Session {
  if (session.status !== 'spiller' || session.active === null) return session;
  const { row, col } = session.active;
  const cell = cellAt(session.board, row, col);
  if (isCellLocked(cell)) return session;

  const board = setValue(session.board, row, col, null, false);
  const index = cellIndex(session.board.size, row, col);
  const progress = new Map(session.progress);
  const current = progressFor(session, index);
  // Klokken skal gå igjen når cellen står tom og er valgt.
  progress.set(index, { ...current, activeSince: current.activeSince ?? now });

  const showErrors = session.mode === 'streng';
  return {
    ...session,
    board: restyle(board, showErrors),
    progress,
    showErrors,
  };
}

export function toggleActiveNote(session: Session, value: number): Session {
  if (session.status !== 'spiller' || session.active === null) return session;
  const { row, col } = session.active;
  const cell = cellAt(session.board, row, col);
  if (isCellLocked(cell)) return session;

  const board = toggleNote(session.board, row, col, value);
  return { ...session, board: restyle(board, session.showErrors) };
}

/**
 * Hint i tre nivåer, fra orientering til fasit:
 *
 *   1. Konseptet: hva slags oppgave dette er, med hele regeltabellen. Det er
 *      ikke et steg i løsningen, så spilleren må fortsatt finne regelen selv.
 *   2. Første løsningssteg.
 *   3. Fasiten og resten av stegene.
 *
 * Hvert nivå koster poeng, og trekket skjer bare første gang nivået tas.
 */
export function takeHint(session: Session): Session {
  if (session.status !== 'spiller' || session.active === null) return session;

  const { row, col } = session.active;
  const cell = cellAt(session.board, row, col);
  if (isCellLocked(cell) || cell.task === null) return session;

  const index = cellIndex(session.board.size, row, col);
  const current = progressFor(session, index);
  if (current.hintLevel >= 3) return session;

  const level = (current.hintLevel + 1) as 1 | 2 | 3;
  const progress = withProgress(session, index, { hintLevel: level });

  return {
    ...session,
    score: chargeHint(session.score, session.config, level),
    progress,
  };
}

export interface HintView {
  level: HintLevel;
  /** Fagstoffet bak oppgaven. Fra nivå 1. */
  concept: Concept | null;
  /** Stegene spilleren har betalt for. Fra nivå 2. */
  steps: string[];
  /** Fasit, bare på nivå 3. */
  answer: number | null;
}

const INGEN_HINT: HintView = { level: 0, concept: null, steps: [], answer: null };

/** Hva hintpanelet skal vise for den aktive cellen. */
export function hintView(
  session: Session,
  registry: TaskRegistry = defaultRegistry,
): HintView {
  const cell = activeCell(session);
  if (cell === null || cell.task === null) return INGEN_HINT;

  const { hintLevel } = cellProgress(session, cell.row, cell.col);
  if (hintLevel === 0) return INGEN_HINT;

  const conceptId = registry.byId(cell.task.templateId)?.concept;
  const concept = conceptId === undefined ? null : (conceptById(conceptId) ?? null);

  if (hintLevel === 1) return { level: 1, concept, steps: [], answer: null };
  if (hintLevel === 2) {
    return { level: 2, concept, steps: cell.task.steps.slice(0, 1), answer: null };
  }
  return { level: 3, concept, steps: [...cell.task.steps], answer: cell.solution };
}

/**
 * Sjekkeknappen i rolig modus. Markerer feil, og trekker poeng for hvert feil
 * svar som ikke allerede er betalt for.
 */
export function checkBoard(session: Session, now: number): Session {
  if (session.status !== 'spiller') return session;

  let score = session.score;
  const progress = new Map(session.progress);

  for (const cell of session.board.cells) {
    if (cell.given || cell.userValue === null) continue;
    if (cell.userValue === cell.solution) continue;

    const index = cellIndex(session.board.size, cell.row, cell.col);
    const current = progressFor(session, index);
    if (current.chargedFor === cell.userValue) continue;

    score = chargeMistake(score, session.config, session.mode);
    progress.set(index, { ...current, chargedFor: cell.userValue });
  }

  const lost = isOutOfLives(score, session.mode);

  return {
    ...session,
    board: restyle(session.board, true),
    score,
    progress,
    showErrors: true,
    status: lost ? 'tapt' : session.status,
    finishedAt: lost ? now : session.finishedAt,
  };
}

/** Antall celler som har en oppgave. */
export function countTasks(board: Board): number {
  return board.cells.filter((cell) => !cell.given).length;
}

/** Celler som fortsatt mangler riktig svar. */
export function unsolvedCount(session: Session): number {
  return session.board.cells.filter(
    (cell) => !cell.given && effectiveValue(cell) !== cell.solution,
  ).length;
}

/** Tid per oppgave, klar for statistikken i M6. */
export interface TaskTiming {
  templateId: string;
  answer: number;
  /** Total tid brukt i cellen, også når den ikke ble løst. */
  elapsedMs: number;
  solvedMs: number | null;
  hintLevel: HintLevel;
  wrongAttempts: number;
  solved: boolean;
}

export function taskTimings(session: Session, now: number): TaskTiming[] {
  const timings: TaskTiming[] = [];
  for (const cell of session.board.cells) {
    if (cell.given || cell.task === null) continue;
    const progress = cellProgress(session, cell.row, cell.col);
    timings.push({
      templateId: cell.task.templateId,
      answer: cell.solution,
      elapsedMs: cellElapsedMs(session, cell.row, cell.col, now),
      solvedMs: progress.solvedMs,
      hintLevel: progress.hintLevel,
      wrongAttempts: progress.wrongAttempts,
      solved: cell.userValue === cell.solution,
    });
  }
  return timings;
}
