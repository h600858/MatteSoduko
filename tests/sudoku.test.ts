import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';
import { rateGrid } from '../core/sudoku/difficulty.ts';
import {
  dig,
  generatePuzzle,
  generateSolved,
  taskCountFor,
} from '../core/sudoku/generate.ts';
import type { Grid } from '../core/sudoku/grid.ts';
import {
  BOARD_SIZES,
  allCells,
  blockIndexOf,
  cellsOfBlock,
  countEmpty,
  createGrid,
  isFilled,
  valueAt,
  withValue,
} from '../core/sudoku/grid.ts';
import { countSolutions, hasUniqueSolution, solve } from '../core/sudoku/solve.ts';
import { isMoveLegal, validate } from '../core/sudoku/validate.ts';

/** Antall brett per størrelse, jf. testkrav 3. */
const BOARDS_PER_SIZE = 100;

/** Kontrollerer at hver rad, kolonne og blokk inneholder 1..size nøyaktig én gang. */
function assertCompleteAndValid(grid: Grid): void {
  const result = validate(grid);
  expect(result.valid, `regelbrudd: ${JSON.stringify(result.violations)}`).toBe(true);
  expect(result.complete).toBe(true);

  const expected = Array.from({ length: grid.size }, (_unused, i) => i + 1);

  for (let index = 0; index < grid.size; index += 1) {
    const row: number[] = [];
    const col: number[] = [];
    for (let k = 0; k < grid.size; k += 1) {
      row.push(valueAt(grid, index, k));
      col.push(valueAt(grid, k, index));
    }
    const block = cellsOfBlock(grid, index).map((ref) => valueAt(grid, ref.row, ref.col));

    expect(row.slice().sort((a, b) => a - b)).toEqual(expected);
    expect(col.slice().sort((a, b) => a - b)).toEqual(expected);
    expect(block.slice().sort((a, b) => a - b)).toEqual(expected);
  }
}

describe('geometri', () => {
  it('deler 4x4 i 2x2, 6x6 i 2x3 og 9x9 i 3x3', () => {
    expect(generateSolved(4, createRng('g4')).blockRows).toBe(2);
    expect(generateSolved(4, createRng('g4')).blockCols).toBe(2);
    expect(generateSolved(6, createRng('g6')).blockRows).toBe(2);
    expect(generateSolved(6, createRng('g6')).blockCols).toBe(3);
    expect(generateSolved(9, createRng('g9')).blockRows).toBe(3);
    expect(generateSolved(9, createRng('g9')).blockCols).toBe(3);
  });

  it('gir hver celle riktig blokkindeks på et 6x6-brett', () => {
    const grid = generateSolved(6, createRng('blokk'));
    // Tre blokkbånd på to blokker hver.
    expect(blockIndexOf(grid, 0, 0)).toBe(0);
    expect(blockIndexOf(grid, 1, 2)).toBe(0);
    expect(blockIndexOf(grid, 0, 3)).toBe(1);
    expect(blockIndexOf(grid, 2, 0)).toBe(2);
    expect(blockIndexOf(grid, 5, 5)).toBe(5);
  });

  it('dekker alle celler nøyaktig én gang med blokkene', () => {
    for (const size of BOARD_SIZES) {
      const grid = generateSolved(size, createRng(`dekning:${size}`));
      const seen = new Set<string>();
      for (let block = 0; block < size; block += 1) {
        for (const ref of cellsOfBlock(grid, block)) {
          seen.add(`${ref.row},${ref.col}`);
        }
      }
      expect(seen.size).toBe(size * size);
    }
  });
});

describe('generateSolved', () => {
  for (const size of BOARD_SIZES) {
    it(`lager gyldige komplette ${size}x${size}-brett`, () => {
      for (let i = 0; i < 25; i += 1) {
        assertCompleteAndValid(generateSolved(size, createRng(`komplett:${size}:${i}`)));
      }
    });
  }

  it('gir identisk brett for samme seed og ulikt for ulik seed', () => {
    for (const size of BOARD_SIZES) {
      const a = generateSolved(size, createRng(`seed-a:${size}`));
      const b = generateSolved(size, createRng(`seed-a:${size}`));
      const c = generateSolved(size, createRng(`seed-b:${size}`));
      expect(b.cells).toEqual(a.cells);
      expect(c.cells).not.toEqual(a.cells);
    }
  });
});

