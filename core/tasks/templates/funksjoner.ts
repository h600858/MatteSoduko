import type { GeneratedTask, TaskTemplate } from '../types.ts';
import {
  approxEqual,
  evaluateAt,
  realQuadraticRoots,
  safeVerify,
} from '../verify.ts';
import {
  argLatex,
  attempt,
  nonZeroRange,
  polyExpr,
  polyLatex,
  productLatex,
} from './shared.ts';

/**
 * f(x) = ax + b, finn f(x0).
 * Invers: b = t - a*x0.
 */
const verdi: TaskTemplate = {
  id: 'func.verdi',
  topic: 'funksjoner',
  difficulty: 1,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-5, 5));
      const x0 = rng.pick(nonZeroRange(-5, 5));
      const b = target - a * x0;
      if (Math.abs(b) > 25) return null;

      const terms = [
        { coef: a, body: 'x' },
        { coef: b, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'func.verdi',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: `Finn f(${argLatex(x0)}).`,
        answer: target,
        steps: [
          `Sett inn x = ${x0} i uttrykket.`,
          `f(${argLatex(x0)}) = ${productLatex(a, x0)}${b < 0 ? ` - ${Math.abs(b)}` : ` + ${b}`}`,
          `f(${argLatex(x0)}) = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(evaluateAt(expr, { x: x0 }), target)),
      };
    });
  },
};

/**
 * f(x) = k(x - t)(x - r) skrevet ut som andregradsuttrykk, finn det største
 * nullpunktet. Invers: velg r < t, så er t det største nullpunktet.
 *
 * Uttrykket skrives ut i utvidet form. Faktorisert form ville vist fasiten
 * direkte i oppgaveteksten.
 */
const nullpunkt: TaskTemplate = {
  id: 'func.nullpunkt',
  topic: 'funksjoner',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const r = rng.int(target - 7, target - 1);
      if (r >= target) return null;
      const k = rng.pick([1, 1, 2]);

      const a = k;
      const b = -k * (target + r);
      const c = k * target * r;
      if (Math.abs(b) > 40 || Math.abs(c) > 90) return null;

      const terms = [
        { coef: a, body: 'x^2' },
        { coef: b, body: 'x' },
        { coef: c, body: '' },
      ];

      return {
        templateId: 'func.nullpunkt',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: 'Hva er det største nullpunktet til f?',
        answer: target,
        steps: [
          `Løs likningen ${polyLatex(terms)} = 0.`,
          `Uttrykket kan faktoriseres: ${k === 1 ? '' : `${k}`}(x - ${target})(x ${r < 0 ? `+ ${Math.abs(r)}` : `- ${r}`}) = 0`,
          `Nullpunktene er x = ${r} og x = ${target}. Det største er ${target}.`,
        ],
        verify: () =>
          safeVerify(() => {
            const roots = realQuadraticRoots(a, b, c);
            if (roots.length === 0) return false;
            return approxEqual(Math.max(...roots), target, 1e-7);
          }),
      };
    });
  },
};

/** Grunntall og hvor stor eksponent de tåler før tallet blir uleselig stort. */
const LOG_BASES: readonly { base: number; maxExponent: number }[] = [
  { base: 2, maxExponent: 9 },
  { base: 3, maxExponent: 9 },
  { base: 5, maxExponent: 7 },
  { base: 10, maxExponent: 5 },
];

/**
 * Finn log_b(b^t). Invers: direkte, tallet under logaritmen skrives ut ferdig
 * utregnet slik at eksponenten ikke er synlig.
 */
const log: TaskTemplate = {
  id: 'func.log',
  topic: 'funksjoner',
  difficulty: 1,
  build(target, rng): GeneratedTask | null {
    const usable = LOG_BASES.filter((entry) => target <= entry.maxExponent);
    if (usable.length === 0) return null;

    return attempt(() => {
      const { base } = rng.pick(usable);
      const value = Math.pow(base, target);
      if (!Number.isSafeInteger(value)) return null;

      return {
        templateId: 'func.log',
        latex: `\\log_{${base}}(${value})`,
        prompt: 'Regn ut verdien av uttrykket.',
        answer: target,
        steps: [
          `Spør: hvilken eksponent må ${base} opphøyes i for å gi ${value}?`,
          `${base}^{${target}} = ${value}`,
          `\\log_{${base}}(${value}) = ${target}`,
        ],
        verify: () =>
          safeVerify(() => approxEqual(evaluateAt(`log(${value}, ${base})`, {}), target, 1e-6)),
      };
    });
  },
};

/**
 * Hvor krysser y = a1*x + b1 og y = a2*x + b2? Oppgi x.
 * Invers: b2 = b1 + t*(a1 - a2).
 */
const skjaering: TaskTemplate = {
  id: 'func.skjaering',
  topic: 'funksjoner',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a1 = rng.pick(nonZeroRange(-4, 4));
      const a2 = rng.int(-4, 4);
      if (a1 === a2) return null;
      const b1 = rng.int(-8, 8);
      const b2 = b1 + target * (a1 - a2);
      if (Math.abs(b2) > 40) return null;

      const terms1 = [
        { coef: a1, body: 'x' },
        { coef: b1, body: '' },
      ];
      const terms2 = [
        { coef: a2, body: 'x' },
        { coef: b2, body: '' },
      ];
      const expr1 = polyExpr(terms1);
      const expr2 = polyExpr(terms2);

      return {
        templateId: 'func.skjaering',
        latex: `y_1 = ${polyLatex(terms1)} \\qquad y_2 = ${polyLatex(terms2)}`,
        prompt: 'Hvilken x-verdi har skjæringspunktet mellom linjene?',
        answer: target,
        steps: [
          `Sett uttrykkene like: ${polyLatex(terms1)} = ${polyLatex(terms2)}`,
          `Samle x-leddene: ${a1 - a2}x = ${b2 - b1}`,
          `x = ${target}`,
        ],
        verify: () =>
          safeVerify(
            () =>
              a1 !== a2 &&
              approxEqual(evaluateAt(expr1, { x: target }), evaluateAt(expr2, { x: target })),
          ),
      };
    });
  },
};

/**
 * f(g(x0)) med f(x) = ax + b og g(x) = cx + d.
 * Invers: b = t - a*(c*x0 + d).
 */
const sammensatt: TaskTemplate = {
  id: 'func.sammensatt',
  topic: 'funksjoner',
  difficulty: 3,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-4, 4));
      const c = rng.pick(nonZeroRange(-4, 4));
      const d = rng.int(-6, 6);
      const x0 = rng.int(-4, 4);
      const inner = c * x0 + d;
      const b = target - a * inner;
      if (Math.abs(b) > 30 || Math.abs(inner) > 20) return null;

      const fTerms = [
        { coef: a, body: 'x' },
        { coef: b, body: '' },
      ];
      const gTerms = [
        { coef: c, body: 'x' },
        { coef: d, body: '' },
      ];
      const fExpr = polyExpr(fTerms);
      const gExpr = polyExpr(gTerms);

      return {
        templateId: 'func.sammensatt',
        latex: `f(x) = ${polyLatex(fTerms)} \\qquad g(x) = ${polyLatex(gTerms)}`,
        prompt: `Finn f(g(${argLatex(x0)})).`,
        answer: target,
        steps: [
          `Regn ut den indre funksjonen først: g(${argLatex(x0)}) = ${productLatex(c, x0)}${d < 0 ? ` - ${Math.abs(d)}` : ` + ${d}`} = ${inner}`,
          `Sett svaret inn i f: f(${argLatex(inner)}) = ${productLatex(a, inner)}${b < 0 ? ` - ${Math.abs(b)}` : ` + ${b}`}`,
          `f(g(${argLatex(x0)})) = ${target}`,
        ],
        verify: () =>
          safeVerify(() => {
            const innerValue = evaluateAt(gExpr, { x: x0 });
            return approxEqual(evaluateAt(fExpr, { x: innerValue }), target);
          }),
      };
    });
  },
};

/**
 * f(x) = ax + b, finn f^-1(y0).
 * Invers: sett y0 = a*t + b, så er t den inverse verdien.
 */
const invers: TaskTemplate = {
  id: 'func.invers',
  topic: 'funksjoner',
  difficulty: 3,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(-5, 5));
      const b = rng.int(-9, 9);
      const y0 = a * target + b;
      if (Math.abs(y0) > 50) return null;

      const terms = [
        { coef: a, body: 'x' },
        { coef: b, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'func.invers',
        latex: `f(x) = ${polyLatex(terms)}`,
        prompt: `Finn f⁻¹(${argLatex(y0)}).`,
        answer: target,
        steps: [
          `f⁻¹(${argLatex(y0)}) er den x-verdien som gir f(x) = ${y0}.`,
          `Løs ${polyLatex(terms)} = ${y0}, altså ${a}x = ${y0 - b}.`,
          `x = ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(evaluateAt(expr, { x: target }), y0)),
      };
    });
  },
};

