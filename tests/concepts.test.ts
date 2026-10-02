import { describe, expect, it } from 'vitest';
import { generateBoard } from '../core/game/engine.ts';
import { focusCell, hintView, startSession, takeHint } from '../core/game/session.ts';
import { CONCEPTS, conceptById } from '../core/tasks/concepts.ts';
import { allTemplates, createRegistry, taskRegistry } from '../core/tasks/registry.ts';
import { LEVELS } from '../core/tasks/types.ts';
import { temaerPaa } from './helpers.ts';

describe('fagstoffet henger sammen', () => {
  it('gir hver mal et konsept som finnes', () => {
    for (const template of allTemplates) {
      expect(
        conceptById(template.concept),
        `${template.id} peker på konseptet «${template.concept}», som ikke finnes`,
      ).toBeDefined();
    }
  });

  it('har ingen konsepter uten maler', () => {
    const brukt = new Set(allTemplates.map((template) => template.concept));
    for (const concept of CONCEPTS) {
      expect(brukt.has(concept.id), `konseptet ${concept.id} brukes ikke av noen mal`).toBe(
        true,
      );
    }
  });

  it('har unike id-er', () => {
    const ider = CONCEPTS.map((concept) => concept.id);
    expect(new Set(ider).size).toBe(ider.length);
  });

  it('dekker alle fire nivåene', () => {
    for (const level of LEVELS) {
      const konsepter = new Set(
        allTemplates.filter((t) => t.level === level).map((t) => t.concept),
      );
      expect(konsepter.size, `nivå ${level} mangler konsepter`).toBeGreaterThan(0);
    }
  });
});

describe('konseptene er fullstendige', () => {
  for (const concept of CONCEPTS) {
    it(`${concept.id} har alt et hint trenger`, () => {
      expect(concept.title.length).toBeGreaterThan(2);
      // Introduksjonen skal forklare hva slags oppgave dette er.
      expect(concept.intro.length).toBeGreaterThan(40);
      expect(concept.rulesHeading.length).toBeGreaterThan(3);
      expect(concept.guidance.length).toBeGreaterThan(40);

      // Tabellen skal vise flere regler, ikke bare den som passer. Å finne
      // riktig regel er en del av oppgaven.
      expect(concept.rules.length).toBeGreaterThanOrEqual(3);
      for (const rule of concept.rules) {
        expect(rule.fn.length).toBeGreaterThan(0);
        expect(rule.result.length).toBeGreaterThan(0);
      }

      expect(concept.sources.length).toBeGreaterThan(0);
    });
  }

  it('peker bare på ekte nettadresser over https', () => {
    for (const concept of CONCEPTS) {
      for (const source of concept.sources) {
        expect(source.url.startsWith('https://'), `${source.url} er ikke https`).toBe(true);
        expect(() => new URL(source.url)).not.toThrow();
        expect(source.label.length).toBeGreaterThan(3);
        expect(source.note.length).toBeGreaterThan(3);
      }
    }
  });

  it('bruker LaTeX-kommandoene riktig i regeltabellen', () => {
    // Samme felle som i oppgavetekstene: en kommando uten backslash rendres
    // som bokstaver.
    const bar = /(?<!\\)\b(cdot|frac|sqrt|pm|ln|log_|int|lim|infty)\b/;
    for (const concept of CONCEPTS) {
      for (const rule of concept.rules) {
        for (const tekst of [rule.fn, rule.result]) {
          const treff = bar.exec(tekst);
          expect(treff, `${concept.id}: «${tekst}» mangler backslash foran ${treff?.[1] ?? ''}`)
            .toBeNull();
        }
      }
    }
  });
});

describe('konsepthintet i spill', () => {
  it('gir konseptet som første hint, uten å røpe løsningen', () => {
    for (const level of LEVELS) {
      const board = generateBoard({
        size: 6,
        topics: temaerPaa(level),
        level,
        seed: `konsept:${level}`,
      });
      const første = board.cells.find((cell) => !cell.given);
      if (første === undefined) continue;

      let s = startSession({ board, mode: 'rolig', now: 0 });
      s = focusCell(s, første.row, første.col, 0);
      s = takeHint(s);

      const view = hintView(s);
      expect(view.level).toBe(1);
      expect(view.concept, `nivå ${level} mangler konsept`).not.toBeNull();
      // Ingen steg og ingen fasit på første nivå.
      expect(view.steps).toEqual([]);
      expect(view.answer).toBeNull();
      // Konseptet skal stemme med malen.
      const mal = taskRegistry.byId(første.task?.templateId ?? '');
      expect(view.concept?.id).toBe(mal?.concept);
    }
  });

  it('bygger på seg for hvert nivå, uten å miste konseptet', () => {
    const board = generateBoard({
      size: 6,
      topics: temaerPaa('vanskelig'),
      level: 'vanskelig',
      seed: 'trapp',
    });
    const mål = board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    let s = focusCell(startSession({ board, mode: 'rolig', now: 0 }), mål.row, mål.col, 0);
    const sett: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      s = takeHint(s);
      const view = hintView(s);
      expect(view.concept).not.toBeNull();
      sett.push(view.steps.length);
    }

    // Ingen steg, så ett, så alle.
    expect(sett[0]).toBe(0);
    expect(sett[1]).toBe(1);
    expect(sett[2]).toBe(mål.task?.steps.length);
    expect(hintView(s).answer).toBe(mål.solution);
  });

  it('tåler at malen ikke finnes i registeret som slås opp i', () => {
    const board = generateBoard({
      size: 4,
      topics: temaerPaa('enkel'),
      level: 'enkel',
      seed: 'ukjent-mal',
    });
    const mål = board.cells.find((cell) => !cell.given);
    if (mål === undefined) return;

    let s = focusCell(startSession({ board, mode: 'rolig', now: 0 }), mål.row, mål.col, 0);
    s = takeHint(s);

    // Et register uten malen skal gi hint uten konsept, ikke krasje.
    const tomtRegister = createRegistry([]);
    expect(() => hintView(s, tomtRegister)).not.toThrow();
    expect(hintView(s, tomtRegister).concept).toBeNull();
    // Stegene kommer fortsatt fra oppgaven selv.
    expect(hintView(s, tomtRegister).level).toBe(1);
  });
});
