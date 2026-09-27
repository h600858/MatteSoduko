import { useMemo } from 'react';
import type { DailyBoard } from '../../core/game/daily.ts';
import { dailyBoard, dailyPlayed, dailyResult } from '../../core/game/daily.ts';
import { MASCOT_NAME, dailyQuote, greeting } from '../../core/game/mascot.ts';
import type { Progress } from '../../core/game/progress.ts';
import { streakView } from '../../core/game/records.ts';
import { DEFAULT_SCORING, maxBoardScore, rankFor } from '../../core/game/scoring.ts';
import { holesForDifficulty } from '../../core/sudoku/generate.ts';
import { taskRegistry } from '../../core/tasks/registry.ts';
import type { Level } from '../../core/tasks/types.ts';
import { LEVELS, LEVEL_INFO } from '../../core/tasks/types.ts';
import { Lion } from './Mascot.tsx';
import { formatTime } from './Hud.tsx';

interface HomeProps {
  progress: Progress;
  /** Nivået spilleren brukte sist. Styrer hvilket dagens brett som vises. */
  level: Level;
  now: Date;
  onLevelChange: (level: Level) => void;
  onStartDaily: (oppsett: DailyBoard) => void;
  onSetup: () => void;
  onProfile: () => void;
}

export function Home({
  progress,
  level,
  now,
  onLevelChange,
  onStartDaily,
  onSetup,
  onProfile,
}: HomeProps): React.JSX.Element {
  const oppsett = useMemo(() => dailyBoard(now, level, taskRegistry), [now, level]);
  const spilt = dailyPlayed(progress, now, level);
  const resultat = dailyResult(progress, now, level);

  const oppgaver = holesForDifficulty(oppsett.size, oppsett.boardDifficulty);
  const tak = maxBoardScore(DEFAULT_SCORING, oppgaver, level);
  const rang = rankFor(progress.lifetime.points);
  const rekke = streakView(progress.streak, now);

  return (
    <div className="hjem">
      <section className="velkomst">
        <div className="velkomstlove">
          <Lion />
        </div>
        <div className="velkomsttekst">
          <p className="hilsen">
            {greeting(now)} Jeg er {MASCOT_NAME}.
          </p>
          <p className="dagensord">{dailyQuote(now)}</p>
          {progress.lifetime.boardsPlayed > 0 && (
            <p className="velkomststatus">
              {progress.lifetime.points.toLocaleString('nb-NO')} poeng · {rang.label} ·{' '}
              {progress.lifetime.boardsPlayed} brett spilt
            </p>
          )}
          {rekke.current > 0 && (
            <p className={`rekke ${rekke.atRisk ? 'fare' : ''}`}>
              <span className="rekketall">{rekke.current}</span>
              {rekke.current === 1 ? ' dag på rad' : ' dager på rad'}
              {rekke.atRisk ? ' · spill i dag for å holde den' : ''}
              {rekke.longest > rekke.current ? ` · lengste ${rekke.longest}` : ''}
            </p>
          )}
        </div>
      </section>

      <section className="dagenskort">
        <div className="dagenstopp">
          <h2>Dagens brett</h2>
          {spilt && <span className="merkelapp">Spilt i dag</span>}
        </div>
        <p className="hjelpetekst">
          Alle som spiller {LEVEL_INFO[level].label.toLowerCase()} i dag får nøyaktig dette
          brettet, med nøyaktig disse oppgavene.
        </p>

        <div className="nivaavelger" role="group" aria-label="Velg nivå for dagens brett">
          {LEVELS.map((kandidat) => (
            <button
              key={kandidat}
              type="button"
              className={kandidat === level ? 'aktiv' : ''}
              onClick={() => onLevelChange(kandidat)}
              aria-pressed={kandidat === level}
            >
              {LEVEL_INFO[kandidat].label}
            </button>
          ))}
        </div>

        <dl className="dagensfakta">
          <div>
            <dt>Brett</dt>
            <dd>
              {oppsett.size}×{oppsett.size}
            </dd>
          </div>
          <div>
            <dt>Oppgaver</dt>
            <dd>{oppgaver}</dd>
          </div>
          <div>
            <dt>Å hente</dt>
            <dd>opptil {tak.toLocaleString('nb-NO')}</dd>
          </div>
        </dl>

        {resultat === null ? (
          <button type="button" className="start" onClick={() => onStartDaily(oppsett)}>
            Spill dagens brett
          </button>
        ) : (
          <>
            <p className="dagensresultat">
              Du fikk <strong>{resultat.points.toLocaleString('nb-NO')} poeng</strong> på{' '}
              {formatTime(resultat.durationMs)}
              {resultat.completed ? ', og fullførte brettet.' : `, og løste ${resultat.solvedCells} av ${resultat.taskCount} celler.`}
            </p>
            <button type="button" onClick={() => onStartDaily(oppsett)}>
              Spill det om igjen
            </button>
          </>
        )}
      </section>

      <section className="hjemvalg">
        <button type="button" className="hjemkort" onClick={onSetup}>
          <span className="hjemkorttittel">Sett opp brett</span>
          <span className="hjelpetekst">
            Velg nivå, temaer, størrelse og feilmodus selv.
          </span>
        </button>
        <button type="button" className="hjemkort" onClick={onProfile}>
          <span className="hjemkorttittel">Profil</span>
          <span className="hjelpetekst">
            Poeng, trinn og statistikk per oppgavemal.
          </span>
        </button>
      </section>
    </div>
  );
}
