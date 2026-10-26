import { type Card, type Deck, FIBONACCI_DECK, findCard, numericCards } from "@/lib/deck";
import { type ConsensusConfig, configForDeck } from "./config";
import { pickQuestions } from "./questions";
import type {
  AnalysisFlag,
  ConsensusState,
  DivergencePattern,
  Outlier,
  RoundAnalysis,
  Vote,
  VoteStats,
} from "./types";

interface NumericVote {
  vote: Vote;
  card: Card;
  /** Position of the card on the deck's numeric scale. */
  step: number;
}

interface Classification {
  state: ConsensusState;
  pattern: DivergencePattern;
  outliers: Outlier[];
}

/**
 * Analyses the votes of a revealed round: statistics, a recommended card,
 * the kind of divergence and questions that help the team discuss it.
 *
 * Distances are measured in deck steps rather than points, because the
 * Fibonacci scale is roughly logarithmic: 1 vs 2 and 8 vs 13 are the same
 * amount of disagreement. The same holds for ordinal decks such as Risk,
 * whose thresholds come from `configForDeck`.
 */
export function analyzeRound(
  votes: readonly Vote[],
  deck: Deck = FIBONACCI_DECK,
  config: ConsensusConfig = configForDeck(deck),
): RoundAnalysis {
  const scale = numericCards(deck);
  const stepOf = new Map(scale.map((card, index) => [card.value, index]));

  const numeric: NumericVote[] = [];
  let unknown = 0;
  let breaks = 0;
  for (const vote of votes) {
    const card = findCard(deck, vote.value);
    if (!card) throw new Error(`Unknown card value: ${vote.value}`);
    if (card.kind === "numeric") {
      numeric.push({ vote, card, step: stepOf.get(card.value)! });
    } else if (card.kind === "unknown") {
      unknown++;
    } else {
      breaks++;
    }
  }
  numeric.sort((a, b) => a.step - b.step);

  const counts = {
    numeric: numeric.length,
    unknown,
    break: breaks,
    total: votes.length,
  };
  const distribution = deck.cards.map((card) => ({
    value: card.value,
    count: votes.filter((vote) => vote.value === card.value).length,
  }));
  const stats = numeric.length > 0 ? computeStats(numeric.map((n) => n.card.points!)) : null;
  const spreadSteps =
    numeric.length > 0 ? numeric[numeric.length - 1].step - numeric[0].step : 0;

  const flags: AnalysisFlag[] = [];
  const estimating = numeric.length + unknown;
  if (unknown > 0 && unknown / estimating >= config.highUncertaintyShare) {
    flags.push("high_uncertainty");
  }
  if (breaks > 0) flags.push("break_requested");

  const insufficient = numeric.length < config.minNumericVotes || unknown > numeric.length;
  if (insufficient || !stats) {
    return {
      counts,
      stats,
      distribution,
      recommendation: null,
      state: "D_insufficient",
      pattern: "insufficient",
      spreadSteps,
      outliers: [],
      flags,
      questions: pickQuestions({ pattern: "insufficient", flags, numeric: [], outliers: [] }, config),
    };
  }

  const recommendedCard = nearestCard(scale, stats.median);
  if (config.largeItemPoints !== null && recommendedCard.points! >= config.largeItemPoints) {
    flags.push("large_item");
  }
  if (config.highRiskPoints !== null && recommendedCard.points! >= config.highRiskPoints) {
    flags.push("high_risk");
  }

  const { state, pattern, outliers } = classify(numeric, spreadSteps, config);

  return {
    counts,
    stats,
    distribution,
    recommendation: { median: stats.median, card: recommendedCard.value },
    state,
    pattern,
    spreadSteps,
    outliers,
    flags,
    questions: pickQuestions(
      { pattern, flags, numeric: numeric.map((n) => n.card.value), outliers },
      config,
    ),
  };
}

function classify(
  numeric: NumericVote[],
  spreadSteps: number,
  config: ConsensusConfig,
): Classification {
  if (spreadSteps === 0) {
    return { state: "A_consensus", pattern: "unanimous", outliers: [] };
  }

  const steps = numeric.map((n) => n.step);
  const used = [...new Set(steps)];
  const total = steps.length;
  const outlierSteps = new Set<number>();

  // A gap is an unused card between two used ones. Each gap splits the votes
  // into two sides: a small side is a few outliers, two substantial sides
  // are two camps that see the item differently.
  for (let i = 0; i < used.length - 1; i++) {
    if (used[i + 1] - used[i] < config.minGapSteps) continue;
    const below = steps.filter((step) => step <= used[i]).length;
    const above = total - below;
    const minority = Math.min(below, above);
    const isOutlierSide =
      minority / total < config.outlierMaxShare ||
      (minority === 1 && total >= config.singleOutlierMinVotes);
    if (!isOutlierSide) {
      return { state: "C_high", pattern: "polarized", outliers: [] };
    }
    const side = below < above ? used.slice(0, i + 1) : used.slice(i + 1);
    side.forEach((step) => outlierSteps.add(step));
  }

  if (outlierSteps.size === 0) {
    return spreadSteps <= config.maxClusteredSpread
      ? { state: "B_moderate", pattern: "adjacent", outliers: [] }
      : { state: "C_high", pattern: "wide", outliers: [] };
  }

  const outlierVotes = numeric.filter((n) => outlierSteps.has(n.step));
  const core = numeric.filter((n) => !outlierSteps.has(n.step));
  const coreSpread = core[core.length - 1].step - core[0].step;
  const outliers = outlierVotes.map((n) => ({ voterId: n.vote.voterId, value: n.card.value }));

  if (outlierVotes.length / total > config.maxOutlierShare || coreSpread > config.maxClusteredSpread) {
    return { state: "C_high", pattern: "wide", outliers };
  }
  return { state: "B_moderate", pattern: "outlier", outliers };
}

export function computeStats(points: readonly number[]): VoteStats {
  const sorted = [...points].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const frequency = new Map<number, number>();
  for (const p of sorted) frequency.set(p, (frequency.get(p) ?? 0) + 1);
  const maxCount = Math.max(...frequency.values());
  const candidates = [...frequency.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([value]) => value);
  // When every value got the same number of votes nothing stands out.
  const modes = candidates.length === frequency.size && frequency.size > 1 ? [] : candidates;

  return {
    mean: sorted.reduce((sum, p) => sum + p, 0) / n,
    median,
    modes,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
  };
}

/** Card closest to `points`; on a tie the higher card wins. */
export function nearestCard(scale: readonly Card[], points: number): Card {
  let best = scale[0];
  for (const card of scale) {
    if (Math.abs(card.points! - points) <= Math.abs(best.points! - points)) best = card;
  }
  return best;
}
