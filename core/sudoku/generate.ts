/**
 * Generering av brett.
 *
 * Rekkefølgen er fortsatt: lag et komplett gyldig brett først. Da er
 * fasitsifferet i hver celle kjent, og oppgavegeneratoren kan bestille en
 * oppgave med akkurat det svaret.
 *
 * Men brettet spilleren får er HELT TOMT. Hver eneste celle bærer en
 * matteoppgave. Det er selve spillet: du regner til du har nok sifre til at
 * resten følger av sudokulogikk, og da slipper du å regne mer.
 *
 * Dette bryter med den vanlige sudokuregelen om én løsning. Et tomt rutenett
 * har mange gyldige utfyllinger, og det er helt greit her: oppgavene ER
 * ledetrådene. Hver celle kan alltid løses ved å regne, så spilleren står
 * aldri fast. Og i det øyeblikket nok celler er fylt, er resten entydig — da
 * kan man dedusere seg i mål.
 *
 * Målt over 40 brett per størrelse: velger man cellene godt, holder det med 4
 * oppgaver på 4x4, 10 på 6x6 og 24 på 9x9. Tar man dem i tilfeldig rekkefølge,
 * trengs rundt 7, 18 og 42. Gapet er strategien.
 */
import type { Rng } from '../rng.ts';
import type { BoardSize, Grid } from './grid.ts';
import {
  allCells,
  countEmpty,
  createEmptyGrid,
  createGrid,
  geometryFor,
  valueAt,
  withValue,
} from './grid.ts';
import { countSolutions } from './solve.ts';

/**
 * Hvor mange oppgaver et brett har. Alle cellene, siden brettet starter tomt.
 *
 * Finnes som funksjon fordi kallerne ikke skal trenge å vite at «alle celler»
 * er svaret — bare at tallet følger av størrelsen.
 */
export function taskCountFor(size: BoardSize): number {
  return size * size;
}

/**
 * Hvor mange gravrekkefølger vi prøver når vi regner ut hvor få oppgaver man
 * kan slippe unna med. Flere forsoek gir et litt lavere, men fortsatt
 * oppnåelig, tall. Fire koster rundt 11 ms på 9x9.
 */
const DIG_ORDERS_TRIED = 4;

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
 * tyngre enn å treffe hulltallet nøyaktig. Ber man om flere hull enn brettet
 * har celler, graves det så dypt entydigheten tillater.
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
  rng: Rng;
}

export interface Puzzle {
  /** Brettet spilleren starter med. Helt tomt — hver celle har en oppgave. */
  puzzle: Grid;
  /** Den komplette løsningen. Fasitsifferet for hver celle. */
  solution: Grid;
  /**
   * Færrest oppgaver som må løses før resten følger av sudokulogikk, hvis man
   * velger cellene godt. Et oppnåelig tall, ikke et teoretisk minimum: det
   * finnes en konkret rekkefølge som treffer det.
   *
   * Tar man cellene i tilfeldig rekkefølge, trengs omtrent det dobbelte. Der
   * ligger strategien.
   */
  minMathCells: number;
}

/**
 * Færrest celler som må stå igjen for at resten er entydig bestemt.
 *
 * Utnytter at dette er nøyaktig det motsatte av graving: graver vi så dypt
 * entydigheten tillater, er cellene som står igjen et sett ledetråder som
 * bestemmer brettet. Vi prøver noen rekkefølger og beholder det minste settet.
 */
export function minCluesFor(solution: Grid, rng: Rng): number {
  const cellCount = solution.size * solution.size;
  let best = cellCount;

  for (let d = 0; d < DIG_ORDERS_TRIED; d += 1) {
    const igjen = cellCount - countEmpty(dig(solution, cellCount, rng.fork(`ledetrad:${d}`)));
    if (igjen < best) best = igjen;
  }

  return best;
}

/**
 * Et tomt brett pluss løsningen bak det.
 *
 * Søket er deterministisk: alle tilfeldige valg kommer fra forkede strømmer av
 * rng, så samme seed gir samme brett.
 */
export function generatePuzzle({ size, rng }: PuzzleOptions): Puzzle {
  const solution = generateSolved(size, rng.fork('losning'));
  return {
    // Ingen graving: spilleren starter på bar bakke og regner seg innover.
    puzzle: createEmptyGrid(size),
    solution,
    minMathCells: minCluesFor(solution, rng.fork('ledetrader')),
  };
}
