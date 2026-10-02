/**
 * Hvor vanskelig et sudokubrett faktisk er.
 *
 * Antall hull er bare et omtrentlig mål. Det som avgjør er hvilke teknikker
 * brettet krever. Her løses brettet med bare de to enkleste teknikkene et
 * menneske bruker:
 *
 *   naken ener  — en celle har bare én mulig verdi igjen
 *   skjult ener — en verdi har bare én mulig plass i en rad, kolonne eller blokk
 *
 * Kommer man i mål med bare disse, er brettet enkelt. Stopper det opp, kreves
 * det noe mer, og da er brettet krevende. Denne modulen gjetter aldri: den
 * stopper i stedet, og forteller hvor langt den kom.
 */
import type { Grid } from './grid.ts';

/** Teknikkene vurdereren kjenner, fra enklest til vanskeligst. */
export type Technique = 'naken-ener' | 'skjult-ener';

export type Difficulty = 'lett' | 'middels' | 'krevende';

export interface Rating {
  /**
   * Den groveste inndelingen:
   *   lett      — bare nakne enere trengs
   *   middels   — skjulte enere trengs også
   *   krevende  — de to teknikkene tar ikke brettet i mål
   */
  difficulty: Difficulty;
  /** Antall celler som stod igjen da teknikkene tok slutt. */
  unsolved: number;
  nakedSingles: number;
  hiddenSingles: number;
  /** Hvor mange tomme celler brettet startet med. */
  holes: number;
}

interface State {
  size: number;
  full: number;
  cells: Int32Array;
  rowMask: Int32Array;
  colMask: Int32Array;
  blockMask: Int32Array;
  blockOf: Int32Array;
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

function buildState(grid: Grid): State | null {
  const { size, blockRows, blockCols } = grid;
  const perBand = size / blockCols;
  const cellCount = size * size;

  const state: State = {
    size,
    full: (1 << size) - 1,
    cells: new Int32Array(cellCount),
    rowMask: new Int32Array(size),
    colMask: new Int32Array(size),
    blockMask: new Int32Array(size),
    blockOf: new Int32Array(cellCount),
  };

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const index = row * size + col;
      const block = Math.floor(row / blockRows) * perBand + Math.floor(col / blockCols);
      state.blockOf[index] = block;

      const value = grid.cells[index] ?? 0;
      state.cells[index] = value;
      if (value === 0) continue;

      const bit = 1 << (value - 1);
      if (
        (((state.rowMask[row] ?? 0) | (state.colMask[col] ?? 0) | (state.blockMask[block] ?? 0)) &
          bit) !== 0
      ) {
        return null;
      }
      state.rowMask[row] = (state.rowMask[row] ?? 0) | bit;
      state.colMask[col] = (state.colMask[col] ?? 0) | bit;
      state.blockMask[block] = (state.blockMask[block] ?? 0) | bit;
    }
  }

  return state;
}

/** Hvilke verdier som fortsatt er mulige i cellen, som en bitmaske. */
function candidates(state: State, index: number): number {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  const block = state.blockOf[index] ?? 0;
  const brukt =
    (state.rowMask[row] ?? 0) | (state.colMask[col] ?? 0) | (state.blockMask[block] ?? 0);
  return state.full & ~brukt;
}

function place(state: State, index: number, value: number): void {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  const block = state.blockOf[index] ?? 0;
  const bit = 1 << (value - 1);

  state.cells[index] = value;
  state.rowMask[row] = (state.rowMask[row] ?? 0) | bit;
  state.colMask[col] = (state.colMask[col] ?? 0) | bit;
  state.blockMask[block] = (state.blockMask[block] ?? 0) | bit;
}

/** Cellene i én enhet: rad, kolonne eller blokk. */
function unitIndices(grid: Grid, kind: 'rad' | 'kolonne' | 'blokk', index: number): number[] {
  const { size, blockRows, blockCols } = grid;
  const ut: number[] = [];

  if (kind === 'rad') {
    for (let col = 0; col < size; col += 1) ut.push(index * size + col);
  } else if (kind === 'kolonne') {
    for (let row = 0; row < size; row += 1) ut.push(row * size + index);
  } else {
    const perBand = size / blockCols;
    const startRow = Math.floor(index / perBand) * blockRows;
    const startCol = (index % perBand) * blockCols;
    for (let r = 0; r < blockRows; r += 1) {
      for (let c = 0; c < blockCols; c += 1) {
        ut.push((startRow + r) * size + startCol + c);
      }
    }
  }
  return ut;
}

/**
 * Vurderer brettet ved å løse det med bare de to enkleste teknikkene.
 *
 * Et ugyldig brett får «krevende» med alle cellene uløst. Det er en ærlig
 * beskrivelse: teknikkene kommer ingen vei.
 */
export function rateGrid(grid: Grid): Rating {
  const holes = grid.cells.filter((value) => value === 0).length;
  const state = buildState(grid);

  if (state === null) {
    return {
      difficulty: 'krevende',
      unsolved: holes,
      nakedSingles: 0,
      hiddenSingles: 0,
      holes,
    };
  }

  let nakedSingles = 0;
  let hiddenSingles = 0;
  const enheter: ReadonlyArray<'rad' | 'kolonne' | 'blokk'> = ['rad', 'kolonne', 'blokk'];

  let fortsett = true;
  while (fortsett) {
    fortsett = false;

    // Nakne enere først: de er de enkleste å se.
    for (let index = 0; index < state.cells.length; index += 1) {
      if (state.cells[index] !== 0) continue;
      const mulige = candidates(state, index);
      if (popcount(mulige) === 1) {
        place(state, index, Math.log2(mulige & -mulige) + 1);
        nakedSingles += 1;
        fortsett = true;
      }
    }
    if (fortsett) continue;

    // Så skjulte enere: en verdi som bare har én plass igjen i en enhet.
    for (const kind of enheter) {
      for (let unit = 0; unit < state.size && !fortsett; unit += 1) {
        const celler = unitIndices(grid, kind, unit);
        for (let value = 1; value <= state.size && !fortsett; value += 1) {
          const bit = 1 << (value - 1);
          let plass = -1;
          let antall = 0;
          for (const index of celler) {
            if (state.cells[index] !== 0) continue;
            if ((candidates(state, index) & bit) === 0) continue;
            plass = index;
            antall += 1;
            if (antall > 1) break;
          }
          if (antall === 1 && plass >= 0) {
            place(state, plass, value);
            hiddenSingles += 1;
            fortsett = true;
          }
        }
      }
      if (fortsett) break;
    }
  }

  const unsolved = state.cells.reduce((sum, value) => (value === 0 ? sum + 1 : sum), 0);

  const difficulty: Difficulty =
    unsolved > 0 ? 'krevende' : hiddenSingles > 0 ? 'middels' : 'lett';

  return { difficulty, unsolved, nakedSingles, hiddenSingles, holes };
}

/** True når brettet krever mer enn nakne og skjulte enere. */
export function isDemanding(grid: Grid): boolean {
  return rateGrid(grid).difficulty === 'krevende';
}
