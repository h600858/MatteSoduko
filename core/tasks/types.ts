import type { Rng } from '../rng.ts';

/** 1 = direkte innsetting, 2 = én regel, 3 = sammensatte regler / flere steg. */
export type Difficulty = 1 | 2 | 3;

/**
 * Temaer. Nye temaer (statistikk, integrasjon) legges til her og registreres i
 * registeret uten at motoren må endres.
 */
export type Topic = 'derivasjon' | 'funksjoner';

export const ALL_TOPICS: readonly Topic[] = ['derivasjon', 'funksjoner'];

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
  difficulty: Difficulty;
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
