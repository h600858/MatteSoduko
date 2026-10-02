import { useMemo, useState } from 'react';
import type { BoardSize } from '../../core/sudoku/grid.ts';
import { BOARD_SIZES } from '../../core/sudoku/grid.ts';
import { DEFAULT_SCORING, maxBoardScore } from '../../core/game/scoring.ts';
import { taskCountFor } from '../../core/sudoku/generate.ts';
import { taskRegistry } from '../../core/tasks/registry.ts';
import type { Level, Topic } from '../../core/tasks/types.ts';
import { LEVEL_INFO } from '../../core/tasks/types.ts';
import type { Settings } from '../state/game.tsx';

/**
 * Omtrent hvor få oppgaver man slipper unna med per størrelse, hvis man velger
 * cellene godt. Målte snitt over 40 brett per størrelse. Det eksakte tallet for
 * et konkret brett står i HUD-en når brettet er laget.
 */
const SMART_ANSLAG: Readonly<Record<number, number>> = { 4: 4, 6: 10, 9: 24 };

interface SetupProps {
  settings: Settings;
  error: string | null;
  /** Antall maler vi har statistikk for. Styrer om bryteren er verdt å bruke. */
  knownTemplates: number;
  onStart: (settings: Settings) => void;
}

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
  const oppgaver = taskCountFor(draft.size);
  const tak = maxBoardScore(DEFAULT_SCORING, oppgaver, draft.level);

  return (
    <div className="oppsett">
      <h1>MatteSudoku</h1>
      <p className="ingress">
        Brettet er helt tomt. Hver eneste celle skjuler en matteoppgave, og svaret er
        tallet som skal stå der. Du regner deg innover til du har nok tall — og så kan du
        løse resten som et vanlig sudoku.
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
          <p className="hjelpetekst">
            Alle cellene er tomme, så et {draft.size}×{draft.size} har {oppgaver} oppgaver.
            Men du trenger ikke løse alle: velger du cellene smart, holder det med rundt{' '}
            {SMART_ANSLAG[draft.size]} før resten følger av seg selv. Tar du dem i tilfeldig
            rekkefølge, trenger du omtrent det dobbelte. Der ligger strategien.
          </p>
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
                Du får ikke vite om svaret var feil før du trykker sjekk, og det koster ingen liv.
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
              <span className="hjelpetekst">Feil slår ut med én gang, og koster ett liv.</span>
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
              <strong>Tilpass etter hvordan jeg ligger an</strong>
              <span className="hjelpetekst">
                {knownTemplates === 0
                  ? 'Du har ikke spilt nok ennå, så alle oppgavetyper kommer like ofte. Etter noen brett begynner de du sliter med å dukke opp oftere.'
                  : `Oppgavetyper du bommer på eller bruker lang tid på kommer oftere. Bygger på de ${knownTemplates} typene du har spilt.`}
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
            Samme seed gir alltid samme sudoku. Slår du på tilpasning, kan oppgavene i
            cellene likevel bytte seg ut etter hvert som du spiller mer.
          </p>
        </fieldset>

        <div className="potten">
          <div>
            <span className="pottetall">{tak.toLocaleString('nb-NO')}</span>
            <span className="pottemerke">poeng å hente</span>
          </div>
          <p className="hjelpetekst">
Rundt {oppgaver} oppgaver · {LEVEL_INFO[draft.level].label.toLowerCase()}. Dette er
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