const VEKST_START: readonly number[] = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 100];

/**
 * N(x) = N0 * 2^x. Hvor mange doblinger til N = N0 * 2^t?
 * Invers: direkte, måltallet skrives ut ferdig utregnet.
 */
const vekst: TaskTemplate = {
  id: 'func.vekst',
  topic: 'funksjoner',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const start = rng.pick(VEKST_START);
      const total = start * Math.pow(2, target);
      if (!Number.isSafeInteger(total) || total > 200_000) return null;

      return {
        templateId: 'func.vekst',
        latex: `N(x) = ${start} \\cdot 2^{x}`,
        prompt: `Hvor mange doblinger skal til før N(x) = ${total}?`,
        answer: target,
        steps: [
          `Del måltallet på startverdien: ${total} / ${start} = ${Math.pow(2, target)}`,
          `Spør hvilken potens av 2 dette er: 2^{${target}} = ${Math.pow(2, target)}`,
          `x = ${target}`,
        ],
        verify: () =>
          safeVerify(() => approxEqual(evaluateAt(`${start}*2^x`, { x: target }), total)),
      };
    });
  },
};

/**
 * f(x) = c/(ax - b) med b = a*t. Hvilken x-verdi er ikke i definisjonsmengden?
 * Invers: nevneren er null når x = b/a = t.
 *
 * a >= 2 slik at fasiten ikke kan leses rett ut av uttrykket.
 */
