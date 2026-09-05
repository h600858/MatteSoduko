/**
 * Generering av brett.
 *
 * Rekkefølgen er alltid: lag et komplett gyldig brett først, grav deretter hull
 * i det. Da er fasitsifferet i hver tomme celle kjent, og oppgavegeneratoren
 * kan bestille en oppgave med akkurat det svaret.
 */
import type { Rng } from '../rng.ts';
import type { BoardSize, Grid } from './grid.ts';
import { allCells, createGrid, geometryFor, valueAt, withValue } from './grid.ts';
import { countSolutions } from './solve.ts';

/** Vanskelighetsgrad for selve brettet. Uavhengig av oppgavenes nivå. */
export type BoardDifficulty = 1 | 2 | 3;

/**
 * Hvor mange hull vi sikter mot. Graveren kan ende opp med litt færre hvis
 * brettet ellers ville fått flere løsninger.
 */
const HOLES: Readonly<Record<BoardSize, Readonly<Record<BoardDifficulty, number>>>> = {
  4: { 1: 5, 2: 7, 3: 9 },
  6: { 1: 12, 2: 17, 3: 21 },
  9: { 1: 32, 2: 42, 3: 50 },
};

export function holesForDifficulty(size: BoardSize, difficulty: BoardDifficulty): number {
  return HOLES[size][difficulty];
}

/**
 * Komplett, gyldig brett med tallene 1..size. Backtracking med randomisert
 * kandidatrekkefølge, slik at samme seed alltid gir samme brett.
 */
export function generateSolved(size: BoardSize, rng: Rng): Grid {
  const { blockRows, blockCols } = geometryFor(size);
  const perBand = size / blockCols;
  const cellCount = size * size;

  const cells = new Int32Array(cellCount);
  const rowMask = new Int32Array(size);
  const colMask = new Int32Array(size);
  const blockMask = new Int32Array(size);

  const fill = (index: number): boolean => {
    if (index === cellCount) return true;

    const row = Math.floor(index / size);
    const col = index % size;
    const block = Math.floor(row / blockRows) * perBand + Math.floor(col / blockCols);
    const used = (rowMask[row] ?? 0) | (colMask[col] ?? 0) | (blockMask[block] ?? 0);

    const candidates: number[] = [];
    for (let value = 1; value <= size; value += 1) {
      if ((used & (1 << (value - 1))) === 0) candidates.push(value);
    }

    for (const value of rng.shuffle(candidates)) {
      const bit = 1 << (value - 1);
      cells[index] = value;
      rowMask[row] = (rowMask[row] ?? 0) | bit;
      colMask[col] = (colMask[col] ?? 0) | bit;
      blockMask[block] = (blockMask[block] ?? 0) | bit;

      if (fill(index + 1)) return true;

      cells[index] = 0;
      rowMask[row] = (rowMask[row] ?? 0) & ~bit;
      colMask[col] = (colMask[col] ?? 0) & ~bit;
      blockMask[block] = (blockMask[block] ?? 0) & ~bit;
    }

    return false;
  };

  if (!fill(0)) {
    throw new Error(`Klarte ikke å generere et komplett ${size}x${size}-brett`);
  }

  return createGrid(size, Array.from(cells));
}

/**
 * Fjerner celler én for én. Et fjern som gjør løsningen flertydig angres, slik
 * at brettet alltid har nøyaktig én løsning når vi er ferdige.
 *
 * Resultatet kan ha færre hull enn bestilt. Det er tilsiktet: entydighet veier
 * tyngre enn å treffe hulltallet nøyaktig.
 */
export function dig(grid: Grid, holes: number, rng: Rng): Grid {
  let current = grid;
  let removed = 0;

  for (const { row, col } of rng.shuffle(allCells(grid))) {
    if (removed >= holes) break;
    if (valueAt(current, row, col) === 0) continue;

    const candidate = withValue(current, row, col, 0);
    if (countSolutions(candidate, 2) === 1) {
      current = candidate;
      removed += 1;
    }
  }

  return current;
}

export interface PuzzleOptions {
  size: BoardSize;
  boardDifficulty: BoardDifficulty;
  rng: Rng;
}

export interface Puzzle {
  /** Brettet med hull. Nøyaktig én løsning. */
  puzzle: Grid;
  /** Den komplette løsningen. Fasitsifferet for hver tomme celle. */
  solution: Grid;
}

/** Komplett brett pluss et gravd brett med garantert entydig løsning. */
export function generatePuzzle({ size, boardDifficulty, rng }: PuzzleOptions): Puzzle {
  const solution = generateSolved(size, rng);
  const puzzle = dig(solution, holesForDifficulty(size, boardDifficulty), rng);
  return { puzzle, solution };
}