describe('countSolutions', () => {
  it('finner nøyaktig én løsning for et komplett brett', () => {
    for (const size of BOARD_SIZES) {
      expect(countSolutions(generateSolved(size, createRng(`en:${size}`)), 2)).toBe(1);
    }
  });

  it('returnerer 0 for et brett som allerede bryter reglene', () => {
    const grid = createGrid(4, [
      1, 1, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    expect(countSolutions(grid, 2)).toBe(0);
    expect(solve(grid)).toBeNull();
  });

  it('stopper ved limit', () => {
    const tomt = createGrid(4, new Array<number>(16).fill(0));
    expect(countSolutions(tomt, 1)).toBe(1);
    expect(countSolutions(tomt, 2)).toBe(2);
    expect(countSolutions(tomt, 5)).toBe(5);
  });

  it('teller alle 288 løsninger for et tomt 4x4-brett', () => {
    expect(countSolutions(createGrid(4, new Array<number>(16).fill(0)), 1000)).toBe(288);
  });

  it('ser at et bytterektangel gjør brettet flertydig', () => {
    // Cellene (0,0), (0,2), (1,0) og (1,2) danner et mønster der verdiene 1 og
    // 3 kan bytte plass uten å bryte noen regel. Blankes de fire, finnes det
    // minst to løsninger.
    const solved = createGrid(4, [
      1, 2, 3, 4,
      3, 4, 1, 2,
      2, 1, 4, 3,
      4, 3, 2, 1,
    ]);
    expect(validate(solved).complete).toBe(true);
    expect(hasUniqueSolution(solved)).toBe(true);

    let grid = solved;
    for (const [row, col] of [[0, 0], [0, 2], [1, 0], [1, 2]] as const) {
      grid = withValue(grid, row, col, 0);
    }
    expect(countSolutions(grid, 2)).toBe(2);
    expect(hasUniqueSolution(grid)).toBe(false);
  });
});

describe('solve', () => {
  it('finner en gyldig utfylling av et tomt brett', () => {
    // Et tomt brett har mange løsninger, så solve kan ikke treffe fasiten.
    // Kravet er at det den finner er et lovlig komplett brett.
    for (const size of BOARD_SIZES) {
      const { puzzle } = generatePuzzle({ size, rng: createRng(`losning:${size}`) });
      const solved = solve(puzzle);
      expect(solved).not.toBeNull();
      if (solved === null) continue;
      assertCompleteAndValid(solved);
    }
  });

  it('gjenskaper fasiten når nok celler står', () => {
    // Så snart ledetrådene bestemmer brettet, må solve treffe nøyaktig fasiten.
    // Det er dette som gjør at spilleren kan dedusere seg i mål.
    for (const size of BOARD_SIZES) {
      const rng = createRng(`fasit:${size}`);
      const losning = generateSolved(size, rng);
      const medLedetrader = dig(losning, size * size, rng);
      expect(hasUniqueSolution(medLedetrader)).toBe(true);
      expect(solve(medLedetrader)?.cells).toEqual(losning.cells);
    }
  });
});

describe('dig', () => {
  it('etterlater alltid nøyaktig én løsning', () => {
    for (const size of BOARD_SIZES) {
      const solved = generateSolved(size, createRng(`grav:${size}`));
      const dug = dig(solved, size * size, createRng(`grav-rng:${size}`));
      expect(hasUniqueSolution(dug)).toBe(true);
      expect(countEmpty(dug)).toBeGreaterThan(0);
    }
  });

  it('lar givne celler beholde fasitverdien sin', () => {
    const solved = generateSolved(9, createRng('bevar'));
    const dug = dig(solved, 40, createRng('bevar-rng'));
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const value = valueAt(dug, row, col);
        if (value !== 0) {
          expect(value).toBe(valueAt(solved, row, col));
        }
      }
    }
  });

  it('fjerner aldri flere hull enn bestilt', () => {
    const solved = generateSolved(9, createRng('tak'));
    for (const holes of [10, 25, 40]) {
      expect(countEmpty(dig(solved, holes, createRng(`tak:${holes}`)))).toBeLessThanOrEqual(holes);
    }
  });
});

