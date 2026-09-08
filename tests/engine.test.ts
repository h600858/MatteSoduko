import { describe, expect, it } from 'vitest';
import type { Board, GenerateBoardOptions } from '../core/game/engine.ts';
import {
  BoardGenerationError,
  cellAt,
  clearCell,
  conflicts,
  effectiveValue,
  fillWithSolution,
  generateBoard,
  isComplete,
  isSolved,
  remainingCells,
  setValue,
  toGrid,
  toggleNote,
} from '../core/game/engine.ts';
import { BOARD_SIZES, blockIndexOf, valueAt } from '../core/sudoku/grid.ts';
import { validate } from '../core/sudoku/validate.ts';
import { ALL_TOPICS, taskKey } from '../core/tasks/types.ts';
import type { BoardSize } from '../core/sudoku/grid.ts';

function options(size: BoardSize, seed: string): GenerateBoardOptions {
  return {
    size,
    topics: ALL_TOPICS,
    taskDifficulty: 3,
    boardDifficulty: 2,
    seed,
  };
}

/** Første tomme celle på brettet. */
function firstEmpty(board: Board): { row: number; col: number } {
  const cell = board.cells.find((candidate) => !candidate.given);
  if (cell === undefined) throw new Error('Brettet har ingen tomme celler');
  return { row: cell.row, col: cell.col };
}

describe('generateBoard', () => {
  for (const size of BOARD_SIZES) {
    it(`bygger et ${size}x${size}-brett der hver tom celle har en verifisert oppgave`, () => {
      const board = generateBoard(options(size, `bygg:${size}`));

      expect(board.size).toBe(size);
      expect(board.cells).toHaveLength(size * size);

      let tasks = 0;
      for (const cell of board.cells) {
        expect(cell.solution).toBe(valueAt(board.solution, cell.row, cell.col));

        if (cell.given) {
          expect(cell.task).toBeNull();
          expect(cell.status).toBe('låst');
          expect(valueAt(board.puzzle, cell.row, cell.col)).toBe(cell.solution);
        } else {
          tasks += 1;
          expect(cell.task, `celle (${cell.row}, ${cell.col}) mangler oppgave`).not.toBeNull();
          // Svaret på oppgaven er tallet som skal stå i cellen.
          expect(cell.task?.answer).toBe(cell.solution);
          expect(cell.task?.verify()).toBe(true);
          expect(cell.status).toBe('tom');
          expect(valueAt(board.puzzle, cell.row, cell.col)).toBe(0);
        }
      }

      expect(tasks).toBeGreaterThan(0);
      expect(tasks).toBe(remainingCells(board).length);
    });
  }

  it('lager et brett med nøyaktig én løsning', () => {
    for (const size of BOARD_SIZES) {
      const board = generateBoard(options(size, `entydig:${size}`));
      expect(validate(board.solution).complete).toBe(true);
      expect(validate(board.puzzle).valid).toBe(true);
    }
  });

  it('holder brettnivå og oppgavenivå fra hverandre', () => {
    const lett = generateBoard({ ...options(9, 'nivaa'), boardDifficulty: 1, taskDifficulty: 3 });
    const vanskelig = generateBoard({
      ...options(9, 'nivaa'),
      boardDifficulty: 3,
      taskDifficulty: 1,
    });

    // Samme seed, men ulikt hulltall.
    expect(remainingCells(vanskelig).length).toBeGreaterThan(remainingCells(lett).length);

    // Og bare nivå 1-maler i det siste brettet.
    for (const cell of vanskelig.cells) {
      if (cell.task === null) continue;
      expect(['func.verdi', 'func.log']).toContain(cell.task.templateId);
    }
  });

  it('bruker bare maler til og med valgt oppgavenivå', () => {
    const board = generateBoard({ ...options(9, 'tak'), taskDifficulty: 2 });
    for (const cell of board.cells) {
      if (cell.task === null) continue;
      expect(cell.task.templateId).not.toMatch(/^deriv\.(produkt|kjerne|kvotient|ekstremal)$/);
      expect(cell.task.templateId).not.toMatch(/^func\.(sammensatt|invers)$/);
    }
  });

  it('sier tydelig fra når ingen mal kan gi svarene', () => {
    // Derivasjon har ingen maler på nivå 1.
    expect(() =>
      generateBoard({ ...options(9, 'umulig'), topics: ['derivasjon'], taskDifficulty: 1 }),
    ).toThrow(BoardGenerationError);

    expect(() => generateBoard({ ...options(9, 'tomt-tema'), topics: [] })).toThrow(
      BoardGenerationError,
    );
  });
});

