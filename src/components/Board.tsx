import type { Board as BoardModel } from '../../core/game/engine.ts';
import { cellAt, effectiveValue } from '../../core/game/engine.ts';
import { blockIndexOf } from '../../core/sudoku/grid.ts';
import type { CellRefLike } from '../../core/game/session.ts';
import { Cell } from './Cell.tsx';

interface BoardProps {
  board: BoardModel;
  selected: CellRefLike | null;
  onSelect: (row: number, col: number) => void;
}

export function Board({ board, selected, onSelect }: BoardProps): React.JSX.Element {
  const selectedCell = selected === null ? null : cellAt(board, selected.row, selected.col);
  const selectedValue = selectedCell === null ? 0 : effectiveValue(selectedCell);
  const selectedBlock =
    selected === null ? -1 : blockIndexOf(board.solution, selected.row, selected.col);

  return (
    <div
      className="brett"
      style={{ gridTemplateColumns: `repeat(${board.size}, var(--celle))` }}
      role="grid"
      aria-label={`Sudokubrett ${board.size} ganger ${board.size}`}
    >
      {board.cells.map((cell) => {
        const isSelected =
          selected !== null && cell.row === selected.row && cell.col === selected.col;
        const related =
          selected !== null &&
          !isSelected &&
          (cell.row === selected.row ||
            cell.col === selected.col ||
            blockIndexOf(board.solution, cell.row, cell.col) === selectedBlock);

        return (
          <Cell
            key={`${cell.row}-${cell.col}`}
            cell={cell}
            size={board.size}
            selected={isSelected}
            related={related}
            sameValue={selectedValue !== 0 && effectiveValue(cell) === selectedValue}
            borderRight={(cell.col + 1) % board.blockCols === 0 && cell.col + 1 < board.size}
            borderBottom={(cell.row + 1) % board.blockRows === 0 && cell.row + 1 < board.size}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
