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
  tasks/        oppgavemaler, register og mathjs-verifisering
  sudoku/       generering, løser og validering
  game/         motor, spilløkt, poengregler, fremdrift og adaptiv vekting
electron/  hovedprosess (ESM) og preload (CJS, sandkasse på)
src/       React-UI. All styling ligger i styles.css og er ment å kastes.
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
