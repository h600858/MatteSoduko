/**
 * Poengreglene, som rene funksjoner.
 *
 * Ingenting her vet om brett, celler eller tid som går. Alt tas inn som tall,
 * slik at reglene kan justeres og testes uten å røre spillmotoren.
 */

import type { Level } from '../tasks/types.ts';

/** Streng markerer feil med én gang og koster liv. Rolig venter til du sjekker. */
export type ErrorMode = 'streng' | 'rolig';

/** 0 = ingen hint brukt, 1 = første løsningssteg, 2 = fasit for cellen. */
export type HintLevel = 0 | 1 | 2;

export interface ScoringConfig {
  /** Grunnpoeng for hver celle som løses riktig. */
  readonly basePerCell: number;
  /** Trekk for hvert feil svar. */
  readonly wrongPenalty: number;
  /** Trekk for hint, per nivå. */
  readonly hintPenalty: Readonly<Record<1 | 2, number>>;
  /** Ekstra poeng for en celle løst uten hint. */
  readonly noHintBonus: number;
  /** Maks tidsbonus for én celle. */
  readonly maxTimeBonus: number;
  /** Under dette antallet sekunder gis full tidsbonus. */
  readonly fastSeconds: number;
  /** Over dette antallet sekunder gis ingen tidsbonus. */
  readonly slowSeconds: number;
  /** Bonus for å fullføre hele brettet. */
  readonly completionBonus: number;
  /** Forventet tid per oppgave når brettbonusen regnes ut. */
  readonly targetSecondsPerCell: number;
  /** Poeng per sekund spart mot forventet tid. */
  readonly pointsPerSecondSaved: number;
  /** Tak på brettbonusen for tid. */
  readonly maxBoardTimeBonus: number;
  /** Antall liv i streng modus. */
  readonly lives: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  basePerCell: 100,
  wrongPenalty: 40,
  hintPenalty: { 1: 30, 2: 80 },
  noHintBonus: 25,
  maxTimeBonus: 50,
  fastSeconds: 20,
  slowSeconds: 150,
  completionBonus: 250,
  targetSecondsPerCell: 45,
  pointsPerSecondSaved: 2,
  maxBoardTimeBonus: 400,
  lives: 3,
};

export interface ScoreState {
  /**
   * Summen har med vilje ingen bunn. Med et gulv på null ville et hint vært
   * gratis for den som allerede sto på null, og det er nettopp tidlig i et
   * brett man har lyst til å be om hjelp. En negativ sum er tydelig
   * tilbakemelding, ikke en feiltilstand.
   */
  readonly points: number;
  /** Bare i bruk i streng modus. */
  readonly livesLeft: number;
  readonly hintsUsed: number;
  readonly mistakes: number;
  readonly solvedCells: number;
}

export function createScoreState(config: ScoringConfig): ScoreState {
  return {
    points: 0,
    livesLeft: config.lives,
    hintsUsed: 0,
    mistakes: 0,
    solvedCells: 0,
  };
}

/**
 * Tidsbonus for én celle. Full bonus opp til fastSeconds, deretter jevnt
 * fallende til null ved slowSeconds.
 */
export function timeBonus(config: ScoringConfig, seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= config.fastSeconds) return config.maxTimeBonus;
  if (seconds >= config.slowSeconds) return 0;
  const span = config.slowSeconds - config.fastSeconds;
  const left = config.slowSeconds - seconds;
  return Math.round((left / span) * config.maxTimeBonus);
}

export interface CellAward {
  seconds: number;
  hintLevel: HintLevel;
}

/** Poengene en riktig celle er verdt. */
export function cellAward(config: ScoringConfig, { seconds, hintLevel }: CellAward): number {
  // Har man sett fasiten, er verken tid eller hintbonus fortjent.
  if (hintLevel >= 2) return config.basePerCell;
  if (hintLevel === 1) return config.basePerCell + timeBonus(config, seconds);
  return config.basePerCell + timeBonus(config, seconds) + config.noHintBonus;
}

export function awardCell(
  state: ScoreState,
  config: ScoringConfig,
  award: CellAward,
): ScoreState {
  return {
    ...state,
    points: state.points + cellAward(config, award),
    solvedCells: state.solvedCells + 1,
  };
}

/** Trekk for et feil svar. Koster liv bare i streng modus. */
export function chargeMistake(
  state: ScoreState,
  config: ScoringConfig,
  mode: ErrorMode,
): ScoreState {
  return {
    ...state,
    points: state.points - config.wrongPenalty,
    mistakes: state.mistakes + 1,
    livesLeft: mode === 'streng' ? Math.max(0, state.livesLeft - 1) : state.livesLeft,
  };
}

