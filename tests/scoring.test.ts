import { describe, expect, it } from 'vitest';
import type { ScoringConfig } from '../core/game/scoring.ts';
import {
  DEFAULT_SCORING,
  awardCell,
  boardAward,
  boardTimeBonus,
  cellAward,
  chargeHint,
  chargeMistake,
  createScoreState,
  isOutOfLives,
  nextRank,
  rankFor,
  rankProgress,
  timeBonus,
  LEVEL_MULTIPLIER,
  RANKS,
} from '../core/game/scoring.ts';
import { LEVELS } from '../core/tasks/types.ts';

const config: ScoringConfig = DEFAULT_SCORING;

describe('timeBonus', () => {
  it('gir full bonus for raske svar', () => {
    expect(timeBonus(config, 0)).toBe(config.maxTimeBonus);
    expect(timeBonus(config, config.fastSeconds)).toBe(config.maxTimeBonus);
  });

  it('gir null bonus for trege svar', () => {
    expect(timeBonus(config, config.slowSeconds)).toBe(0);
    expect(timeBonus(config, config.slowSeconds + 500)).toBe(0);
  });

  it('faller jevnt mellom grensene', () => {
    const midt = (config.fastSeconds + config.slowSeconds) / 2;
    expect(timeBonus(config, midt)).toBe(Math.round(config.maxTimeBonus / 2));

    let previous = config.maxTimeBonus + 1;
    for (let s = config.fastSeconds; s <= config.slowSeconds; s += 5) {
      const bonus = timeBonus(config, s);
      expect(bonus).toBeLessThanOrEqual(previous);
      expect(bonus).toBeGreaterThanOrEqual(0);
      previous = bonus;
    }
  });
});

describe('cellAward', () => {
  it('gir grunnpoeng, tidsbonus og hintbonus uten hint', () => {
    expect(cellAward(config, { seconds: 5, hintLevel: 0 })).toBe(
      config.basePerCell + config.maxTimeBonus + config.noHintBonus,
    );
  });

  it('mister hintbonusen etter konsepthintet, men beholder tidsbonusen', () => {
    expect(cellAward(config, { seconds: 5, hintLevel: 1 })).toBe(
      config.basePerCell + config.maxTimeBonus,
    );
  });

  it('halverer tidsbonusen når et løsningssteg er vist', () => {
    expect(cellAward(config, { seconds: 5, hintLevel: 2 })).toBe(
      config.basePerCell + Math.round(config.maxTimeBonus / 2),
    );
  });

  it('gir bare grunnpoeng når fasiten er vist', () => {
    expect(cellAward(config, { seconds: 5, hintLevel: 3 })).toBe(config.basePerCell);
  });

  it('gir mindre uttelling for hvert hintnivå', () => {
    for (const seconds of [0, 10, 30, 60, 200]) {
      const nivaaer = ([0, 1, 2, 3] as const).map((hintLevel) =>
        cellAward(config, { seconds, hintLevel }),
      );
      for (let i = 1; i < nivaaer.length; i += 1) {
        expect(nivaaer[i], `nivå ${i} etter ${seconds} s`).toBeLessThanOrEqual(
          nivaaer[i - 1] ?? 0,
        );
      }
      // Et hintfritt svar skal alltid være strengt bedre enn et hjulpet.
      expect(nivaaer[0]).toBeGreaterThan(nivaaer[3] ?? 0);
    }
  });

  it('gjør hvert hintnivå dyrere enn det forrige', () => {
    expect(config.hintPenalty[1]).toBeLessThan(config.hintPenalty[2]);
    expect(config.hintPenalty[2]).toBeLessThan(config.hintPenalty[3]);
  });
});

describe('poengregnskapet', () => {
  it('starter på null poeng og fulle liv', () => {
    const state = createScoreState(config);
    expect(state.points).toBe(0);
    expect(state.livesLeft).toBe(config.lives);
    expect(state.solvedCells).toBe(0);
  });

  it('legger til poeng og teller løste celler', () => {
    const state = awardCell(createScoreState(config), config, { seconds: 5, hintLevel: 0 });
    expect(state.solvedCells).toBe(1);
    expect(state.points).toBe(config.basePerCell + config.maxTimeBonus + config.noHintBonus);
  });

  it('koster liv bare i streng modus', () => {
    const start = createScoreState(config);
    expect(chargeMistake(start, config, 'streng').livesLeft).toBe(config.lives - 1);
    expect(chargeMistake(start, config, 'rolig').livesLeft).toBe(config.lives);
    // Poengtrekket gjelder i begge moduser.
    expect(chargeMistake(start, config, 'rolig').mistakes).toBe(1);
  });

  it('lar trekk bite selv fra null poeng', () => {
    // Et gulv på null ville gjort hint gratis for den som står på null,
    // og det er nettopp tidlig i brettet man vil be om hjelp.
    const start = createScoreState(config);
    expect(start.points).toBe(0);
    expect(chargeHint(start, config, 1).points).toBe(-config.hintPenalty[1]);
    expect(chargeMistake(start, config, 'rolig').points).toBe(-config.wrongPenalty);
  });

  it('stopper livene på null uansett hvor mange feil som gjøres', () => {
    let state = createScoreState(config);
    for (let i = 0; i < 20; i += 1) {
      state = chargeMistake(state, config, 'streng');
    }
    expect(state.livesLeft).toBe(0);
    expect(state.mistakes).toBe(20);
  });

  it('teller hint og trekker mer for fasit enn for første steg', () => {
    const start = createScoreState(config);
    const etterNivaa1 = chargeHint(start, config, 1);
    const etterNivaa2 = chargeHint(start, config, 2);
    expect(etterNivaa1.hintsUsed).toBe(1);
    expect(config.hintPenalty[2]).toBeGreaterThan(config.hintPenalty[1]);
    expect(etterNivaa2.points).toBeLessThanOrEqual(etterNivaa1.points);
  });

  it('melder om tap først når livene er brukt opp i streng modus', () => {
    let state = createScoreState(config);
    for (let i = 0; i < config.lives; i += 1) {
      expect(isOutOfLives(state, 'streng')).toBe(false);
      state = chargeMistake(state, config, 'streng');
    }
    expect(isOutOfLives(state, 'streng')).toBe(true);
    // Rolig modus har ingen liv å tape.
    expect(isOutOfLives(state, 'rolig')).toBe(false);
  });
});

