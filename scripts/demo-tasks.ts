/**
 * Liten CLI for å lese gjennom kvaliteten på genererte oppgaver.
 *
 *   npm run demo:tasks
 *   npm run demo:tasks -- --seed=hvl --antall=20 --nivaa=2 --temaer=derivasjon
 *   npm run demo:tasks -- --stats
 */
import { createRng } from '../core/rng.ts';
import { allTemplates, taskRegistry } from '../core/tasks/registry.ts';
import type { Difficulty, Topic } from '../core/tasks/types.ts';
import { ALL_TOPICS, taskKey, templateCovers } from '../core/tasks/types.ts';

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
const rawDifficulty = Number(flag('nivaa') ?? 3);
const maxDifficulty: Difficulty =
  rawDifficulty === 1 ? 1 : rawDifficulty === 2 ? 2 : 3;
const topics: readonly Topic[] = (flag('temaer') ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter((part): part is Topic => part === 'derivasjon' || part === 'funksjoner');
const activeTopics = topics.length > 0 ? topics : ALL_TOPICS;

function printTasks(): void {
  console.log(`Seed: ${seed}`);
  console.log(`Temaer: ${activeTopics.join(', ')}   Maks nivå: ${maxDifficulty}`);
  console.log('='.repeat(72));

  const rng = createRng(seed);
  const used = new Set<string>();

  for (let i = 1; i <= count; i += 1) {
    const targetAnswer = rng.int(1, 9);
    const task = taskRegistry.generateTask({
      topics: activeTopics,
      maxDifficulty,
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
  console.log('Mal                 nivå  dekker svar        null-rate');
  console.log('-'.repeat(60));

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
      `${template.id.padEnd(20)}${String(template.difficulty).padEnd(6)}${covered
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
