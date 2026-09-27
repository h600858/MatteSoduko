import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { templateWeights } from '../core/game/adaptive.ts';
import type { Progress } from '../core/game/progress.ts';
import {
  emptyProgress,
  recordSession,
  sessionRecord,
  wasAttempted,
} from '../core/game/progress.ts';
import type { Session } from '../core/game/session.ts';
import { allTemplates } from '../core/tasks/registry.ts';
import { Board } from './components/Board.tsx';
import { Hud } from './components/Hud.tsx';
import { Mascot } from './components/Mascot.tsx';
import { Setup } from './components/Setup.tsx';
import { Profile } from './components/Profile.tsx';
import { TaskPanel } from './components/TaskPanel.tsx';
import { TopBar } from './components/TopBar.tsx';
import type { Settings } from './state/game.tsx';
import { useGame, useGameDispatch } from './state/game.tsx';
import { readProgress, writeProgress } from './state/storage.ts';

const TEMPLATE_IDS = allTemplates.map((template) => template.id);

export function App(): React.JSX.Element {
  const state = useGame();
  const dispatch = useGameDispatch();
  const session = state.session;
  const panelRef = useRef<HTMLElement>(null);

  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Øktene vi allerede har banket inn, slik at et brett ikke føres inn i
  // statistikken to ganger når komponenten tegnes på nytt.
  const bankede = useRef(new Set<string>());
  /** Forrige økt, så et brett som forlates rekker å bli lagret. */
  const forrigeØkt = useRef<Session | null>(null);

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

  /**
   * Banker inn et brett. Også tapte og halvferdige brett telles: et uferdig
   * brett gir det spilleren faktisk tjente inn, bare uten fullførtbonusen.
   */
  const bankInn = useCallback((økt: Session | null): void => {
    if (økt === null) return;

    const key = `${økt.board.seed}:${økt.startedAt}`;
    if (bankede.current.has(key)) return;

    const stamp = økt.finishedAt ?? Date.now();
    const record = sessionRecord(økt, stamp);

    // Et brett spilleren aldri rakk å røre skal ikke inn i statistikken.
    if (record.board.solvedCells === 0 && !record.timings.some(wasAttempted)) return;

    bankede.current.add(key);
    setProgress((current) => {
      const next = recordSession(current, record);
      void writeProgress(next).then((error) => {
        if (error !== null) setProgressWarning(error);
      });
      return next;
    });
  }, []);

  // Et brett som er ferdigspilt bankes inn med én gang.
  useEffect(() => {
    if (session !== null && session.status !== 'spiller') bankInn(session);
  }, [session, bankInn]);

  // Et brett som forlates halvveis bankes inn før det forsvinner. Uten dette
  // ville alt arbeidet vært borte i det man trykker Nytt brett.
  useEffect(() => {
    const forrige = forrigeØkt.current;
    const samme =
      forrige !== null &&
      session !== null &&
      forrige.board.seed === session.board.seed &&
      forrige.startedAt === session.startedAt;

    if (forrige !== null && !samme) bankInn(forrige);
    forrigeØkt.current = session;
  }, [session, bankInn]);

  const closeStats = useCallback(() => setShowStats(false), []);

  // Den adaptive vektingen: statistikken gjøres om til vekter registeret
  // allerede tar imot. Regnes bare om når fremdriften faktisk har endret seg.
  const weights = useMemo(
    () => templateWeights(progress, { templateIds: TEMPLATE_IDS }),
    [progress],
  );

  const startBoard = useCallback(
    (settings: Settings) => {
      dispatch({ type: 'start', settings, now: Date.now(), weights });
    },
    [dispatch, weights],
  );

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

  // Toppbaren og maskoten staar uansett hvilken skjerm som vises.
  const skjerm = showStats ? (
    <Profile progress={progress} warning={progressWarning} weights={weights} onClose={closeStats} />
  ) : session === null ? (
    <Setup
      settings={state.settings}
      error={state.error}
      knownTemplates={Object.keys(progress.templates).length}
      onStart={startBoard}
    />
  ) : (
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

  return (
    <>
      <TopBar
        onShowStats={showStats ? null : () => setShowStats(true)}
        onNewBoard={session !== null && !showStats ? () => dispatch({ type: 'avslutt' }) : null}
      />
      {skjerm}
      <Mascot />
    </>
  );
}
