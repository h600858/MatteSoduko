/**
 * Felles utgangspunkt for testene.
 *
 * Nivå og temaer leses ut av registeret i stedet for å skrives som lister her.
 * Da faller ikke testene sammen den dagen et nytt tema legges til.
 */
import { taskRegistry } from '../core/tasks/registry.ts';
import type { Level, Topic } from '../core/tasks/types.ts';

/** Nivået testene bruker når selve nivået ikke er poenget. */
export const NIVAA: Level = 'middels';

/** Alle temaer som finnes på NIVAA. */
export const ALLE_TEMAER: readonly Topic[] = taskRegistry
  .topicsForLevel(NIVAA)
  .map((topic) => topic.id);

/** Temaene på et vilkårlig nivå. */
export function temaerPaa(level: Level): readonly Topic[] {
  return taskRegistry.topicsForLevel(level).map((topic) => topic.id);
}
