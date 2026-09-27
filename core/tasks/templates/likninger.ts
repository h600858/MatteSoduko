/**
 * Enkel-nivået: likninger og regnerekkefølge, ungdomsskole.
 *
 * Alle malene er invertible på samme måte som resten: parametrene velges ut
 * fra det bestilte svaret, ikke omvendt.
 */
import type { GeneratedTask, TaskTemplate } from '../types.ts';
import { approxEqual, evaluateAt, safeVerify } from '../verify.ts';
import { attempt, nonZeroRange, plusLatex, polyExpr, polyLatex, productLatex } from './shared.ts';

/**
 * ax + b = c, finn x.
 * Invers: c = a*t + b.
 */
const enkel: TaskTemplate = {
  id: 'lik.enkel',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(2, 9));
      const b = rng.int(-15, 15);
      if (b === 0) return null;
      const c = a * target + b;
      if (Math.abs(c) > 90) return null;

      return {
        templateId: 'lik.enkel',
        latex: `${polyLatex([{ coef: a, body: 'x' }, { coef: b, body: '' }])} = ${c}`,
        prompt: 'Hvilket tall er x?',
        answer: target,
        steps: [
          `Flytt ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`} over: ${a}x = ${c} ${b < 0 ? '+' : '-'} ${Math.abs(b)}`,
          `${a}x = ${a * target}`,
          `Del på ${a}: x = ${target}`,
        ],
        verify: () =>
          safeVerify(() =>
            approxEqual(
              evaluateAt(polyExpr([{ coef: a, body: 'x' }, { coef: b, body: '' }]), { x: target }),
              c,
            ),
          ),
      };
    });
  },
};

/**
 * ax + b = cx + d, finn x. Ukjent på begge sider.
 * Invers: d = (a - c)*t + b.
 */
const beggeSider: TaskTemplate = {
  id: 'lik.beggesider',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(2, 9));
      const c = rng.pick(nonZeroRange(-5, 8));
      if (a === c) return null;
      const b = rng.int(-12, 12);
      const d = (a - c) * target + b;
      if (Math.abs(d) > 80) return null;

      const venstre = polyLatex([{ coef: a, body: 'x' }, { coef: b, body: '' }]);
      const høyre = polyLatex([{ coef: c, body: 'x' }, { coef: d, body: '' }]);

      return {
        templateId: 'lik.beggesider',
        latex: `${venstre} = ${høyre}`,
        prompt: 'Hvilket tall er x?',
        answer: target,
        steps: [
          `Samle x-leddene på venstre side: ${a - c}x${plusLatex(b)} = ${d}`,
          `${a - c}x = ${d - b}`,
          `Del på ${a - c}: x = ${target}`,
        ],
        verify: () =>
          safeVerify(() => {
            const v = evaluateAt(polyExpr([{ coef: a, body: 'x' }, { coef: b, body: '' }]), {
              x: target,
            });
            const h = evaluateAt(polyExpr([{ coef: c, body: 'x' }, { coef: d, body: '' }]), {
              x: target,
            });
            return a !== c && approxEqual(v, h);
          }),
      };
    });
  },
};

/**
 * a(x + b) = c, finn x.
 * Invers: c = a*(t + b).
 */
const parentes: TaskTemplate = {
  id: 'lik.parentes',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.pick(nonZeroRange(2, 8));
      const b = rng.int(-10, 10);
      if (b === 0) return null;
      const c = a * (target + b);
      if (Math.abs(c) > 95) return null;

      const innmat = polyLatex([{ coef: 1, body: 'x' }, { coef: b, body: '' }]);

      return {
        templateId: 'lik.parentes',
        latex: `${a}(${innmat}) = ${c}`,
        prompt: 'Hvilket tall er x?',
        answer: target,
        steps: [
          `Del begge sider på ${a}: ${innmat} = ${target + b}`,
          `Flytt ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`} over.`,
          `x = ${target}`,
        ],
        verify: () =>
          safeVerify(() => approxEqual(evaluateAt(`(${a})*(x+(${b}))`, { x: target }), c)),
      };
    });
  },
};

/**
 * (x + b)/a = c, finn x.
 * Invers: c = (t + b)/a, krever at a deler t + b.
 */
