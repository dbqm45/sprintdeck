import type { Vote } from "@/lib/consensus";
import { type Deck, findCard } from "@/lib/deck";

const ALIASES: Record<string, string> = {
  "½": "0.5",
  "1/2": "0.5",
  ",5": "0.5",
  "☕": "break",
  coffee: "break",
  pause: "break",
  "very high": "very_high",
  "very-high": "very_high",
};

export interface ParsedVotes {
  votes: Vote[];
  /** voterId → display name */
  names: Record<string, string>;
  invalid: string[];
}

/**
 * Parses "Anna:3, Ben:5, 8, ?" into votes. Entries are separated by commas,
 * semicolons or new lines; unnamed votes get "Voter N".
 */
export function parseVotes(input: string, deck: Deck): ParsedVotes {
  const votes: Vote[] = [];
  const names: Record<string, string> = {};
  const invalid: string[] = [];

  const entries = input
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const separator = entry.lastIndexOf(":");
    const name = separator > 0 ? entry.slice(0, separator).trim() : "";
    const raw = (separator > 0 ? entry.slice(separator + 1) : entry).trim().toLowerCase();
    const value = ALIASES[raw] ?? raw;

    if (!findCard(deck, value)) {
      invalid.push(entry);
      continue;
    }
    const voterId = `v${votes.length + 1}`;
    votes.push({ voterId, value });
    names[voterId] = name || `Voter ${votes.length}`;
  }

  return { votes, names, invalid };
}