describe(`genererte brett: ${BOARDS_PER_SIZE} per størrelse`, () => {
  for (const size of BOARD_SIZES) {
    it(`${size}x${size} er helt tomt, med en gyldig fasit bak`, () => {
      for (let i = 0; i < BOARDS_PER_SIZE; i += 1) {
        const { puzzle, solution } = generatePuzzle({
          size,
          rng: createRng(`brett:${size}:${i}`),
        });

        // Fasiten er et gyldig komplett brett. Det er den som gir hver celle
        // sitt svar, og den invarianten er uendret.
        assertCompleteAndValid(solution);

        // Og brettet spilleren møter er tomt: hver eneste celle har en oppgave.
        expect(countEmpty(puzzle), `brett ${i} (${size}x${size}) er ikke tomt`).toBe(
          size * size,
        );
        expect(isFilled(puzzle)).toBe(false);
        expect(validate(puzzle).valid).toBe(true);
      }
    });
  }

  it('har en oppgave i hver celle, uten unntak', () => {
    for (const size of BOARD_SIZES) {
      const { puzzle } = generatePuzzle({ size, rng: createRng(`alle:${size}`) });
      expect(countEmpty(puzzle)).toBe(taskCountFor(size));
      expect(puzzle.cells.every((value) => value === 0)).toBe(true);
    }
  });

  it('er IKKE entydig fra start, og det er med vilje', () => {
    // Dette er bruddet med vanlig sudoku. Et tomt rutenett har mange gyldige
    // utfyllinger. Det går bra fordi oppgavene er ledetrådene: hver celle kan
    // alltid løses ved å regne, så spilleren står aldri fast.
    for (const size of BOARD_SIZES) {
      const { puzzle } = generatePuzzle({ size, rng: createRng(`flertydig:${size}`) });
      expect(countSolutions(puzzle, 2)).toBe(2);
      expect(hasUniqueSolution(puzzle)).toBe(false);
    }
  });

  it('blir entydig når minMathCells celler er fylt, om man velger godt', () => {
    // Kjerneløftet: tallet vi viser spilleren skal være oppnåelig. Vi beviser
    // det ved å finne et ledetrådsett av akkurat den størrelsen som gjør resten
    // entydig.
    for (const size of BOARD_SIZES) {
      for (let i = 0; i < 5; i += 1) {
        const rng = createRng(`terskel:${size}:${i}`);
        const { solution, minMathCells } = generatePuzzle({ size, rng });

        // Grav med samme strømmer: ett av forsøkene må treffe minMathCells.
        const ledetradStrom = createRng(`terskel:${size}:${i}`)
          .fork('ledetrader');
        let traff = false;
        for (let d = 0; d < 8 && !traff; d += 1) {
          const gravd = dig(solution, size * size, ledetradStrom.fork(`ledetrad:${d}`));
          const igjen = size * size - countEmpty(gravd);
          if (igjen === minMathCells) {
            // Og med de cellene stående er resten entydig bestemt.
            expect(hasUniqueSolution(gravd)).toBe(true);
            traff = true;
          }
        }
        expect(traff, `${size}x${size} brett ${i}: fant ikke settet på ${minMathCells}`).toBe(
          true,
        );
      }
    }
  });

  it('krever langt mindre enn halve brettet', () => {
    // Poenget med spillet: du skal slippe å regne alt. Målt snitt er 4 av 16,
    // 10 av 36 og 24 av 81, så under halvparten med god margin.
    for (const size of BOARD_SIZES) {
      for (let i = 0; i < 10; i += 1) {
        const { minMathCells } = generatePuzzle({ size, rng: createRng(`andel:${size}:${i}`) });
        expect(minMathCells).toBeGreaterThan(0);
        expect(
          minMathCells,
          `${size}x${size}: ${minMathCells} av ${size * size} er for mye`,
        ).toBeLessThan((size * size) / 2);
      }
    }
  });

  it('ligger nær de målte snittene', () => {
    const ventet: Readonly<Record<number, number>> = { 4: 4, 6: 10, 9: 24 };
    for (const size of BOARD_SIZES) {
      let sum = 0;
      const runder = 10;
      for (let i = 0; i < runder; i += 1) {
        sum += generatePuzzle({ size, rng: createRng(`snitt:${size}:${i}`) }).minMathCells;
      }
      const snitt = sum / runder;
      const mal = ventet[size] ?? 0;
      expect(
        Math.abs(snitt - mal),
        `${size}x${size}: snitt ${snitt.toFixed(1)}, ventet rundt ${mal}`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it('nar brettet er fylt nok, holder enkle teknikker hele veien', () => {
    // Spilleren skal kunne dedusere for hand, ikke bare i teorien. Vi fyller
    // tilfeldige celler fra fasiten og sjekker at entydighet og
    // handløsbarhet inntreffer samtidig.
    for (const size of [4, 6] as const) {
      for (let i = 0; i < 6; i += 1) {
        const rng = createRng(`forhand:${size}:${i}`);
        const { solution } = generatePuzzle({ size, rng });

        let brett = createGrid(size, new Array<number>(size * size).fill(0));
        let entydigVed = -1;
        let forHandVed = -1;
        let fylt = 0;

        for (const { row, col } of rng.fork('rekkefolge').shuffle(allCells(solution))) {
          brett = withValue(brett, row, col, valueAt(solution, row, col));
          fylt += 1;
          if (entydigVed < 0 && hasUniqueSolution(brett)) entydigVed = fylt;
          if (forHandVed < 0 && rateGrid(brett).unsolved === 0) forHandVed = fylt;
          if (entydigVed > 0 && forHandVed > 0) break;
        }

        expect(entydigVed).toBeGreaterThan(0);
        expect(
          forHandVed,
          `${size}x${size} brett ${i}: entydig ved ${entydigVed}, for hand ved ${forHandVed}`,
        ).toBe(entydigVed);
      }
    }
  });

  it('gir samme brett og samme terskel for samme seed', () => {
    for (const size of BOARD_SIZES) {
      const a = generatePuzzle({ size, rng: createRng(`repro:${size}`) });
      const b = generatePuzzle({ size, rng: createRng(`repro:${size}`) });
      expect(a.solution.cells).toEqual(b.solution.cells);
      expect(a.minMathCells).toBe(b.minMathCells);
    }
  });
});

describe('validate', () => {
  it('peker ut riktig rad, kolonne og blokk ved konflikt', () => {
    const solved = generateSolved(9, createRng('konflikt'));
    // Kopier verdien fra (0,0) inn i (1,1). Begge ligger i blokk 0, og de deler
    // hverken rad eller kolonne, så konflikten skal treffe rad 0 og 1,
    // kolonne 0 og 1, og blokk 0.
    const value = valueAt(solved, 0, 0);
    const broken = withValue(solved, 1, 1, value);

    const result = validate(broken);
    expect(result.valid).toBe(false);
    expect(result.complete).toBe(false);
    expect(result.blocks).toContain(0);
    expect(result.rows).toContain(1);
    expect(result.cols).toContain(1);
    expect(result.cells).toContainEqual({ row: 0, col: 0 });
    expect(result.cells).toContainEqual({ row: 1, col: 1 });
  });

  it('godtar et halvferdig brett uten regelbrudd', () => {
    const { puzzle } = generatePuzzle({
      size: 9,
      rng: createRng('halvferdig'),
    });
    const result = validate(puzzle);
    expect(result.valid).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.cells).toHaveLength(0);
  });

  it('finner duplikater i rad, kolonne og blokk hver for seg', () => {
    const rad = createGrid(4, [
      1, 0, 0, 1,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    expect(validate(rad).rows).toEqual([0]);
    expect(validate(rad).cols).toEqual([]);

    const kolonne = createGrid(4, [
      2, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      2, 0, 0, 0,
    ]);
    expect(validate(kolonne).cols).toEqual([0]);
    expect(validate(kolonne).rows).toEqual([]);

    const blokk = createGrid(4, [
      3, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    expect(validate(blokk).blocks).toEqual([0]);
    expect(validate(blokk).rows).toEqual([]);
    expect(validate(blokk).cols).toEqual([]);
  });
});

describe('isMoveLegal', () => {
  it('avviser trekk som kolliderer, og godtar trekk som ikke gjør det', () => {
    const { puzzle, solution } = generatePuzzle({
      size: 9,
      rng: createRng('trekk'),
    });

    let tested = 0;
    for (let row = 0; row < 9 && tested < 20; row += 1) {
      for (let col = 0; col < 9 && tested < 20; col += 1) {
        if (valueAt(puzzle, row, col) !== 0) continue;
        tested += 1;

        const correct = valueAt(solution, row, col);
        expect(isMoveLegal(puzzle, row, col, correct)).toBe(true);

        // En verdi som allerede står i samme rad kan ikke være lovlig.
        const conflicting = Array.from({ length: 9 }, (_unused, i) => i)
          .map((c) => valueAt(puzzle, row, c))
          .find((v) => v !== 0);
        if (conflicting !== undefined) {
          expect(isMoveLegal(puzzle, row, col, conflicting)).toBe(false);
        }
      }
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('behandler 0 som å tømme cellen', () => {
    const solved = generateSolved(4, createRng('tom-celle'));
    expect(isMoveLegal(solved, 0, 0, 0)).toBe(true);
  });
});
