import type { Board } from '../../core/game/engine.ts';
import { conflicts, isComplete, remainingCells } from '../../core/game/engine.ts';
import type { GameAction } from '../state/game.tsx';
import type { Dispatch } from 'react';

interface HudProps {
  board: Board;
  noteMode: boolean;
  dispatch: Dispatch<GameAction>;
}

export function Hud({ board, noteMode, dispatch }: HudProps): React.JSX.Element {
  const remaining = remainingCells(board).length;
  const problems = conflicts(board);
  const done = isComplete(board);

  return (
    <header className="hud">
      <div className="hudlinje">
        <span className="merke">
          {board.size}×{board.size}
        </span>
        <span>brettnivå {board.boardDifficulty}</span>
        <span>oppgavenivå ≤ {board.taskDifficulty}</span>
        <span>{board.topics.join(', ')}</span>
        <span className="seed">seed: {board.seed}</span>
      </div>

      <div className="hudlinje">
        <span>{remaining} celler igjen</span>
        <span className={problems.valid ? 'ok' : 'feil'}>
          {problems.valid ? 'ingen konflikter' : `${problems.cells.length} celler i konflikt`}
        </span>
        {done && <strong className="ferdig">Brettet er løst.</strong>}
      </div>

      <div className="hudlinje knapper">
        <button
          type="button"
          className={noteMode ? 'aktiv' : ''}
          onClick={() => dispatch({ type: 'notatmodus' })}
        >
          Notatmodus {noteMode ? 'på' : 'av'} (n)
        </button>
        <button type="button" onClick={() => dispatch({ type: 'avslutt' })}>
          Nytt brett
        </button>
        <button
          type="button"
          className="midlertidig"
          onClick={() => dispatch({ type: 'avslør' })}
          title="Midlertidig testeknapp. Erstattes av hintsystemet i M5."
        >
          Fyll inn fasit
        </button>
      </div>

      <p className="tastatur">
        Piltaster flytter · 1–{board.size} fyller inn · samme tall igjen tømmer ·
        Delete tømmer · n veksler notatmodus
      </p>
    </header>
  );
}
