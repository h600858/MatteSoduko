/**
 * Spilltilstanden for UI-et.
 *
 * All regellogikk ligger i core/game/engine.ts. Denne filen holder bare rede på
 * hva som er valgt, om notatmodus er på, og hvilket brett som er i spill.
 * React context med useReducer er nok her, og det slipper en ekstra
 * avhengighet.
 */
import type { Dispatch, ReactNode } from 'react';
import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Board } from '../../core/game/engine.ts';
import {
  BoardGenerationError,
  cellAt,
  clearCell,
  fillWithSolution,
  generateBoard,
  setValue,
  toggleNote,
} from '../../core/game/engine.ts';
import type { BoardDifficulty } from '../../core/sudoku/generate.ts';
import type { BoardSize } from '../../core/sudoku/grid.ts';
import type { Difficulty, Topic } from '../../core/tasks/types.ts';
import { ALL_TOPICS } from '../../core/tasks/types.ts';

export interface Settings {
  size: BoardSize;
  topics: readonly Topic[];
  taskDifficulty: Difficulty;
  boardDifficulty: BoardDifficulty;
  /** Tom streng betyr at vi trekker en tilfeldig seed ved start. */
  seed: string;
}

export interface Selection {
  row: number;
  col: number;
}

export interface GameState {
  board: Board | null;
  settings: Settings;
  selected: Selection | null;
  noteMode: boolean;
  error: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  size: 9,
  topics: ALL_TOPICS,
  taskDifficulty: 3,
  boardDifficulty: 2,
  seed: '',
};

export type GameAction =
  | { type: 'start'; settings: Settings }
  | { type: 'avslutt' }
  | { type: 'velg'; selection: Selection }
  | { type: 'flytt'; dRow: number; dCol: number }
  | { type: 'skriv'; value: number }
  | { type: 'tøm' }
  | { type: 'notatmodus' }
  | { type: 'avslør' };

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Første celle som ikke er låst, slik at markøren starter et nyttig sted. */
function firstOpenCell(board: Board): Selection | null {
  const cell = board.cells.find((candidate) => !candidate.given);
  return cell === undefined ? null : { row: cell.row, col: cell.col };
}

function clamp(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start': {
      const seed = action.settings.seed.trim() === '' ? randomSeed() : action.settings.seed.trim();
      try {
        const board = generateBoard({
          size: action.settings.size,
          topics: action.settings.topics,
          taskDifficulty: action.settings.taskDifficulty,
          boardDifficulty: action.settings.boardDifficulty,
          seed,
        });
        return {
          board,
          settings: { ...action.settings, seed },
          selected: firstOpenCell(board),
          noteMode: false,
          error: null,
        };
      } catch (error: unknown) {
        const message =
          error instanceof BoardGenerationError
            ? error.message
            : `Uventet feil under brettbygging: ${String(error)}`;
        return { ...state, board: null, settings: action.settings, error: message };
      }
    }

    case 'avslutt':
      return { ...state, board: null, selected: null, error: null };

    case 'velg':
      return { ...state, selected: action.selection };

    case 'flytt': {
      if (state.board === null) return state;
      const max = state.board.size - 1;
      const from = state.selected ?? { row: 0, col: 0 };
      return {
        ...state,
        selected: {
          row: clamp(from.row + action.dRow, max),
          col: clamp(from.col + action.dCol, max),
        },
      };
    }

    case 'skriv': {
      const { board, selected } = state;
      if (board === null || selected === null) return state;
      if (action.value < 1 || action.value > board.size) return state;

      if (state.noteMode) {
        return { ...state, board: toggleNote(board, selected.row, selected.col, action.value) };
      }

      // Trykker man samme tall om igjen, tømmes cellen.
      const current = cellAt(board, selected.row, selected.col);
      if (current.userValue === action.value) {
        return { ...state, board: clearCell(board, selected.row, selected.col) };
      }
      return { ...state, board: setValue(board, selected.row, selected.col, action.value) };
    }

    case 'tøm': {
      const { board, selected } = state;
      if (board === null || selected === null) return state;
      return { ...state, board: clearCell(board, selected.row, selected.col) };
    }

    case 'notatmodus':
      return { ...state, noteMode: !state.noteMode };

    case 'avslør': {
      if (state.board === null) return state;
      return { ...state, board: fillWithSolution(state.board) };
    }

    default:
      return state;
  }
}

const initialState: GameState = {
  board: null,
  settings: DEFAULT_SETTINGS,
  selected: null,
  noteMode: false,
  error: null,
};

const StateContext = createContext<GameState | null>(null);
const DispatchContext = createContext<Dispatch<GameAction> | null>(null);

export function GameProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => state, [state]);
  return (
    <StateContext.Provider value={value}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useGame(): GameState {
  const state = useContext(StateContext);
  if (state === null) throw new Error('useGame må brukes inne i en GameProvider');
  return state;
}

export function useGameDispatch(): Dispatch<GameAction> {
  const dispatch = useContext(DispatchContext);
  if (dispatch === null) throw new Error('useGameDispatch må brukes inne i en GameProvider');
  return dispatch;
}
