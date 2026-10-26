export interface Vote {
  voterId: string;
  /** Card value from the deck, e.g. "5", "0.5", "?" or "break". */
  value: string;
}

export type ConsensusState =
  | "A_consensus"
  | "B_moderate"
  | "C_high"
  | "D_insufficient";

export type DivergencePattern =
  | "unanimous"
  | "adjacent"
  | "outlier"
  | "polarized"
  | "wide"
  | "insufficient";

export type AnalysisFlag = "high_uncertainty" | "large_item" | "high_risk" | "break_requested";

export type QuestionId =
  | "lower_vs_higher"
  | "testing_deployment"
  | "outlier_perspective"
  | "dependencies"
  | "risks_edge_cases"
  | "shared_scope"
  | "same_approach"
  | "acceptance_criteria"
  | "split_item"
  | "missing_info"
  | "clarify_or_spike"
  // Risk deck
  | "outlier_knowledge"
  | "how_to_verify"
  | "what_breaks"
  | "criteria_for_newcomer"
  | "reduce_risk";

export interface Question {
  id: QuestionId;
  /** Card values the question refers to (e.g. lower/higher, outlier values). */
  values?: string[];
  /** Voters the question is addressed to (outlier questions). */
  voterIds?: string[];
}

export interface VoteCounts {
  numeric: number;
  unknown: number;
  break: number;
  total: number;
}

export interface VoteStats {
  mean: number;
  median: number;
  /** All most-voted numeric values; empty when there is no mode. */
  modes: number[];
  min: number;
  max: number;
  range: number;
}

export interface DistributionEntry {
  value: string;
  count: number;
}

export interface Recommendation {
  /** Actual median of numeric votes; may not be a card in the deck. */
  median: number;
  /** Card closest to the median; ties round up. */
  card: string;
}

export interface Outlier {
  voterId: string;
  value: string;
}

export interface RoundAnalysis {
  counts: VoteCounts;
  stats: VoteStats | null;
  /** Every card of the deck, in deck order, with its vote count. */
  distribution: DistributionEntry[];
  recommendation: Recommendation | null;
  state: ConsensusState;
  pattern: DivergencePattern;
  /** Distance between the lowest and highest numeric vote, in deck steps. */
  spreadSteps: number;
  outliers: Outlier[];
  flags: AnalysisFlag[];
  questions: Question[];
}
