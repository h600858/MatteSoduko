import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';
import { allTemplates } from '../core/tasks/registry.ts';
import type { TaskTemplate } from '../core/tasks/types.ts';
import { templateCovers } from '../core/tasks/types.ts';

/** Antall genererte oppgaver per mal, jf. testkrav 1. */
const ITERATIONS = 500;

/** Alle svar som kan forekomme i en sudokucelle. */
const TARGETS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Run {
  attempts: number;
  nulls: number;
}

/**
 * Fanger LaTeX-kommandoer som har mistet backslashen sin, f.eks. "3 cdot 4" i
 * stedet for "3 \cdot 4". KaTeX ville rendret det som bokstaver.
 */
const BARE_LATEX_COMMAND = /(?<!\\)\b(cdot|frac|qquad|quad|log_|sqrt)\b/;

function assertLatexEscaping(text: string, where: string): void {
  const match = BARE_LATEX_COMMAND.exec(text);
  expect(match, `${where} mangler backslash foran "${match?.[1] ?? ''}": ${text}`).toBeNull();
}

/**
 * Kjører malen mange ganger med tilfeldig target og tilfeldig seed, og
 * kontrollerer hver eneste oppgave. Kaster i testen ved første avvik.
 */
function exercise(template: TaskTemplate): Run {
  const meta = createRng(`meta:${template.id}`);
  const run: Run = { attempts: 0, nulls: 0 };

  for (let i = 0; i < ITERATIONS; i += 1) {
    const target = meta.pick(TARGETS);
    if (!templateCovers(template, target)) continue;

    run.attempts += 1;
    const rng = createRng(`${template.id}:${i}:${target}:${meta.int(0, 1_000_000)}`);
    const task = template.build(target, rng);

    if (task === null) {
      run.nulls += 1;
      continue;
    }

    expect(task.templateId, `${template.id} setter feil templateId`).toBe(template.id);
    expect(task.answer, `${template.id} traff ikke bestilt svar ${target}`).toBe(target);
    expect(Number.isInteger(task.answer)).toBe(true);
    expect(task.latex.length).toBeGreaterThan(0);
    expect(task.prompt.length).toBeGreaterThan(0);
    expect(task.steps.length).toBeGreaterThan(0);
    assertLatexEscaping(task.latex, `${template.id} latex`);
    for (const step of task.steps) {
      expect(step.length).toBeGreaterThan(0);
      assertLatexEscaping(step, `${template.id} steg`);
    }
    // Uavhengig kontroll med mathjs, ikke med malens egen inversformel.
    expect(
      task.verify(),
      `${template.id} feilet verifisering for target ${target}: ${task.latex} | ${task.prompt}`,
    ).toBe(true);
  }

  return run;
}

describe('oppgavemaler', () => {
  it('har unike id-er', () => {
    const ids = allTemplates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dekker begge temaene', () => {
    const topics = new Set(allTemplates.map((template) => template.topic));
    expect(topics).toEqual(new Set(['derivasjon', 'funksjoner']));
  });

  for (const template of allTemplates) {
    it(`${template.id}: ${ITERATIONS} genererte oppgaver treffer bestilt svar og verifiserer`, () => {
      const run = exercise(template);
      expect(run.attempts).toBeGreaterThan(0);

      const nullRate = run.nulls / run.attempts;
      expect(
        nullRate,
        `${template.id} ga null i ${(nullRate * 100).toFixed(1)} % av ${run.attempts} forsøk`,
      ).toBeLessThanOrEqual(0.1);
    });
  }

  describe('deriv.kjerne', () => {
    const kjerne = allTemplates.find((template) => template.id === 'deriv.kjerne');

    it('er registrert', () => {
      expect(kjerne).toBeDefined();
    });

    it('melder selv fra om at odde svar ikke dekkes', () => {
      if (kjerne === undefined) return;
      for (const target of TARGETS) {
        expect(templateCovers(kjerne, target)).toBe(target % 2 === 0);
      }
    });

    it('returnerer null for odde svar', () => {
      if (kjerne === undefined) return;
      for (const target of [1, 3, 5, 7, 9]) {
        expect(kjerne.build(target, createRng(`odde:${target}`))).toBeNull();
      }
    });
  });

  it('gir identisk oppgave for samme mal, target og seed', () => {
    for (const template of allTemplates) {
      const target = template.id === 'deriv.kjerne' ? 4 : 5;
      const first = template.build(target, createRng(`repro:${template.id}`));
      const second = template.build(target, createRng(`repro:${template.id}`));
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second?.latex).toBe(first?.latex);
      expect(second?.prompt).toBe(first?.prompt);
      expect(second?.steps).toEqual(first?.steps);
    }
  });
});
