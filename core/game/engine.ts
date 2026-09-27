/**
 * Spillmotoren: setter sammen sudokubrett og oppgaver, og holder styr på hva
 * spilleren har fylt inn.
 *
 * Rekkefølgen er den som gjør hele prosjektet mulig:
 *   1. lag et komplett brett
 *   2. grav hull, med entydig løsning
 *   3. les fasitsifferet i hver tomme celle
 *   4. bestill en oppgave med akkurat det svaret
 *
 * Ingen import fra React eller Electron.
 */
import type { Rng } from '../rng.ts';
import { createRng } from '../rng.ts';
import type { BoardDifficulty } from '../sudoku/generate.ts';
import { generatePuzzle } from '../sudoku/generate.ts';
import type { BoardSize, Grid } from '../sudoku/grid.ts';
import { createGrid, valueAt } from '../sudoku/grid.ts';
import type { ValidationResult } from '../sudoku/validate.ts';
import { validate } from '../sudoku/validate.ts';
import type { TaskRegistry } from '../tasks/registry.ts';
import { taskRegistry as defaultRegistry } from '../tasks/registry.ts';
import type { GeneratedTask, Level, Topic } from '../tasks/types.ts';
import { taskKey } from '../tasks/types.ts';

export type CellStatus = 'tom' | 'fylt' | 'konflikt' | 'låst';

export interface Cell {
  readonly row: number;
  readonly col: number;
  /** Fasitsifferet. For tomme celler er dette svaret på oppgaven. */
  readonly solution: number;
  /** True hvis cellen var utfylt fra start. Da har den ingen oppgave. */
  readonly given: boolean;
  readonly task: GeneratedTask | null;
  readonly userValue: number | null;
  readonly notes: ReadonlySet<number>;
  readonly status: CellStatus;
}

export interface Board {
  readonly seed: string;
  readonly size: BoardSize;
  readonly blockRows: number;
  readonly blockCols: number;
  readonly topics: readonly Topic[];
  readonly level: Level;
  readonly boardDifficulty: BoardDifficulty;
  /** size*size celler, radvis. */
  readonly cells: readonly Cell[];
  /** Den komplette løsningen. */
  readonly solution: Grid;
  /** Utgangsstillingen, med hull. */
  readonly puzzle: Grid;
}

export interface GenerateBoardOptions {
  size: BoardSize;
  topics: readonly Topic[];
  /** Skolenivået brettet spilles på. Bare maler fra dette nivået brukes. */
  level: Level;
  /** Styrer antall hull. Uavhengig av taskDifficulty. */
  boardDifficulty: BoardDifficulty;
  seed: string | number;
  /** Byttes ut i tester og når nye temaer registreres. */
  registry?: TaskRegistry;
  /** Vekt per mal-id, fra den adaptive vektingen. */
  weights?: ReadonlyMap<string, number>;
}

/** Kastes når brettet ikke lar seg bygge med de valgte innstillingene. */
export class BoardGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardGenerationError';
  }
}

export function cellIndex(size: number, row: number, col: number): number {
  return row * size + col;
}

export function cellAt(board: Board, row: number, col: number): Cell {
  const cell = board.cells[cellIndex(board.size, row, col)];
  if (cell === undefined) {
    throw new Error(`Ingen celle på (${row}, ${col}) i et ${board.size}x${board.size}-brett`);
  }
  return cell;
}

/** Verdien som faktisk står i cellen: fasit for givne, ellers det spilleren skrev. */
export function effectiveValue(cell: Cell): number {
  if (cell.given) return cell.solution;
  return cell.userValue ?? 0;
}

/** Brettet slik det ser ut nå, som et rent sudokubrett. */
export function toGrid(board: Board): Grid {
  return createGrid(board.size, board.cells.map(effectiveValue));
}

export function conflicts(board: Board): ValidationResult {
  return validate(toGrid(board));
}

/**
 * Setter status på hver celle ut fra gjeldende konflikter.
 *
 * `markConflicts: false` brukes i rolig modus, der feil først skal vises når
 * spilleren ber om en sjekk.
 */
export function refreshStatuses(board: Board, markConflicts = true): Board {
  return applyStatuses(board, markConflicts ? conflictIndices(board) : new Set<number>());
}

/** Indeksene til cellene som bryter en sudokuregel akkurat nå. */
export function conflictIndices(board: Board): Set<number> {
  const conflicted = new Set<number>();
  for (const ref of conflicts(board).cells) {
    conflicted.add(cellIndex(board.size, ref.row, ref.col));
  }
  return conflicted;
}

/**
 * Setter status på hver celle ut fra en ferdig liste over celler som skal
 * markeres som feil. Spilløkten bruker denne direkte, siden den også regner
 * svar som avviker fra fasiten som feil, ikke bare regelbrudd.
 */
export function applyStatuses(board: Board, conflicted: ReadonlySet<number>): Board {
  const cells = board.cells.map((cell, index): Cell => {
    let status: CellStatus;
    if (cell.given) {
      status = 'låst';
    } else if (conflicted.has(index)) {
      status = 'konflikt';
    } else if (cell.userValue === null) {
      status = 'tom';
    } else {
      status = 'fylt';
    }
    return status === cell.status ? cell : { ...cell, status };
  });

  return { ...board, cells };
}

/**
 * Skriver et tall i en celle. Givne celler er låst. Å sette en verdi tømmer
 * notatene i cellen, slik det fungerer i vanlig sudoku.
 */
