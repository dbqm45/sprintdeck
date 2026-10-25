export type CardKind = "numeric" | "unknown" | "break";

export interface Card {
  /** Stable value stored in the database. */
  value: string;
  /** Text shown on the card. */
  label: string;
  kind: CardKind;
  /** Numeric worth of the card; only set for numeric cards. */
  points?: number;
}

export interface Deck {
  id: string;
  name: string;
  cards: readonly Card[];
}

export const FIBONACCI_DECK: Deck = {
  id: "fibonacci",
  name: "Fibonacci",
  cards: [
    { value: "0", label: "0", kind: "numeric", points: 0 },
    { value: "0.5", label: "½", kind: "numeric", points: 0.5 },
    { value: "1", label: "1", kind: "numeric", points: 1 },
    { value: "2", label: "2", kind: "numeric", points: 2 },
    { value: "3", label: "3", kind: "numeric", points: 3 },
    { value: "5", label: "5", kind: "numeric", points: 5 },
    { value: "8", label: "8", kind: "numeric", points: 8 },
    { value: "13", label: "13", kind: "numeric", points: 13 },
    { value: "21", label: "21", kind: "numeric", points: 21 },
    { value: "?", label: "?", kind: "unknown" },
    { value: "break", label: "☕", kind: "break" },
  ],
};

export function findCard(deck: Deck, value: string): Card | undefined {
  return deck.cards.find((card) => card.value === value);
}

/** Numeric cards in ascending order — the scale used to measure distance. */
export function numericCards(deck: Deck): Card[] {
  return deck.cards
    .filter((card) => card.kind === "numeric")
    .sort((a, b) => a.points! - b.points!);
}
