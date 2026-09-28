import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';
import { createRegistry, taskRegistry } from '../core/tasks/registry.ts';
import { TOPICS, topicInfo } from '../core/tasks/topics.ts';
import type { Level } from '../core/tasks/types.ts';
import { LEVELS, taskKey } from '../core/tasks/types.ts';
import { ALLE_TEMAER, NIVAA, temaerPaa } from './helpers.ts';

const TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('nivåer og temaer', () => {
  it('har maler på alle fire nivåene', () => {
    expect(taskRegistry.levels()).toEqual(LEVELS);
  });

  it('gir minst ett tema per nivå', () => {
    for (const level of LEVELS) {
      expect(taskRegistry.topicsForLevel(level).length, `nivå ${level}`).toBeGreaterThan(0);
    }
  });

  it('lar hver mal stå i temakatalogen', () => {
    for (const template of taskRegistry.templates) {
      expect(topicInfo(template.topic), `ukjent tema: ${template.topic}`).toBeDefined();
    }
  });

  it('plasserer likninger på enkel og integrasjon på ultra', () => {
    expect(temaerPaa('enkel')).toContain('likninger');
    expect(temaerPaa('ultra')).toContain('integrasjon');
  });

  it('tar med et tema som ikke står i katalogen, i stedet for å skjule det', () => {
    const utvidet = taskRegistry.register({
      id: 'ukjent.mal',
      topic: 'statistikk',
      level: 'middels',
      concept: 'derivasjon.regler',
      build: (target) => ({
        templateId: 'ukjent.mal',
        latex: `${target}`,
        prompt: 'Les tallet.',
        answer: target,
        steps: ['Tallet står der.'],
        verify: () => true,
      }),
    });

    const ider = utvidet.topicsForLevel('middels').map((topic) => topic.id);
    expect(ider).toContain('statistikk');
  });

  it('har maler for hvert tema i katalogen', () => {
    const brukt = new Set(taskRegistry.templates.map((template) => template.topic));
    for (const topic of TOPICS) {
      expect(brukt.has(topic.id), `katalogen har ${topic.id}, men ingen maler bruker det`).toBe(
        true,
      );
    }
  });
});

describe('oppgaveregisteret', () => {
  it('leverer en verifisert oppgave med bestilt svar på alle nivåer', () => {
    for (const level of LEVELS) {
      const topics = temaerPaa(level);
      for (const targetAnswer of TARGETS) {
        const task = taskRegistry.generateTask({
          topics,
          level,
          targetAnswer,
          rng: createRng(`reg:${level}:${targetAnswer}`),
        });

        expect(task, `fant ingen oppgave for svar ${targetAnswer} på nivå ${level}`).not.toBeNull();
        expect(task?.answer).toBe(targetAnswer);
        expect(task?.verify()).toBe(true);
      }
    }
  });

  it('velger bare maler fra valgt nivå og tema', () => {
    for (const level of LEVELS) {
      for (const topic of temaerPaa(level)) {
        const pool = taskRegistry.candidates({ topics: [topic], level, targetAnswer: 6 });
        expect(pool.length).toBeGreaterThan(0);
        for (const template of pool) {
          expect(template.topic).toBe(topic);
          expect(template.level).toBe(level);
        }
      }
    }
  });

  it('blander ikke inn maler fra andre nivåer', () => {
    const enkel = taskRegistry.candidates({
      topics: temaerPaa('enkel'),
      level: 'enkel',
      targetAnswer: 5,
    });
    expect(enkel.length).toBeGreaterThan(0);
    for (const template of enkel) {
      expect(template.level).toBe('enkel');
      expect(template.id.startsWith('deriv.')).toBe(false);
    }
  });

  it('hopper over maler som ikke dekker svaret', () => {
    const pool = taskRegistry.candidates({
      topics: ['derivasjon'],
      level: 'vanskelig',
      targetAnswer: 7,
    });
    expect(pool.map((template) => template.id)).not.toContain('deriv.kjerne');

    const partall = taskRegistry.candidates({
      topics: ['derivasjon'],
      level: 'vanskelig',
      targetAnswer: 8,
    });
    expect(partall.map((template) => template.id)).toContain('deriv.kjerne');
  });

  it('returnerer null når ingen mal passer', () => {
    // Integrasjon finnes ikke på enkel-nivået.
    const pool = taskRegistry.candidates({
      topics: ['integrasjon'],
      level: 'enkel',
      targetAnswer: 4,
    });
    expect(pool).toHaveLength(0);

    const task = taskRegistry.generateTask({
      topics: ['integrasjon'],
      level: 'enkel',
      targetAnswer: 4,
      rng: createRng('tom'),
    });
    expect(task).toBeNull();
  });

  it('respekterer exclude og gir unike oppgavetekster for samme svar', () => {
    // Ni forekomster av samme siffer er det verste tilfellet på et 9x9-brett.
    for (const level of LEVELS) {
      const used = new Set<string>();
      const rng = createRng(`unike:${level}`);
      for (let i = 0; i < 9; i += 1) {
        const task = taskRegistry.generateTask({
          topics: temaerPaa(level),
          level,
          targetAnswer: 7,
          rng,
          exclude: used,
        });
        expect(
          task,
          `nivå ${level}: klarte ikke å lage unik oppgave nummer ${i + 1}`,
        ).not.toBeNull();
        if (task === null) break;
        const key = taskKey(task);
        expect(used.has(key)).toBe(false);
        used.add(key);
      }
      expect(used.size, `nivå ${level}`).toBe(9);
    }
  });

  it('gir identisk oppgave for samme seed', () => {
    const options = { topics: ALLE_TEMAER, level: NIVAA as Level, targetAnswer: 5 };
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
      topic: 'funksjoner',
      level: 'middels',
      concept: 'funksjoner.verdi',
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
