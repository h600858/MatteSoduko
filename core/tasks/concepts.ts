/**
 * Fagstoffet bak oppgavene.
 *
 * Et konsept svarer på «hva slags oppgave er dette, og hvilke regler gjelder».
 * Det er det første hintet: ikke et steg i løsningen, men en orientering, med
 * hele regeltabellen vist. Spilleren må fortsatt finne ut hvilken regel som
 * passer, og det er nettopp der læringen ligger.
 *
 * Kildene peker til reelle norske fagsider. De er kontrollert, men nettsider
 * flytter på seg: en lenke som ikke virker er en feil verdt å melde fra om.
 *
 * Å legge til et konsept er én oppføring her pluss én `concept`-linje på
 * malene som hører til. Motoren trenger ikke endres.
 */

export interface RuleRow {
  /** Navnet på regelen, f.eks. «Produktregelen». */
  name: string;
  /** Venstre side, som LaTeX. */
  fn: string;
  /** Høyre side, som LaTeX. */
  result: string;
}

export interface Source {
  label: string;
  url: string;
  /** Hva man finner der. Vises etter lenken. */
  note: string;
}

export interface Concept {
  id: string;
  title: string;
  /** Hva slags oppgave dette er. Én til to setninger. */
  intro: string;
  /** Overskrift over tabellen. */
  rulesHeading: string;
  /** Hele tabellen, ikke bare regelen som passer. */
  rules: readonly RuleRow[];
  /** Hva spilleren skal gjøre med tabellen. */
  guidance: string;
  sources: readonly Source[];
}

const NDLA_DERIVASJON: Source = {
  label: 'NDLA: Derivasjonsregler (R1)',
  url: 'https://ndla.no/r/matematikk-r1/derivasjonsregler/2744733dd6',
  note: 'hele tabellen med utledning og eksempler',
};