describe('brettbonus', () => {
  it('gir bonus for tid spart mot forventet tid', () => {
    const taskCount = 40;
    const target = taskCount * config.targetSecondsPerCell;
    expect(boardTimeBonus(config, target, taskCount)).toBe(0);
    expect(boardTimeBonus(config, target + 100, taskCount)).toBe(0);
    expect(boardTimeBonus(config, target - 60, taskCount)).toBe(
      Math.min(config.maxBoardTimeBonus, 60 * config.pointsPerSecondSaved),
    );
  });

  it('har et tak', () => {
    expect(boardTimeBonus(config, 0, 500)).toBe(config.maxBoardTimeBonus);
  });

  it('legger fullførtbonus og tidsbonus til et fullført brett', () => {
    const rawPoints = 1000;
    const banket = boardAward(config, {
      rawPoints,
      completed: true,
      seconds: 0,
      taskCount: 10,
      level: 'enkel',
    });
    expect(banket).toBe(rawPoints + config.completionBonus + boardTimeBonus(config, 0, 10));
  });
});

describe('poeng per brett', () => {
  const brett = (over: Partial<Parameters<typeof boardAward>[1]> = {}) => ({
    rawPoints: 7000,
    completed: true,
    seconds: 600,
    taskCount: 42,
    level: 'enkel' as const,
    ...over,
  });

  it('gir flere poeng jo hardere nivået er', () => {
    const poeng = LEVELS.map((level) => boardAward(config, brett({ level })));
    for (let i = 1; i < poeng.length; i += 1) {
      expect(poeng[i]).toBeGreaterThan(poeng[i - 1] ?? 0);
    }
    expect(LEVEL_MULTIPLIER.enkel).toBe(1);
  });

  it('gir flere poeng for et raskt brett enn for et tregt', () => {
    expect(boardAward(config, brett({ seconds: 300 }))).toBeGreaterThan(
      boardAward(config, brett({ seconds: 5000 })),
    );
  });

  it('gir uttelling for et halvferdig brett', () => {
    // Halvparten av cellene løst gir omtrent halvparten av råpoengene.
    const halvt = boardAward(config, brett({ rawPoints: 3500, completed: false }));
    expect(halvt).toBeGreaterThan(0);
  });

  it('gir litt mindre enn halvparten for et halvferdig brett', () => {
    const fullt = boardAward(config, brett());
    const halvt = boardAward(config, brett({ rawPoints: 3500, completed: false }));
    const andel = halvt / fullt;

    // Mindre enn halvparten, fordi fullførtbonusen og tidsbonusen faller bort.
    expect(andel).toBeLessThan(0.5);
    // Men ikke så mye mindre at halve brettet føles bortkastet.
    expect(andel).toBeGreaterThan(0.35);
  });

  it('gir ingenting for et brett der ingenting ble løst', () => {
    expect(boardAward(config, brett({ rawPoints: 0, completed: false }))).toBe(0);
  });

  it('gjør det alltid lønnsomt å spille brettet ferdig', () => {
    for (const level of LEVELS) {
      const nesten = boardAward(config, brett({ rawPoints: 6900, completed: false, level }));
      const helt = boardAward(config, brett({ rawPoints: 7000, completed: true, level }));
      expect(helt, `nivå ${level}`).toBeGreaterThan(nesten);
    }
  });

  it('tåler et brett uten oppgaveceller', () => {
    expect(() => boardAward(config, brett({ taskCount: 0, rawPoints: 0 }))).not.toThrow();
  });
});

describe('trinn', () => {
  it('starter på laveste trinn', () => {
    expect(rankFor(0).id).toBe(RANKS[0]?.id);
  });

  it('stiger med poengsummen og går aldri nedover', () => {
    let forrige = -1;
    for (let poeng = 0; poeng <= 200_000; poeng += 2_500) {
      const index = RANKS.findIndex((rank) => rank.id === rankFor(poeng).id);
      expect(index).toBeGreaterThanOrEqual(forrige);
      forrige = index;
    }
  });

  it('treffer riktig trinn på grensene', () => {
    for (const rank of RANKS) {
      expect(rankFor(rank.from).id).toBe(rank.id);
      if (rank.from > 0) {
        expect(rankFor(rank.from - 1).id).not.toBe(rank.id);
      }
    }
  });

  it('melder om neste trinn helt til det høyeste er nådd', () => {
    expect(nextRank(0)?.id).toBe(RANKS[1]?.id);
    const høyeste = RANKS[RANKS.length - 1];
    expect(nextRank(høyeste?.from ?? 0)).toBeNull();
    expect(rankProgress(høyeste?.from ?? 0)).toBe(1);
  });

  it('gir en andel mellom 0 og 1 på vei mot neste trinn', () => {
    for (let poeng = 0; poeng <= 200_000; poeng += 1_000) {
      const andel = rankProgress(poeng);
      expect(andel).toBeGreaterThanOrEqual(0);
      expect(andel).toBeLessThanOrEqual(1);
    }
  });
});
