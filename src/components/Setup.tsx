import { useState } from 'react';
import type { BoardDifficulty } from '../../core/sudoku/generate.ts';
import type { BoardSize } from '../../core/sudoku/grid.ts';
import { BOARD_SIZES } from '../../core/sudoku/grid.ts';
import type { Difficulty, Topic } from '../../core/tasks/types.ts';
import { ALL_TOPICS } from '../../core/tasks/types.ts';
import type { GameAction, Settings } from '../state/game.tsx';
import type { Dispatch } from 'react';

interface SetupProps {
  settings: Settings;
  error: string | null;
  dispatch: Dispatch<GameAction>;
}

const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3];
const BOARD_DIFFICULTIES: readonly BoardDifficulty[] = [1, 2, 3];

const TASK_LABEL: Readonly<Record<Difficulty, string>> = {
  1: '1 — direkte innsetting',
  2: '2 — én regel',
  3: '3 — sammensatte regler',
};

const BOARD_LABEL: Readonly<Record<BoardDifficulty, string>> = {
  1: '1 — få hull',
  2: '2 — middels',
  3: '3 — mange hull',
};

export function Setup({ settings, error, dispatch }: SetupProps): React.JSX.Element {
  const [draft, setDraft] = useState<Settings>(settings);

  const toggleTopic = (topic: Topic): void => {
    const has = draft.topics.includes(topic);
    const next = has ? draft.topics.filter((t) => t !== topic) : [...draft.topics, topic];
    setDraft({ ...draft, topics: next });
  };

  // Derivasjon har ingen maler på nivå 1, så den kombinasjonen er umulig.
  const onlyDerivasjon = draft.topics.length === 1 && draft.topics[0] === 'derivasjon';
  const impossible = draft.topics.length === 0 || (onlyDerivasjon && draft.taskDifficulty === 1);

  return (
    <div className="oppsett">
      <h1>MatteSudoku</h1>
      <p className="ingress">
        Hver tomme celle inneholder en oppgave fra MAT102-pensum. Svaret er tallet som skal stå
        i cellen.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          dispatch({ type: 'start', settings: draft, now: Date.now() });
        }}
      >
        <fieldset>
          <legend>Brettstørrelse</legend>
          {BOARD_SIZES.map((size: BoardSize) => (
            <label key={size}>
              <input
                type="radio"
                name="storrelse"
                checked={draft.size === size}
                onChange={() => setDraft({ ...draft, size })}
              />
              {size}×{size}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Temaer</legend>
          {ALL_TOPICS.map((topic) => (
            <label key={topic}>
              <input
                type="checkbox"
                checked={draft.topics.includes(topic)}
                onChange={() => toggleTopic(topic)}
              />
              {topic}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Oppgavenivå (maler til og med)</legend>
          {DIFFICULTIES.map((level) => (
            <label key={level}>
              <input
                type="radio"
                name="oppgavenivaa"
                checked={draft.taskDifficulty === level}
                onChange={() => setDraft({ ...draft, taskDifficulty: level })}
              />
              {TASK_LABEL[level]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Brettnivå (antall hull)</legend>
          {BOARD_DIFFICULTIES.map((level) => (
            <label key={level}>
              <input
                type="radio"
                name="brettnivaa"
                checked={draft.boardDifficulty === level}
                onChange={() => setDraft({ ...draft, boardDifficulty: level })}
              />
              {BOARD_LABEL[level]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Feilmodus</legend>
          <label>
            <input
              type="radio"
              name="modus"
              checked={draft.mode === 'rolig'}
              onChange={() => setDraft({ ...draft, mode: 'rolig' })}
            />
            rolig — feil vises først når du trykker sjekk, og koster ikke liv
          </label>
          <label>
            <input
              type="radio"
              name="modus"
              checked={draft.mode === 'streng'}
              onChange={() => setDraft({ ...draft, mode: 'streng' })}
            />
            streng — feil markeres med én gang og koster ett liv
          </label>
        </fieldset>

        <fieldset>
          <legend>Seed</legend>
          <input
            type="text"
            value={draft.seed}
            placeholder="tom = tilfeldig"
            onChange={(event) => setDraft({ ...draft, seed: event.target.value })}
          />
          <p className="hjelpetekst">Samme seed gir alltid samme brett og samme oppgaver.</p>
        </fieldset>

        {impossible && (
          <p className="feilmelding">
            {draft.topics.length === 0
              ? 'Velg minst ett tema.'
              : 'Derivasjon har ingen maler på nivå 1. Velg nivå 2 eller høyere, eller ta med funksjoner.'}
          </p>
        )}

        {error !== null && <p className="feilmelding">{error}</p>}

        <button type="submit" className="start" disabled={impossible}>
          Start
        </button>
      </form>
    </div>
  );
}
