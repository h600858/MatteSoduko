/**
 * Adaptiv vekting av oppgavemaler.
 *
 * Maler du bommer ofte på, eller bruker lang tid på, skal trekkes oftere.
 * Maler du treffer raskt og sikkert skal trekkes sjeldnere, men aldri
 * forsvinne helt.
 *
 * Hele modulen er én ren funksjon med en konfigurasjon ved siden av, nettopp
 * for at den skal være lett å bytte ut med noe mer avansert senere. Den vet
 * ingenting om brett, celler eller UI: inn går statistikk, ut går vekter som
 * registeret allerede tar imot.
 */
import type { Progress, TemplateStats } from './progress.ts';
import { accuracy, averageMs } from './progress.ts';

export interface AdaptiveConfig {
  /** Vekten en mal har når vi ikke vet noe om den ennå. */
  readonly baseWeight: number;
  /** Nedre grense. En mestret mal skal bli sjeldnere, ikke borte. */
  readonly minWeight: number;
  /** Øvre grense, så én svak mal ikke kaprer hele brettet. */
  readonly maxWeight: number;
  /** Hvor mye full bomprosent løfter vekten. */
  readonly missInfluence: number;
  /** Hvor mye det å være dobbelt så treg som referansen løfter vekten. */
  readonly slowInfluence: number;
  /** Hvor mye en rask og sikker mal dempes. */
  readonly masteryRelief: number;
  /** Vekt for maler som aldri er sett. Over baseWeight, så nytt stoff kommer fram. */
  readonly noveltyWeight: number;
  /** Antall forsøk før statistikken tas helt på alvor. */
  readonly confidenceAttempts: number;
}

export const DEFAULT_ADAPTIVE: AdaptiveConfig = {
  baseWeight: 1,
  minWeight: 0.35,
  maxWeight: 6,
  missInfluence: 3,
  slowInfluence: 1.5,
  masteryRelief: 0.5,
  noveltyWeight: 1.6,
  confidenceAttempts: 4,
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Referansetiden vi måler tregheten mot: medianen av gjennomsnittstidene.
 *
 * Medianen er selvkalibrerende. Et fast sekundtall ville vært feil for både
 * den som løser 4x4 i hodet og den som jobber seg gjennom 9x9 med penn.
 */
export function referenceMs(progress: Progress): number | null {
  const times = Object.values(progress.templates)
    .map((stats) => averageMs(stats))
    .filter((ms): ms is number => ms !== null && ms > 0)
    .sort((a, b) => a - b);

  if (times.length === 0) return null;
  const middle = Math.floor(times.length / 2);
  if (times.length % 2 === 1) return times[middle] ?? null;
  const low = times[middle - 1];
  const high = times[middle];
  if (low === undefined || high === undefined) return null;
  return (low + high) / 2;
}

export interface WeightBreakdown {
  templateId: string;
  weight: number;
  /** 0 til 1. Hvor mye statistikken er å stole på ennå. */
  confidence: number;
  /** 0 til 1. Andel forsøk som ikke endte riktig. */
  missRate: number;
  /** 0 til 1. Hvor mye tregere enn referansen malen er. */
  slowness: number;
  /** Null når malen aldri er sett. */
  stats: TemplateStats | null;
}

export interface WeightOptions {
  /** Alle maler registeret kjenner. Også de som aldri er spilt. */
  templateIds: readonly string[];
  config?: AdaptiveConfig;
}

/**
 * Regner ut vekt og de tallene vekten bygger på, per mal.
 *
 * Skilt ut fra templateWeights() slik at statistikkskjermen kan vise hvorfor en
 * mal kommer oftere, ikke bare at den gjør det.
 */
export function weightBreakdowns(
  progress: Progress,
  { templateIds, config = DEFAULT_ADAPTIVE }: WeightOptions,
): WeightBreakdown[] {
  const reference = referenceMs(progress);

  return templateIds.map((templateId): WeightBreakdown => {
    const stats = progress.templates[templateId];

    if (stats === undefined || stats.attempts === 0) {
      return {
        templateId,
        weight: clamp(config.noveltyWeight, config.minWeight, config.maxWeight),
        confidence: 0,
        missRate: 0,
        slowness: 0,
        stats: stats ?? null,
      };
    }

    const hitRate = accuracy(stats) ?? 0;
    const missRate = clamp(1 - hitRate, 0, 1);

    const average = averageMs(stats);
    const slowness =
      reference === null || reference <= 0 || average === null
        ? 0
        : clamp((average - reference) / reference, 0, 1);

    const confidence = clamp(stats.attempts / config.confidenceAttempts, 0, 1);

    // Sliter du med malen, løftes den. Er du både rask og sikker, dempes den.
    const struggle = config.missInfluence * missRate + config.slowInfluence * slowness;
    const mastery = config.masteryRelief * (1 - missRate) * (1 - slowness);
    const weight = clamp(
      config.baseWeight + confidence * (struggle - mastery),
      config.minWeight,
      config.maxWeight,
    );

    return { templateId, weight, confidence, missRate, slowness, stats };
  });
}

/**
 * Vekt per mal-id, klar til å sendes rett inn i generateBoard.
 *
 * Høyere vekt gir større sjanse for at malen velges til en celle.
 */
export function templateWeights(
  progress: Progress,
  options: WeightOptions,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const row of weightBreakdowns(progress, options)) {
    weights.set(row.templateId, row.weight);
  }
  return weights;
}
