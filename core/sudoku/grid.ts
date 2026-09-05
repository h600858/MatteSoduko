/**
 * Brettrepresentasjon og geometri.
 *
 * Et brett lagres som en flat liste med size*size verdier, radvis. 0 betyr tom
 * celle. Alle funksjoner her er rene: de returnerer nye brett i stedet for å
 * endre det de får inn.
 */

export type BoardSize = 4 | 6 | 9;

export const BOARD_SIZES: readonly BoardSize[] = [4, 6, 9];

export interface CellRef {
  readonly row: number;
  readonly col: number;
}

export interface Grid {
  readonly size: BoardSize;
  /** Antall rader i en blokk. */
  readonly blockRows: number;
  /** Antall kolonner i en blokk. */
  readonly blockCols: number;
  /** size*size verdier, radvis. 0 betyr tom. */
  readonly cells: readonly number[];
}

interface Geometry {
  readonly blockRows: number;
  readonly blockCols: number;
}

const GEOMETRY: Readonly<Record<BoardSize, Geometry>> = {
  4: { blockRows: 2, blockCols: 2 },
  6: { blockRows: 2, blockCols: 3 },
  9: { blockRows: 3, blockCols: 3 },
};

export function isBoardSize(value: number): value is BoardSize {
  return value === 4 || value === 6 || value === 9;
}

export function geometryFor(size: BoardSize): Geometry {
  return GEOMETRY[size];
}

/** Hvor mange blokker som ligger ved siden av hverandre i ett blokkbånd. */
export function blocksPerBand(size: BoardSize): number {
  return size / GEOMETRY[size].blockCols;
}

export function createEmptyGrid(size: BoardSize): Grid {
  const { blockRows, blockCols } = GEOMETRY[size];
  return {
    size,
    blockRows,
    blockCols,
    cells: new Array<number>(size * size).fill(0),
  };
}

/** Lager et brett fra en flat liste, og avviser feil lengde eller verdi. */
export function createGrid(size: BoardSize, cells: readonly number[]): Grid {
  if (cells.length !== size * size) {
    throw new Error(`Forventet ${size * size} celler, fikk ${cells.length}`);
  }
  for (const value of cells) {
    if (!Number.isInteger(value) || value < 0 || value > size) {
      throw new Error(`Ugyldig celleverdi ${value} for et ${size}x${size}-brett`);
    }
  }
  const { blockRows, blockCols } = GEOMETRY[size];
  return { size, blockRows, blockCols, cells: cells.slice() };
}

export function indexOf(size: number, row: number, col: number): number {
  return row * size + col;
}

export function valueAt(grid: Grid, row: number, col: number): number {
  return grid.cells[indexOf(grid.size, row, col)] ?? 0;
}

export function withValue(grid: Grid, row: number, col: number, value: number): Grid {
  const cells = grid.cells.slice();
  cells[indexOf(grid.size, row, col)] = value;
  return { ...grid, cells };
}

export function blockIndexOf(grid: Grid, row: number, col: number): number {
  const perBand = grid.size / grid.blockCols;
  return Math.floor(row / grid.blockRows) * perBand + Math.floor(col / grid.blockCols);
}

/** Alle cellene i én blokk, i radvis rekkefølge. */
export function cellsOfBlock(grid: Grid, blockIndex: number): CellRef[] {
  const perBand = grid.size / grid.blockCols;
  const bandRow = Math.floor(blockIndex / perBand) * grid.blockRows;
  const bandCol = (blockIndex % perBand) * grid.blockCols;

  const refs: CellRef[] = [];
  for (let r = 0; r < grid.blockRows; r += 1) {
    for (let c = 0; c < grid.blockCols; c += 1) {
      refs.push({ row: bandRow + r, col: bandCol + c });
    }
  }
  return refs;
}

/** Alle cellene i en rad. */
export function cellsOfRow(grid: Grid, row: number): CellRef[] {
  return Array.from({ length: grid.size }, (_unused, col) => ({ row, col }));
}

/** Alle cellene i en kolonne. */
export function cellsOfCol(grid: Grid, col: number): CellRef[] {
  return Array.from({ length: grid.size }, (_unused, row) => ({ row, col }));
}

/** Alle celleposisjoner på brettet, radvis. */
export function allCells(grid: Grid): CellRef[] {
  const refs: CellRef[] = [];
  for (let row = 0; row < grid.size; row += 1) {
    for (let col = 0; col < grid.size; col += 1) {
      refs.push({ row, col });
    }
  }
  return refs;
}

export function countEmpty(grid: Grid): number {
  return grid.cells.reduce((sum, value) => (value === 0 ? sum + 1 : sum), 0);
}

export function isFilled(grid: Grid): boolean {
  return grid.cells.every((value) => value !== 0);
}

/** Enkel tekstvisning, brukes av CLI-skript og til feilsøking. */
export function gridToString(grid: Grid): string {
  const width = String(grid.size).length;
  const lines: string[] = [];

  for (let row = 0; row < grid.size; row += 1) {
    const parts: string[] = [];
    for (let col = 0; col < grid.size; col += 1) {
      const value = valueAt(grid, row, col);
      parts.push((value === 0 ? '.' : String(value)).padStart(width));
      if ((col + 1) % grid.blockCols === 0 && col + 1 < grid.size) parts.push('|');
    }
    lines.push(parts.join(' '));
    if ((row + 1) % grid.blockRows === 0 && row + 1 < grid.size) {
      lines.push('-'.repeat(lines[0]?.length ?? 0));
    }
  }

  return lines.join('\n');
}