export function chargeHint(
  state: ScoreState,
  config: ScoringConfig,
  level: 1 | 2,
): ScoreState {
  return {
    ...state,
    points: state.points - config.hintPenalty[level],
    hintsUsed: state.hintsUsed + 1,
  };
}

/** Bonus for å bruke kortere tid på brettet enn forventet. */
export function boardTimeBonus(
  config: ScoringConfig,
  seconds: number,
  taskCount: number,
): number {
  const target = taskCount * config.targetSecondsPerCell;
  const saved = target - seconds;
  if (saved <= 0) return 0;
  return Math.min(config.maxBoardTimeBonus, Math.round(saved * config.pointsPerSecondSaved));
}

/**
 * Hvor mye et nivå er verdt.
 *
 * Samme antall riktige celler gir flere poeng jo hardere stoffet er.
 */
export const LEVEL_MULTIPLIER: Readonly<Record<Level, number>> = {
  enkel: 1,
  middels: 1.4,
  vanskelig: 1.9,
  ultra: 2.5,
};

export interface BoardAwardInput {
  /** Poengene som ble tjent inn underveis, før bonus og multiplikator. */
  rawPoints: number;
  /** True bare når hele brettet er løst. */
  completed: boolean;
  /** Tid brukt på brettet. */
  seconds: number;
  /** Antall celler med oppgave. */
  taskCount: number;
  level: Level;
}

/**
 * Poengene et ferdigspilt brett legger til på totalen.
 *
 * Et halvferdig brett gir det spilleren faktisk tjente inn underveis, altså
 * omtrent halvparten av celleposengene. Men fullførtbonusen og tidsbonusen
 * faller bort, så utbyttet blir likevel litt mindre enn halvparten av det et
 * fullført brett ville gitt. Det er nettopp den forskjellen som gjør det verdt
 * å spille brettet ferdig.
 */
export function boardAward(config: ScoringConfig, input: BoardAwardInput): number {
  const bonus = input.completed
    ? config.completionBonus + boardTimeBonus(config, input.seconds, input.taskCount)
    : 0;
  return Math.round((input.rawPoints + bonus) * LEVEL_MULTIPLIER[input.level]);
}

/**
 * Taket for et brett: alle celler riktig, ingen hint, ingen feil, og så raskt
 * at både celletidsbonusen og bretttidsbonusen blir full.
 *
 * Brukes i oppsettet for å vise hva brettet er verdt før man starter. Det er
 * et tak, ikke en forventning, og bør merkes deretter i teksten.
 */
export function maxBoardScore(
  config: ScoringConfig,
  taskCount: number,
  level: Level,
): number {
  const perCelle = config.basePerCell + config.maxTimeBonus + config.noHintBonus;
  const bonus = config.completionBonus + boardTimeBonus(config, 0, taskCount);
  return Math.round((taskCount * perCelle + bonus) * LEVEL_MULTIPLIER[level]);
}

export interface Rank {
  id: string;
  label: string;
  /** Poengsummen som trengs for å nå dette trinnet. */
  from: number;
}

/** Trinnene man jobber seg oppover etter hvert som totalen vokser. */
export const RANKS: readonly Rank[] = [
  { id: 'nybegynner', label: 'Nybegynner', from: 0 },
  { id: 'ovet', label: 'Øvet', from: 2_500 },
  { id: 'god', label: 'God', from: 10_000 },
  { id: 'sterk', label: 'Sterk', from: 25_000 },
  { id: 'veteran', label: 'Veteran', from: 60_000 },
  { id: 'mester', label: 'Mester', from: 120_000 },
];

export function rankFor(points: number): Rank {
  let funnet = RANKS[0] as Rank;
  for (const rank of RANKS) {
    if (points >= rank.from) funnet = rank;
  }
  return funnet;
}

/** Neste trinn, eller null når man står på det høyeste. */
export function nextRank(points: number): Rank | null {
  return RANKS.find((rank) => rank.from > points) ?? null;
}

/** Hvor langt man er kommet mot neste trinn, 0 til 1. */
export function rankProgress(points: number): number {
  const nå = rankFor(points);
  const neste = nextRank(points);
  if (neste === null) return 1;
  const spenn = neste.from - nå.from;
  if (spenn <= 0) return 1;
  return Math.min(1, Math.max(0, (points - nå.from) / spenn));
}

/** Slutt i streng modus: livene er brukt opp. */
export function isOutOfLives(state: ScoreState, mode: ErrorMode): boolean {
  return mode === 'streng' && state.livesLeft <= 0;
}
