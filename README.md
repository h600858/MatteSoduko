# MatteSudoku

Sudoku der hver tomme celle inneholder en matteoppgave fra MAT102-pensum.
Svaret på oppgaven er tallet som skal stå i cellen, og sudokureglene validerer
underveis.

## Kjernemekanikk

Brettet lages først, oppgavene etterpå:

1. Generer et komplett, gyldig sudokubrett med tallene 1..N.
2. Fjern celler til ønsket vanskelighetsgrad, og verifiser at brettet fortsatt
   har nøyaktig én løsning.
3. For hver fjernet celle er fasitsifferet kjent. Be registeret om en oppgave
   **med bestilt svar**.
4. Verifiser svaret uavhengig med mathjs før oppgaven slippes inn på brettet.

Hver oppgavemal er derfor invertibel: den kan velge parametre slik at fasiten
blir et bestemt tall. All tilfeldighet går gjennom en seedbar RNG som injiseres,
så et brett kan reproduseres fra en seed.

## Mappestruktur

```
core/     ren TypeScript, ingen import fra React eller Electron
  rng.ts        seedbar generator
  tasks/        oppgavemaler, temakatalog, register og verifisering
  sudoku/       generering, løser og validering
  game/         motor, spilløkt, poengregler, fremdrift og adaptiv vekting
electron/  hovedprosess (ESM) og preload (CJS, sandkasse på)
src/       React-UI. All styling ligger i styles.css.
tests/     vitest
scripts/   CLI-verktøy
```

## Kommandoer

```bash
npm run dev         # starter appen i et Electron-vindu
npm run dev:web     # bare renderer-en i nettleseren, uten Electron
npm run build       # typesjekk + produksjonsbygg til dist/ og dist-electron/
npm test            # hele testsuiten
npm run typecheck   # tsc --noEmit, strict mode
npm run demo:tasks  # printer ti genererte oppgaver med fasit
npm run demo:brett  # printer et ferdig brett med oppgave i hver tomme celle

npm run dist        # bygger Windows-installer til release/
npm run dist:mac    # bygger macOS-dmg, må kjøres på en Mac
npm run pack        # pakker ut appen uten installer, for rask kontroll
npm run ikon        # regenererer plassholderikonet i build/
```

## Vanskelighetsgrader og temaer

Fire nivåer, knyttet til skoletrinn:

| Nivå | Trinn | Temaer i dag |
| --- | --- | --- |
| Enkel | Ungdomsskole | Likninger og regnerekkefølge |
| Middels | Videregående | Funksjoner, derivasjon |
| Vanskelig | Universitet | Derivasjon, funksjoner |
| Ultra vanskelig | Universitet, videregående emner | Integrasjon |

Et brett bruker bare maler fra det valgte nivået. Nivået er en egenskap ved
malen, ikke ved brettet, og hvilke temaer som finnes på et nivå utledes av
malene selv. Det er derfor bare én kilde til den sannheten.

### Legge til et nytt tema

1. Skriv malene i `core/tasks/templates/<tema>.ts`. Hver mal oppgir `topic`,
   `level` og en `build()` som er invertibel: parametrene velges ut fra det
   bestilte svaret.
2. Legg til én linje i `TOPICS` i `core/tasks/topics.ts` med id, navn og
   beskrivelse.
3. Legg malene inn i `allTemplates` i `core/tasks/registry.ts`.

Verken motoren, UI-et eller typene må endres. Temaet dukker opp i valgmenyen
på de nivåene malene hører til, og testene plukker det opp automatisk.

## Utseende

Hovedfargen er turkisgrønn og ligger på toppbaren og på sidene av flaten.
Innholdet står i hvite kort oppå, resten av paletten er hvit, grå og
nesten-svart. Hele uttrykket ligger i `src/styles.css`, styrt av variabler
øverst i filen, så fargeprofilen kan endres ett sted.

Ingen skrifter lastes utenfra. Appen skal virke offline, så typografien bygger
på systemfontene.

Maskoten heter Tallak og er en løve i inline SVG, tegnet i
`src/components/Mascot.tsx`. Hun viser ett utsagn per dag, valgt av en ren
funksjon av datoen i `core/game/mascot.ts`, så teksten står stille gjennom
dagen uten at noe må lagres.

## Tastatur

Piltaster flytter markøren, `1`–`9` fyller inn, samme tall om igjen tømmer
cellen, `Delete` tømmer, og `n` veksler notatmodus.

Begge demo-skriptene tar flagg:

```bash
npm run demo:tasks -- --seed=hvl --antall=20 --nivaa=2 --temaer=derivasjon
npm run demo:tasks -- --stats     # null-rate per mal

npm run demo:brett -- --seed=hvl --storrelse=6 --nivaa=2 --brettnivaa=3 --fasit
```

Skriptene kjøres direkte med Node sin innebygde TypeScript-stripping, så det
trengs ingen egen kjøretidsavhengighet for TypeScript.

## Pakking

`npm run dist` lager `release/MatteSudoku-<versjon>-oppsett-x64.exe`, en
NSIS-installer på rundt 110 MB. Mesteparten er Electron selv. Installeren lar
deg velge mappe og installerer per bruker, så den trenger ikke administrator.

Pakken inneholder bare `dist/`, `dist-electron/` og `package.json`. Vite
bundler alt av UI og `core/` inn i `dist/`, og hovedprosessen importerer bare
`electron` og node-innebygde moduler, så `node_modules` holdes utenfor.

Fremdriften havner i `%APPDATA%/MatteSudoku/progress.json` for den installerte
appen. Avinstallering sletter den ikke.

**Usignert.** Windows SmartScreen vil vise «Windows beskyttet PC-en din» første
gang. Velg *Mer info* og så *Kjør likevel*. Skal advarslene bort, kreves et
kodesigneringssertifikat.

**macOS** er konfigurert (dmg for arm64 og x64), men kan ikke bygges fra
Windows. `npm run dist:mac` må kjøres på en Mac. Den blir også usignert og uten
notarisering, så første åpning krever høyreklikk og *Åpne*.

Ikonet i `build/icon.png` er en plassholder som genereres av
`scripts/lag-ikon.ts`. Det er et sudokurutenett, ikke designarbeid.

## Status

- [x] **M1** RNG og oppgavemaler for derivasjon og funksjoner
- [x] **M2** Sudokumotor
- [x] **M3** Brettbygging
- [x] **M4** Electron-skall og UI
- [x] **M5** Poeng, liv, hint, timer
- [x] **M6** Persistens og statistikk
- [x] **M7** Adaptiv vekting
- [x] **M8** Pakking
- [x] **M9** Designløft og maskot
- [x] **M10** Fire vanskelighetsnivåer og datadrevet temaregister
- [x] **M11** Poeng over tid og profilside
- [x] **M12** Introskjerm, dagens brett og synlig maksscore
