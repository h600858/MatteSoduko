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
  sudoku/       generering, løser og validering   (M2)
  game/         motor, poeng, progresjon, adaptiv vekting  (M3, M5-M7)
electron/  hovedprosess og preload   (M4)
src/       React-UI                  (M4)
tests/     vitest
scripts/   CLI-verktøy
```

## Kommandoer

```bash
npm test            # hele testsuiten
npm run typecheck   # tsc --noEmit, strict mode
npm run demo:tasks  # printer ti genererte oppgaver med fasit
```

`demo:tasks` tar flagg:

```bash
npm run demo:tasks -- --seed=hvl --antall=20 --nivaa=2 --temaer=derivasjon
npm run demo:tasks -- --stats     # null-rate per mal
```

Skriptene kjøres direkte med Node sin innebygde TypeScript-stripping, så det
trengs ingen egen kjøretidsavhengighet for TypeScript.

## Status

- [x] **M1** RNG og oppgavemaler for derivasjon og funksjoner
- [ ] **M2** Sudokumotor
- [ ] **M3** Brettbygging
- [ ] **M4** Electron-skall og UI
- [ ] **M5** Poeng, liv, hint, timer
- [ ] **M6** Persistens og statistikk
- [ ] **M7** Adaptiv vekting
- [ ] **M8** Pakking
