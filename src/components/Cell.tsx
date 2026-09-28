import type { Cell as CellModel } from '../../core/game/engine.ts';
import { effectiveValue } from '../../core/game/engine.ts';

interface CellProps {
  cell: CellModel;
  size: number;
  selected: boolean;
  /** Cellen ligger i samme rad, kolonne eller blokk som den valgte. */
  related: boolean;
  /** Cellen har samme tall som den valgte. */
  sameValue: boolean;
  /** Midlertidig stengt etter for mange gale svar. */
  blocked: boolean;
  /** Tykk skillelinje mot naboen til høyre eller under. */
  borderRight: boolean;
  borderBottom: boolean;
  onSelect: (row: number, col: number) => void;
}

export function Cell({
  cell,
  size,
  selected,
  related,
  sameValue,
  blocked,
  borderRight,
  borderBottom,
  onSelect,
}: CellProps): React.JSX.Element {
  const value = effectiveValue(cell);
  const classes = ['celle', `status-${cell.status}`];
  if (selected) classes.push('valgt');
  if (related) classes.push('beslektet');
  if (sameValue && !selected) classes.push('samme-tall');
  if (blocked) classes.push('sperret');
  if (borderRight) classes.push('kant-hoyre');
  if (borderBottom) classes.push('kant-bunn');

  const label = cell.given
    ? `Rad ${cell.row + 1}, kolonne ${cell.col + 1}: låst ${value}`
    : `Rad ${cell.row + 1}, kolonne ${cell.col + 1}: ${
        blocked ? 'sperret' : value === 0 ? 'tom, har oppgave' : String(value)
      }`;

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={() => onSelect(cell.row, cell.col)}
      aria-label={label}
      aria-pressed={selected}
      tabIndex={-1}
    >
      {value !== 0 ? (
        <span className="celleverdi">{value}</span>
      ) : cell.notes.size > 0 ? (
        <span className="notater">
          {Array.from({ length: size }, (_unused, i) => i + 1).map((candidate) => (
            <span key={candidate} className="notat">
              {cell.notes.has(candidate) ? candidate : ''}
            </span>
          ))}
        </span>
      ) : blocked ? (
        <span className="sperremerke" aria-hidden="true">
          ⏻
        </span>
      ) : (
        <span className="oppgavemerke" aria-hidden="true">
          ƒ
        </span>
      )}
    </button>
  );
}
