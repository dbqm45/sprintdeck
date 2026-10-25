import { describe, expect, it } from "vitest";
import { FIBONACCI_DECK } from "@/lib/deck";
import { parseVotes } from "./parse-votes";

describe("parseVotes", () => {
  it("parses named and unnamed votes", () => {
    const result = parseVotes("Anna:3, 5\nBen: ?", FIBONACCI_DECK);
    expect(result.votes).toEqual([
      { voterId: "v1", value: "3" },
      { voterId: "v2", value: "5" },
      { voterId: "v3", value: "?" },
    ]);
    expect(result.names).toEqual({ v1: "Anna", v2: "Voter 2", v3: "Ben" });
    expect(result.invalid).toEqual([]);
  });

  it("understands aliases for ½ and the break card", () => {
    const result = parseVotes("½; 1/2; ☕; coffee", FIBONACCI_DECK);
    expect(result.votes.map((v) => v.value)).toEqual(["0.5", "0.5", "break", "break"]);
  });

  it("collects entries that are not in the deck", () => {
    const result = parseVotes("3, 4, Cleo:100", FIBONACCI_DECK);
    expect(result.votes).toHaveLength(1);
    expect(result.invalid).toEqual(["4", "Cleo:100"]);
  });
});
