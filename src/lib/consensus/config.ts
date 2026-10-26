import type { Deck } from "@/lib/deck";

/**
 * Thresholds of the Consensus Engine. Kept in one place so they can be
 * calibrated against real sessions without touching the algorithm.
 * Distances are in deck steps, so a deck with fewer cards needs its own values.
 */
export interface ConsensusConfig {
  /** Fewer numeric votes than this → not enough data. */
  minNumericVotes: number;
  /** Two used cards this many steps apart (an unused card between them) form a gap. */
  minGapSteps: number;
  /** A side of a gap holding less than this share of votes is treated as outliers. */
  outlierMaxShare: number;
  /** From this many numeric votes a single voter across a gap is always an outlier. */
  singleOutlierMinVotes: number;
  /** More outliers than this share in total means the votes are widely spread. */
  maxOutlierShare: number;
  /** Numeric votes spanning at most this many steps count as clustered. */
  maxClusteredSpread: number;
  /** Share of "?" among estimating votes that raises the uncertainty flag. */
  highUncertaintyShare: number;
  /** Recommended points at or above this raise the large item flag; null: the deck doesn't measure size. */
  largeItemPoints: number | null;
  /** Recommended points at or above this raise the high risk flag; null: the deck doesn't measure risk. */
  highRiskPoints: number | null;
  /** Which questions fit the deck: effort (how big is it?) or risk (do we understand it the same way?). */
  questionBank: "effort" | "risk";
  /** Maximum number of questions suggested at once. */
  maxQuestions: number;
}

/** Fibonacci: 9 numeric cards (0 … 21). */
export const CONSENSUS_CONFIG: ConsensusConfig = {
  minNumericVotes: 2,
  minGapSteps: 2,
  outlierMaxShare: 0.25,
  singleOutlierMinVotes: 3,
  maxOutlierShare: 1 / 3,
  maxClusteredSpread: 2,
  highUncertaintyShare: 1 / 3,
  largeItemPoints: 13,
  highRiskPoints: null,
  questionBank: "effort",
  maxQuestions: 3,
};

/**
 * Risk: 4 levels (Low … Very high). Two steps apart is half the scale, so only
 * neighbouring levels count as clustered. A gap still needs one empty level
 * between votes — it can't be smaller.
 */
export const RISK_CONSENSUS_CONFIG: ConsensusConfig = {
  ...CONSENSUS_CONFIG,
  maxClusteredSpread: 1,
  largeItemPoints: null,
  highRiskPoints: 3, // High
  questionBank: "risk",
};

const CONFIG_BY_DECK: Record<string, ConsensusConfig> = {
  fibonacci: CONSENSUS_CONFIG,
  risk: RISK_CONSENSUS_CONFIG,
};

/** Thresholds for a deck; unknown decks use the Fibonacci ones. */
export function configForDeck(deck: Deck): ConsensusConfig {
  return CONFIG_BY_DECK[deck.id] ?? CONSENSUS_CONFIG;
}
