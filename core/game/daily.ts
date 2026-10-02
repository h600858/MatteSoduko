/**
 * Dagens brett.
 *
 * Ett brett per nivå per dato, bestemt av datoen alene. Alle som spiller
 * middels i dag får nøyaktig det samme brettet med nøyaktig de samme
 * oppgavene. Det er hele poenget: da kan man snakke om det, og senere
 * sammenligne seg.
 *
 * Ingenting lagres for å få til dette. Datoen er seeden, og den seedbare
 * generatoren gjør resten.
 */
import { createRng } from '../rng.ts';
import type { TaskRegistry } from '../tasks/registry.ts';
import { taskRegistry as defaultRegistry } from '../tasks/registry.ts';
import type { Level, Topic } from '../tasks/types.ts';
import { LEVELS } from '../tasks/types.ts';
import type { BoardSize } from '../sudoku/grid.ts';
import type { Progress } from './progress.ts';

/** Datoen som YYYY-MM-DD, etter lokal kalender. */
export function isoDate(date: Date): string {
  const år = date.getFullYear();
  const måned = String(date.getMonth() + 1).padStart(2, '0');
  const dag = String(date.getDate()).padStart(2, '0');
  return `${år}-${måned}-${dag}`;
}

const PREFIKS = 'dagens';

export function dailySeed(date: Date, level: Level): string {
  return `${PREFIKS}:${isoDate(date)}:${level}`;
}

/** Om en seed hører til et dagens brett. */
export function isDailySeed(seed: string): boolean {
  return seed.startsWith(`${PREFIKS}:`);
}

/**
 * Størrelsene dagens brett trekker fra.
 *
 * 6x6 går igjen fordi det er den naturlige økta: rundt tjuefem oppgaver. 9x9
 * dukker opp av og til, som en større dag. 4x4 er utelatt med vilje, siden det
 * bare har fire mulige svar og derfor gjentar de samme malene.
 *
 * Hulltallet trekkes ikke: hvert brett graves så hardt størrelsen tillater.
 */
const DAGENS_STØRRELSER: readonly BoardSize[] = [6, 6, 6, 9];

export interface DailyBoard {
  /** Datoen brettet hører til, som YYYY-MM-DD. */
  date: string;
  level: Level;
  size: BoardSize;
  topics: readonly Topic[];
  seed: string;
}

/** Oppsettet for dagens brett på et gitt nivå. */
export function dailyBoard(
  date: Date,
  level: Level,
  registry: TaskRegistry = defaultRegistry,
): DailyBoard {
  const seed = dailySeed(date, level);
  // Egen strøm for oppsettet, slik at selve brettet ikke flytter seg dersom
  // listen over størrelser endres senere.
  const rng = createRng(`oppsett:${seed}`);

  return {
    date: isoDate(date),
    level,
    size: rng.pick(DAGENS_STØRRELSER),
    topics: registry.topicsForLevel(level).map((topic) => topic.id),
    seed,
  };
}

/**
 * Om dagens brett på dette nivået allerede er spilt.
 *
 * Trenger ingen ny lagring: brettresultatene inneholder allerede seeden, og
 * seeden er utledet av datoen.
 */
export function dailyPlayed(progress: Progress, date: Date, level: Level): boolean {
  const seed = dailySeed(date, level);
  return progress.boards.some((board) => board.seed === seed);
}

/** Nivåene der dagens brett er spilt. */
export function dailyPlayedLevels(progress: Progress, date: Date): Level[] {
  return LEVELS.filter((level) => dailyPlayed(progress, date, level));
}

/** Resultatet fra dagens brett, hvis det er spilt. */
export function dailyResult(
  progress: Progress,
  date: Date,
  level: Level,
): Progress['boards'][number] | null {
  const seed = dailySeed(date, level);
  return progress.boards.find((board) => board.seed === seed) ?? null;
}
