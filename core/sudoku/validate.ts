/**
 * Regelvalidering.
 *
 * Returnerer ikke bare ja eller nei, men hvilke rader, kolonner og blokker som
 * bryter reglene og hvilke celler som er involvert. UI-et bruker det til å
 * markere konflikten der spilleren faktisk ser den.
 */
import type { CellRef, Grid } from './grid.ts';
import { blockIndexOf, cellsOfBlock, cellsOfCol, cellsOfRow, isFilled, valueAt } from './grid.ts';

export type UnitKind = 'rad' | 'kolonne' | 'blokk';

export interface Violation {
  kind: UnitKind;
  /** Rad-, kolonne- eller blokkindeks. */
  index: number;
  /** Verdien som forekommer mer enn én gang. */
  value: number;
  /** Cellene som deler verdien. */
  cells: CellRef[];
}

export interface ValidationResult {
  /** True hvis ingen regel er brutt. Et halvferdig brett kan godt være gyldig. */
  valid: boolean;
  /** True hvis brettet er både fullt og gyldig. */
  complete: boolean;
  /** Radindekser med konflikt. */
  rows: number[];
  /** Kolonneindekser med konflikt. */
  cols: number[];
  /** Blokkindekser med konflikt. */
  blocks: number[];
  /** Alle celler som inngår i minst én konflikt, uten duplikater. */
  cells: CellRef[];
  violations: Violation[];
}

/** Finner verdier som forekommer flere ganger i én enhet. */
function violationsIn(grid: Grid, kind: UnitKind, index: number, refs: CellRef[]): Violation[] {
  const byValue = new Map<number, CellRef[]>();

  for (const ref of refs) {
    const value = valueAt(grid, ref.row, ref.col);
    if (value === 0) continue;
    const bucket = byValue.get(value);
    if (bucket === undefined) {
      byValue.set(value, [ref]);
    } else {
      bucket.push(ref);
    }
  }

  const found: Violation[] = [];
  for (const [value, cells] of byValue) {
    if (cells.length > 1) {
      found.push({ kind, index, value, cells });
    }
  }
  return found;
}

export function validate(grid: Grid): ValidationResult {
  const violations: Violation[] = [];

  for (let index = 0; index < grid.size; index += 1) {
    violations.push(...violationsIn(grid, 'rad', index, cellsOfRow(grid, index)));
    violations.push(...violationsIn(grid, 'kolonne', index, cellsOfCol(grid, index)));
    violations.push(...violationsIn(grid, 'blokk', index, cellsOfBlock(grid, index)));
  }

  const rows = new Set<number>();
  const cols = new Set<number>();
  const blocks = new Set<number>();
  const cellKeys = new Set<string>();
  const cells: CellRef[] = [];

  for (const violation of violations) {
    if (violation.kind === 'rad') rows.add(violation.index);
    if (violation.kind === 'kolonne') cols.add(violation.index);
    if (violation.kind === 'blokk') blocks.add(violation.index);

    for (const ref of violation.cells) {
      const key = `${ref.row},${ref.col}`;
      if (!cellKeys.has(key)) {
        cellKeys.add(key);
        cells.push(ref);
      }
    }
  }

  const valid = violations.length === 0;

  return {
    valid,
    complete: valid && isFilled(grid),
    rows: [...rows].sort((a, b) => a - b),
    cols: [...cols].sort((a, b) => a - b),
    blocks: [...blocks].sort((a, b) => a - b),
    cells,
    violations,
  };
}

/**
 * Om én bestemt verdi kan settes i en celle uten å bryte reglene. Brukes av
 * spillmotoren når spilleren skriver et tall.
 */
export function isMoveLegal(grid: Grid, row: number, col: number, value: number): boolean {
  if (value === 0) return true;
  const block = blockIndexOf(grid, row, col);

  for (const ref of cellsOfRow(grid, row)) {
    if (ref.col !== col && valueAt(grid, ref.row, ref.col) === value) return false;
  }
  for (const ref of cellsOfCol(grid, col)) {
    if (ref.row !== row && valueAt(grid, ref.row, ref.col) === value) return false;
  }
  for (const ref of cellsOfBlock(grid, block)) {
    if ((ref.row !== row || ref.col !== col) && valueAt(grid, ref.row, ref.col) === value) {
      return false;
    }
  }

  return true;
}
