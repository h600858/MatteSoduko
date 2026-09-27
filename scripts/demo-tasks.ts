/**
 * Liten CLI for å lese gjennom kvaliteten på genererte oppgaver.
 *
 *   npm run demo:tasks
 *   npm run demo:tasks -- --seed=hvl --antall=20 --nivaa=2 --temaer=derivasjon
 *   npm run demo:tasks -- --stats
 */
import { createRng } from '../core/rng.ts';
import { allTemplates, taskRegistry } from '../core/tasks/registry.ts';
import { topicLabel } from '../core/tasks/topics.ts';
import type { Level, Topic } from '../core/tasks/types.ts';
import { isLevel, taskKey, templateCovers } from '../core/tasks/types.ts';

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const seed = flag('seed') ?? `demo-${Date.now()}`;
const count = Number(flag('antall') ?? 10);
const rawLevel = flag('nivaa') ?? 'middels';
const level: Level = isLevel(rawLevel) ? rawLevel : 'middels';
const valgteTemaer: readonly Topic[] = (flag('temaer') ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part.length > 0);
const activeTopics =
  valgteTemaer.length > 0
    ? valgteTemaer
    : taskRegistry.topicsForLevel(level).map((topic) => topic.id);

function printTasks(): void {
  console.log(`Seed: ${seed}`);
  console.log(`Nivå: ${level}   Temaer: ${activeTopics.map(topicLabel).join(', ')}`);
  console.log('='.repeat(72));

  const rng = createRng(seed);
  const used = new Set<string>();

  for (let i = 1; i <= count; i += 1) {
    const targetAnswer = rng.int(1, 9);
    const task = taskRegistry.generateTask({
      topics: activeTopics,
      level,
      targetAnswer,
      rng,
      exclude: used,
    });

    if (task === null) {
      console.log(`${String(i).padStart(2)}. [ingen mal klarte svaret ${targetAnswer}]`);
      continue;
    }

    used.add(taskKey(task));
    console.log(`${String(i).padStart(2)}. ${task.templateId}   (fasit: ${task.answer})`);
    console.log(`    LaTeX:  ${task.latex}`);
    console.log(`    Spm:    ${task.prompt}`);
    for (const [index, step] of task.steps.entries()) {
      console.log(`    Steg ${index + 1}: ${step}`);
    }
    console.log(`    mathjs-verifisering: ${task.verify() ? 'ok' : 'FEILET'}`);
    console.log('');
  }

  console.log(`${used.size} av ${count} oppgaver hadde unik tekst.`);
}

function printStats(): void {
  const iterations = 300;
  console.log('Mal                  nivå        dekker svar        null-rate');
  console.log('-'.repeat(68));

  for (const template of allTemplates) {
    const covered = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((target) =>
      templateCovers(template, target),
    );
    let attempts = 0;
    let nulls = 0;
    const meta = createRng(`stats:${template.id}`);

    for (let i = 0; i < iterations; i += 1) {
      const target = meta.pick(covered);
      attempts += 1;
      if (template.build(target, createRng(`${template.id}:${i}:${meta.int(0, 1e6)}`)) === null) {
        nulls += 1;
      }
    }

    const rate = ((nulls / attempts) * 100).toFixed(1);
    console.log(
      `${template.id.padEnd(21)}${template.level.padEnd(12)}${covered
        .join('')
        .padEnd(19)}${rate} %`,
    );
  }
}

if (hasFlag('stats')) {
  printStats();
} else {
  printTasks();
}
