/**
 * Bygger beslutningsnotatet for videre utvikling av MatteSudoku.
 *
 *   npm install --no-save docx
 *   node notat/lag-notat.cjs
 *
 * docx installeres med --no-save med vilje: den trengs bare for å skrive dette
 * notatet, og hører ikke hjemme blant appens avhengigheter.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');

const TURKIS = '0A7D68';
const MORK = '14181A';
const GRA = '6B7479';
const LYS = 'E0F6F0';

const SIDEBREDDE = 9026; // DXA innenfor margene på A4 med 2,5 cm marg

/** Vanlig avsnitt. */
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 140, line: 276 },
    alignment: opts.alignment,
    children: [
      new TextRun({
        text,
        size: opts.size ?? 21,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? MORK,
      }),
    ],
  });
}

/** Avsnitt med blandet formatering: ['vanlig', ['fet', true]] */
function rich(deler, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 140, line: 276 },
    children: deler.map((d) =>
      Array.isArray(d)
        ? new TextRun({ text: d[0], bold: true, size: 21, color: MORK })
        : new TextRun({ text: d, size: 21, color: MORK }),
    ),
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 380, after: 160 },
    children: [new TextRun({ text, size: 30, bold: true, color: TURKIS })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, size: 24, bold: true, color: MORK })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 90 },
    children: [new TextRun({ text, size: 21, bold: true, color: TURKIS })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'kuler', level },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 21, color: MORK })],
  });
}

function nummer(text) {
  return new Paragraph({
    numbering: { reference: 'tall', level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 21, color: MORK })],
  });
}