describe('testkrav 4: ingen to identiske oppgavetekster', () => {
  for (const size of BOARD_SIZES) {
    it(`${size}x${size} har unik oppgavetekst i hver celle`, () => {
      for (let i = 0; i < 10; i += 1) {
        const board = generateBoard({
          ...options(size, `unik:${size}:${i}`),
          boardDifficulty: 3,
        });

        const seen = new Map<string, string>();
        for (const cell of board.cells) {
          if (cell.task === null) continue;
          const key = taskKey(cell.task);
          const previous = seen.get(key);
          expect(
            previous,
            `celle (${cell.row}, ${cell.col}) gjentar oppgaven fra ${previous ?? ''}: ${key}`,
          ).toBeUndefined();
          seen.set(key, `(${cell.row}, ${cell.col})`);
        }

        expect(seen.size).toBe(remainingCells(board).length);
      }
    });
  }

  it('gir unike tekster også når mange celler deler samme fasit', () => {
    const board = generateBoard({ ...options(9, 'samme-fasit'), boardDifficulty: 3 });
    const byAnswer = new Map<number, string[]>();

    for (const cell of board.cells) {
      if (cell.task === null) continue;
      const list = byAnswer.get(cell.solution) ?? [];
      list.push(taskKey(cell.task));
      byAnswer.set(cell.solution, list);
    }

    let mostRepeated = 0;
    for (const [, keys] of byAnswer) {
      expect(new Set(keys).size).toBe(keys.length);
      mostRepeated = Math.max(mostRepeated, keys.length);
    }
    // Sjekken er bare meningsfull hvis minst ett siffer faktisk gikk igjen.
    expect(mostRepeated).toBeGreaterThan(1);
  });
});

describe('testkrav 5: motoren fullfører og oppdager konflikt', () => {
  for (const size of BOARD_SIZES) {
    it(`${size}x${size} fullføres når alle fasitsvar fylles inn`, () => {
      const board = generateBoard(options(size, `fullfor:${size}`));
      expect(isComplete(board)).toBe(false);
      expect(isSolved(board)).toBe(false);

      let playing = board;
      for (const cell of board.cells) {
        if (cell.given) continue;
        playing = setValue(playing, cell.row, cell.col, cell.solution);
      }

      expect(isComplete(playing)).toBe(true);
      expect(isSolved(playing)).toBe(true);
      expect(remainingCells(playing)).toHaveLength(0);
      expect(conflicts(playing).valid).toBe(true);
      expect(playing.cells.every((cell) => cell.status === 'fylt' || cell.status === 'låst')).toBe(
        true,
      );
      expect(toGrid(playing).cells).toEqual(board.solution.cells);
    });
  }

  it('finner konflikten i riktig rad, kolonne og blokk', () => {
    const board = generateBoard(options(9, 'konflikt'));
    const target = firstEmpty(board);
    const correct = cellAt(board, target.row, target.col).solution;
    const wrong = correct === 9 ? 1 : correct + 1;

    // Fyll hele brettet riktig, bortsett fra én celle.
    let playing = board;
    for (const cell of board.cells) {
      if (cell.given) continue;
      const value =
        cell.row === target.row && cell.col === target.col ? wrong : cell.solution;
      playing = setValue(playing, cell.row, cell.col, value);
    }

    expect(isComplete(playing)).toBe(false);
    expect(isSolved(playing)).toBe(false);

    const result = conflicts(playing);
    expect(result.valid).toBe(false);
    expect(result.rows).toContain(target.row);
    expect(result.cols).toContain(target.col);
    expect(result.blocks).toContain(blockIndexOf(board.solution, target.row, target.col));
    expect(result.cells).toContainEqual({ row: target.row, col: target.col });
    expect(cellAt(playing, target.row, target.col).status).toBe('konflikt');

    // Retter man opp igjen, forsvinner konflikten.
    const rettet = setValue(playing, target.row, target.col, correct);
    expect(conflicts(rettet).valid).toBe(true);
    expect(isComplete(rettet)).toBe(true);
    expect(cellAt(rettet, target.row, target.col).status).toBe('fylt');
  });

  it('markerer ikke konflikt når markConflicts er av (rolig modus)', () => {
    const board = generateBoard(options(9, 'rolig'));
    const target = firstEmpty(board);
    const correct = cellAt(board, target.row, target.col).solution;
    const wrong = correct === 9 ? 1 : correct + 1;

    let playing = board;
    for (const cell of board.cells) {
      if (cell.given) continue;
      const value =
        cell.row === target.row && cell.col === target.col ? wrong : cell.solution;
      playing = setValue(playing, cell.row, cell.col, value, false);
    }

    expect(playing.cells.some((cell) => cell.status === 'konflikt')).toBe(false);
    // Konflikten finnes fortsatt, den er bare ikke markert ennå.
    expect(conflicts(playing).valid).toBe(false);
  });
});

