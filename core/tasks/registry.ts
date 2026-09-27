import type { Rng } from '../rng.ts';
import { derivasjonTemplates } from './templates/derivasjon.ts';
import { funksjonerTemplates } from './templates/funksjoner.ts';
import { integrasjonTemplates } from './templates/integrasjon.ts';
import { likningerTemplates } from './templates/likninger.ts';
import { topicInfo } from './topics.ts';
import type { GeneratedTask, Level, TaskTemplate, Topic, TopicInfo } from './types.ts';
import { LEVELS, taskKey, templateCovers } from './types.ts';

export interface GenerateTaskOptions {
  /** Hvilke temaer brettet bruker. */
  topics: readonly Topic[];
  /** Nivået brettet spilles på. Bare maler fra dette nivået brukes. */
  level: Level;
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
  level: Level;
  targetAnswer: number;
}

export interface TaskRegistry {
  readonly templates: readonly TaskTemplate[];
  byId(id: string): TaskTemplate | undefined;
  /** Nivåer som faktisk har maler. */
  levels(): readonly Level[];
  /** Temaer som har minst én mal på nivået, i katalogens rekkefølge. */
  topicsForLevel(level: Level): readonly TopicInfo[];
  /** Maler som passer temaet, nivået og det bestilte svaret. */
  candidates(options: CandidateOptions): readonly TaskTemplate[];
  /** Bygger én verifisert oppgave med det bestilte svaret, eller null. */
  generateTask(options: GenerateTaskOptions): GeneratedTask | null;
  /**
   * Nytt register med flere maler. Nye temaer legges til her uten at motoren
   * må endres.
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

    levels() {
      const funnet = new Set(templates.map((template) => template.level));
      return LEVELS.filter((level) => funnet.has(level));
    },

    topicsForLevel(level) {
      const ider = new Set(
        templates.filter((template) => template.level === level).map((t) => t.topic),
      );
      const ut: TopicInfo[] = [];
      for (const id of ider) {
        // Et tema uten katalogoppføring skal fortsatt kunne spilles.
        ut.push(topicInfo(id) ?? { id, label: id, description: '' });
      }
      // Katalogens rekkefølge, med ukjente temaer bakerst.
      return ut.sort((a, b) => {
        const ia = topicInfo(a.id) === undefined ? 999 : 0;
        const ib = topicInfo(b.id) === undefined ? 999 : 0;
        if (ia !== ib) return ia - ib;
        return a.label.localeCompare(b.label, 'nb');
      });
    },

    candidates({ topics, level, targetAnswer }) {
      const ønsket = new Set<Topic>(topics);
      return templates.filter(
        (template) =>
          ønsket.has(template.topic) &&
          template.level === level &&
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
  ...likningerTemplates,
  ...funksjonerTemplates,
  ...derivasjonTemplates,
  ...integrasjonTemplates,
];

/** Standardregisteret med alle maler som er implementert. */
export const taskRegistry: TaskRegistry = createRegistry(allTemplates);
