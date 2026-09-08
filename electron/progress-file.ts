/**
 * Lesing og skriving av progress.json i hovedprosessen.
 *
 * Filen ligger i app.getPath('userData'). Skrivingen går via en midlertidig fil
 * som deretter flyttes på plass, slik at et strømbrudd midt i skrivingen ikke
 * kan etterlate en halvskrevet fil.
 *
 * Validering skjer ikke her, men i core/game/progress.ts. Denne filen leverer
 * rå tekst og lar skjemaet avgjøre om innholdet kan brukes.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export const PROGRESS_FILENAME = 'progress.json';

export function progressPath(): string {
  return path.join(app.getPath('userData'), PROGRESS_FILENAME);
}

/** Innholdet i filen, eller null hvis den ikke finnes ennå. */
export async function readProgressFile(): Promise<string | null> {
  try {
    return await fs.readFile(progressPath(), 'utf8');
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    // En fil vi ikke får lest skal ikke stoppe appen. UI-et starter med tom
    // fremdrift, akkurat som ved et ugyldig innhold.
    console.error('Klarte ikke å lese progress.json:', error);
    return null;
  }
}

export async function writeProgressFile(contents: string): Promise<void> {
  const target = progressPath();
  const temporary = `${target}.${randomUUID()}.tmp`;

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temporary, contents, 'utf8');

  try {
    await fs.rename(temporary, target);
  } catch (error: unknown) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
}
