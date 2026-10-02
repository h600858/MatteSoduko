/**
 * Viser et ferdig brett med oppgaver i terminalen.
 *
 *   npm run demo:brett
 *   npm run demo:brett -- --seed=hvl --storrelse=6 --nivaa=2 --brettnivaa=3
 *   npm run demo:brett -- --fasit
 */
import { generateBoard, remainingCells } from '../core/game/engine.ts';
import type { BoardSize } from '../core/sudoku/grid.ts';
import { gridToString, isBoardSize } from '../core/sudoku/grid.ts';
import { taskRegistry } from '../core/tasks/registry.ts';
import { topicLabel } from '../core/tasks/topics.ts';
import type { Level, Topic } from '../core/tasks/types.ts';
import { isLevel } from '../core/tasks/types.ts';

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const seed = flag('seed') ?? `brett-${Date.now()}`;

const rawSize = Number(flag('storrelse') ?? 9);
const size: BoardSize = isBoardSize(rawSize) ? rawSize : 9;

const rawLevel = flag('nivaa') ?? 'middels';
const level: Level = isLevel(rawLevel) ? rawLevel : 'middels';

const chosen: readonly Topic[] = (flag('temaer') ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part.length > 0);
const topics =
  chosen.length > 0 ? chosen : taskRegistry.topicsForLevel(level).map((topic) => topic.id);

const board = generateBoard({ size, topics, level, seed });
const open = remainingCells(board);

console.log(`Seed: ${board.seed}`);
console.log(
  `${size}x${size}   minst ${board.minMathCells} å regne   oppgavenivå: ${level}   ` +
    `temaer: ${topics.map(topicLabel).join(', ')}`,
);
console.log(`${open.length} celler med oppgave, ${size * size - open.length} givne.`);
console.log('');
console.log('Utgangsstilling (punktum = celle med oppgave):');
console.log(gridToString(board.puzzle));

if (process.argv.includes('--fasit')) {
  console.log('');
  console.log('Fasit:');
  console.log(gridToString(board.solution));
}

console.log('');
console.log('Oppgavene:');
console.log('='.repeat(72));

for (const cell of open) {
  const task = cell.task;
  if (task === null) continue;
  console.log(`(rad ${cell.row + 1}, kol ${cell.col + 1})  ${task.templateId}   -> ${task.answer}`);
  console.log(`    ${task.latex}`);
  console.log(`    ${task.prompt}`);
}

const templates = new Map<string, number>();
for (const cell of open) {
  if (cell.task === null) continue;
  templates.set(cell.task.templateId, (templates.get(cell.task.templateId) ?? 0) + 1);
}

console.log('');
console.log('Fordeling av maler:');
for (const [id, count] of [...templates].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${id.padEnd(20)} ${count}`);
}
