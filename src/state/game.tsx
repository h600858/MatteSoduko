/**
 * Spilltilstanden for UI-et.
 *
 * All regellogikk ligger i core/game/. Denne filen holder bare rede på hvilken
 * økt som er i gang, om notatmodus er på, og hvilket klokkeslett vi tegner ut.
 * React context med useReducer er nok her, og det slipper en ekstra
 * avhengighet.
 */
import type { Dispatch, ReactNode } from 'react';
import { createContext, useContext, useMemo, useReducer } from 'react';
import { BoardGenerationError, generateBoard } from '../../core/game/engine.ts';
import type { ErrorMode } from '../../core/game/scoring.ts';
import type { Session } from '../../core/game/session.ts';
import {
  checkBoard,
  clearActive,
  focusCell,
  isCellLocked,
  startSession,
  submitValue,
  takeHint,
  toggleActiveNote,
} from '../../core/game/session.ts';
import { cellAt } from '../../core/game/engine.ts';
import type { BoardDifficulty } from '../../core/sudoku/generate.ts';
import type { BoardSize } from '../../core/sudoku/grid.ts';
import { taskRegistry } from '../../core/tasks/registry.ts';
import type { Level, Topic } from '../../core/tasks/types.ts';

export interface Settings {
  size: BoardSize;
  topics: readonly Topic[];
  /** Skolenivået. Bare maler fra dette nivået brukes. */
  level: Level;
  boardDifficulty: BoardDifficulty;
  mode: ErrorMode;
  /**
   * Når den er på, vektes oppgavevalget etter statistikken din. Da avhenger
   * oppgavene av hva du har spilt før, ikke bare av seeden.
   */
  adaptive: boolean;
  /** Tom streng betyr at vi trekker en tilfeldig seed ved start. */
  seed: string;
}

export interface GameState {
  session: Session | null;
  settings: Settings;
  noteMode: boolean;
  error: string | null;
}

const DEFAULT_LEVEL: Level = 'middels';

export const DEFAULT_SETTINGS: Settings = {
  size: 9,
  topics: taskRegistry.topicsForLevel(DEFAULT_LEVEL).map((topic) => topic.id),
  level: DEFAULT_LEVEL,
  boardDifficulty: 2,
  mode: 'rolig',
  adaptive: true,
  seed: '',
};

export type GameAction =
  | {
      type: 'start';
      settings: Settings;
      now: number;
      /** Fra den adaptive vektingen. Utelatt gir likt trekk mellom malene. */
      weights?: ReadonlyMap<string, number>;
    }
  | { type: 'avslutt' }
  | { type: 'velg'; row: number; col: number; now: number }
  | { type: 'flytt'; dRow: number; dCol: number; now: number }
  | { type: 'skriv'; value: number; now: number }
  | { type: 'tøm'; now: number }
  | { type: 'notatmodus' }
  | { type: 'hint' }
  | { type: 'sjekk'; now: number };

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function reducer(state: GameState, action: GameAction): GameState {
  const session = state.session;

  switch (action.type) {
    case 'start': {
      const seed = action.settings.seed.trim() === '' ? randomSeed() : action.settings.seed.trim();
      try {
        const board = generateBoard({
          size: action.settings.size,
          topics: action.settings.topics,
          level: action.settings.level,
          boardDifficulty: action.settings.boardDifficulty,
          seed,
          ...(action.settings.adaptive && action.weights !== undefined
            ? { weights: action.weights }
            : {}),
        });
        return {
          session: startSession({ board, mode: action.settings.mode, now: action.now }),
          settings: { ...action.settings, seed },
          noteMode: false,
          error: null,
        };
      } catch (error: unknown) {
        const message =
          error instanceof BoardGenerationError
            ? error.message
            : `Uventet feil under brettbygging: ${String(error)}`;
        return { ...state, session: null, settings: action.settings, error: message };
      }
    }

    case 'avslutt':
      return { ...state, session: null, error: null };

    case 'velg':
      if (session === null) return state;
      return { ...state, session: focusCell(session, action.row, action.col, action.now) };

    case 'flytt': {
      if (session === null) return state;
      const max = session.board.size - 1;
      const from = session.active ?? { row: 0, col: 0 };
      return {
        ...state,
        session: focusCell(
          session,
          clamp(from.row + action.dRow, max),
          clamp(from.col + action.dCol, max),
          action.now,
        ),
      };
    }

    case 'skriv': {
      if (session === null || session.active === null) return state;

      if (state.noteMode) {
        return { ...state, session: toggleActiveNote(session, action.value) };
      }

      // Trykker man samme tall om igjen, tømmes cellen. Låste og løste celler
      // rører vi ikke.
      const cell = cellAt(session.board, session.active.row, session.active.col);
      if (!isCellLocked(cell) && cell.userValue === action.value) {
        return { ...state, session: clearActive(session, action.now) };
      }
      return { ...state, session: submitValue(session, action.value, action.now) };
    }

    case 'tøm':
      if (session === null) return state;
      return { ...state, session: clearActive(session, action.now) };

    case 'notatmodus':
      return { ...state, noteMode: !state.noteMode };

    case 'hint':
      if (session === null) return state;
      return { ...state, session: takeHint(session) };

    case 'sjekk':
      if (session === null) return state;
      return { ...state, session: checkBoard(session, action.now) };

    default:
      return state;
  }
}

const initialState: GameState = {
  session: null,
  settings: DEFAULT_SETTINGS,
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