describe('testkrav 6: reproduserbarhet', () => {
  for (const size of BOARD_SIZES) {
    it(`${size}x${size} gir identisk brett og identiske oppgaver for samme seed`, () => {
      const a = generateBoard(options(size, `repro:${size}`));
      const b = generateBoard(options(size, `repro:${size}`));

      expect(b.puzzle.cells).toEqual(a.puzzle.cells);
      expect(b.solution.cells).toEqual(a.solution.cells);
      expect(b.cells).toHaveLength(a.cells.length);

      for (let i = 0; i < a.cells.length; i += 1) {
        const left = a.cells[i];
        const right = b.cells[i];
        expect(right?.given).toBe(left?.given);
        expect(right?.solution).toBe(left?.solution);
        expect(right?.task?.templateId).toBe(left?.task?.templateId);
        expect(right?.task?.latex).toBe(left?.task?.latex);
        expect(right?.task?.prompt).toBe(left?.task?.prompt);
        expect(right?.task?.steps).toEqual(left?.task?.steps);
      }
    });
  }

  it('gir et annet brett for en annen seed', () => {
    const a = generateBoard(options(9, 'seed-a'));
    const b = generateBoard(options(9, 'seed-b'));
    expect(b.puzzle.cells).not.toEqual(a.puzzle.cells);
  });

  it('flytter ikke på brettet når bare oppgavevalget endres', () => {
    const a = generateBoard({ ...options(9, 'delt-seed'), taskDifficulty: 3 });
    const b = generateBoard({ ...options(9, 'delt-seed'), taskDifficulty: 2 });
    // Egne rng-strømmer for brett og oppgaver.
    expect(b.puzzle.cells).toEqual(a.puzzle.cells);
    expect(b.cells.map((cell) => cell.task?.templateId ?? null)).not.toEqual(
      a.cells.map((cell) => cell.task?.templateId ?? null),
    );
  });
});

describe('celleoperasjoner', () => {
  it('låser givne celler', () => {
    const board = generateBoard(options(9, 'laast'));
    const given = board.cells.find((cell) => cell.given);
    expect(given).toBeDefined();
    if (given === undefined) return;

    const etter = setValue(board, given.row, given.col, 1);
    expect(etter).toBe(board);
    expect(cellAt(etter, given.row, given.col).userValue).toBeNull();
    expect(effectiveValue(cellAt(etter, given.row, given.col))).toBe(given.solution);
  });

  it('avviser verdier utenfor brettets tallområde', () => {
    const board = generateBoard(options(4, 'omraade'));
    const { row, col } = firstEmpty(board);
    expect(() => setValue(board, row, col, 5)).toThrow();
    expect(() => setValue(board, row, col, 0)).toThrow();
  });

  it('tømmer en celle igjen', () => {
    const board = generateBoard(options(9, 'tom'));
    const { row, col } = firstEmpty(board);
    const fylt = setValue(board, row, col, cellAt(board, row, col).solution);
    expect(cellAt(fylt, row, col).status).toBe('fylt');

    const tomt = clearCell(fylt, row, col);
    expect(cellAt(tomt, row, col).userValue).toBeNull();
    expect(cellAt(tomt, row, col).status).toBe('tom');
  });

  it('slår notater av og på, og tømmer dem når et svar skrives', () => {
    const board = generateBoard(options(9, 'notater'));
    const { row, col } = firstEmpty(board);

    let playing = toggleNote(board, row, col, 3);
    playing = toggleNote(playing, row, col, 7);
    expect([...cellAt(playing, row, col).notes].sort()).toEqual([3, 7]);

    playing = toggleNote(playing, row, col, 3);
    expect([...cellAt(playing, row, col).notes]).toEqual([7]);

    playing = setValue(playing, row, col, cellAt(board, row, col).solution);
    expect(cellAt(playing, row, col).notes.size).toBe(0);

    // Notater har ingen mening i en celle som allerede har et svar.
    const uendret = toggleNote(playing, row, col, 5);
    expect(uendret).toBe(playing);
  });

  it('fillWithSolution løser hele brettet', () => {
    for (const size of BOARD_SIZES) {
      const board = fillWithSolution(generateBoard(options(size, `fasit:${size}`)));
      expect(isSolved(board)).toBe(true);
      expect(isComplete(board)).toBe(true);
    }
  });
});
