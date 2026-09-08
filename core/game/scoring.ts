/**
 * Poengreglene, som rene funksjoner.
 *
 * Ingenting her vet om brett, celler eller tid som går. Alt tas inn som tall,
 * slik at reglene kan justeres og testes uten å røre spillmotoren.
 */

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

export function awardCompletion(
  state: ScoreState,
  config: ScoringConfig,
  seconds: number,
  taskCount: number,
): ScoreState {
  return {
    ...state,
    points: state.points + config.completionBonus + boardTimeBonus(config, seconds, taskCount),
  };
}

/** Slutt i streng modus: livene er brukt opp. */
export function isOutOfLives(state: ScoreState, mode: ErrorMode): boolean {
  return mode === 'streng' && state.livesLeft <= 0;
}
