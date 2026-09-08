import katex from 'katex';
import { forwardRef, useMemo } from 'react';
import type { Session } from '../../core/game/session.ts';
import { activeCell, cellElapsedMs, cellProgress, hintView } from '../../core/game/session.ts';
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
          ) : (
            <p className="hjelpetekst">
              Skriv svaret som tall i cellen. Trykk h for hint.
            </p>
          )}

          {hint.level > 0 && (
            <div className="hint">
              <h3>{hint.level === 1 ? 'Hint, nivå 1' : 'Hint, nivå 2: fasit'}</h3>
              <ol>
                {hint.steps.map((step, index) => (
                  <li key={index}>
                    <StepText text={step} />
                  </li>
                ))}
              </ol>
              {hint.answer !== null && <p className="fasit">Svaret er {hint.answer}.</p>}
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
