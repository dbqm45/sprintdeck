import { findCard, type Deck } from "@/lib/deck";

/** Card label for a stored value (e.g. "0.5" → "½"); falls back to the value itself. */
export function cardLabel(deck: Deck, value: string): string {
  return findCard(deck, value)?.label ?? value;
}

/** Points without trailing zeros: 4 → "4", 4.5 → "4.5", 4.25 → "4.25". */
export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

/** Votes needed for half of the team to agree. */
export function halfOf(votes: number): number {
  return Math.ceil(votes / 2);
}