export function setValue(
  board: Board,
  row: number,
  col: number,
  value: number | null,
  markConflicts = true,
): Board {
  const cell = cellAt(board, row, col);
  if (cell.given) return board;
  if (value !== null && (value < 1 || value > board.size)) {
    throw new Error(`Verdien ${value} finnes ikke på et ${board.size}x${board.size}-brett`);
  }

  const cells = board.cells.slice();
  cells[cellIndex(board.size, row, col)] = {
    ...cell,
    userValue: value,
    notes: value === null ? cell.notes : new Set<number>(),
  };

  return refreshStatuses({ ...board, cells }, markConflicts);
}

export function clearCell(board: Board, row: number, col: number, markConflicts = true): Board {
  return setValue(board, row, col, null, markConflicts);
}

/** Slår et kandidattall av eller på i en celle. Har ingen effekt på fylte celler. */
export function toggleNote(board: Board, row: number, col: number, value: number): Board {
  const cell = cellAt(board, row, col);
  if (cell.given || cell.userValue !== null) return board;
  if (value < 1 || value > board.size) {
    throw new Error(`Notatet ${value} finnes ikke på et ${board.size}x${board.size}-brett`);
  }

  const notes = new Set(cell.notes);
  if (notes.has(value)) {
    notes.delete(value);
  } else {
    notes.add(value);
  }

  const cells = board.cells.slice();
  cells[cellIndex(board.size, row, col)] = { ...cell, notes };
  return { ...board, cells };
}

/** True når brettet er fullt og uten regelbrudd. */
export function isComplete(board: Board): boolean {
  return conflicts(board).complete;
}

/** True når hver celle har fasitverdien sin. */
export function isSolved(board: Board): boolean {
  return board.cells.every((cell) => effectiveValue(cell) === cell.solution);
}

/** Celler som venter på svar. */
export function remainingCells(board: Board): Cell[] {
  return board.cells.filter((cell) => !cell.given && cell.userValue === null);
}

/** Fyller inn alle riktige svar. Brukes av tester og av fasitvisning. */
export function fillWithSolution(board: Board): Board {
  const cells = board.cells.map((cell): Cell =>
    cell.given ? cell : { ...cell, userValue: cell.solution, notes: new Set<number>() },
  );
  return refreshStatuses({ ...board, cells });
}

/**
 * Sjekker på forhånd at det finnes minst én mal for hvert siffer brettet
 * trenger. Uten dette ville en umulig kombinasjon først vist seg som et
 * halvferdig brett midt i genereringen.
 */
function assertTemplatesExist(options: GenerateBoardOptions, registry: TaskRegistry): void {
  const missing: number[] = [];
  for (let target = 1; target <= options.size; target += 1) {
    const pool = registry.candidates({
      topics: options.topics,
      level: options.level,
      targetAnswer: target,
    });
    if (pool.length === 0) missing.push(target);
  }

  if (missing.length > 0) {
    throw new BoardGenerationError(
      `Ingen oppgavemal kan gi svaret ${missing.join(', ')} med temaene ` +
        `[${options.topics.join(', ')}] på nivået «${options.level}». ` +
        'Velg flere temaer, et annet nivå, eller et mindre brett.',
    );
  }
}

function buildTasks(
  puzzle: Grid,
  solution: Grid,
  options: GenerateBoardOptions,
  registry: TaskRegistry,
  rng: Rng,
): Cell[] {
  const used = new Set<string>();
  const cells: Cell[] = [];

  for (let row = 0; row < options.size; row += 1) {
    for (let col = 0; col < options.size; col += 1) {
      const answer = valueAt(solution, row, col);
      const given = valueAt(puzzle, row, col) !== 0;

      if (given) {
        cells.push({
          row,
          col,
          solution: answer,
          given: true,
          task: null,
          userValue: null,
          notes: new Set<number>(),
          status: 'låst',
        });
        continue;
      }

      const task = registry.generateTask({
        topics: options.topics,
        level: options.level,
        targetAnswer: answer,
        rng,
        exclude: used,
        weights: options.weights,
      });

      if (task === null) {
        throw new BoardGenerationError(
          `Klarte ikke å lage en unik oppgave med svaret ${answer} til celle ` +
            `(${row}, ${col}). Prøv færre hull, flere temaer eller et høyere oppgavenivå.`,
        );
      }

      used.add(taskKey(task));
      cells.push({
        row,
        col,
        solution: answer,
        given: false,
        task,
        userValue: null,
        notes: new Set<number>(),
        status: 'tom',
      });
    }
  }

  return cells;
}

/**
 * Bygger et komplett brett med oppgaver. Samme seed gir alltid identisk brett
 * og identiske oppgaver.
 */
export function generateBoard(options: GenerateBoardOptions): Board {
  const registry = options.registry ?? defaultRegistry;
  if (options.topics.length === 0) {
    throw new BoardGenerationError('Velg minst ett tema.');
  }
  assertTemplatesExist(options, registry);

  const seed = String(options.seed);
  const rng = createRng(seed);
  // Egne strømmer, slik at en endring i oppgavevalget ikke flytter på brettet.
  const boardRng = rng.fork('brett');
  const taskRng = rng.fork('oppgaver');

  const { puzzle, solution } = generatePuzzle({
    size: options.size,
    boardDifficulty: options.boardDifficulty,
    rng: boardRng,
  });

  const cells = buildTasks(puzzle, solution, options, registry, taskRng);

  return {
    seed,
    size: options.size,
    blockRows: puzzle.blockRows,
    blockCols: puzzle.blockCols,
    topics: [...options.topics],
    level: options.level,
    boardDifficulty: options.boardDifficulty,
    cells,
    solution,
    puzzle,
  };
}
