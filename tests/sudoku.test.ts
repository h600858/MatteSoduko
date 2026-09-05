import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng.ts';
import type { BoardDifficulty } from '../core/sudoku/generate.ts';
import {
  dig,
  generatePuzzle,
  generateSolved,
  holesForDifficulty,
} from '../core/sudoku/generate.ts';
import type { Grid } from '../core/sudoku/grid.ts';
import {
  BOARD_SIZES,
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

const DIFFICULTIES: BoardDifficulty[] = [1, 2, 3];

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
  it('gjenskaper løsningen til et gravd brett', () => {
    for (const size of BOARD_SIZES) {
      const { puzzle, solution } = generatePuzzle({
        size,
        boardDifficulty: 3,
        rng: createRng(`losning:${size}`),
      });
      const solved = solve(puzzle);
      expect(solved).not.toBeNull();
      expect(solved?.cells).toEqual(solution.cells);
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
    it(`${size}x${size} har nøyaktig én løsning og er gyldig`, () => {
      for (let i = 0; i < BOARDS_PER_SIZE; i += 1) {
        const boardDifficulty = DIFFICULTIES[i % DIFFICULTIES.length] ?? 2;
        const { puzzle, solution } = generatePuzzle({
          size,
          boardDifficulty,
          rng: createRng(`brett:${size}:${i}`),
        });

        // Fasiten er et gyldig komplett brett.
        assertCompleteAndValid(solution);

        // Brettet med hull bryter ingen regler.
        const check = validate(puzzle);
        expect(check.valid, `brett ${i} (${size}x${size}) bryter reglene`).toBe(true);
        expect(check.complete).toBe(false);
        expect(isFilled(puzzle)).toBe(false);

        // Og det har nøyaktig én løsning.
        expect(
          countSolutions(puzzle, 2),
          `brett ${i} (${size}x${size}, nivå ${boardDifficulty}) er ikke entydig`,
        ).toBe(1);
      }
    });
  }

  it('treffer rimelig nær bestilt hulltall', () => {
    for (const size of BOARD_SIZES) {
      for (const difficulty of DIFFICULTIES) {
        const wanted = holesForDifficulty(size, difficulty);
        const { puzzle } = generatePuzzle({
          size,
          boardDifficulty: difficulty,
          rng: createRng(`hull:${size}:${difficulty}`),
        });
        const actual = countEmpty(puzzle);
        expect(actual).toBeLessThanOrEqual(wanted);
        expect(
          actual,
          `${size}x${size} nivå ${difficulty}: fikk ${actual} av ${wanted} hull`,
        ).toBeGreaterThanOrEqual(Math.floor(wanted * 0.75));
      }
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
      boardDifficulty: 2,
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
      boardDifficulty: 2,
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
