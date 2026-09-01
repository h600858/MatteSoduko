import type { GeneratedTask, TaskTemplate } from '../types.ts';
import {
  approxEqual,
  derivativeAt,
  safeVerify,
  secondDerivativeAt,
} from '../verify.ts';
import {
  argLatex,
  attempt,
  expLatex,
  linearFactorExpr,
  linearFactorLatex,
  nonZeroRange,
  plusLatex,
  polyExpr,
  polyLatex,
  productLatex,
  range,
  signedDivisorsOf,
} from './shared.ts';

/**
 * f(x) = ax^2 + bx + c, finn f'(x0).
 * Invers: f'(x0) = 2a*x0 + b  =>  b = t - 2a*x0.
 */
const polynom2: TaskTemplate = {
  id: 'deriv.polynom2',
  topic: 'derivasjon',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-3, 3));
      const x0 = rng.pick(nonZeroRange(-3, 3));
      const b = target - 2 * a * x0;
      if (Math.abs(b) > 24) return null;
      const c = rng.int(-6, 6);

      const terms = [
        { coef: a, body: 'x^2' },
        { coef: b, body: 'x' },
        { coef: c, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'deriv.polynom2',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: `Finn f'(${argLatex(x0)}).`,
        answer: target,
        steps: [
          `Deriver ledd for ledd: f'(x) = ${polyLatex([{ coef: 2 * a, body: 'x' }, { coef: b, body: '' }])}`,
          `Sett inn x = ${x0}: f'(${argLatex(x0)}) = ${productLatex(2 * a, x0)}${plusLatex(b)}`,
          `f'(${argLatex(x0)}) = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, x0), target)),
      };
    });
  },
};

/**
 * f(x) = ax^3 + bx + c, finn f'(x0).
 * Invers: f'(x0) = 3a*x0^2 + b  =>  b = t - 3a*x0^2.
 */
const polynom3: TaskTemplate = {
  id: 'deriv.polynom3',
  topic: 'derivasjon',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-2, 2));
      const x0 = rng.pick(nonZeroRange(-2, 2));
      const b = target - 3 * a * x0 * x0;
      if (Math.abs(b) > 30) return null;
      const c = rng.int(-6, 6);

      const terms = [
        { coef: a, body: 'x^3' },
        { coef: b, body: 'x' },
        { coef: c, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'deriv.polynom3',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: `Finn f'(${argLatex(x0)}).`,
        answer: target,
        steps: [
          `Deriver ledd for ledd: f'(x) = ${polyLatex([{ coef: 3 * a, body: 'x^2' }, { coef: b, body: '' }])}`,
          `Sett inn x = ${x0}: f'(${argLatex(x0)}) = ${3 * a} \\cdot (${x0})^2${plusLatex(b)}`,
          `f'(${argLatex(x0)}) = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, x0), target)),
      };
    });
  },
};

/**
 * f(x) = (ax + b)(cx + d), finn f'(x0).
 * Invers: f'(x0) = 2ac*x0 + ad + bc  =>  d = (t - 2ac*x0 - bc)/a.
 * Krever at a deler telleren, derfor de interne forsøkene.
 */
const produkt: TaskTemplate = {
  id: 'deriv.produkt',
  topic: 'derivasjon',
  difficulty: 3,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-3, 3));
      const c = rng.pick(nonZeroRange(-3, 3));
      const b = rng.int(-5, 5);
      const x0 = rng.int(-2, 2);

      const numerator = target - 2 * a * c * x0 - b * c;
      if (numerator % a !== 0) return null;
      const d = numerator / a;
      if (Math.abs(d) > 12) return null;
      // (ax+b)(ax+b) hører hjemme i deriv.kjerne, ikke her.
      if (a === c && b === d) return null;

      const expr = `${linearFactorExpr(a, b)}*${linearFactorExpr(c, d)}`;

      return {
        templateId: 'deriv.produkt',
        latex: `f(x) = ${linearFactorLatex(a, b)}${linearFactorLatex(c, d)}`,
        prompt: `Finn f'(${argLatex(x0)}).`,
        answer: target,
        steps: [
          `Sett u = ${polyLatex([{ coef: a, body: 'x' }, { coef: b, body: '' }])} og v = ${polyLatex([{ coef: c, body: 'x' }, { coef: d, body: '' }])}, slik at u' = ${a} og v' = ${c}.`,
          `Produktregelen: f'(x) = u'v + uv' = ${a}${linearFactorLatex(c, d)} + ${c}${linearFactorLatex(a, b)}`,
          `Trekk sammen: f'(x) = ${polyLatex([{ coef: 2 * a * c, body: 'x' }, { coef: a * d + b * c, body: '' }])}`,
          `Sett inn x = ${x0}: f'(${argLatex(x0)}) = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, x0), target)),
      };
    });
  },
};

/**
 * f(x) = (ax + b)^2, finn f'(x0).
 * Invers: f'(x0) = 2a(a*x0 + b)  =>  b = t/(2a) - a*x0, der 2a må dele t.
 * Odde t er umulig, siden 2a alltid er et partall.
 */
const kjerne: TaskTemplate = {
  id: 'deriv.kjerne',
  topic: 'derivasjon',
  difficulty: 3,
  coversTarget(target) {
    return target % 2 === 0;
  },
  build(target, rng): GeneratedTask | null {
    if (target % 2 !== 0) return null;
    const aCandidates = signedDivisorsOf(target / 2, 4);
    if (aCandidates.length === 0) return null;

    return attempt(() => {
      const a = rng.pick(aCandidates);
      const x0 = rng.int(-2, 2);
      const b = target / (2 * a) - a * x0;
      if (!Number.isInteger(b) || Math.abs(b) > 15) return null;

      const expr = `${linearFactorExpr(a, b)}^2`;

      return {
        templateId: 'deriv.kjerne',
        latex: `f(x) = ${linearFactorLatex(a, b)}^2`,
        prompt: `Finn f'(${argLatex(x0)}).`,
        answer: target,
        steps: [
          `Kjerneregelen med kjerne u = ${polyLatex([{ coef: a, body: 'x' }, { coef: b, body: '' }])} og u' = ${a}.`,
          `f'(x) = 2u \\cdot u' = ${2 * a}${linearFactorLatex(a, b)}`,
          `Sett inn x = ${x0}: f'(${argLatex(x0)}) = ${2 * a} \\cdot (${a * x0 + b}) = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, x0), target)),
      };
    });
  },
};

/**
 * f(x) = (ax + b)/x, finn f'(x0).
 * Invers: f'(x0) = -b/x0^2  =>  b = -t*x0^2.
 */
const kvotient: TaskTemplate = {
  id: 'deriv.kvotient',
  topic: 'derivasjon',
  difficulty: 3,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const x0 = rng.pick([-2, -1, 1, 2]);
      const a = rng.pick(nonZeroRange(-4, 4));
      const b = -target * x0 * x0;
      if (b === 0) return null;

      const expr = `(${linearFactorExpr(a, b)})/x`;

      return {
        templateId: 'deriv.kvotient',
        latex: `f(x) = \\frac{${polyLatex([{ coef: a, body: 'x' }, { coef: b, body: '' }])}}{x}`,
        prompt: `Finn f'(${argLatex(x0)}).`,
        answer: target,
        steps: [
          `Skriv om brøken: f(x) = ${a}${plusLatex(b)}x^{-1}`,
          `Deriver: f'(x) = ${-b}x^{-2} = \\frac{${-b}}{x^2}`,
          `Sett inn x = ${x0}: f'(${argLatex(x0)}) = \\frac{${-b}}{${x0 * x0}} = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, x0), target)),
      };
    });
  },
};

/**
 * f(x) = a*e^(bx) + c, finn f'(0).
 * Invers: f'(0) = ab  =>  b = t/a, der a velges blant divisorene til t.
 * Konstantleddet c påvirker ikke den deriverte, men gir malen nok variasjon
 * til at samme fasit kan opptre flere ganger på ett brett uten identisk tekst.
 */
const eksp: TaskTemplate = {
  id: 'deriv.eksp',
  topic: 'derivasjon',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    const aCandidates = signedDivisorsOf(target, 9);
    if (aCandidates.length === 0) return null;

    return attempt(() => {
      const a = rng.pick(aCandidates);
      const b = target / a;
      if (!Number.isInteger(b) || Math.abs(b) > 9) return null;
      const c = rng.int(-5, 5);

      const expr = `(${a})*exp((${b})*x)+(${c})`;

      return {
        templateId: 'deriv.eksp',
        latex: `f(x) = ${expLatex(a, b)}${plusLatex(c)}`,
        prompt: `Finn f'(0).`,
        answer: target,
        steps: [
          `Kjerneregelen på e-funksjonen: f'(x) = ${expLatex(a * b, b)}`,
          `Sett inn x = 0: f'(0) = ${productLatex(a, b)} \\cdot e^{0}`,
          `f'(0) = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, 0), target)),
      };
    });
  },
};

/**
 * f(x) = ax^2 + bx + c med a > 0, finn x-verdien til bunnpunktet.
 * Invers: x = -b/(2a)  =>  b = -2at.
 */
const ekstremal: TaskTemplate = {
  id: 'deriv.ekstremal',
  topic: 'derivasjon',
  difficulty: 3,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick([1, 2]);
      const b = -2 * a * target;
      const c = rng.int(-6, 6);

      const terms = [
        { coef: a, body: 'x^2' },
        { coef: b, body: 'x' },
        { coef: c, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'deriv.ekstremal',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: 'Hvilken x-verdi gir bunnpunktet til f?',
        answer: target,
        steps: [
          `Bunnpunktet ligger der f'(x) = 0.`,
          `f'(x) = ${polyLatex([{ coef: 2 * a, body: 'x' }, { coef: b, body: '' }])}`,
          `${2 * a}x = ${-b} gir x = ${target}. Siden a = ${a} > 0 er dette et bunnpunkt.`,
        ],
        verify: () =>
          safeVerify(
            () =>
              approxEqual(derivativeAt(expr, target), 0) &&
              secondDerivativeAt(expr, target) > 0,
          ),
      };
    });
  },
};

/**
 * Stigningstallet til tangenten til f i x0. Samme invers som deriv.polynom2,
 * men en annen innpakning av spørsmålet.
 */
const tangent: TaskTemplate = {
  id: 'deriv.tangent',
  topic: 'derivasjon',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-4, 4));
      const x0 = rng.pick(nonZeroRange(-4, 4));
      const b = target - 2 * a * x0;
      if (Math.abs(b) > 28) return null;
      const c = rng.pick(range(-5, 5));

      const terms = [
        { coef: a, body: 'x^2' },
        { coef: b, body: 'x' },
        { coef: c, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'deriv.tangent',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: `Hva er stigningstallet til tangenten til f i x = ${argLatex(x0)}?`,
        answer: target,
        steps: [
          `Stigningstallet til tangenten i x = ${argLatex(x0)} er f'(${argLatex(x0)}).`,
          `f'(x) = ${polyLatex([{ coef: 2 * a, body: 'x' }, { coef: b, body: '' }])}`,
          `f'(${argLatex(x0)}) = ${productLatex(2 * a, x0)}${plusLatex(b)} = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(derivativeAt(expr, x0), target)),
      };
    });
  },
};

export const derivasjonTemplates: readonly TaskTemplate[] = [
  polynom2,
  polynom3,
  produkt,
  kjerne,
  kvotient,
  eksp,
  ekstremal,
  tangent,
];
