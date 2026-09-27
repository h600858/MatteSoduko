/**
 * Temakatalogen.
 *
 * Dette er hele listen over temaer appen kjenner. Skal et nytt tema legges til,
 * er oppskriften:
 *
 *   1. Skriv malene i core/tasks/templates/<tema>.ts
 *   2. Legg til én linje her med id, navn og beskrivelse
 *   3. Legg malene inn i allTemplates i registry.ts
 *
 * Ingenting i motoren, i UI-et eller i typene må endres. Hvilke nivåer et tema
 * dekker utledes av malene selv, så det finnes bare én kilde til den
 * sannheten.
 */
import type { TopicInfo } from './types.ts';

export const TOPICS: readonly TopicInfo[] = [
  {
    id: 'likninger',
    label: 'Likninger og regnerekkefølge',
    description: 'Løs for x, regn ut uttrykk, negative tall og parenteser.',
  },
  {
    id: 'funksjoner',
    label: 'Funksjoner',
    description: 'Funksjonsverdier, nullpunkt, logaritmer, vekst og skjæringspunkt.',
  },
  {
    id: 'derivasjon',
    label: 'Derivasjon',
    description: 'Den deriverte, tangenter, ekstremalpunkt, produkt- og kjerneregel.',
  },
  {
    id: 'integrasjon',
    label: 'Integrasjon',
    description: 'Bestemte integraler, areal mellom kurver og uegentlige integraler.',
  },
];

const BY_ID = new Map<string, TopicInfo>(TOPICS.map((topic) => [topic.id, topic]));

export function topicInfo(id: string): TopicInfo | undefined {
  return BY_ID.get(id);
}

/** Navnet på temaet, eller id-en hvis det ikke står i katalogen. */
export function topicLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}