export const CONCEPTS: readonly Concept[] = [
  {
    id: 'likninger.losning',
    title: 'Løse en likning',
    intro:
      'Dette er en likning: to uttrykk som er like store. Oppgaven er å finne tallet x ' +
      'må være for at likheten skal stemme.',
    rulesHeading: 'Det du har lov til å gjøre med en likning',
    rules: [
      { name: 'Legge til på begge sider', fn: 'x - a = b', result: 'x = b + a' },
      { name: 'Trekke fra på begge sider', fn: 'x + a = b', result: 'x = b - a' },
      { name: 'Dele på begge sider', fn: 'ax = b', result: 'x = \\frac{b}{a}' },
      { name: 'Gange begge sider', fn: '\\frac{x}{a} = b', result: 'x = ab' },
      { name: 'Løse opp parentes', fn: 'a(x + b)', result: 'ax + ab' },
      { name: 'Samle like ledd', fn: 'ax = cx + d', result: '(a - c)x = d' },
    ],
    guidance:
      'Alt du gjør på den ene siden må du gjøre på den andre. Målet er å få x alene ' +
      'på én side. Begynn med å samle alle ledd med x på samme side.',
    sources: [
      {
        label: 'Matematikk.net: Likninger',
        url: 'https://www.matematikk.net/side/Likninger',
        note: 'gjennomgang fra de enkleste til andregradslikninger',
      },
    ],
  },

  {
    id: 'likninger.regnerekkefolge',
    title: 'Regnerekkefølge',
    intro:
      'Dette er et regnestykke der rekkefølgen avgjør svaret. Regner du fra venstre ' +
      'mot høyre uten å tenke, får du som regel feil.',
    rulesHeading: 'Rekkefølgen du skal regne i',
    rules: [
      { name: '1. Parenteser', fn: 'a \\cdot (b + c)', result: 'regn ut parentesen først' },
      { name: '2. Potenser og røtter', fn: 'a \\cdot b^2', result: 'potensen før gangingen' },
      { name: '3. Ganging og deling', fn: 'a + b \\cdot c', result: 'gangingen før plussen' },
      { name: '4. Pluss og minus', fn: 'a + b - c', result: 'til slutt, fra venstre' },
      { name: 'Minus foran parentes', fn: 'a - (b - c)', result: 'a - b + c' },
      { name: 'To minus', fn: 'a - (-b)', result: 'a + b' },
    ],
    guidance:
      'Gå gjennom listen ovenfra. Finn det som står øverst på listen i regnestykket ' +
      'ditt, og regn det ut først.',
    sources: [
      {
        label: 'Matematikk.net: Likninger',
        url: 'https://www.matematikk.net/side/Likninger',
        note: 'regnerekkefølge og regning med negative tall',
      },
    ],
  },

  {
    id: 'funksjoner.verdi',
    title: 'Funksjonsverdi',
    intro:
      'Dette er en funksjon. Å finne f(a) betyr å bytte ut hver x i uttrykket med ' +
      'tallet a, og så regne ut.',
    rulesHeading: 'Slik leser du funksjonsnotasjonen',
    rules: [
      { name: 'Funksjonsverdi', fn: 'f(x) = ax + b', result: 'f(2) = a \\cdot 2 + b' },
      { name: 'Sammensatt funksjon', fn: 'f(g(x))', result: 'regn ut g(x) først' },
      { name: 'Invers funksjon', fn: 'f^{-1}(y)', result: 'den x som gir f(x) = y' },
    ],
    guidance:
      'Har du en funksjon inni en annen, som f(g(2)), starter du innerst. Regn ut ' +
      'g(2) først, og sett svaret inn i f.',
    sources: [
      {
        label: 'Matematikk.net: Likninger',
        url: 'https://www.matematikk.net/side/Likninger',
        note: 'funksjonsuttrykk og innsetting',
      },
    ],
  },

  {
    id: 'funksjoner.nullpunkt',
    title: 'Nullpunkt og definisjonsmengde',
    intro:
      'Et nullpunkt er en x-verdi som gjør at funksjonen blir null. For en brøk er ' +
      'spørsmålet det motsatte: hvilken x gjør nevneren null, slik at brøken blir ' +
      'udefinert.',
    rulesHeading: 'Regler du trenger',
    rules: [
      { name: 'Nullpunkt', fn: 'f(x) = 0', result: 'løs likningen for x' },
      {
        name: 'Andregradsformelen',
        fn: 'ax^2 + bx + c = 0',
        result: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      },
      { name: 'Produkt lik null', fn: '(x - p)(x - q) = 0', result: 'x = p \\text{ eller } x = q' },
      { name: 'Udefinert brøk', fn: '\\frac{c}{ax - b}', result: 'nevneren kan ikke bli null' },
    ],
    guidance:
      'Kan uttrykket faktoriseres, er det raskest. Ellers bruker du andregradsformelen. ' +
      'Husk at oppgaven kan spørre etter det største nullpunktet, ikke begge.',
    sources: [
      {
        label: 'Matematikk.net: Likninger',
        url: 'https://www.matematikk.net/side/Likninger',
        note: 'andregradslikninger og faktorisering',
      },
    ],
  },

  {
    id: 'funksjoner.logaritmer',
    title: 'Logaritmer og vekst',
    intro:
      'En logaritme svarer på spørsmålet «hvilken eksponent trengs?». At ' +
      '\\log_2(8) = 3 betyr at 2 opphøyd i 3 er 8.',
    rulesHeading: 'Logaritme- og potensregler',
    rules: [
      { name: 'Definisjon', fn: '\\log_a(x) = y', result: 'a^y = x' },
      { name: 'Logaritmen av en potens', fn: '\\log_a(a^n)', result: 'n' },
      { name: 'Produktregelen', fn: '\\log_a(xy)', result: '\\log_a(x) + \\log_a(y)' },
      { name: 'Doblingsvekst', fn: 'N(x) = N_0 \\cdot 2^x', result: 'x er antall doblinger' },
    ],
    guidance:
      'Skriv tallet under logaritmen som en potens av grunntallet. Da leser du svaret ' +
      'rett av eksponenten. For vekstoppgaver: del måltallet på startverdien først.',
    sources: [
      {
        label: 'NDLA: Ulikheter med logaritmeuttrykk (R1)',
        url: 'https://ndla.no/r/matematikk-r1/ulikheter-med-logaritmeuttrykk/2bdd097f95',
        note: 'logaritmereglene i bruk',
      },
    ],
  },

  {
    id: 'derivasjon.regler',
    title: 'Derivasjon',
    intro:
      'Dette dreier seg om derivasjon. Den deriverte f\'(x) forteller hvor bratt ' +
      'funksjonen stiger i punktet x, altså stigningstallet til tangenten der.',
    rulesHeading: 'Derivasjonsreglene',
    rules: [
      { name: 'Konstant', fn: 'f(x) = k', result: "f'(x) = 0" },
      { name: 'Potensregelen', fn: 'f(x) = x^r', result: "f'(x) = r \\cdot x^{r-1}" },
      { name: 'Konstant faktor', fn: 'f(x) = k \\cdot g(x)', result: "f'(x) = k \\cdot g'(x)" },
      {
        name: 'Sum og differanse',
        fn: 'f(x) = g(x) \\pm h(x)',
        result: "f'(x) = g'(x) \\pm h'(x)",
      },
      {
        name: 'Produktregelen',
        fn: 'f(x) = u(x) \\cdot v(x)',
        result: "f'(x) = u'v + uv'",
      },
      {
        name: 'Kvotientregelen',
        fn: 'f(x) = \\frac{u(x)}{v(x)}',
        result: "f'(x) = \\frac{u'v - uv'}{v^2}",
      },
      { name: 'Kjerneregelen', fn: 'f(x) = g(u(x))', result: "f'(x) = g'(u) \\cdot u'(x)" },
      { name: 'Eksponentialfunksjon', fn: 'f(x) = e^x', result: "f'(x) = e^x" },
      { name: 'Naturlig logaritme', fn: 'f(x) = \\ln(x)', result: "f'(x) = \\frac{1}{x}" },
    ],
    guidance:
      'Se på formen til f(x) og finn regelen som ligner. Er det to uttrykk ganget ' +
      'sammen? Da er det produktregelen. Står det noe inni en parentes som er opphøyd? ' +
      'Da er det kjerneregelen. Er det en brøk med x i nevneren? Da er det ' +
      'kvotientregelen, eller du kan skrive om til en potens med negativ eksponent.',
    sources: [
      NDLA_DERIVASJON,
      {
        label: 'NDLA: Produktregelen for derivasjon (S1)',
        url: 'https://ndla.no/r/matematikk-s1/produktregelen-for-derivasjon/af73d80d3a',
        note: 'produktregelen alene, med utledning',
      },
      {
        label: 'NDLA: Kjerneregelen (R1)',
        url: 'https://ndla.no/nb/r/matematikk-r1/kjerneregelen/5c79eaccb3',
        note: 'kjerneregelen steg for steg',
      },
    ],
  },

  {
    id: 'derivasjon.ekstremalpunkt',
    title: 'Ekstremalpunkt',
    intro:
      'Dette handler om å finne bunnpunktet til en funksjon. I et bunn- eller ' +
      'toppunkt er tangenten vannrett, altså er den deriverte null der.',
    rulesHeading: 'Fremgangsmåte',
    rules: [
      { name: '1. Deriver', fn: 'f(x) = ax^2 + bx + c', result: "f'(x) = 2ax + b" },
      { name: '2. Sett lik null', fn: "f'(x) = 0", result: 'x = -\\frac{b}{2a}' },
      { name: '3. Avgjør type', fn: 'a > 0', result: 'bunnpunkt' },
      { name: '', fn: 'a < 0', result: 'toppunkt' },
    ],
    guidance:
      'Deriver funksjonen, sett den deriverte lik null, og løs for x. Fortegnet på ' +
      'andregradsleddet avgjør om punktet er et bunnpunkt eller et toppunkt.',
    sources: [NDLA_DERIVASJON],
  },

  {
    id: 'integrasjon.bestemt',
    title: 'Bestemt integral',
    intro:
      'Dette er et bestemt integral. Det måler arealet mellom grafen og x-aksen ' +
      'mellom to grenser, og regnes ut ved hjelp av den antideriverte.',
    rulesHeading: 'Integrasjonsregler',
    rules: [
      {
        name: 'Analysens fundamentalteorem',
        fn: '\\int_a^b f(x)\\,dx',
        result: 'F(b) - F(a)',
      },
      {
        name: 'Potensregelen',
        fn: '\\int x^n\\,dx',
        result: '\\frac{x^{n+1}}{n+1} + C',
      },
      { name: 'Konstant faktor', fn: '\\int k \\cdot f(x)\\,dx', result: 'k \\int f(x)\\,dx' },
      { name: 'Sinus', fn: '\\int \\sin(x)\\,dx', result: '-\\cos(x) + C' },
      { name: 'Cosinus', fn: '\\int \\cos(x)\\,dx', result: '\\sin(x) + C' },
      {
        name: 'Areal mellom kurver',
        fn: '\\int_a^b (f(x) - g(x))\\,dx',
        result: 'arealet mellom grafene',
      },
    ],
    guidance:
      'Finn den antideriverte F, sett inn øvre grense, og trekk fra verdien i nedre ' +
      'grense. Konstanten C faller bort i et bestemt integral.',
    sources: [
      {
        label: 'NDLA: Grunnleggende regneregler for integrasjon (R2)',
        url: 'https://ndla.no/r/matematikk-r2/grunnleggende-regneregler-for-integrasjon/3381b239a8',
        note: 'reglene med utledning',
      },
      {
        label: 'NDLA: Beregne bestemte integraler og arealer (R2)',
        url: 'https://ndla.no/nb/r/matematikk-r2/beregne-bestemte-integraler-og-arealer-ved-regning/c779133638',
        note: 'arealberegning steg for steg',
      },
    ],
  },

  {
    id: 'integrasjon.uegentlig',
    title: 'Uegentlig integral',
    intro:
      'Dette integralet har en uendelig grense. Det regnes ut ved å integrere til en ' +
      'endelig grense b, og deretter la b gå mot uendelig.',
    rulesHeading: 'Fremgangsmåte',
    rules: [
      {
        name: 'Definisjon',
        fn: '\\int_1^{\\infty} f(x)\\,dx',
        result: '\\lim_{b \\to \\infty} \\int_1^{b} f(x)\\,dx',
      },
      {
        name: 'Potensregelen',
        fn: '\\int \\frac{a}{x^n}\\,dx',
        result: '\\frac{a}{(1-n)x^{n-1}} + C',
      },
      {
        name: 'Konvergens',
        fn: '\\int_1^{\\infty} \\frac{1}{x^n}\\,dx',
        result: 'konvergerer når n > 1',
      },
    ],
    guidance:
      'Integrer som vanlig til en grense b. Se så hva leddet med b gjør når b vokser: ' +
      'går det mot null, er det som står igjen svaret.',
    sources: [
      {
        label: 'NDLA: Integrasjon (R2)',
        url: 'https://ndla.no/e/matematikk-r2/integrasjon/466a4a228c',
        note: 'hele integrasjonsemnet',
      },
      {
        label: 'Matematikk.net: Integrasjon',
        url: 'https://www.matematikk.net/side/Integrasjon',
        note: 'oppsummering med eksempler',
      },
    ],
  },
];

const BY_ID = new Map<string, Concept>(CONCEPTS.map((concept) => [concept.id, concept]));

export function conceptById(id: string): Concept | undefined {
  return BY_ID.get(id);
}
