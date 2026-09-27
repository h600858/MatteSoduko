import type { Rng } from '../../rng.ts';

/**
 * Hvor mange parameterkombinasjoner en mal prøver internt før den gir opp og
 * returnerer null. Flere maler har delelighetskrav som gjør at et tilfeldig
 * trekk ikke alltid går opp.
 */
export const MAX_ATTEMPTS = 50;

/** Prøver `draw` inntil `max` ganger. Første ikke-null vinner. */
export function attempt<T>(
  draw: () => T | null,
  max: number = MAX_ATTEMPTS,
): T | null {
  for (let i = 0; i < max; i += 1) {
    const result = draw();
    if (result !== null) return result;
  }
  return null;
}

/** Heltall fra min til max, begge inklusive. */
export function range(min: number, max: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max; v += 1) out.push(v);
  return out;
}

/** Som range(), men uten null. */
export function nonZeroRange(min: number, max: number): number[] {
  return range(min, max).filter((v) => v !== 0);
}

/** Positive divisorer av |n|. Tom liste for n = 0. */
export function divisorsOf(n: number): number[] {
  const abs = Math.abs(n);
  if (abs === 0) return [];
  const out: number[] = [];
  for (let d = 1; d <= abs; d += 1) {
    if (abs % d === 0) out.push(d);
  }
  return out;
}

/** Divisorer av n, både positive og negative, med |d| <= limit. */
export function signedDivisorsOf(n: number, limit = Number.POSITIVE_INFINITY): number[] {
  const out: number[] = [];
  for (const d of divisorsOf(n)) {
    if (d <= limit) {
      out.push(d, -d);
    }
  }
  return out;
}

export function pickNonZero(rng: Rng, min: number, max: number): number {
  return rng.pick(nonZeroRange(min, max));
}

export interface PolyTerm {
  coef: number;
  /** Tom streng for konstantledd, ellers "x", "x^2", "x^3". Samme syntaks i KaTeX og mathjs. */
  body: string;
}

/** Skriver et polynom som pen LaTeX: "2x^2 - x + 3". */
export function polyLatex(terms: readonly PolyTerm[]): string {
  let out = '';
  for (const term of terms) {
    if (term.coef === 0) continue;
    const abs = Math.abs(term.coef);
    const coefText = abs === 1 && term.body !== '' ? '' : String(abs);
    if (out === '') {
      out = `${term.coef < 0 ? '-' : ''}${coefText}${term.body}`;
    } else {
      out += ` ${term.coef < 0 ? '-' : '+'} ${coefText}${term.body}`;
    }
  }
  return out === '' ? '0' : out;
}

/** Skriver det samme polynomet som et mathjs-uttrykk: "(2)*x^2+(-1)*x+(3)". */
export function polyExpr(terms: readonly PolyTerm[]): string {
  const parts = terms
    .filter((term) => term.coef !== 0)
    .map((term) => (term.body === '' ? `(${term.coef})` : `(${term.coef})*${term.body}`));
  return parts.length === 0 ? '0' : parts.join('+');
}

/** "(2x - 3)" som LaTeX. */
export function linearFactorLatex(a: number, b: number, variable = 'x'): string {
  return `(${polyLatex([{ coef: a, body: variable }, { coef: b, body: '' }])})`;
}

/** "((2)*x+(-3))" som mathjs-uttrykk. */
export function linearFactorExpr(a: number, b: number, variable = 'x'): string {
  return `((${a})*${variable}+(${b}))`;
}

/** Tall i LaTeX der negative tall må stå i parentes, f.eks. f'(-2). */
export function argLatex(n: number): string {
  return n < 0 ? `-${Math.abs(n)}` : String(n);
}

/** "3 \cdot 4" med korrekt håndtering av negative faktorer. */
export function productLatex(a: number, b: number): string {
  const left = a < 0 ? `(${a})` : String(a);
  const right = b < 0 ? `(${b})` : String(b);
  return `${left} \\cdot ${right}`;
}

/** " + 3" / " - 3" / "" for 0. Brukt i løsningssteg. */
export function plusLatex(n: number): string {
  if (n === 0) return '';
  return n < 0 ? ` - ${Math.abs(n)}` : ` + ${n}`;
}

/** "3e^{2x}", "e^{-x}", "-e^{x}". */
export function expLatex(a: number, b: number, variable = 'x'): string {
  const coef = a === 1 ? '' : a === -1 ? '-' : String(a);
  const exponent = b === 1 ? variable : b === -1 ? `-${variable}` : `${b}${variable}`;
  return `${coef}e^{${exponent}}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const rest = x % y;
    x = y;
    y = rest;
  }
  return x === 0 ? 1 : x;
}

/**
 * Forkortet brøk som LaTeX: "3", "-2", "\frac{1}{3}".
 *
 * Trengs fordi antideriverte gir brøkkoeffisienter. Uten denne ville
 * koeffisienten blitt skrevet ut som et rått flyttall.
 */
export function fractionLatex(numerator: number, denominator: number): string {
  if (numerator === 0) return '0';
  const tegn = numerator < 0 !== denominator < 0 ? -1 : 1;
  const felles = gcd(numerator, denominator);
  const teller = Math.abs(numerator) / felles;
  const nevner = Math.abs(denominator) / felles;
  const prefiks = tegn < 0 ? '-' : '';
  return nevner === 1 ? `${prefiks}${teller}` : `${prefiks}\\frac{${teller}}{${nevner}}`;
}

export interface RationalTerm {
  numerator: number;
  denominator: number;
  /** Tom streng for konstantledd. */
  body: string;
}

/** Polynom der koeffisientene kan være brøker: "\frac{1}{3}x^3 - 2x". */
export function rationalPolyLatex(terms: readonly RationalTerm[]): string {
  let ut = '';
  for (const term of terms) {
    if (term.numerator === 0) continue;
    const negativ = term.numerator < 0 !== term.denominator < 0;
    const absolutt = fractionLatex(Math.abs(term.numerator), Math.abs(term.denominator));
    const koeffisient = absolutt === '1' && term.body !== '' ? '' : absolutt;
    const tekst = `${koeffisient}${term.body}`;
    if (ut === '') {
      ut = `${negativ ? '-' : ''}${tekst}`;
    } else {
      ut += ` ${negativ ? '-' : '+'} ${tekst}`;
    }
  }
  return ut === '' ? '0' : ut;
}
