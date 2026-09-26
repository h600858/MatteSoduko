import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADAPTIVE,
  referenceMs,
  templateWeights,
  weightBreakdowns,
} from '../core/game/adaptive.ts';
import { generateBoard } from '../core/game/engine.ts';
import type { Progress, TemplateStats } from '../core/game/progress.ts';
import { emptyProgress } from '../core/game/progress.ts';
import { allTemplates } from '../core/tasks/registry.ts';
import { ALL_TOPICS } from '../core/tasks/types.ts';

const config = DEFAULT_ADAPTIVE;
const ALL_IDS = allTemplates.map((template) => template.id);

function stats(overrides: Partial<TemplateStats> = {}): TemplateStats {
  return {
    attempts: 10,
    correct: 10,
    solvedMs: 100_000,
    hinted: 0,
    wrongAttempts: 0,
    lastSeen: '2026-09-08T12:00:00.000Z',
    ...overrides,
  };
}

function progressWith(templates: Record<string, TemplateStats>): Progress {
  return { ...emptyProgress(), templates };
}

function weightOf(progress: Progress, id: string, ids: readonly string[] = ALL_IDS): number {
  return templateWeights(progress, { templateIds: ids }).get(id) ?? Number.NaN;
}

describe('vekting: det spesifikasjonen ber om', () => {
  it('trekker maler du bommer ofte på, oftere', () => {
    const progress = progressWith({
      sikker: stats({ attempts: 10, correct: 10, solvedMs: 100_000 }),
      bommer: stats({ attempts: 10, correct: 3, solvedMs: 30_000 }),
    });

    const ids = ['sikker', 'bommer'];
    expect(weightOf(progress, 'bommer', ids)).toBeGreaterThan(weightOf(progress, 'sikker', ids));
  });

  it('trekker maler du bruker lang tid på, oftere', () => {
    // Begge treffer alltid. Forskjellen er bare tiden.
    const progress = progressWith({
      rask: stats({ solvedMs: 10 * 5_000 }),
      middels: stats({ solvedMs: 10 * 20_000 }),
      treg: stats({ solvedMs: 10 * 90_000 }),
    });

    const ids = ['rask', 'middels', 'treg'];
    expect(weightOf(progress, 'treg', ids)).toBeGreaterThan(weightOf(progress, 'rask', ids));
  });

  it('demper maler du både treffer og er rask på', () => {
    const progress = progressWith({
      mestret: stats({ attempts: 20, correct: 20, solvedMs: 20 * 3_000 }),
      snitt: stats({ attempts: 20, correct: 20, solvedMs: 20 * 30_000 }),
    });

    const ids = ['mestret', 'snitt'];
    expect(weightOf(progress, 'mestret', ids)).toBeLessThan(config.baseWeight);
  });
});

describe('vekting: grenser og robusthet', () => {
  it('holder seg innenfor min og maks uansett tall', () => {
    const ekstreme = progressWith({
      katastrofe: stats({ attempts: 200, correct: 0, solvedMs: 0 }),
      perfekt: stats({ attempts: 200, correct: 200, solvedMs: 200 }),
      treg: stats({ attempts: 200, correct: 200, solvedMs: 200 * 10_000_000 }),
    });

    for (const row of weightBreakdowns(ekstreme, { templateIds: Object.keys(ekstreme.templates) })) {
      expect(row.weight).toBeGreaterThanOrEqual(config.minWeight);
      expect(row.weight).toBeLessThanOrEqual(config.maxWeight);
      expect(Number.isFinite(row.weight)).toBe(true);
    }
  });

  it('lar aldri en mal falle helt bort', () => {
    const progress = progressWith({ perfekt: stats({ attempts: 500, correct: 500, solvedMs: 500 }) });
    expect(weightOf(progress, 'perfekt', ['perfekt'])).toBeGreaterThan(0);
  });

  it('gir alle maler lik vekt når vi ikke vet noe', () => {
    const weights = templateWeights(emptyProgress(), { templateIds: ALL_IDS });
    expect(weights.size).toBe(ALL_IDS.length);
    const verdier = new Set(weights.values());
    expect(verdier.size).toBe(1);
    expect([...verdier][0]).toBe(config.noveltyWeight);
  });

  it('favoriserer maler som aldri er sett, over maler som sitter', () => {
    const progress = progressWith({
      'deriv.polynom2': stats({ attempts: 20, correct: 20, solvedMs: 20 * 2_000 }),
    });
    expect(weightOf(progress, 'deriv.kjerne')).toBeGreaterThan(
      weightOf(progress, 'deriv.polynom2'),
    );
  });

  it('stoler ikke på statistikken etter ett enkelt forsøk', () => {
    const ettBom = progressWith({ ny: stats({ attempts: 1, correct: 0, solvedMs: 0 }) });
    const mangeBom = progressWith({ ny: stats({ attempts: 20, correct: 0, solvedMs: 0 }) });

    const lite = weightOf(ettBom, 'ny', ['ny']);
    const mye = weightOf(mangeBom, 'ny', ['ny']);
    expect(lite).toBeLessThan(mye);
    // Ett uheldig bomskudd skal ikke sende malen til taket.
    expect(lite).toBeLessThan(config.maxWeight);
  });

  it('gir vekt for hver mal som etterspørres, også ukjente id-er', () => {
    const weights = templateWeights(emptyProgress(), {
      templateIds: [...ALL_IDS, 'statistikk.kommer.senere'],
    });
    expect(weights.get('statistikk.kommer.senere')).toBe(config.noveltyWeight);
    expect(weights.size).toBe(ALL_IDS.length + 1);
  });

  it('tåler tom statistikk uten referansetid', () => {
    expect(referenceMs(emptyProgress())).toBeNull();
    // Uten referanse skal tregheten være null, ikke NaN.
    const progress = progressWith({ ny: stats({ attempts: 5, correct: 0, solvedMs: 0 }) });
    const rad = weightBreakdowns(progress, { templateIds: ['ny'] })[0];
    expect(rad?.slowness).toBe(0);
  });

  it('regner medianen som referansetid', () => {
    const progress = progressWith({
      a: stats({ attempts: 1, correct: 1, solvedMs: 10_000 }),
      b: stats({ attempts: 1, correct: 1, solvedMs: 20_000 }),
      c: stats({ attempts: 1, correct: 1, solvedMs: 60_000 }),
    });
    expect(referenceMs(progress)).toBe(20_000);
  });

  it('muterer ikke statistikken den får inn', () => {
    const progress = progressWith({ a: stats() });
    const kopi = JSON.parse(JSON.stringify(progress)) as Progress;
    templateWeights(progress, { templateIds: ALL_IDS });
    expect(progress).toEqual(kopi);
  });
});

