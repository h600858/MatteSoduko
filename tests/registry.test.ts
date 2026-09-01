import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';
import { createRegistry, taskRegistry } from '../core/tasks/registry.ts';
import type { Difficulty, Topic } from '../core/tasks/types.ts';
import { ALL_TOPICS, taskKey } from '../core/tasks/types.ts';

const TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const DIFFICULTIES: Difficulty[] = [1, 2, 3];

describe('oppgaveregisteret', () => {
  it('leverer en verifisert oppgave med bestilt svar for alle svar og vanskelighetsgrader', () => {
    for (const maxDifficulty of DIFFICULTIES) {
      for (const targetAnswer of TARGETS) {
        const task = taskRegistry.generateTask({
          topics: ALL_TOPICS,
          maxDifficulty,
          targetAnswer,
          rng: createRng(`reg:${maxDifficulty}:${targetAnswer}`),
        });

        expect(task, `fant ingen oppgave for svar ${targetAnswer} på nivå ${maxDifficulty}`)
          .not.toBeNull();
        expect(task?.answer).toBe(targetAnswer);
        expect(task?.verify()).toBe(true);
      }
    }
  });

  it('velger bare maler innenfor valgt tema og vanskelighetsgrad', () => {
    for (const maxDifficulty of DIFFICULTIES) {
      for (const topic of ALL_TOPICS) {
        const pool = taskRegistry.candidates({
          topics: [topic],
          maxDifficulty,
          targetAnswer: 6,
        });
        for (const template of pool) {
          expect(template.topic).toBe(topic);
          expect(template.difficulty).toBeLessThanOrEqual(maxDifficulty);
        }
      }
    }
  });

  it('hopper over maler som ikke dekker svaret', () => {
    const pool = taskRegistry.candidates({
      topics: ['derivasjon'],
      maxDifficulty: 3,
      targetAnswer: 7,
    });
    expect(pool.map((template) => template.id)).not.toContain('deriv.kjerne');

    const evenPool = taskRegistry.candidates({
      topics: ['derivasjon'],
      maxDifficulty: 3,
      targetAnswer: 8,
    });
    expect(evenPool.map((template) => template.id)).toContain('deriv.kjerne');
  });

  it('returnerer null når ingen mal passer', () => {
    // Derivasjon har ingen maler på nivå 1.
    const pool = taskRegistry.candidates({
      topics: ['derivasjon'],
      maxDifficulty: 1,
      targetAnswer: 4,
    });
    expect(pool).toHaveLength(0);

    const task = taskRegistry.generateTask({
      topics: ['derivasjon'],
      maxDifficulty: 1,
      targetAnswer: 4,
      rng: createRng('tom'),
    });
    expect(task).toBeNull();
  });

  it('respekterer exclude og gir unike oppgavetekster for samme svar', () => {
    // Ni forekomster av samme siffer er det verste tilfellet på et 9x9-brett.
    const used = new Set<string>();
    const rng = createRng('unike');
    for (let i = 0; i < 9; i += 1) {
      const task = taskRegistry.generateTask({
        topics: ALL_TOPICS,
        maxDifficulty: 3,
        targetAnswer: 7,
        rng,
        exclude: used,
      });
      expect(task, `klarte ikke å lage unik oppgave nummer ${i + 1}`).not.toBeNull();
      if (task === null) return;
      const key = taskKey(task);
      expect(used.has(key)).toBe(false);
      used.add(key);
    }
    expect(used.size).toBe(9);
  });

  it('gir identisk oppgave for samme seed', () => {
    const options = {
      topics: ALL_TOPICS,
      maxDifficulty: 3 as Difficulty,
      targetAnswer: 5,
    };
    const first = taskRegistry.generateTask({ ...options, rng: createRng('lik-seed') });
    const second = taskRegistry.generateTask({ ...options, rng: createRng('lik-seed') });
    expect(first).not.toBeNull();
    expect(second?.templateId).toBe(first?.templateId);
    expect(second?.latex).toBe(first?.latex);
    expect(second?.prompt).toBe(first?.prompt);
  });

  it('lar nye temaer registreres uten å endre motoren', () => {
    const utvidet = taskRegistry.register({
      id: 'test.konstant',
      topic: 'funksjoner' as Topic,
      difficulty: 1,
      build: (target) => ({
        templateId: 'test.konstant',
        latex: `${target}`,
        prompt: 'Les tallet.',
        answer: target,
        steps: ['Tallet står der.'],
        verify: () => true,
      }),
    });

    expect(utvidet.templates.length).toBe(taskRegistry.templates.length + 1);
    expect(utvidet.byId('test.konstant')).toBeDefined();
    // Det opprinnelige registeret er urørt.
    expect(taskRegistry.byId('test.konstant')).toBeUndefined();
  });

  it('avviser duplikate mal-id-er', () => {
    const template = taskRegistry.templates[0];
    expect(template).toBeDefined();
    if (template === undefined) return;
    expect(() => createRegistry([template, template])).toThrow();
  });
});
