import { useEffect, useRef, useState } from 'react';
import { Board } from './components/Board.tsx';
import { Hud } from './components/Hud.tsx';
import { Setup } from './components/Setup.tsx';
import { TaskPanel } from './components/TaskPanel.tsx';
import { useGame, useGameDispatch } from './state/game.tsx';

export function App(): React.JSX.Element {
  const state = useGame();
  const dispatch = useGameDispatch();
  const session = state.session;
  const panelRef = useRef<HTMLElement>(null);

  // Klokkene i HUD-en trenger en jevn puls. Selve tiden leses fra Date.now()
  // når en handling utføres, så denne er bare til opptegning.
  const [now, setNow] = useState(() => Date.now());
  const running = session !== null && session.status === 'spiller';

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // Tastaturet er hovedinput. Lytteren ligger på vinduet, ikke på cellene, slik
  // at markøren ikke kan gå tapt i en klikkbar knapp.
  useEffect(() => {
    if (session === null) return undefined;

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      // Ikke stjel tastetrykk fra tekstfelt.
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

      const stamp = Date.now();

      switch (event.key) {
        case 'ArrowUp':
          dispatch({ type: 'flytt', dRow: -1, dCol: 0, now: stamp });
          break;
        case 'ArrowDown':
          dispatch({ type: 'flytt', dRow: 1, dCol: 0, now: stamp });
          break;
        case 'ArrowLeft':
          dispatch({ type: 'flytt', dRow: 0, dCol: -1, now: stamp });
          break;
        case 'ArrowRight':
          dispatch({ type: 'flytt', dRow: 0, dCol: 1, now: stamp });
          break;
        case 'Backspace':
        case 'Delete':
          dispatch({ type: 'tøm', now: stamp });
          break;
        case 'n':
        case 'N':
          dispatch({ type: 'notatmodus' });
          break;
        case 'h':
        case 'H':
          dispatch({ type: 'hint' });
          break;
        case ' ':
          panelRef.current?.scrollIntoView({ block: 'nearest' });
          panelRef.current?.focus();
          break;
        default: {
          const value = Number(event.key);
          if (!Number.isInteger(value) || value < 1 || value > session.board.size) return;
          dispatch({ type: 'skriv', value, now: stamp });
          break;
        }
      }

      setNow(stamp);
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, dispatch]);

  if (session === null) {
    return <Setup settings={state.settings} error={state.error} dispatch={dispatch} />;
  }

  return (
    <div className="app">
      <Hud session={session} noteMode={state.noteMode} now={now} dispatch={dispatch} />
      <main className="spillflate">
        <Board
          board={session.board}
          selected={session.active}
          onSelect={(row, col) => dispatch({ type: 'velg', row, col, now: Date.now() })}
        />
        <TaskPanel ref={panelRef} session={session} now={now} />
      </main>
    </div>
  );
}