/** Uthevet boks for anbefalinger. */
function boks(tittel, tekst) {
  return new Table({
    columnWidths: [SIDEBREDDE],
    width: { size: SIDEBREDDE, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: LYS },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: LYS },
      left: { style: BorderStyle.SINGLE, size: 18, color: TURKIS },
      right: { style: BorderStyle.SINGLE, size: 2, color: LYS },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: SIDEBREDDE, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: LYS },
            margins: { top: 160, bottom: 160, left: 220, right: 220 },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: tittel, bold: true, size: 21, color: TURKIS }),
                ],
              }),
              new Paragraph({
                spacing: { after: 0, line: 276 },
                children: [new TextRun({ text: tekst, size: 21, color: MORK })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Tabell med overskriftsrad. */
function tabell(kolonnebredder, overskrifter, rader) {
  const celle = (tekst, bredde, fet, fyll) =>
    new TableCell({
      width: { size: bredde, type: WidthType.DXA },
      shading: fyll ? { type: ShadingType.CLEAR, fill: fyll } : undefined,
      margins: { top: 90, bottom: 90, left: 140, right: 140 },
      children: [
        new Paragraph({
          spacing: { after: 0, line: 260 },
          children: [
            new TextRun({
              text: tekst,
              size: 19,
              bold: fet,
              color: fet ? MORK : MORK,
            }),
          ],
        }),
      ],
    });

  return new Table({
    columnWidths: kolonnebredder,
    width: { size: kolonnebredder.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'DFE3E5' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DFE3E5' },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'EEF0F1' },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: overskrifter.map((t, i) => celle(t, kolonnebredder[i], true, LYS)),
      }),
      ...rader.map(
        (rad) =>
          new TableRow({
            children: rad.map((t, i) => celle(t, kolonnebredder[i], false)),
          }),
      ),
    ],
  });
}

const innhold = [
  // ---------- Forside ----------
  new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: 'MatteSudoku', size: 56, bold: true, color: TURKIS }),
    ],
  }),
  new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({
        text: 'Veien videre: brettdesign, introskjerm, spillmekanikk og retningsvalg',
        size: 26,
        color: MORK,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 400 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TURKIS, space: 8 } },
    children: [
      new TextRun({ text: 'Beslutningsnotat · 27. september 2026', size: 19, color: GRA }),
    ],
  }),

  h1('Kort oppsummert'),
  p(
    'Dette notatet svarer på fire ting du tok opp: om 6×6-brettet er et ekte sudoku, ' +
      'hvordan maksimal poengsum kan vises mens brettet settes opp, hvordan en introskjerm ' +
      'og et navn til løven kan se ut, og hvilke mekanikker som er verdt å legge til for å ' +
      'gjøre det gøyere å samle poeng. Til slutt kommer en vurdering av det store ' +
      'retningsvalget: læringsplattform, hobbyside, eller begge deler.',
  ),
  boks(
    'Hovedanbefaling',
    'Behold 6×6 — det er et fullverdig sudoku og trolig den beste størrelsen for ' +
      'MatteSudoku. Bygg deretter tre små ting som henger sammen: introskjerm, synlig ' +
      'maksscore, og «Dagens brett». Det siste er den enkeltmekanikken som gir mest ' +
      'tilbake for minst arbeid, og den låser ingen dører mot verken skolebruk eller ' +
      'konkurranser senere.',
  ),
  p(''),

  // ---------- 6x6 ----------
  h1('1. Fungerer 6×6 som et vanlig sudoku?'),
  rich([
    ['Ja. '],
    'Et 6×6-brett med blokker på 2 rader × 3 kolonner er en anerkjent og fullt gyldig ' +
      'sudokuvariant, ofte kalt Mini Sudoku. Reglene er nøyaktig de samme som i 9×9: ' +
      'hver rad, hver kolonne og hver blokk skal inneholde tallene 1 til 6 nøyaktig én gang.',
  ]),
  p(
    'Jeg kontrollerte dette direkte mot motoren i stedet for å svare fra hukommelsen. ' +
      'Jeg genererte 200 brett i hver størrelse og sjekket to ting for hvert enkelt: at ' +
      'fasiten faktisk oppfyller sudokuregelen for alle rader, kolonner og blokker, og at ' +
      'brettet med hull har nøyaktig én løsning.',
  ),
  tabell(
    [2200, 3400, 3426],
    ['Størrelse', 'Oppfyller sudokuregelen', 'Nøyaktig én løsning'],
    [
      ['4×4 (2×2-blokker)', '200 av 200', '200 av 200'],
      ['6×6 (2×3-blokker)', '200 av 200', '200 av 200'],
      ['9×9 (3×3-blokker)', '200 av 200', '200 av 200'],
    ],
  ),
  p(''),
  p(
    'Med andre ord: 6×6 er ikke et forenklet eller «uekte» sudoku. Det er det samme ' +
      'puslespillet med et mindre rutenett, og løses med nøyaktig de samme teknikkene.',
  ),

  h2('Men størrelsen har en konsekvens du bør kjenne til'),
  p(
    'Brettstørrelsen bestemmer hvilke svar oppgavene kan ha. På et 6×6-brett må hvert ' +
      'svar være et tall mellom 1 og 6, og på et 4×4-brett mellom 1 og 4. Det snevrer inn ' +
      'hvilke oppgavemaler som kan brukes: en mal som bare treffer partall dekker to ' +
      'verdier på et 4×4-brett, men fire på et 9×9.',
  ),
  p(
    'Dette merkes først og fremst på 4×4. Der er det bare fire mulige svar og gjerne ' +
      'sju hull, så de samme malene går igjen. 4×4 fungerer godt som smakebit og til ' +
      'demonstrasjon, men er for tynt til øving over tid.',
  ),
  boks(
    'Anbefaling om brettstørrelser',
    'Behold alle tre, men gjør 6×6 til standardvalget. Et 9×9 på høyeste hullnivå gir ' +
      'over femti matteoppgaver, altså en økt på godt over en time. 6×6 gir rundt 20 ' +
      'oppgaver, som er en naturlig økt. Merk 4×4 tydelig som «smakebit» i oppsettet, så ' +
      'ingen velger den i den tro at det er full pakke.',
  ),
  p(''),

  // ---------- Maksscore ----------
  h1('2. Synlig maksimal poengsum mens brettet settes opp'),
  p(
    'Dette er både nyttig og billig å bygge, fordi alle tallene allerede finnes i ' +
      'poengmodellen. Maksimal sum for et brett er:',
  ),
  p(
    '(antall oppgaver × (grunnpoeng + full tidsbonus + hintfri bonus) + fullførtbonus ' +
      '+ maks brettidsbonus) × nivåmultiplikator',
  ),
  p(
    'Antall oppgaver er kjent så snart størrelse og hullnivå er valgt, og ' +
      'nivåmultiplikatoren er kjent så snart vanskelighetsgraden er valgt. Summen kan ' +
      'derfor oppdateres direkte mens man klikker seg gjennom oppsettet.',
  ),

  h3('Hvorfor det er mer enn pynt'),
  p(
    'Det gjør avveiningen synlig. I dag må man gjette på om det lønner seg å ta et lite ' +
      'brett på ultra eller et stort brett på middels. Med tallet framme blir valget ' +
      'informert, og vanskelighetsgraden får en konkret verdi i stedet for bare en ' +
      'etikett.',
  ),

  h3('To ting å passe på'),
  bullet(
    'Tallet må merkes tydelig som et tak, ikke en forventning. «Opptil 3 400 poeng» ' +
      'leser riktig; «3 400 poeng» gir feil forventning, siden full tidsbonus krever at ' +
      'hver celle løses på under 20 sekunder uten hint.',
  ),
  bullet(
    'Det kan være verdt å vise et realistisk anslag ved siden av, regnet ut fra din egen ' +
      'snittid fra statistikken. Da blir tallet noe du kan sikte mot.',
  ),
  p(''),

  // ---------- Introskjerm ----------
  h1('3. Introskjerm og navn på løven'),
  p(
    'En enkel introskjerm som det første man møter: løven i full størrelse, en hilsen, ' +
      'dagens utsagn, og to knapper — «Sett opp brett» og «Profil». Den koster lite og ' +
      'gir appen et ansikt fra første sekund. Totalpoengene dine passer også godt her, ' +
      'som en rask påminnelse om hvor du står.',
  ),

  h2('Navneforslag'),
  tabell(
    [1900, 3300, 3826],
    ['Navn', 'Hvorfor', 'Passer for'],
    [
      [
        'Regnar',
        'Ordspill på «regne» og det norske navnet Ragnar. Varmt og lett å huske, uten å ' +
          'bli barnslig.',
        'Både elever og voksne. Førstevalget mitt.',
      ],
      [
        'Tallak',
        'Ekte norsk navn som inneholder «tall». Mer dempet og litt mer voksent.',
        'Hvis tonen skal være rolig heller enn leken.',
      ],
      [
        'Pytta',
        'Fra Pytagoras. Leken og tydelig matterelatert.',
        'Yngre elever. Kan bli for søtt for lønningspils.',
      ],
      [
        'Leo',
        'Internasjonalt, åpenbar løvereferanse, fungerer på engelsk.',
        'Hvis appen skal ut av Norge senere.',
      ],
    ],
  ),
  p(''),
  boks(
    'Anbefaling om navn',
    'Regnar. Det bærer både løven og matematikken, det er norsk, og det fungerer like ' +
      'godt i et klasserom som på et firmaarrangement. Tallak er det trygge alternativet ' +
      'hvis Regnar føles for spøkefullt.',
  ),
  p(''),

  // ---------- Lagmodus ----------
  h1('4. Lagmodus: sudoku som alternativ til quiz'),
  p(
    'Scenarioet du beskrev — et teknisk selskap på lønningspils som løser ett brett ' +
      'sammen — er etter min vurdering den sterkeste ideen i hele notatet. Det er også ' +
      'det som skiller MatteSudoku tydeligst fra en vanlig quiz.',
  ),
  p(
    'I en quiz vet man svaret eller ikke. Her har laget alltid to veier videre: resonnere ' +
      'seg fram med sudokulogikk, eller regne ut oppgaven i cellen. Det betyr at både den ' +
      'som er god på tall og den som er god på mønstre kan bidra, og at gruppa aldri står ' +
      'helt fast.',
  ),

  h3('Hva som må bygges'),
  bullet('Presentasjonsmodus: mye større brett og oppgavetekst, lesbart fra avstand.'),
  bullet(
    'Oppgaven som hint i stedet for fasit. Står laget fast, åpner de cellen som en ' +
      'matteoppgave og regner seg fram til tallet.',
  ),
  bullet('Felles klokke og felles poengsum, uten kobling til noen enkeltprofil.'),
  bullet(
    'Ingen liv og ingen streng modus. I en sosial setting skal et feil svar ikke avslutte ' +
      'kvelden.',
  ),
  p(''),
  p(
    'Det meste finnes allerede: hintsystemet, den felles klokka og poengmodellen. ' +
      'Hovedarbeidet er presentasjon og en litt annen flyt, ikke ny logikk.',
  ),

  // ---------- Mekanikker ----------
  h1('5. Forslag til nye mekanikker'),
  p(
    'Jeg har sett på hva som faktisk virker i læringsapper, og på hvilke sudokuvarianter ' +
      'som finnes. Hovedfunnet fra forskningen er entydig: mekanikken må henge på selve ' +
      'læringsatferden, ikke limes utenpå. Poeng for å være innom gir lite. Poeng for ' +
      'gjentatt øving, repetisjon over tid og mestring gir mye.',
  ),
  p(
    'Forslagene under er sortert etter hvor mye de gir igjen for arbeidet.',
  ),

  h2('Lav innsats, høy verdi'),
  tabell(
    [2600, 4400, 2026],
    ['Tiltak', 'Hva det er', 'Hvorfor'],
    [
      [
        'Dagens brett',
        'Ett felles brett per dato, laget av datoen som seed. Alle får det samme brettet ' +
          'den dagen.',
        'Nesten gratis å bygge. Gir en grunn til å komme tilbake, og er forutsetningen ' +
          'for konkurranser senere.',
      ],
      [
        'Rekke med dager',
        'Teller dager på rad med minst ett brett.',
        'Forskning på tallforståelse finner tydelig effekt av rekker. Dataene finnes ' +
          'allerede.',
      ],
      [
        'Personlige rekorder',
        'Beste tid og beste poengsum per nivå og størrelse.',
        'Gir noe å slå uten at det trengs andre spillere eller en tjener.',
      ],
      [
        'Maksscore i oppsettet',
        'Punkt 2 i dette notatet.',
        'Gjør valget av vanskelighetsgrad meningsfylt.',
      ],
    ],
  ),
  p(''),

  h2('Middels innsats'),
  h3('Mestring per oppgavemal'),
  p(
    'Den adaptive vektingen vet allerede hvilke maler du sliter med. Det kan gjøres ' +
      'synlig: en mal går fra Ny til Øver til Sitter etter et visst antall riktige på rad ' +
      'innenfor en tidsgrense. Da ser du framgangen din på tema, ikke bare totalt, og det ' +
      'treffer nøyaktig det forskningen kaller mestringsstyrt progresjon.',
  ),
  h3('Ukentlige oppdrag'),
  p(
    'Små mål som «fullfør tre brett på vanskelig» eller «løs et brett uten hint». Alt kan ' +
      'regnes ut av fremdriften som allerede lagres, og de gir variasjon uten nytt ' +
      'fagstoff.',
  ),
  h3('Repetisjon over tid'),
  p(
    'Maler du ikke har sett på lenge bør komme tilbake, ikke bare de du bommer på. ' +
      'Tidspunktet for sist sett lagres allerede, men brukes ikke i vektingen ennå. Det er ' +
      'en liten endring i én ren funksjon.',
  ),
  h3('Sudokuvarianter'),
  p(
    'Varianter er en billig måte å gi brettet nytt liv på. De henger ulikt godt sammen ' +
      'med matteoppgavene:',
  ),
  bullet(
    'Diagonalsudoku (X-sudoku): de to diagonalene må også inneholde alle tall. Minst ' +
      'arbeid av alle variantene, siden det bare er to nye grupper å kontrollere.',
  ),
  bullet(
    'Jigsaw: blokkene har uregelmessig form. Krever endring i generatoren, men ingenting ' +
      'i matten.',
  ),
  bullet(
    'Killer sudoku: grupper av celler med en oppgitt sum. Matematisk interessant, men ' +
      'kolliderer delvis med ideen om at regnestykket ligger inne i cellen. Bør vurderes ' +
      'nøye før den bygges.',
  ),
  p(''),

  h2('Høy innsats, krever et retningsvalg'),
  p(
    'Poengtavler, klasser, grupper og konkurranser mellom brukere forutsetter alle to ' +
      'ting appen ikke har i dag: brukerkontoer og en tjener. Det er ikke en liten ' +
      'utvidelse, det er et annet produkt. Se neste kapittel.',
  ),

  // ---------- Retningsvalg ----------
  h1('6. Retningsvalget: læringsplattform, hobbyside eller begge'),
  p(
    'Dette er den viktigste avgjørelsen i notatet, og den bør tas bevisst. Slik ser de ' +
      'tre retningene ut:',
  ),
  tabell(
    [2200, 3100, 3726],
    ['Retning', 'Hva det krever', 'Konsekvens'],
    [
      [
        'A. Offline enspiller (i dag)',
        'Ingenting nytt. Ingen konto, ingen e-post, ingen tjener.',
        'Enkelt, privat og raskt å utvikle. Ingen personopplysninger i omløp.',
      ],
      [
        'B. Hobbyplattform',
        'Kontoer, tjener, database. E-post eller innlogging via tredjepart.',
        'Gir poengtavler, dagens brett med rangering og venner. Et normalt produktsteg.',
      ],
      [
        'C. Skoleverktøy',
        'Alt i B, pluss elevdata, roller for lærer og elev, og et vesentlig juridisk ' +
          'arbeid.',
        'Langt større forpliktelse. Se under.',
      ],
    ],
  ),
  p(''),

  h2('Hva steget til skolebruk faktisk innebærer'),
  p(
    'Dette er verdt å være klar over før det velges, ikke etterpå. Jeg oppgir det som ' +
      'punkter å undersøke nærmere, ikke som juridisk rådgivning:',
  ),
  bullet(
    'Behandling av personopplysninger om mindreårige utløser strengere krav under ' +
      'personvernforordningen.',
  ),
  bullet(
    'Norske skoler krever normalt databehandleravtale med leverandøren, og ofte en ' +
      'personvernkonsekvensvurdering før et verktøy tas i bruk.',
  ),
  bullet(
    'Feide er den nasjonale innloggingsløsningen i norsk utdanning. Uten støtte for den ' +
      'blir terskelen for skolene høy.',
  ),
  bullet(
    'Lagring av elevdata innebærer krav til sletterutiner, innsyn og driftssikkerhet som ' +
      'må være på plass fra dag én.',
  ),
  p(''),
  boks(
    'Anbefaling om retning',
    'Sikt mot både og, men bygg det i rekkefølge. Behold kjernen slik den er: appen skal ' +
      'fungere helt uten konto. Legg konto på som noe valgfritt som låser opp poengtavler ' +
      'og dagens brett. Skolebruk kan komme etterpå, som en rolle oppå kontoen, ikke som ' +
      'et eget produkt. Ved registrering velger man «på egen hånd» eller «gjennom skolen», ' +
      'og valget styrer bare hvilke funksjoner som vises.',
  ),
  p(''),

  h2('Én teknisk forutsetning som gjør dette mulig'),
  p(
    'Mappen core/ er i dag helt fri for React og Electron, og all matematikk og spillogikk ' +
      'ligger der. Den samme disiplinen bør gjelde kontoer: ingenting i core/ skal vite ' +
      'hva en bruker eller en klasse er. Holder vi på det, kan den samme kjernen kjøre ' +
      'både i skrivebordsappen, i en nettleser og på en tjener senere. Brytes det, blir ' +
      'steget til B og C mye dyrere enn det trenger å være.',
  ),

  // ---------- Pensum ----------
  h1('7. Kobling mot pensum'),
  p(
    'Du sa dette kan vente, så her er bare det korte svaret: grunnlaget er allerede lagt. ' +
      'Temakatalogen fra forrige milepæl er nettopp den koblingen som trengs.',
  ),
  p(
    'En pensumkobling er et lag oppå: en liste over kompetansemål, der hvert mål peker på ' +
      'de oppgavemalene som dekker det. Læreren velger mål, og appen velger maler. ' +
      'Motoren trenger ikke endres i det hele tatt, fordi den allerede tar imot en liste ' +
      'over temaer og et nivå.',
  ),
  p(
    'For norsk skole er den naturlige forankringen kompetansemålene i læreplanen for ' +
      'matematikk. Det praktiske arbeidet er ikke teknisk, det er å skrive nok ' +
      'oppgavemaler til å dekke målene på hvert trinn.',
  ),

  // ---------- Videre ----------
  h1('8. Forslag til rekkefølge'),
  p(
    'Basert på vurderingene over, i den rekkefølgen jeg ville tatt dem:',
  ),
  nummer(
    'Introskjerm med Regnar, navnet på plass, og synlig maksscore i oppsettet. Lite ' +
      'arbeid, umiddelbart synlig.',
  ),
  nummer(
    'Dagens brett, rekke med dager og personlige rekorder. Dette er vanedannelsen, og ' +
      'alt kan bygges uten tjener.',
  ),
  nummer(
    'Mestring per oppgavemal og ukentlige oppdrag. Gjør framgangen synlig på tema.',
  ),
  nummer(
    'Lagmodus med presentasjonsvisning. Åpner en helt ny bruksmåte, og er det som gjør ' +
      'appen interessant utenfor skolen.',
  ),
  nummer(
    'Deretter tas retningsvalget om kontoer og tjener, med et faktisk grunnlag å bestemme ' +
      'ut fra.',
  ),
  p(''),
  p(
    'Alt i punkt 1 til 4 kan bygges uten å bryte noen av de prinsippene appen hviler på i ' +
      'dag: ingen tjener, ingen nettverkskall, og en kjerne som kan testes uten ' +
      'brukergrensesnitt.',
    { italics: true, color: GRA },
  ),

  // ---------- Kilder ----------
  h1('Kilder'),
  p(
    'Påstandene om 6×6 og om brettenes entydighet er kontrollert direkte mot motoren i ' +
      'prosjektet, ikke hentet fra kilder. Det følgende ligger til grunn for kapittel 5:',
    { color: GRA },
  ),
  bullet('trophy.so — oversikt over spillmekanikk i studieapper og hva de brukes til.'),
  bullet(
    'link.springer.com — studie av effekten av rekker på tallforståelse hos de yngste, ' +
      'med effektstørrelser på 0,38 til 0,42.',
  ),
  bullet('sudokuaday.com og thesudoku.net — beskrivelser av sudokuvarianter.'),
  bullet('teambuilding.com — samarbeidsspill og puslespill brukt på arbeidsplasser.'),
];

const doc = new Document({
  creator: 'MatteSudoku',
  title: 'MatteSudoku — veien videre',
  description: 'Beslutningsnotat om brettdesign, introskjerm, spillmekanikk og retningsvalg',
  numbering: {
    config: [
      {
        reference: 'kuler',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 240 } } },
          },
        ],
      },
      {
        reference: 'tall',
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 280 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'MatteSudoku · veien videre · side ', size: 16, color: GRA }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRA }),
              ],
            }),
          ],
        }),
      },
      children: innhold,
    },
  ],
});

const ut = path.join(__dirname, 'MatteSudoku-veien-videre.docx');
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(ut, buf);
  console.log(`Skrev ${ut} (${Math.round(buf.length / 1024)} kB)`);
});
