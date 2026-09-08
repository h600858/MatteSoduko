import { describe, expect, it } from 'vitest';
import type { ScoringConfig } from '../core/game/scoring.ts';
import {
  DEFAULT_SCORING,
  awardCell,
  awardCompletion,
  boardTimeBonus,
  cellAward,
  chargeHint,
  chargeMistake,
  createScoreState,
  isOutOfLives,
  timeBonus,
} from '../core/game/scoring.ts';

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

  it('mister hintbonusen etter første hint, men beholder tidsbonusen', () => {
    expect(cellAward(config, { seconds: 5, hintLevel: 1 })).toBe(
      config.basePerCell + config.maxTimeBonus,
    );
  });

  it('gir bare grunnpoeng når fasiten er vist', () => {
    expect(cellAward(config, { seconds: 5, hintLevel: 2 })).toBe(config.basePerCell);
  });

  it('belønner alltid et hintfritt svar mer enn et hjulpet', () => {
    for (const seconds of [0, 10, 30, 60, 200]) {
      const rent = cellAward(config, { seconds, hintLevel: 0 });
      const hint1 = cellAward(config, { seconds, hintLevel: 1 });
      const hint2 = cellAward(config, { seconds, hintLevel: 2 });
      expect(rent).toBeGreaterThan(hint1);
      expect(hint1).toBeGreaterThanOrEqual(hint2);
    }
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

  it('legger fullførtbonus og tidsbonus til summen', () => {
    const start = awardCell(createScoreState(config), config, { seconds: 5, hintLevel: 0 });
    const etter = awardCompletion(start, config, 0, 10);
    expect(etter.points).toBe(
      start.points + config.completionBonus + boardTimeBonus(config, 0, 10),
    );
  });
});
