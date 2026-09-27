import type { Dispatch } from 'react';
import type { Session } from '../../core/game/session.ts';
import {
  boardElapsedMs,
  cellElapsedMs,
  countTasks,
  unsolvedCount,
} from '../../core/game/session.ts';
import type { BoardSummary } from '../../core/game/records.ts';
import { topicLabel } from '../../core/tasks/topics.ts';
import { LEVEL_INFO } from '../../core/tasks/types.ts';
import type { GameAction } from '../state/game.tsx';

/** mm:ss. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Det som vises når brettet er over.
 *
 * Målestokkene er bevisst ærlige: andelen av det mulige er regnet ut av
 * poengreglene, og persentilen måles mot dine egne tidligere brett. Ingen av
 * dem later som om de vet hva andre har fått.
 */
function Oppsummering({ summary }: { summary: BoardSummary }): React.JSX.Element {
  const { board, shareOfMax: andel, percentile: persentil, record: beat } = summary;
  const fullført = board.completed;

  return (
    <div className={`utfall ${fullført ? 'ok' : 'feil'}`}>
      <p className="utfallhode">
        {fullført
          ? `Brettet er løst på ${formatTime(board.durationMs)}.`
          : 'Livene er brukt opp.'}{' '}
        <strong>{board.points.toLocaleString('nb-NO')} poeng</strong> til totalen.
      </p>

      <ul className="maalestokk">
        {andel !== null && (
          <li>
            <strong>{Math.round(andel * 100)} %</strong> av det brettet kunne gitt
          </li>
        )}
        {persentil !== null && (
          <li>
            Bedre enn <strong>{Math.round(persentil * 100)} %</strong> av dine egne{' '}
            {LEVEL_INFO[board.level].label.toLowerCase()}-brett
          </li>
        )}
        {beat !== null && (
          <li className="rekord">
            Ny personlig rekord
            {beat === 'poeng' ? ' i poeng' : beat === 'tid' ? ' i tid' : ''}
          </li>
        )}
      </ul>
    </div>
  );
}

interface HudProps {
  session: Session;
  noteMode: boolean;
  now: number;
  /** Regnes ut ved innbanking, mot fremdriften slik den var før brettet. */
  summary: BoardSummary | null;
  dispatch: Dispatch<GameAction>;
}

export function Hud({
  session,
  noteMode,
  now,
  summary,
  dispatch,
}: HudProps): React.JSX.Element {
  const { board, score, mode, config, status } = session;
  const remaining = unsolvedCount(session);
  const cellMs =
    session.active === null
      ? 0
      : cellElapsedMs(session, session.active.row, session.active.col, now);

  return (
    <header className="hud">
      <div className="hudlinje tall">
        <span className="poeng">{score.points} poeng</span>
        {mode === 'streng' && (
          <span className={score.livesLeft <= 1 ? 'feil' : ''}>
            {'♥'.repeat(score.livesLeft)}
            {'♡'.repeat(Math.max(0, config.lives - score.livesLeft))} liv
          </span>
        )}
        <span title="Tid på hele brettet">brett {formatTime(boardElapsedMs(session, now))}</span>
        <span title="Tid på cellen du står i">celle {formatTime(cellMs)}</span>
        <span>
          {remaining} av {countTasks(board)} igjen
        </span>
        {score.hintsUsed > 0 && <span>{score.hintsUsed} hint</span>}
        {score.mistakes > 0 && <span className="feil">{score.mistakes} feil</span>}
      </div>

      {status !== 'spiller' && summary !== null && <Oppsummering summary={summary} />}

      <div className="hudlinje knapper">
        <button
          type="button"
          className={noteMode ? 'aktiv' : ''}
          onClick={() => dispatch({ type: 'notatmodus' })}
          disabled={status !== 'spiller'}
        >
          Notatmodus {noteMode ? 'på' : 'av'} (n)
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'hint' })}
          disabled={status !== 'spiller'}
          title={`Nivå 1 koster ${config.hintPenalty[1]} poeng, nivå 2 koster ${config.hintPenalty[2]}`}
        >
          Hint (h)
        </button>
        {mode === 'rolig' && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'sjekk', now: Date.now() })}
            disabled={status !== 'spiller'}
          >
            Sjekk brettet
          </button>
        )}
      </div>

      <div className="hudlinje smaatt">
        <span className="merke">
          {board.size}×{board.size}
        </span>
        <span>brettnivå {board.boardDifficulty}</span>
        <span>{LEVEL_INFO[board.level].label.toLowerCase()}</span>
        <span>{mode} modus</span>
        <span>{board.topics.map((id) => topicLabel(id)).join(', ')}</span>
        <span className="seed">seed: {board.seed}</span>
      </div>

      <p className="tastatur">
        Piltaster flytter · 1–{board.size} fyller inn · samme tall igjen tømmer · Delete tømmer ·
        n notatmodus · h hint · mellomrom hopper til oppgavepanelet
      </p>
    </header>
  );
}
