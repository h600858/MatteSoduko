import type { Rng } from '../rng.ts';
import { derivasjonTemplates } from './templates/derivasjon.ts';
import { funksjonerTemplates } from './templates/funksjoner.ts';
import type { Difficulty, GeneratedTask, TaskTemplate, Topic } from './types.ts';
import { taskKey, templateCovers } from './types.ts';

export interface GenerateTaskOptions {
  /** Hvilke temaer brettet bruker. */
  topics: readonly Topic[];
  /** Maler med difficulty <= denne er lov. */
  maxDifficulty: Difficulty;
  /** Det bestilte svaret. Oppgaven som returneres har alltid denne fasiten. */
  targetAnswer: number;
  rng: Rng;
  /**
   * Oppgavenøkler som allerede er i bruk på brettet. Brukes for å hindre at to
   * celler med samme fasit får identisk oppgavetekst.
   */
  exclude?: ReadonlySet<string>;
  /**
   * Vekt per mal-id. Høyere vekt gir større sjanse for å bli valgt først.
   * Settes av den adaptive vektingen. Maler uten oppgitt vekt får 1.
   */
  weights?: ReadonlyMap<string, number>;
  /** Hvor mange ganger hver mal får prøve seg før registeret går videre. */
  attemptsPerTemplate?: number;
}

export interface CandidateOptions {
  topics: readonly Topic[];
  maxDifficulty: Difficulty;
  targetAnswer: number;
}

export interface TaskRegistry {
  readonly templates: readonly TaskTemplate[];
  byId(id: string): TaskTemplate | undefined;
  /** Maler som passer temaet, vanskelighetsgraden og det bestilte svaret. */
  candidates(options: CandidateOptions): readonly TaskTemplate[];
  /** Bygger én verifisert oppgave med det bestilte svaret, eller null. */
  generateTask(options: GenerateTaskOptions): GeneratedTask | null;
  /**
   * Nytt register med flere maler. Nye temaer (statistikk, integrasjon) legges
   * til her uten at motoren må endres.
   */
  register(...extra: readonly TaskTemplate[]): TaskRegistry;
}

const DEFAULT_ATTEMPTS_PER_TEMPLATE = 4;

export function createRegistry(templates: readonly TaskTemplate[]): TaskRegistry {
  const byIdMap = new Map<string, TaskTemplate>();
  for (const template of templates) {
    if (byIdMap.has(template.id)) {
      throw new Error(`Duplikat mal-id: ${template.id}`);
    }
    byIdMap.set(template.id, template);
  }

  const registry: TaskRegistry = {
    templates,

    byId(id) {
      return byIdMap.get(id);
    },

    candidates({ topics, maxDifficulty, targetAnswer }) {
      const wanted = new Set<Topic>(topics);
      return templates.filter(
        (template) =>
          wanted.has(template.topic) &&
          template.difficulty <= maxDifficulty &&
          templateCovers(template, targetAnswer),
      );
    },

    generateTask(options) {
      const {
        rng,
        targetAnswer,
        exclude,
        weights,
        attemptsPerTemplate = DEFAULT_ATTEMPTS_PER_TEMPLATE,
      } = options;

      const pool = registry.candidates(options);
      if (pool.length === 0) return null;

      const ordered = rng.weightedShuffle(pool, (template) => weights?.get(template.id) ?? 1);

      for (const template of ordered) {
        for (let i = 0; i < attemptsPerTemplate; i += 1) {
          const task = template.build(targetAnswer, rng);
          // build() har allerede prøvd mange parameterkombinasjoner internt.
          // Returnerer den null, hjelper det ikke å spørre samme mal igjen.
          if (task === null) break;
          if (task.answer !== targetAnswer) continue;
          if (!task.verify()) continue;
          if (exclude?.has(taskKey(task)) === true) continue;
          return task;
        }
      }

      return null;
    },

    register(...extra) {
      return createRegistry([...templates, ...extra]);
    },
  };

  return registry;
}

export const allTemplates: readonly TaskTemplate[] = [
  ...derivasjonTemplates,
  ...funksjonerTemplates,
];

/** Standardregisteret med alle maler som er implementert. */
export const taskRegistry: TaskRegistry = createRegistry(allTemplates);
