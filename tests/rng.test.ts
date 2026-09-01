import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';

const take = (next: () => number, count: number): number[] =>
  Array.from({ length: count }, () => next());

describe('createRng', () => {
  it('gir identisk sekvens for samme seed', () => {
    const a = createRng('mattesudoku');
    const b = createRng('mattesudoku');
    expect(take(() => a.next(), 200)).toEqual(take(() => b.next(), 200));
  });

  it('gir ulik sekvens for ulike seeder', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-2');
    expect(take(() => a.next(), 50)).not.toEqual(take(() => b.next(), 50));
  });

  it('holder seg i [0, 1)', () => {
    const rng = createRng('interval');
    for (let i = 0; i < 5_000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int() dekker hele intervallet og går aldri utenfor', () => {
    const rng = createRng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i += 1) {
      const value = rng.int(-3, 4);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThanOrEqual(4);
      seen.add(value);
    }
    expect(seen.size).toBe(8);
  });

  it('int() krever min <= max', () => {
    const rng = createRng('int-feil');
    expect(() => rng.int(5, 1)).toThrow();
  });

  it('shuffle() gir en permutasjon og muterer ikke input', () => {
    const rng = createRng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const frozen = input.slice();
    const shuffled = rng.shuffle(input);
    expect(input).toEqual(frozen);
    expect(shuffled.slice().sort((x, y) => x - y)).toEqual(frozen);
    expect(shuffled).not.toEqual(frozen);
  });

  it('pick() kaster på tom liste', () => {
    const rng = createRng('pick');
    expect(() => rng.pick([])).toThrow();
  });

  it('weightedShuffle() favoriserer høye vekter', () => {
    const rng = createRng('vekter');
    const items = ['tung', 'lett-a', 'lett-b', 'lett-c'];
    const weightOf = (item: string): number => (item === 'tung' ? 20 : 1);
    let forsteplasser = 0;
    for (let i = 0; i < 400; i += 1) {
      if (rng.weightedShuffle(items, weightOf)[0] === 'tung') forsteplasser += 1;
    }
    // Uvektet ville dette vaert rundt 100 av 400.
    expect(forsteplasser).toBeGreaterThan(220);
  });

  it('fork() er deterministisk for samme etikett', () => {
    const childA = createRng('rot').fork('brett');
    const childB = createRng('rot').fork('brett');
    expect(take(() => childA.next(), 20)).toEqual(take(() => childB.next(), 20));
  });

  it('fork() gir uavhengige strømmer for ulike etiketter', () => {
    const brett = createRng('rot').fork('brett');
    const oppgaver = createRng('rot').fork('oppgaver');
    expect(take(() => brett.next(), 20)).not.toEqual(take(() => oppgaver.next(), 20));
  });
});
