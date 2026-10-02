import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';
import { isDemanding, rateGrid } from '../core/sudoku/difficulty.ts';
import { dig, generatePuzzle, generateSolved } from '../core/sudoku/generate.ts';
import { createGrid, withValue } from '../core/sudoku/grid.ts';
import { solve } from '../core/sudoku/solve.ts';

describe('rateGrid', () => {
  it('kaller et komplett brett lett, uten noe å gjøre', () => {
    const løst = generateSolved(9, createRng('komplett'));
    const grad = rateGrid(løst);
    expect(grad.difficulty).toBe('lett');
    expect(grad.holes).toBe(0);
    expect(grad.unsolved).toBe(0);
    expect(grad.nakedSingles).toBe(0);
    expect(grad.hiddenSingles).toBe(0);
  });

  it('løser en enkelt tom celle med en naken ener', () => {
    const løst = generateSolved(9, createRng('en-celle'));
    const grad = rateGrid(withValue(løst, 4, 4, 0));
    expect(grad.difficulty).toBe('lett');
    expect(grad.nakedSingles).toBe(1);
    expect(grad.hiddenSingles).toBe(0);
    expect(grad.unsolved).toBe(0);
  });

  it('teller hullene brettet startet med', () => {
    const løst = generateSolved(6, createRng('hull'));
    const gravd = dig(løst, 14, createRng('hull-rng'));
    const grad = rateGrid(gravd);
    expect(grad.holes).toBe(14);
  });

  it('skiller brett som trenger skjulte enere fra dem som ikke gjør det', () => {
    // I stedet for et konstruert rutenett: grav ekte brett til vi har sett
    // begge utfallene. Da vet vi at inndelingen faktisk skiller.
    let lett = 0;
    let middels = 0;
    for (let i = 0; i < 80; i += 1) {
      const rng = createRng(`skille:${i}`);
      const gravd = dig(generateSolved(9, rng), 46, rng);
      const grad = rateGrid(gravd);
      if (grad.unsolved > 0) continue;

      // Kommer den i mål, må hver celle være fylt av én av de to teknikkene.
      expect(grad.nakedSingles + grad.hiddenSingles).toBe(grad.holes);

      if (grad.difficulty === 'lett') {
        expect(grad.hiddenSingles).toBe(0);
        lett += 1;
      } else {
        expect(grad.difficulty).toBe('middels');
        expect(grad.hiddenSingles).toBeGreaterThan(0);
        middels += 1;
      }
    }
    expect(lett, 'fant ingen brett som gikk opp med bare nakne enere').toBeGreaterThan(0);
    expect(middels, 'fant ingen brett som trengte skjulte enere').toBeGreaterThan(0);
  });

  it('gjetter aldri: et flertydig brett blir stående uløst', () => {
    // Et tomt brett har mange løsninger. Ingen teknikk kan velge mellom dem.
    const tomt = createGrid(4, new Array<number>(16).fill(0));
    const grad = rateGrid(tomt);
    expect(grad.difficulty).toBe('krevende');
    expect(grad.unsolved).toBe(16);
  });

  it('kaller et ugyldig brett krevende i stedet for å krasje', () => {
    const dobbel = createGrid(4, [
      1, 1, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    expect(() => rateGrid(dobbel)).not.toThrow();
    expect(rateGrid(dobbel).difficulty).toBe('krevende');
  });

  it('plasserer bare riktige tall når den kommer i mål', () => {
    // Teknikkene skal aldri kunne skrive inn noe som strider mot fasiten.
    for (let i = 0; i < 20; i += 1) {
      const rng = createRng(`riktig:${i}`);
      const løsning = generateSolved(6, rng);
      // Grav grunt, slik at brettet oftest går opp av seg selv.
      const gravd = dig(løsning, 8, rng);
      const grad = rateGrid(gravd);
      if (grad.unsolved > 0) continue;
      // Kom den i mål, må den ha kommet fram til nøyaktig fasiten.
      expect(solve(gravd)?.cells).toEqual(løsning.cells);
    }
  });
});

describe('isDemanding', () => {
  it('er sann bare for brett teknikkene ikke tar i mål', () => {
    const løst = generateSolved(9, createRng('krav'));
    expect(isDemanding(løst)).toBe(false);
    expect(isDemanding(createGrid(4, new Array<number>(16).fill(0)))).toBe(true);
  });

  it('holder for et tomt startbrett', () => {
    // Et tomt brett kan per definisjon ikke løses med teknikker alene.
    for (let i = 0; i < 10; i += 1) {
      const { puzzle } = generatePuzzle({ size: 9, rng: createRng(`krav:${i}`) });
      expect(isDemanding(puzzle), `brett ${i}`).toBe(true);
    }
  });
});

describe('vurdereren brukt på spillets egne brett', () => {
  it('sier at et tomt startbrett ikke kan deduseres', () => {
    // Slik skal det være: før du har regnet noe, finnes det ingenting å slutte
    // seg til. Matematikken er inngangen.
    for (const size of [4, 6, 9] as const) {
      const { puzzle } = generatePuzzle({ size, rng: createRng(`tomt:${size}`) });
      const grad = rateGrid(puzzle);
      expect(grad.difficulty).toBe('krevende');
      expect(grad.unsolved).toBe(size * size);
      expect(grad.nakedSingles).toBe(0);
    }
  });
});
