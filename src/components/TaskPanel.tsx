import katex from 'katex';
import { useMemo } from 'react';
import type { Board } from '../../core/game/engine.ts';
import { cellAt } from '../../core/game/engine.ts';
import type { Selection } from '../state/game.tsx';

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

interface TaskPanelProps {
  board: Board;
  selected: Selection | null;
}

export function TaskPanel({ board, selected }: TaskPanelProps): React.JSX.Element {
  const cell = selected === null ? null : cellAt(board, selected.row, selected.col);
  const task = cell?.task ?? null;
  const rendered = useKatex(task?.latex ?? null);

  if (cell === null) {
    return (
      <aside className="oppgavepanel">
        <p className="tomtekst">Velg en celle for å se oppgaven.</p>
      </aside>
    );
  }

  if (cell.given) {
    return (
      <aside className="oppgavepanel">
        <h2>
          Rad {cell.row + 1}, kolonne {cell.col + 1}
        </h2>
        <p className="tomtekst">
          Denne cellen var utfylt fra start og har ingen oppgave. Flytt til en celle med ƒ.
        </p>
      </aside>
    );
  }

  return (
    <aside className="oppgavepanel">
      <h2>
        Rad {cell.row + 1}, kolonne {cell.col + 1}
      </h2>

      {task === null ? (
        <p className="tomtekst">Cellen mangler oppgave.</p>
      ) : (
        <>
          <p className="malid">
            {task.templateId} · nivå {board.taskDifficulty} eller lavere
          </p>

          {rendered === null ? (
            <pre className="latexkilde">{task.latex}</pre>
          ) : (
            // KaTeX produserer HTML-en selv, fra vår egen malstreng.
            <div className="matte" dangerouslySetInnerHTML={{ __html: rendered }} />
          )}

          <p className="spørsmål">{task.prompt}</p>

          <p className="hjelpetekst">
            Skriv svaret som tall i cellen. Sudokureglene sier fra hvis det kolliderer.
          </p>
        </>
      )}

      <div className="cellestatus">
        <span>Status: {cell.status}</span>
        {cell.notes.size > 0 && <span>Notater: {[...cell.notes].sort().join(' ')}</span>}
      </div>
    </aside>
  );
}