describe('vekting i brettbyggingen', () => {
  const baseOptions = {
    size: 9 as const,
    topics: ALL_TOPICS,
    taskDifficulty: 3 as const,
    boardDifficulty: 3 as const,
  };

  it('lar en tungt vektet mal dominere oppgavevalget', () => {
    // Alt annet mestret, én mal spilleren sliter med.
    const templates: Record<string, TemplateStats> = {};
    for (const id of ALL_IDS) {
      templates[id] = stats({ attempts: 30, correct: 30, solvedMs: 30 * 2_000 });
    }
    templates['func.verdi'] = stats({ attempts: 30, correct: 3, solvedMs: 3 * 90_000 });

    const weights = templateWeights(progressWith(templates), { templateIds: ALL_IDS });

    const uvektet = generateBoard({ ...baseOptions, seed: 'vekting' });
    const vektet = generateBoard({ ...baseOptions, seed: 'vekting', weights });

    const tell = (board: typeof uvektet): number =>
      board.cells.filter((cell) => cell.task?.templateId === 'func.verdi').length;

    expect(tell(vektet)).toBeGreaterThan(tell(uvektet));
  });

  it('flytter ikke på selve sudokuen når vektene endres', () => {
    // Brett og oppgaver trekker fra hver sin rng-strøm. Vektene skal bare
    // påvirke hvilke maler som velges, ikke hvilke tall som står hvor.
    const templates: Record<string, TemplateStats> = {};
    for (const id of ALL_IDS) templates[id] = stats({ attempts: 30, correct: 5 });
    const weights = templateWeights(progressWith(templates), { templateIds: ALL_IDS });

    const uvektet = generateBoard({ ...baseOptions, seed: 'samme-brett' });
    const vektet = generateBoard({ ...baseOptions, seed: 'samme-brett', weights });

    expect(vektet.puzzle.cells).toEqual(uvektet.puzzle.cells);
    expect(vektet.solution.cells).toEqual(uvektet.solution.cells);
  });

  it('er reproduserbart: samme seed og samme vekter gir samme oppgaver', () => {
    const templates: Record<string, TemplateStats> = {};
    for (const id of ALL_IDS) templates[id] = stats({ attempts: 12, correct: 6 });
    const weights = templateWeights(progressWith(templates), { templateIds: ALL_IDS });

    const a = generateBoard({ ...baseOptions, seed: 'repro-vekt', weights });
    const b = generateBoard({ ...baseOptions, seed: 'repro-vekt', weights });

    expect(b.cells.map((cell) => cell.task?.templateId ?? null)).toEqual(
      a.cells.map((cell) => cell.task?.templateId ?? null),
    );
    expect(b.cells.map((cell) => cell.task?.latex ?? null)).toEqual(
      a.cells.map((cell) => cell.task?.latex ?? null),
    );
  });

  it('bygger fortsatt et gyldig brett med skjeve vekter', () => {
    // Én mal på maks, resten på minimum.
    const weights = new Map<string, number>(ALL_IDS.map((id) => [id, config.minWeight]));
    weights.set('func.verdi', config.maxWeight);

    const board = generateBoard({ ...baseOptions, seed: 'skjev', weights });
    const tekster = new Set<string>();

    for (const cell of board.cells) {
      if (cell.given) {
        expect(cell.task).toBeNull();
        continue;
      }
      expect(cell.task).not.toBeNull();
      expect(cell.task?.answer).toBe(cell.solution);
      expect(cell.task?.verify()).toBe(true);
      const key = `${cell.task?.latex ?? ''}||${cell.task?.prompt ?? ''}`;
      expect(tekster.has(key)).toBe(false);
      tekster.add(key);
    }
  });
});
