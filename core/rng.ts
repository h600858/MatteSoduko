/**
 * Seedbar tilfeldighetsgenerator.
 *
 * All tilfeldighet i spillet skal gå gjennom denne, aldri gjennom Math.random(),
 * slik at et brett kan reproduseres eksakt fra en seed.
 */
export interface Rng {
  /** Seeden generatoren ble laget fra. */
  readonly seed: string;
  /** Flyttall i [0, 1). */
  next(): number;
  /** Heltall i [min, max], begge grenser inklusive. */
  int(min: number, max: number): number;
  /** Tilfeldig element fra en ikke-tom liste. */
  pick<T>(items: readonly T[]): T;
  /** Ny liste i tilfeldig rekkefølge. Muterer ikke input. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * Vektet rekkefølge av en liste. Høyere vekt gir større sjanse for tidlig
   * plassering. Vekter <= 0 behandles som svært lave, men elementet forsvinner
   * ikke helt. Muterer ikke input.
   */
  weightedShuffle<T>(items: readonly T[], weightOf: (item: T) => number): T[];
  /** Uavhengig generator utledet av denne seeden og en etikett. */
  fork(label: string): Rng;
}

/** cyrb128: strengseed -> fire 32-bits tall. */
function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i += 1) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** sfc32: liten, rask og godt nok fordelt generator. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;
  return () => {
    s0 >>>= 0;
    s1 >>>= 0;
    s2 >>>= 0;
    s3 >>>= 0;
    let t = (s0 + s1) | 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) | 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s3 = (s3 + 1) | 0;
    t = (t + s3) | 0;
    s2 = (s2 + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Lager en generator. Samme seed gir alltid samme sekvens. */
export function createRng(seed: string | number): Rng {
  const seedString = String(seed);
  const [a, b, c, d] = hashSeed(seedString);
  const next = sfc32(a, b, c, d);
  // Kast bort de første verdiene slik at nære seeder ikke starter likt.
  for (let i = 0; i < 12; i += 1) next();

  const rng: Rng = {
    seed: seedString,
    next,
    int(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new Error(`int() krever heltallsgrenser, fikk ${min}..${max}`);
      }
      if (max < min) {
        throw new Error(`int() krever min <= max, fikk ${min}..${max}`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error('pick() på tom liste');
      }
      return items[rng.int(0, items.length - 1)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = items.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = rng.int(0, i);
        const vi = copy[i] as T;
        const vj = copy[j] as T;
        copy[i] = vj;
        copy[j] = vi;
      }
      return copy;
    },
    weightedShuffle<T>(items: readonly T[], weightOf: (item: T) => number): T[] {
      // Efraimidis-Spirakis: nøkkel = u^(1/w), sorter synkende.
      // Skrevet som -ln(u)/w og sortert stigende for bedre numerikk.
      const keyed = items.map((item) => {
        const weight = Math.max(weightOf(item), 1e-6);
        const u = Math.max(next(), Number.MIN_VALUE);
        return { item, key: -Math.log(u) / weight };
      });
      keyed.sort((x, y) => x.key - y.key);
      return keyed.map((entry) => entry.item);
    },
    fork(label: string): Rng {
      return createRng(`${seedString}#${label}`);
    },
  };

  return rng;
}
