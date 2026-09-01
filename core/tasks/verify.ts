/**
 * Uavhengig verifisering av fasit.
 *
 * Poenget med denne modulen er at malene IKKE skal få lov til å bekrefte seg
 * selv ved å regne om med den samme inversformelen de brukte til å velge
 * parametrene. Her er det mathjs som gjør matematikken: symbolsk derivasjon,
 * evaluering av uttrykk og rotberegning. Malen leverer bare uttrykket den
 * faktisk skriver ut til spilleren.
 */
import { derivative, evaluate, polynomialRoot } from 'mathjs';

/** Toleranse for flyttallssammenligning. Alle fasitsvar er heltall 1..9. */
export const EPS = 1e-9;

export function approxEqual(a: number, b: number, eps: number = EPS): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
}

/** Snevrer inn et ukjent mathjs-resultat til et endelig tall. */
function asNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context}: forventet et endelig tall, fikk ${String(value)}`);
  }
  return value;
}

/** Evaluerer et uttrykk med mathjs. */
export function evaluateAt(expression: string, scope: Record<string, number>): number {
  return asNumber(evaluate(expression, { ...scope }), `evaluateAt(${expression})`);
}

/** f'(at), der mathjs deriverer symbolsk. */
export function derivativeAt(expression: string, at: number, variable = 'x'): number {
  const d = derivative(expression, variable);
  const scope: Record<string, number> = { [variable]: at };
  return asNumber(d.evaluate(scope), `derivativeAt(${expression})`);
}

/** f''(at), der mathjs deriverer symbolsk to ganger. */
export function secondDerivativeAt(expression: string, at: number, variable = 'x'): number {
  const d2 = derivative(derivative(expression, variable), variable);
  const scope: Record<string, number> = { [variable]: at };
  return asNumber(d2.evaluate(scope), `secondDerivativeAt(${expression})`);
}

/** Reelle røtter av ax^2 + bx + c, funnet av mathjs. */
export function realQuadraticRoots(a: number, b: number, c: number): number[] {
  const roots: unknown = polynomialRoot(c, b, a);
  if (!Array.isArray(roots)) {
    throw new Error('polynomialRoot returnerte ikke en liste');
  }
  return roots.filter((root): root is number => typeof root === 'number' && Number.isFinite(root));
}

/**
 * Kjører en verifisering og gjør enhver feil om til false. En oppgave som ikke
 * lar seg verifisere skal forkastes, ikke krasje brettbyggingen.
 */
export function safeVerify(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}
