import katex from 'katex';
import { forwardRef, useMemo } from 'react';
import type { Concept } from '../../core/tasks/concepts.ts';
import type { Session } from '../../core/game/session.ts';
import {
  activeCell,
  activeLock,
  cellElapsedMs,
  cellProgress,
  hintView,
} from '../../core/game/session.ts';
import { formatTime } from './Hud.tsx';

/** Rendrer LaTeX til HTML én gang per uttrykk. */
function useKatex(latex: string | null): string | null {
  return useMemo(() => {
    if (latex === null) return null;
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      });
    } catch {
      return null;
    }
  }, [latex]);
}

const SUPERSCRIPTS: Readonly<Record<string, string>> = {
  '-1': '⁻¹',
  '-2': '⁻²',
  '0': '⁰',
  '2': '²',
  '3': '³',
};

/**
 * Løsningsstegene er norsk prosa blandet med LaTeX, uten skille mellom de to.
 * De kan derfor ikke sendes gjennom KaTeX: matematikkmodus spiser mellomrommene
 * i teksten, så «Deriver ledd for ledd» blir «Deriverleddforledd».
 *
 * Her ryddes i stedet de få LaTeX-kommandoene stegene faktisk bruker, og
 * resten vises som vanlig tekst. Skal stegene rendres ordentlig, må malene
 * merke matematikken eksplisitt, for eksempel med dollartegn.
 */
export function prettifyStep(text: string): string {
  return text
    .replace(/\\cdot/g, '·')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\log_\{([^{}]*)\}/g, 'log_$1')
    .replace(/\\qquad/g, '   ')
    .replace(/\^\{([^{}]*)\}/g, (_match, exponent: string) => SUPERSCRIPTS[exponent] ?? `^${exponent}`)
    .replace(/\^(-?\d)/g, (_match, exponent: string) => SUPERSCRIPTS[exponent] ?? `^${exponent}`);
}

/** LaTeX på én linje, til tabellceller. Faller tilbake til råteksten. */
function Matte({ tex }: { tex: string }): React.JSX.Element {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, output: 'html' });
    } catch {
      return null;
    }
  }, [tex]);

  if (html === null) return <span>{tex}</span>;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Det første hintet: hva slags oppgave dette er, hele regeltabellen, og hvor
 * man kan lese mer.
 *
 * Tabellen viser med vilje alle reglene, ikke bare den som passer. Å finne
 * riktig regel er en del av oppgaven.
 */
function Konsept({ concept }: { concept: Concept }): React.JSX.Element {
  return (
    <div className="konsept">
      <h4>{concept.title}</h4>
      <p>{concept.intro}</p>

      <p className="regeltittel">{concept.rulesHeading}</p>
      <div className="regeltabell">
        <table>
          <tbody>
            {concept.rules.map((rule, i) => (
              <tr key={i}>
                <th scope="row">{rule.name}</th>
                <td>
                  <Matte tex={rule.fn} />
                </td>
                <td>
                  <Matte tex={rule.result} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="veiledning">{concept.guidance}</p>

      <p className="kildetittel">Les mer</p>
      <ul className="kilder">
        {concept.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
            <span className="kildenote"> — {source.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ett løsningssteg, som lesbar tekst. */
function StepText({ text }: { text: string }): React.JSX.Element {
  const cleaned = useMemo(() => prettifyStep(text), [text]);
  return <span>{cleaned}</span>;
}

interface TaskPanelProps {
  session: Session;
  now: number;
}

export const TaskPanel = forwardRef<HTMLElement, TaskPanelProps>(function TaskPanel(
  { session, now },
  ref,
) {
  const cell = activeCell(session);
  const task = cell?.task ?? null;
  const rendered = useKatex(task?.latex ?? null);
  const hint = hintView(session);

  if (cell === null) {
    return (
      <aside className="oppgavepanel" ref={ref} tabIndex={-1}>
        <p className="tomtekst">Velg en celle for å se oppgaven.</p>
      </aside>
    );
  }

  const progress = cellProgress(session, cell.row, cell.col);
  const solved = cell.userValue === cell.solution;
  const lås = activeLock(session, now);

  return (
    <aside className="oppgavepanel" ref={ref} tabIndex={-1}>
      <h2>
        Rad {cell.row + 1}, kolonne {cell.col + 1}
      </h2>

      {cell.given ? (
        <p className="tomtekst">
          Denne cellen var utfylt fra start og har ingen oppgave. Flytt til en celle med ƒ.
        </p>
      ) : task === null ? (
        <p className="tomtekst">Cellen mangler oppgave.</p>
      ) : (
        <>
          <p className="malid">
            {task.templateId} · {formatTime(cellElapsedMs(session, cell.row, cell.col, now))} brukt
            {progress.wrongAttempts > 0 && ` · ${progress.wrongAttempts} feilforsøk`}
          </p>

          {rendered === null ? (
            <pre className="latexkilde">{task.latex}</pre>
          ) : (
            // KaTeX produserer HTML-en selv, fra vår egen malstreng.
            <div className="matte" dangerouslySetInnerHTML={{ __html: rendered }} />
          )}

          <p className="spørsmål">{task.prompt}</p>

          {solved ? (
            <p className="lost">Riktig. Cellen er låst.</p>
          ) : lås.locked ? (
            <div className="sperre" role="status">
              <strong>Cellen er sperret.</strong>
              <p>
                Du brukte opp forsøkene dine her. Den åpner seg når du har løst{' '}
                <strong>
                  {lås.cellsLeft} {lås.cellsLeft === 1 ? 'annen celle' : 'andre celler'}
                </strong>
                , eller om <strong>{formatTime(lås.msLeft)}</strong> — det som kommer først.
              </p>
              <p className="hjelpetekst">
                Hint virker fortsatt. Trykk h hvis du vil ha hjelp mens du venter.
              </p>
            </div>
          ) : (
            <p className="hjelpetekst">
              Skriv svaret som tall i cellen. Trykk h for hint.
              {progress.wrongAttempts > 0 &&
                ` Du har ${session.config.wrongAttemptsBeforeLock - progress.wrongAttempts % session.config.wrongAttemptsBeforeLock} forsøk igjen før cellen sperres.`}
            </p>
          )}

          {hint.level > 0 && (
            <div className="hint">
              <h3>
                {hint.level === 1
                  ? 'Hint 1 av 3: hva slags oppgave'
                  : hint.level === 2
                    ? 'Hint 2 av 3: første steg'
                    : 'Hint 3 av 3: fasit'}
              </h3>

              {hint.concept !== null && <Konsept concept={hint.concept} />}

              {hint.steps.length > 0 && (
                <ol className="losningssteg">
                  {hint.steps.map((step, index) => (
                    <li key={index}>
                      <StepText text={step} />
                    </li>
                  ))}
                </ol>
              )}

              {hint.answer !== null && <p className="fasit">Svaret er {hint.answer}.</p>}

              {hint.level < 3 && (
                <p className="hjelpetekst">Trykk h igjen for mer hjelp.</p>
              )}
            </div>
          )}
        </>
      )}

      <div className="cellestatus">
        <span>Status: {cell.status}</span>
        {cell.notes.size > 0 && <span>Notater: {[...cell.notes].sort().join(' ')}</span>}
      </div>
    </aside>
  );
});
