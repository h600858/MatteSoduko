import { useMemo, useState } from 'react';
import type { BoardDifficulty } from '../../core/sudoku/generate.ts';
import type { BoardSize } from '../../core/sudoku/grid.ts';
import { BOARD_SIZES } from '../../core/sudoku/grid.ts';
import { DEFAULT_SCORING, maxBoardScore } from '../../core/game/scoring.ts';
import { holesForDifficulty } from '../../core/sudoku/generate.ts';
import { taskRegistry } from '../../core/tasks/registry.ts';
import type { Level, Topic } from '../../core/tasks/types.ts';
import { LEVEL_INFO } from '../../core/tasks/types.ts';
import type { Settings } from '../state/game.tsx';

interface SetupProps {
  settings: Settings;
  error: string | null;
  /** Antall maler vi har statistikk for. Styrer om bryteren er verdt å bruke. */
  knownTemplates: number;
  onStart: (settings: Settings) => void;
}

const BOARD_DIFFICULTIES: readonly BoardDifficulty[] = [1, 2, 3];

const BOARD_LABEL: Readonly<Record<BoardDifficulty, string>> = {
  1: 'Få hull',
  2: 'Middels',
  3: 'Mange hull',
};

export function Setup({
  settings,
  error,
  knownTemplates,
  onStart,
}: SetupProps): React.JSX.Element {
  const [draft, setDraft] = useState<Settings>(settings);

  // Nivåene og temaene leses ut av registeret, ikke av en liste her. Legges en
  // ny malfil inn i registeret, dukker temaet opp i menyen av seg selv.
  const levels = useMemo(() => taskRegistry.levels(), []);
  const topics = useMemo(() => taskRegistry.topicsForLevel(draft.level), [draft.level]);

  /** Bytte av nivå tar med seg temaene som finnes der. */
  const velgNivå = (level: Level): void => {
    const tilgjengelige = taskRegistry.topicsForLevel(level).map((topic) => topic.id);
    const beholdt = draft.topics.filter((id) => tilgjengelige.includes(id));
    setDraft({
      ...draft,
      level,
      topics: beholdt.length > 0 ? beholdt : tilgjengelige,
    });
  };

  const toggleTopic = (topic: Topic): void => {
    const har = draft.topics.includes(topic);
    const neste = har ? draft.topics.filter((t) => t !== topic) : [...draft.topics, topic];
    setDraft({ ...draft, topics: neste });
  };

  const ingenTemaer = draft.topics.length === 0;

  // Hva brettet er verdt med perfekt spill. Vises som et tak, ikke som en
  // forventning: full tidsbonus krever under 20 sekunder per celle uten hint.
  const oppgaver = holesForDifficulty(draft.size, draft.boardDifficulty);
  const tak = maxBoardScore(DEFAULT_SCORING, oppgaver, draft.level);

  return (
    <div className="oppsett">
      <h1>MatteSudoku</h1>
      <p className="ingress">
        Hver tomme celle inneholder en matteoppgave. Svaret er tallet som skal stå i cellen,
        og sudokureglene sier fra hvis noe ikke stemmer.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onStart(draft);
        }}
      >
        <fieldset>
          <legend>Vanskelighetsgrad</legend>
          {levels.map((level) => {
            const info = LEVEL_INFO[level];
            return (
              <label key={level}>
                <input
                  type="radio"
                  name="nivaa"
                  checked={draft.level === level}
                  onChange={() => velgNivå(level)}
                />
                <span className="valgtekst">
                  <strong>
                    {info.label}
                    <span className="trinn">{info.trinn}</span>
                  </strong>
                  <span className="hjelpetekst">{info.description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <fieldset>
          <legend>Temaer på dette nivået</legend>
          {topics.length === 0 ? (
            <p className="hjelpetekst">Ingen temaer er lagt inn på dette nivået ennå.</p>
          ) : (
            topics.map((topic) => (
              <label key={topic.id}>
                <input
                  type="checkbox"
                  checked={draft.topics.includes(topic.id)}
                  onChange={() => toggleTopic(topic.id)}
                />
                <span className="valgtekst">
                  <strong>{topic.label}</strong>
                  <span className="hjelpetekst">{topic.description}</span>
                </span>
              </label>
            ))
          )}
        </fieldset>

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
          <legend>Antall hull</legend>
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
            <span className="valgtekst">
              <strong>Rolig</strong>
              <span className="hjelpetekst">
                Feil vises først når du trykker sjekk, og koster ikke liv.
              </span>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="modus"
              checked={draft.mode === 'streng'}
              onChange={() => setDraft({ ...draft, mode: 'streng' })}
            />
            <span className="valgtekst">
              <strong>Streng</strong>
              <span className="hjelpetekst">Feil markeres med én gang og koster ett liv.</span>
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>Oppgavevalg</legend>
          <label>
            <input
              type="checkbox"
              checked={draft.adaptive}
              onChange={() => setDraft({ ...draft, adaptive: !draft.adaptive })}
            />
            <span className="valgtekst">
              <strong>Tilpass etter statistikken min</strong>
              <span className="hjelpetekst">
                {knownTemplates === 0
                  ? 'Ingen statistikk ennå, så alle maler trekkes likt. Etter noen brett vektes maler du bommer på eller bruker lang tid på, oftere.'
                  : `Maler du bommer på eller bruker lang tid på trekkes oftere. Bygger på ${knownTemplates} maler du har spilt.`}
              </span>
            </span>
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
          <p className="hjelpetekst">
            Samme seed gir alltid samme sudoku. Med tilpasset oppgavevalg kan oppgavene i
            cellene endre seg etter hvert som statistikken din vokser.
          </p>
        </fieldset>

        <div className="potten">
          <div>
            <span className="pottetall">{tak.toLocaleString('nb-NO')}</span>
            <span className="pottemerke">poeng å hente</span>
          </div>
          <p className="hjelpetekst">
            {oppgaver} oppgaver · {LEVEL_INFO[draft.level].label.toLowerCase()}. Dette er
            taket: alt riktig, ingen hint, og raskt nok til full tidsbonus.
          </p>
        </div>

        {ingenTemaer && <p className="feilmelding">Velg minst ett tema.</p>}
        {error !== null && <p className="feilmelding">{error}</p>}

        <div className="startknapper">
          <button type="submit" className="start" disabled={ingenTemaer}>
            Start
          </button>
        </div>
      </form>
    </div>
  );
}