const brøk: TaskTemplate = {
  id: 'lik.brok',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.int(2, 9);
      const b = rng.int(-12, 12);
      if (b === 0) return null;
      const sum = target + b;
      if (sum % a !== 0) return null;
      const c = sum / a;
      if (Math.abs(c) > 30) return null;

      const teller = polyLatex([{ coef: 1, body: 'x' }, { coef: b, body: '' }]);

      return {
        templateId: 'lik.brok',
        latex: `\\frac{${teller}}{${a}} = ${c}`,
        prompt: 'Hvilket tall er x?',
        answer: target,
        steps: [
          `Gang begge sider med ${a}: ${teller} = ${sum}`,
          `Flytt ${b < 0 ? `- ${Math.abs(b)}` : `+ ${b}`} over.`,
          `x = ${target}`,
        ],
        verify: () =>
          safeVerify(() => approxEqual(evaluateAt(`(x+(${b}))/(${a})`, { x: target }), c)),
      };
    });
  },
};

/**
 * Regn ut a + b·c - d. Tester at gangingen tas før pluss og minus.
 * Invers: d = a + b*c - t.
 */
const rekkefølge: TaskTemplate = {
  id: 'regn.rekkefolge',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.int(2, 20);
      const b = rng.int(2, 9);
      const c = rng.int(2, 9);
      const d = a + b * c - target;
      if (d < 1 || d > 60) return null;

      const uttrykk = `${a} + ${b} \\cdot ${c} - ${d}`;

      return {
        templateId: 'regn.rekkefolge',
        latex: uttrykk,
        prompt: 'Regn ut verdien av uttrykket.',
        answer: target,
        steps: [
          `Ganging før pluss og minus: ${b} \\cdot ${c} = ${b * c}`,
          `${a} + ${b * c} - ${d}`,
          `= ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(evaluateAt(`${a}+${b}*${c}-${d}`, {}), target)),
      };
    });
  },
};

/**
 * Regn ut et uttrykk med negative tall og parentes: a - (b - c).
 * Invers: c = t - a + b.
 */
const negative: TaskTemplate = {
  id: 'regn.negative',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.int(-15, 15);
      const b = rng.int(-15, 15);
      const c = target - a + b;
      if (c === 0 || Math.abs(c) > 30) return null;
      if (a === 0 || b === 0) return null;

      // polyLatex er bygget for polynomer og ville slått sammen de to
      // konstantleddene. Her skal begge stå, så parentesen skrives for hånd.
      const parentesTekst = `${b} ${c < 0 ? '+' : '-'} ${Math.abs(c)}`;

      return {
        templateId: 'regn.negative',
        latex: `${a} - (${parentesTekst})`,
        prompt: 'Regn ut verdien av uttrykket.',
        answer: target,
        steps: [
          `Regn ut parentesen først: ${parentesTekst} = ${b - c}`,
          `${a} - (${b - c})`,
          `= ${target}`,
        ],
        verify: () =>
          safeVerify(() => approxEqual(evaluateAt(`(${a})-((${b})-(${c}))`, {}), target)),
      };
    });
  },
};

/**
 * Regn ut a · b - c · d. To gangestykker som må tas før minus.
 * Invers: velg a, b, c og løs for d, med krav om at c deler differansen.
 */
const toProdukter: TaskTemplate = {
  id: 'regn.produkter',
  topic: 'likninger',
  level: 'enkel',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const a = rng.int(3, 12);
      const b = rng.int(2, 9);
      const c = rng.int(2, 9);
      const rest = a * b - target;
      if (rest <= 0 || rest % c !== 0) return null;
      const d = rest / c;
      if (d < 2 || d > 12) return null;

      return {
        templateId: 'regn.produkter',
        latex: `${a} \\cdot ${b} - ${c} \\cdot ${d}`,
        prompt: 'Regn ut verdien av uttrykket.',
        answer: target,
        steps: [
          `Begge gangestykkene først: ${productLatex(a, b)} = ${a * b} og ${productLatex(c, d)} = ${c * d}`,
          `${a * b} - ${c * d}`,
          `= ${target}`,
        ],
        verify: () => safeVerify(() => approxEqual(evaluateAt(`${a}*${b}-${c}*${d}`, {}), target)),
      };
    });
  },
};

export const likningerTemplates: readonly TaskTemplate[] = [
  enkel,
  beggeSider,
  parentes,
  brøk,
  rekkefølge,
  negative,
  toProdukter,
];
