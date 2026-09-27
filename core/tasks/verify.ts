/**
 * Uavhengig verifisering av fasit.
 *
 * Poenget med denne modulen er at malene IKKE skal få lov til å bekrefte seg
 * selv ved å regne om med den samme inversformelen de brukte til å velge
 * parametrene. Her er det mathjs som gjør matematikken: symbolsk derivasjon,
 * evaluering av uttrykk og rotberegning. Malen leverer bare uttrykket den
 * faktisk skriver ut til spilleren.
 */
import { derivative, evaluate, parse, polynomialRoot } from 'mathjs';

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
 * Numerisk integrasjon med Simpsons metode.
 *
 * mathjs kan ikke integrere symbolsk, så integralmalene kan ikke verifiseres
 * med en antiderivert. I stedet evalueres integranden i mange punkter og
 * summeres. Det er fortsatt uavhengig av malen: malen regner ut svaret fra en
 * antiderivert den selv kjenner, mens denne bare ser på funksjonsverdiene.
 */
export function integrateNumerically(
  expression: string,
  from: number,
  to: number,
  steps = 2000,
): number {
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = (to - from) / n;
  const node = parse(expression);
  const compiled = node.compile();

  const at = (x: number): number => {
    const value: unknown = compiled.evaluate({ x });
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`integrateNumerically(${expression}): ikke et endelig tall i x = ${x}`);
    }
    return value;
  };

  let sum = at(from) + at(to);
  for (let i = 1; i < n; i += 1) {
    sum += at(from + i * h) * (i % 2 === 0 ? 2 : 4);
  }
  return (h / 3) * sum;
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
