import { useCallback, useEffect, useRef, useState } from 'react';
import type { Progress } from '../core/game/progress.ts';
import { emptyProgress, recordSession, sessionRecord } from '../core/game/progress.ts';
import { Board } from './components/Board.tsx';
import { Hud } from './components/Hud.tsx';
import { Setup } from './components/Setup.tsx';
import { Stats } from './components/Stats.tsx';
import { TaskPanel } from './components/TaskPanel.tsx';
import { useGame, useGameDispatch } from './state/game.tsx';
import { readProgress, writeProgress } from './state/storage.ts';

export function App(): React.JSX.Element {
  const state = useGame();
  const dispatch = useGameDispatch();
  const session = state.session;
  const panelRef = useRef<HTMLElement>(null);

  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Identifiserer økten vi allerede har lagret, slik at et ferdig brett ikke
  // føres inn i statistikken to ganger når komponenten tegnes på nytt.
  const savedSession = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readProgress().then((loaded) => {
      if (cancelled) return;
      setProgress(loaded.progress);
      setProgressWarning(loaded.warning);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Klokkene i HUD-en trenger en jevn puls. Selve tiden leses fra Date.now()
  // når en handling utføres, så denne er bare til opptegning.
  const [now, setNow] = useState(() => Date.now());
  const running = session !== null && session.status === 'spiller';

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  // Lagrer et ferdigspilt brett. Også tapte brett telles: de sier like mye om
  // hvilke maler som er vanskelige.
  useEffect(() => {
    if (session === null || session.status === 'spiller') return;

    const key = `${session.board.seed}:${session.startedAt}`;
    if (savedSession.current === key) return;
    savedSession.current = key;

    const stamp = session.finishedAt ?? Date.now();
    setProgress((current) => {
      const next = recordSession(current, sessionRecord(session, stamp));
      void writeProgress(next).then((error) => {
        if (error !== null) setProgressWarning(error);
      });
      return next;
    });
  }, [session]);

  const closeStats = useCallback(() => setShowStats(false), []);

  // Tastaturet er hovedinput. Lytteren ligger på vinduet, ikke på cellene, slik
  // at markøren ikke kan gå tapt i en klikkbar knapp.
  useEffect(() => {
    if (session === null || showStats) return undefined;

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
  }, [session, dispatch, showStats]);

  if (showStats) {
    return <Stats progress={progress} warning={progressWarning} onClose={closeStats} />;
  }

  if (session === null) {
    return (
      <Setup
        settings={state.settings}
        error={state.error}
        dispatch={dispatch}
        onShowStats={() => setShowStats(true)}
      />
    );
  }

  return (
    <div className="app">
      <Hud
        session={session}
        noteMode={state.noteMode}
        now={now}
        dispatch={dispatch}
        onShowStats={() => setShowStats(true)}
      />
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