const definisjon: TaskTemplate = {
  id: 'func.definisjon',
  topic: 'funksjoner',
  difficulty: 2,
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.int(2, 5);
      const c = rng.pick(nonZeroRange(-9, 9));
      const b = a * target;
      if (Math.abs(b) > 45) return null;

      const denomTerms = [
        { coef: a, body: 'x' },
        { coef: -b, body: '' },
      ];
      const denomExpr = polyExpr(denomTerms);

      return {
        templateId: 'func.definisjon',
        latex: `f(x) = \\frac{${c}}{${polyLatex(denomTerms)}}`,
        prompt: 'Hvilken x-verdi er ikke med i definisjonsmengden til f?',
        answer: target,
        steps: [
          'En brøkfunksjon er udefinert der nevneren er null.',
          `Løs ${polyLatex(denomTerms)} = 0, altså ${a}x = ${b}.`,
          `x = ${target}`,
        ],
        verify: () =>
          safeVerify(
            () =>
              c !== 0 &&
              a !== 0 &&
              approxEqual(evaluateAt(denomExpr, { x: target }), 0),
          ),
      };
    });
  },
};

export const funksjonerTemplates: readonly TaskTemplate[] = [
  verdi,
  nullpunkt,
  log,
  skjaering,
  sammensatt,
  invers,
  vekst,
  definisjon,
];

