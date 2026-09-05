/**
 * Løser og løsningsteller.
 *
 * Kandidatene holdes i bitmasker per rad, kolonne og blokk, og søket velger
 * alltid den tomme cellen med færrest muligheter først. Det gjør tellingen rask
 * nok til at graveren kan kalle den én gang per fjernet celle.
 */
import type { BoardSize, Grid } from './grid.ts';
import { createGrid } from './grid.ts';

interface SearchState {
  readonly size: BoardSize;
  readonly full: number;
  readonly blockOf: Int32Array;
  readonly cells: Int32Array;
  readonly rowMask: Int32Array;
  readonly colMask: Int32Array;
  readonly blockMask: Int32Array;
}

function popcount(mask: number): number {
  let value = mask;
  let count = 0;
  while (value !== 0) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

/**
 * Bygger søketilstanden. Returnerer null hvis brettet allerede bryter reglene,
 * for da finnes det ingen løsninger i det hele tatt.
 */
function buildState(grid: Grid): SearchState | null {
  const { size, blockRows, blockCols } = grid;
  const perBand = size / blockCols;
  const cellCount = size * size;

  const blockOf = new Int32Array(cellCount);
  const cells = new Int32Array(cellCount);
  const rowMask = new Int32Array(size);
  const colMask = new Int32Array(size);
  const blockMask = new Int32Array(size);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const index = row * size + col;
      const block = Math.floor(row / blockRows) * perBand + Math.floor(col / blockCols);
      blockOf[index] = block;

      const value = grid.cells[index] ?? 0;
      cells[index] = value;
      if (value === 0) continue;

      const bit = 1 << (value - 1);
      if (
        ((rowMask[row] ?? 0) & bit) !== 0 ||
        ((colMask[col] ?? 0) & bit) !== 0 ||
        ((blockMask[block] ?? 0) & bit) !== 0
      ) {
        return null;
      }
      rowMask[row] = (rowMask[row] ?? 0) | bit;
      colMask[col] = (colMask[col] ?? 0) | bit;
      blockMask[block] = (blockMask[block] ?? 0) | bit;
    }
  }

  return {
    size,
    full: (1 << size) - 1,
    blockOf,
    cells,
    rowMask,
    colMask,
    blockMask,
  };
}

/** Indeksen til den tomme cellen med færrest kandidater, eller -1 hvis full. */
function pickCell(state: SearchState): { index: number; candidates: number } {
  const { size, cells, rowMask, colMask, blockMask, blockOf, full } = state;
  let bestIndex = -1;
  let bestCandidates = 0;
  let bestCount = Number.POSITIVE_INFINITY;

  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index] !== 0) continue;

    const row = Math.floor(index / size);
    const col = index % size;
    const block = blockOf[index] ?? 0;
    const used = (rowMask[row] ?? 0) | (colMask[col] ?? 0) | (blockMask[block] ?? 0);
    const candidates = full & ~used;
    const count = popcount(candidates);

    if (count < bestCount) {
      bestCount = count;
      bestIndex = index;
      bestCandidates = candidates;
      // Ingenting er bedre enn en celle som bare har én mulighet.
      if (count <= 1) break;
    }
  }

  return { index: bestIndex, candidates: bestCandidates };
}

/**
 * Teller løsninger. Stopper så snart `limit` løsninger er funnet, slik at
 * entydighetssjekken slipper å lete videre etter den andre løsningen.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  if (limit < 1) return 0;
  const state = buildState(grid);
  if (state === null) return 0;

  let found = 0;

  const search = (): void => {
    const { index, candidates } = pickCell(state);
    if (index === -1) {
      found += 1;
      return;
    }
    if (candidates === 0) return;

    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const block = state.blockOf[index] ?? 0;

    let remaining = candidates;
    while (remaining !== 0 && found < limit) {
      const bit = remaining & -remaining;
      remaining ^= bit;

      state.cells[index] = Math.log2(bit) + 1;
      state.rowMask[row] = (state.rowMask[row] ?? 0) | bit;
      state.colMask[col] = (state.colMask[col] ?? 0) | bit;
      state.blockMask[block] = (state.blockMask[block] ?? 0) | bit;

      search();

      state.cells[index] = 0;
      state.rowMask[row] = (state.rowMask[row] ?? 0) & ~bit;
      state.colMask[col] = (state.colMask[col] ?? 0) & ~bit;
      state.blockMask[block] = (state.blockMask[block] ?? 0) & ~bit;
    }
  };

  search();
  return found;
}

/** Første løsning, eller null hvis brettet ikke kan løses. */
export function solve(grid: Grid): Grid | null {
  const state = buildState(grid);
  if (state === null) return null;

  let solution: number[] | null = null;

  const search = (): boolean => {
    const { index, candidates } = pickCell(state);
    if (index === -1) {
      solution = Array.from(state.cells);
      return true;
    }
    if (candidates === 0) return false;

    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const block = state.blockOf[index] ?? 0;

    let remaining = candidates;
    while (remaining !== 0) {
      const bit = remaining & -remaining;
      remaining ^= bit;

      state.cells[index] = Math.log2(bit) + 1;
      state.rowMask[row] = (state.rowMask[row] ?? 0) | bit;
      state.colMask[col] = (state.colMask[col] ?? 0) | bit;
      state.blockMask[block] = (state.blockMask[block] ?? 0) | bit;

      if (search()) return true;

      state.cells[index] = 0;
      state.rowMask[row] = (state.rowMask[row] ?? 0) & ~bit;
      state.colMask[col] = (state.colMask[col] ?? 0) & ~bit;
      state.blockMask[block] = (state.blockMask[block] ?? 0) & ~bit;
    }

    return false;
  };

  if (!search() || solution === null) return null;
  return createGrid(grid.size, solution);
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}
