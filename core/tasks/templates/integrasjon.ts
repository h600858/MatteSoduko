/**
 * Ultra-nivået: integrasjon.
 *
 * Verifiseringen er numerisk. mathjs kan ikke integrere symbolsk, så malene
 * kan ikke kontrolleres mot en antiderivert regnet ut av biblioteket. I stedet
 * summeres integranden i mange punkter med Simpsons metode. Det er fortsatt
 * uavhengig av malen: malen regner svaret ut fra en antiderivert den selv
 * kjenner, mens kontrollen bare ser på funksjonsverdiene.
 *
 * Toleransen er derfor løsere enn for de andre temaene.
 */
import type { GeneratedTask, TaskTemplate } from '../types.ts';
import { approxEqual, integrateNumerically, safeVerify } from '../verify.ts';
import {
  attempt,
  divisorsOf,
  fractionLatex,
  nonZeroRange,
  polyExpr,
  polyLatex,
  rationalPolyLatex,
} from './shared.ts';

/** Numerisk integrasjon treffer ikke på mange desimaler. */
const NUMERISK_EPS = 1e-6;

/**
 * Bestemt integral av et andregradsuttrykk.
 * Invers: velg a, b og grensene, og løs for konstantleddet c.
 */
const polynom: TaskTemplate = {
  id: 'int.polynom',
  topic: 'integrasjon',
  level: 'ultra',
  concept: 'integrasjon.bestemt',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const nedre = rng.int(0, 2);
      const bredde = rng.int(1, 3);
      const øvre = nedre + bredde;
      const a = rng.pick(nonZeroRange(-3, 3));
      const b = rng.pick(nonZeroRange(-4, 4));

      // Integralet av ax^2 + bx er kjent. c bidrar med c*(øvre - nedre).
      const uten =
        (a * (øvre ** 3 - nedre ** 3)) / 3 + (b * (øvre ** 2 - nedre ** 2)) / 2;
      const rest = target - uten;
      if (Math.abs(rest % bredde) > 1e-9) return null;
      const c = Math.round(rest / bredde);
      if (Math.abs(c) > 20) return null;

      const terms = [
        { coef: a, body: 'x^2' },
        { coef: b, body: 'x' },
        { coef: c, body: '' },
      ];
      const expr = polyExpr(terms);

      return {
        templateId: 'int.polynom',
        latex: `\\int_{${nedre}}^{${øvre}} \\left(${polyLatex(terms)}\\right)\\,dx`,
        prompt: 'Regn ut det bestemte integralet.',
        answer: target,
        steps: [
          `Finn den antideriverte: ${rationalPolyLatex([
            { numerator: a, denominator: 3, body: 'x^3' },
            { numerator: b, denominator: 2, body: 'x^2' },
            { numerator: c, denominator: 1, body: 'x' },
          ])}`,
          `Sett inn øvre grense ${øvre} og trekk fra nedre grense ${nedre}.`,
          `Svaret er ${target}.`,
        ],
        verify: () =>
          safeVerify(() =>
            approxEqual(integrateNumerically(expr, nedre, øvre), target, NUMERISK_EPS),
          ),
      };
    });
  },
};

/**
 * Integral av en potensfunksjon fra 0.
 * Invers: integralet er a*b^(n+1)/(n+1), så a velges ut fra target.
 */
const potens: TaskTemplate = {
  id: 'int.potens',
  topic: 'integrasjon',
  level: 'ultra',
  concept: 'integrasjon.bestemt',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      const n = rng.int(1, 4);
      const b = rng.int(1, 3);
      const nevner = b ** (n + 1);
      const teller = target * (n + 1);
      if (teller % nevner !== 0) return null;
      const a = teller / nevner;
      if (a === 0 || Math.abs(a) > 60) return null;

      const integrand = `(${a})*x^${n}`;
      const latexIntegrand = polyLatex([{ coef: a, body: `x^{${n}}` }]);

      return {
        templateId: 'int.potens',
        latex: `\\int_{0}^{${b}} ${latexIntegrand}\\,dx`,
        prompt: 'Regn ut det bestemte integralet.',
        answer: target,
        steps: [
          `Potensregelen: den antideriverte er ${fractionLatex(a, n + 1)}x^{${n + 1}}`,
          `Sett inn ${b}: \\frac{${a} \\cdot ${b}^{${n + 1}}}{${n + 1}}`,
          `Svaret er ${target}.`,
        ],
        verify: () =>
          safeVerify(() =>
            approxEqual(integrateNumerically(integrand, 0, b), target, NUMERISK_EPS),
          ),
      };
    });
  },
};

/**
 * Integral av en sinus- eller cosinusfunksjon over et helt intervall.
 * Invers: begge formene gir et heltallsmultiplum av amplituden.
 */
