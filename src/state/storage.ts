/**
 * Lagring av fremdrift, sett fra UI-et.
 *
 * I Electron går det gjennom preload-broen til progress.json i userData.
 * Kjører appen i en vanlig nettleser (npm run dev:web) finnes ingen slik bro,
 * og da brukes localStorage i stedet. Da kan UI-et testes uten Electron uten
 * at koden må vite hvor den kjører.
 */
import type { Progress } from '../../core/game/progress.ts';
import { loadProgress } from '../../core/game/progress.ts';

interface Bridge {
  lesFremdrift: () => Promise<string | null>;
  skrivFremdrift: (contents: string) => Promise<void>;
}

declare global {
  interface Window {
    mattesudoku?: Partial<Bridge> & Record<string, unknown>;
  }
}

const WEB_KEY = 'mattesudoku:fremdrift';

function bridge(): Bridge | null {
  const api = window.mattesudoku;
  if (
    api !== undefined &&
    typeof api.lesFremdrift === 'function' &&
    typeof api.skrivFremdrift === 'function'
  ) {
    return { lesFremdrift: api.lesFremdrift, skrivFremdrift: api.skrivFremdrift };
  }
  return null;
}

/** True når vi kjører i Electron og lagrer til fil. */
export function persistsToFile(): boolean {
  return bridge() !== null;
}

export interface LoadedProgress {
  progress: Progress;
  warning: string | null;
}

export async function readProgress(): Promise<LoadedProgress> {
  const api = bridge();

  try {
    const raw =
      api === null ? window.localStorage.getItem(WEB_KEY) : await api.lesFremdrift();
    return loadProgress(raw);
  } catch (error: unknown) {
    // Lesefeil skal ikke stoppe spillet. Vi starter med tom fremdrift.
    return {
      ...loadProgress(null),
      warning: `Klarte ikke å lese fremdriften: ${String(error)}`,
    };
  }
}

export async function writeProgress(progress: Progress): Promise<string | null> {
  const contents = JSON.stringify(progress, null, 2);
  const api = bridge();

  try {
    if (api === null) {
      window.localStorage.setItem(WEB_KEY, contents);
    } else {
      await api.skrivFremdrift(contents);
    }
    return null;
  } catch (error: unknown) {
    return `Klarte ikke å lagre fremdriften: ${String(error)}`;
  }
}
