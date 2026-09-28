import type { Rng } from '../rng.ts';

/**
 * Vanskelighetsnivå, knyttet til skoletrinn.
 *
 * Nivået er en egenskap ved malen, ikke ved brettet. Et brett velger ett nivå,
 * og bruker bare maler fra det nivået. Antall hull styres av brettets egen
 * vanskelighetsgrad, uavhengig av dette.
 */
export type Level = 'enkel' | 'middels' | 'vanskelig' | 'ultra';

export const LEVELS: readonly Level[] = ['enkel', 'middels', 'vanskelig', 'ultra'];

export interface LevelInfo {
  id: Level;
  label: string;
  /** Skoletrinnet nivået sikter mot. */
  trinn: string;
  description: string;
}

export const LEVEL_INFO: Readonly<Record<Level, LevelInfo>> = {
  enkel: {
    id: 'enkel',
    label: 'Enkel',
    trinn: 'Ungdomsskole',
    description: 'Likninger, regnerekkefølge og negative tall.',
  },
  middels: {
    id: 'middels',
    label: 'Middels',
    trinn: 'Videregående',
    description: 'Funksjoner, nullpunkt, logaritmer og derivasjon av polynomer.',
  },
  vanskelig: {
    id: 'vanskelig',
    label: 'Vanskelig',
    trinn: 'Universitet',
    description: 'Produktregel, kjerneregel, sammensatte og inverse funksjoner.',
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra vanskelig',
    trinn: 'Universitet, videregående emner',
    description: 'Bestemte og uegentlige integraler, areal mellom kurver.',
  },
};

export function isLevel(value: string): value is Level {
  return LEVELS.includes(value as Level);
}

/**
 * Tema-id. Fri streng, ikke en fast union.
 *
 * Det er med vilje: nye temaer skal kunne legges til ved å skrive én malfil og
 * én linje i temakatalogen, uten at typer eller motor må endres.
 */
export type Topic = string;

export interface TopicInfo {
  id: Topic;
  label: string;
  description: string;
}

export interface GeneratedTask {
  templateId: string;
  /** Oppgaveteksten som matematikk, rendres med KaTeX. */
  latex: string;
  /** Kort tekstlig spørsmål på norsk. */
  prompt: string;
  /** Fasit. Skal alltid være lik det bestilte svaret. */
  answer: number;
  /** Løsningssteg, brukes til hint og fasitvisning. */
  steps: string[];
  /** Uavhengig sjekk med mathjs. Skal returnere true. */
  verify: () => boolean;
}

export interface TaskTemplate {
  /** F.eks. "deriv.polynom2". */
  id: string;
  topic: Topic;
  level: Level;
  /**
   * Fagstoffet bak malen, fra core/tasks/concepts.ts. Brukes til det første
   * hintet: hva slags oppgave dette er, og hvilke regler som gjelder.
   */
  concept: string;
  /** Returnerer null hvis ingen gyldige parametre finnes for dette svaret. */
  build(target: number, rng: Rng): GeneratedTask | null;
  /**
   * Valgfritt: hvilke svar malen i det hele tatt er ment å dekke.
   * Utelatt betyr «alle». Brukes av registeret for å hoppe over maler som
   * garantert ikke kan treffe, og av testene for å skille «dekker ikke» fra
   * «klarte ikke».
   */
  coversTarget?(target: number): boolean;
}

/**
 * Nøkkel som identifiserer oppgaveteksten. To celler på samme brett skal aldri
 * få samme nøkkel.
 */
export function taskKey(task: GeneratedTask): string {
  return `${task.latex}||${task.prompt}`;
}

/** Om malen i det hele tatt er ment å kunne treffe dette svaret. */
export function templateCovers(template: TaskTemplate, target: number): boolean {
  return template.coversTarget === undefined || template.coversTarget(target);
}
