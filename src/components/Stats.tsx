import type { Progress } from "../../core/game/progress.ts";
import { overallStats, templateSummaries } from "../../core/game/progress.ts";
import { LEVEL_INFO } from "../../core/tasks/types.ts";
import { persistsToFile } from "../state/storage.ts";
import { formatTime } from "./Hud.tsx";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatPercent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)} %`;
}

function formatWeight(value: number | undefined): string {
  return value === undefined ? "–" : value.toFixed(2).replace(".", ",");
}

/** Merker malene som løftes eller dempes tydelig. */
function vektKlasse(value: number | undefined): string {
  if (value === undefined) return "";
  if (value >= 1.5) return "vekt-opp";
  if (value <= 0.75) return "vekt-ned";
  return "";
}

interface StatsProps {
  progress: Progress;
  warning: string | null;
  /** Fra den adaptive vektingen. Vises så det går an å se hvorfor. */
  weights: ReadonlyMap<string, number>;
  onClose: () => void;
}

export function Stats({
  progress,
  warning,
  weights,
  onClose,
}: StatsProps): React.JSX.Element {
  const rows = templateSummaries(progress);
  const totals = overallStats(progress);

  return (
    <div className="statistikk">
      <div className="statistikktopp">
        <h1>Statistikk</h1>
        <button type="button" onClick={onClose}>
          Tilbake
        </button>
      </div>

      {warning !== null && <p className="feilmelding">{warning}</p>}

      {!persistsToFile() && (
        <p className="hjelpetekst">
          Kjører i nettleser: fremdriften lagres i localStorage, ikke i
          progress.json.
        </p>
      )}

      {totals.boardsPlayed === 0 && rows.length === 0 ? (
        <p className="tomtekst">Ingen brett er spilt ferdig ennå.</p>
      ) : (
        <>
          <dl className="noekkeltall">
            <div>
              <dt>Brett spilt</dt>
              <dd>{totals.boardsPlayed}</dd>
            </div>
            <div>
              <dt>Fullført</dt>
              <dd>{totals.boardsCompleted}</dd>
            </div>
            <div>
              <dt>Beste poengsum</dt>
              <dd>{totals.bestPoints ?? "–"}</dd>
            </div>
            <div>
              <dt>Celler riktig</dt>
              <dd>
                {totals.cellsCorrect} av {totals.cellsAttempted}
              </dd>
            </div>
            <div>
              <dt>Hint brukt</dt>
              <dd>{totals.hintsUsed}</dd>
            </div>
            <div>
              <dt>Feil som kostet poeng</dt>
              <dd>{totals.mistakes}</dd>
            </div>
          </dl>

          {rows.length > 0 && (
            <>
              <h2>Per oppgavemal</h2>
              <p className="hjelpetekst">
                Sortert med svakeste treffprosent først. Vekten viser hvor mye
                oftere malen trekkes: 1,0 er nøytralt, høyere tall kommer
                oftere, lavere sjeldnere.
              </p>
              <div className="tabellramme">
                <table>
                  <thead>
                    <tr>
                      <th>Mal</th>
                      <th>Forsøk</th>
                      <th>Riktig</th>
                      <th>Treff</th>
                      <th>Snittid</th>
                      <th>Hint</th>
                      <th title="Alle gale svar, også de som ble rettet før de kostet noe">
                        Gale svar
                      </th>
                      <th title="Hvor mye oftere malen trekkes. 1,0 er nøytralt.">
                        Vekt
                      </th>
                      <th>Sist sett</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.templateId}>
                        <td className="malid">{row.templateId}</td>
                        <td>{row.attempts}</td>
                        <td>{row.correct}</td>
                        <td>{formatPercent(row.accuracy)}</td>
                        <td>
                          {row.averageMs === null
                            ? "–"
                            : formatTime(row.averageMs)}
                        </td>
                        <td>{row.hinted}</td>
                        <td>{row.wrongAttempts}</td>
                        <td className={vektKlasse(weights.get(row.templateId))}>
                          {formatWeight(weights.get(row.templateId))}
                        </td>
                        <td>{formatDate(row.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {progress.boards.length > 0 && (
            <>
              <h2>Siste brett</h2>
              <div className="tabellramme">
                <table>
                  <thead>
                    <tr>
                      <th>Tidspunkt</th>
                      <th>Brett</th>
                      <th>Modus</th>
                      <th>Utfall</th>
                      <th>Poeng</th>
                      <th>Tid</th>
                      <th>Løst</th>
                      <th>Seed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.boards.slice(0, 20).map((board, index) => (
                      <tr key={`${board.finishedAt}-${index}`}>
                        <td>{formatDate(board.finishedAt)}</td>
                        <td>
                          {board.size}×{board.size} ·{' '}
                          {LEVEL_INFO[board.level].label.toLowerCase()}
                        </td>
                        <td>{board.mode}</td>
                        <td className={board.completed ? "ok" : "feil"}>
                          {board.completed ? "fullført" : "avbrutt"}
                        </td>
                        <td>{board.points}</td>
                        <td>{formatTime(board.durationMs)}</td>
                        <td>
                          {board.solvedCells}/{board.taskCount}
                        </td>
                        <td className="seed">{board.seed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
