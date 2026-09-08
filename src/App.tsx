import { useEffect } from 'react';
import { Board } from './components/Board.tsx';
import { Hud } from './components/Hud.tsx';
import { Setup } from './components/Setup.tsx';
import { TaskPanel } from './components/TaskPanel.tsx';
import { useGame, useGameDispatch } from './state/game.tsx';

export function App(): React.JSX.Element {
  const state = useGame();
  const dispatch = useGameDispatch();
  const board = state.board;

  // Tastaturet er hovedinput. Lytteren ligger på vinduet, ikke på cellene, slik
  // at markøren ikke kan gå tapt i en klikkbar knapp.
  useEffect(() => {
    if (board === null) return undefined;

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      // Ikke stjel tastetrykk fra tekstfelt.
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      switch (event.key) {
        case 'ArrowUp':
          dispatch({ type: 'flytt', dRow: -1, dCol: 0 });
          break;
        case 'ArrowDown':
          dispatch({ type: 'flytt', dRow: 1, dCol: 0 });
          break;
        case 'ArrowLeft':
          dispatch({ type: 'flytt', dRow: 0, dCol: -1 });
          break;
        case 'ArrowRight':
          dispatch({ type: 'flytt', dRow: 0, dCol: 1 });
          break;
        case 'Backspace':
        case 'Delete':
          dispatch({ type: 'tøm' });
          break;
        case 'n':
        case 'N':
          dispatch({ type: 'notatmodus' });
          break;
        default: {
          const value = Number(event.key);
          if (!Number.isInteger(value) || value < 1 || value > board.size) return;
          dispatch({ type: 'skriv', value });
          break;
        }
      }

      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [board, dispatch]);

  if (board === null) {
    return <Setup settings={state.settings} error={state.error} dispatch={dispatch} />;
  }

  return (
    <div className="app">
      <Hud board={board} noteMode={state.noteMode} dispatch={dispatch} />
      <main className="spillflate">
        <Board
          board={board}
          selected={state.selected}
          onSelect={(row, col) => dispatch({ type: 'velg', selection: { row, col } })}
        />
        <TaskPanel board={board} selected={state.selected} />
      </main>
    </div>
  );
}