const trigonometrisk: TaskTemplate = {
  id: 'int.trig',
  topic: 'integrasjon',
  level: 'ultra',
  concept: 'integrasjon.bestemt',
  coversTarget() {
    return true;
  },
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      // sin fra 0 til pi gir 2a, cos fra 0 til pi/2 gir a.
      const brukSinus = target % 2 === 0 && rng.next() < 0.5;
      const a = brukSinus ? target / 2 : target;
      if (!Number.isInteger(a) || a === 0 || Math.abs(a) > 12) return null;

      const integrand = brukSinus ? `(${a})*sin(x)` : `(${a})*cos(x)`;
      const øvre = brukSinus ? Math.PI : Math.PI / 2;
      const øvreLatex = brukSinus ? '\\pi' : '\\frac{\\pi}{2}';
      const funksjon = brukSinus ? '\\sin' : '\\cos';
      const koeffisient = a === 1 ? '' : String(a);

      return {
        templateId: 'int.trig',
        latex: `\\int_{0}^{${øvreLatex}} ${koeffisient}${funksjon}(x)\\,dx`,
        prompt: 'Regn ut det bestemte integralet.',
        answer: target,
        steps: brukSinus
          ? [
              `Den antideriverte til ${koeffisient}\\sin(x) er -${koeffisient}\\cos(x).`,
              `-${a}\\cos(\\pi) + ${a}\\cos(0) = ${a} + ${a}`,
              `Svaret er ${target}.`,
            ]
          : [
              `Den antideriverte til ${koeffisient}\\cos(x) er ${koeffisient}\\sin(x).`,
              `${a}\\sin(\\frac{\\pi}{2}) - ${a}\\sin(0) = ${a}`,
              `Svaret er ${target}.`,
            ],
        verify: () =>
          safeVerify(() =>
            approxEqual(integrateNumerically(integrand, 0, øvre), target, NUMERISK_EPS),
          ),
      };
    });
  },
};

/**
 * Areal mellom to kurver.
 * Invers: differansen er en parabel med kjent areal, og bredden velges slik at
 * arealet blir det bestilte tallet.
 */
const areal: TaskTemplate = {
  id: 'int.areal',
  topic: 'integrasjon',
  level: 'ultra',
  concept: 'integrasjon.bestemt',
  build(target, rng): GeneratedTask | null {
    return attempt(() => {
      // Differansen f - g settes til k*(x - p)(q - x), som har areal
      // k*(q - p)^3 / 6 mellom p og q.
      const p = rng.int(0, 3);
      const bredde = rng.pick([1, 2, 3]);
      const q = p + bredde;
      const teller = target * 6;
      const nevner = bredde ** 3;
      if (teller % nevner !== 0) return null;
      const k = teller / nevner;
      // Taket maa vaere hoeyt nok til at t = 7 gaar opp: der er bredde = 1
      // eneste mulighet, og da blir k = 42.
      if (k <= 0 || k > 60) return null;

      // f - g = k(x - p)(q - x) = -k x^2 + k(p + q) x - k p q
      const a = -k;
      const b = k * (p + q);
      const c = -k * p * q;

      // Legg en tilfeldig linje til begge kurvene, så de ikke alltid er like.
      const m = rng.int(-3, 3);
      const n = rng.int(-4, 4);

      const fTerms = [
        { coef: a, body: 'x^2' },
        { coef: b + m, body: 'x' },
        { coef: c + n, body: '' },
      ];
      const gTerms = [
        { coef: m, body: 'x' },
        { coef: n, body: '' },
      ];
      const diff = `(${polyExpr(fTerms)})-(${polyExpr(gTerms)})`;

      return {
        templateId: 'int.areal',
        latex: `f(x) = ${polyLatex(fTerms)} \\qquad g(x) = ${polyLatex(gTerms)}`,
        prompt: `Hva er arealet mellom kurvene fra x = ${p} til x = ${q}?`,
        answer: target,
        steps: [
          `Arealet er integralet av f(x) - g(x) fra ${p} til ${q}.`,
          `f(x) - g(x) = ${polyLatex([
            { coef: a, body: 'x^2' },
            { coef: b, body: 'x' },
            { coef: c, body: '' },
          ])}`,
          `Integrer og sett inn grensene. Arealet er ${target}.`,
        ],
        verify: () =>
          safeVerify(() => approxEqual(integrateNumerically(diff, p, q), target, NUMERISK_EPS)),
      };
    });
  },
};

/**
 * Uegentlig integral: en uendelig øvre grense som likevel konvergerer.
 * Invers: integralet av a/x^n fra 1 til uendelig er a/(n-1).
 */
const uegentlig: TaskTemplate = {
  id: 'int.uegentlig',
  topic: 'integrasjon',
  level: 'ultra',
  concept: 'integrasjon.uegentlig',
  build(target, rng): GeneratedTask | null {
    const n = rng.pick(divisorsOf(target).filter((d) => d >= 1).map((d) => d + 1));
    if (n === undefined || n < 2) return null;
    const a = target * (n - 1);
    if (a === 0 || a > 90) return null;

    return {
      templateId: 'int.uegentlig',
      latex: `\\int_{1}^{\\infty} \\frac{${a}}{x^{${n}}}\\,dx`,
      prompt: 'Regn ut det uegentlige integralet.',
      answer: target,
      steps: [
        `Integrer til en endelig grense b: ${fractionLatex(a, n - 1)}\\left(1 - \\frac{1}{${
          n === 2 ? 'b' : `b^{${n - 1}}`
        }}\\right)`,
        `La b gå mot uendelig. Leddet med b forsvinner.`,
        `Svaret er ${fractionLatex(a, n - 1)} = ${target}.`,
      ],
      verify: () =>
        safeVerify(() => {
          // Uendelig øvre grense lar seg ikke summere med jevne steg: med et
          // stort intervall blir stegene for grove der integranden stuper.
          // Substitusjonen u = 1/x gjør integralet endelig i stedet:
          //   ∫₁^∞ a/xⁿ dx  =  ∫₀¹ a·u^(n-2) du
          // Det er fortsatt en uavhengig kontroll, for malen bruker den
          // antideriverte a/(n-1), ikke denne omskrivingen.
          return approxEqual(
            integrateNumerically(`(${a})*x^${n - 2}`, 0, 1),
            target,
            NUMERISK_EPS,
          );
        }),
    };
  },
};

export const integrasjonTemplates: readonly TaskTemplate[] = [
  polynom,
  potens,
  trigonometrisk,
  areal,
  uegentlig,
];
