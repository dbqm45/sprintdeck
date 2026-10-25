/**
 * Thresholds of the Consensus Engine. Kept in one place so they can be
 * calibrated against real sessions without touching the algorithm.
 */
export const CONSENSUS_CONFIG = {
  /** Fewer numeric votes than this → not enough data. */
  minNumericVotes: 2,
  /** Two used cards this many steps apart (an unused card between them) form a gap. */
  minGapSteps: 2,
  /** A side of a gap holding less than this share of votes is treated as outliers. */
  outlierMaxShare: 0.25,
  /** From this many numeric votes a single voter across a gap is always an outlier. */
  singleOutlierMinVotes: 3,
  /** More outliers than this share in total means the votes are widely spread. */
  maxOutlierShare: 1 / 3,
  /** Numeric votes spanning at most this many steps count as clustered. */
  maxClusteredSpread: 2,
  /** Share of "?" among estimating votes that raises the uncertainty flag. */
  highUncertaintyShare: 1 / 3,
  /** Recommended points at or above this raise the large item flag. */
  largeItemPoints: 13,
  /** Maximum number of questions suggested at once. */
  maxQuestions: 3,
} as const;

export type ConsensusConfig = typeof CONSENSUS_CONFIG;
