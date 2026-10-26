import { analyzeRound, configForDeck, type RoundAnalysis } from "@/lib/consensus";
import { DECKS, FIBONACCI_DECK, type Deck } from "@/lib/deck";
import type { RoomState } from "@/lib/supabase/rooms";

export type Item = RoomState["items"][number];
export type Round = RoomState["rounds"][number];
export type Participant = RoomState["participants"][number];

export function deckOf(state: RoomState): Deck {
  return DECKS[state.room.deck as keyof typeof DECKS] ?? FIBONACCI_DECK;
}

export function currentItem(state: RoomState): Item | undefined {
  return state.items.find((item) => item.id === state.room.current_item_id);
}

/** Rounds of an item, oldest first. */
export function roundsOf(state: RoomState, itemId: string): Round[] {
  return state.rounds.filter((round) => round.item_id === itemId).sort((a, b) => a.number - b.number);
}

export function latestRound(state: RoomState, itemId: string): Round | undefined {
  return roundsOf(state, itemId).at(-1);
}

/** People who vote: hosts and voters, not observers. */
export function voters(state: RoomState): Participant[] {
  return state.participants.filter((p) => p.role !== "observer");
}

export function isHost(state: RoomState): boolean {
  return state.me.role === "host";
}

export function namesById(state: RoomState): Record<string, string> {
  return Object.fromEntries(state.participants.map((p) => [p.id, p.display_name]));
}

/** Consensus Engine analysis of a revealed round. */
export function analyzeRevealed(state: RoomState, round: Round): RoundAnalysis {
  const votes = round.votes
    .filter((vote): vote is { participant_id: string; value: string } => vote.value !== undefined)
    .map((vote) => ({ voterId: vote.participant_id, value: vote.value }));
  return analyzeRound(votes, deckOf(state));
}

export interface SummaryRow {
  item: Item;
  rounds: number;
  /** Analysis of the last revealed round, if any. */
  analysis: RoundAnalysis | null;
}

export interface Summary {
  rows: SummaryRow[];
  estimated: number;
  skipped: number;
  /** Sum of the estimates in points (meaningless for ordinal decks). */
  totalPoints: number;
  /** Items whose first round was already a full consensus, among estimated ones. */
  firstRoundConsensus: number;
  /** Average number of rounds over estimated items. */
  roundsPerItem: number;
  /** Ordinal decks: estimated items at the high-risk level or above. */
  highRisk: number;
}

export function summarize(state: RoomState): Summary {
  const deck = deckOf(state);
  const { highRiskPoints } = configForDeck(deck);
  const rows = [...state.items]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const rounds = roundsOf(state, item.id);
      const lastRevealed = rounds.filter((round) => round.status === "revealed").at(-1);
      return { item, rounds: rounds.length, analysis: lastRevealed ? analyzeRevealed(state, lastRevealed) : null };
    });

  const estimatedRows = rows.filter((row) => row.item.status === "estimated");
  const pointsOf = (value: string | null) => deck.cards.find((card) => card.value === value)?.points ?? 0;
  const firstRoundConsensus = estimatedRows.filter((row) => {
    const first = roundsOf(state, row.item.id)[0];
    return first?.status === "revealed" && analyzeRevealed(state, first).state === "A_consensus";
  }).length;

  return {
    rows,
    estimated: estimatedRows.length,
    skipped: rows.filter((row) => row.item.status === "skipped").length,
    totalPoints: estimatedRows.reduce((sum, row) => sum + pointsOf(row.item.final_estimate), 0),
    firstRoundConsensus,
    roundsPerItem: estimatedRows.length
      ? estimatedRows.reduce((sum, row) => sum + row.rounds, 0) / estimatedRows.length
      : 0,
    highRisk:
      highRiskPoints === null
        ? 0
        : estimatedRows.filter((row) => pointsOf(row.item.final_estimate) >= highRiskPoints).length,
  };
}
