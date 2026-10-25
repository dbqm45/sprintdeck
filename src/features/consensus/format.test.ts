import { describe, expect, it } from "vitest";
import { FIBONACCI_DECK } from "@/lib/deck";
import { cardLabel, formatPoints, halfOf } from "./format";

describe("cardLabel", () => {
  it("uses the deck label", () => {
    expect(cardLabel(FIBONACCI_DECK, "0.5")).toBe("½");
    expect(cardLabel(FIBONACCI_DECK, "break")).toBe("☕");
  });

  it("falls back to the raw value", () => {
    expect(cardLabel(FIBONACCI_DECK, "42")).toBe("42");
  });
});

describe("formatPoints", () => {
  it.each([
    [4, "4"],
    [4.5, "4.5"],
    [4.25, "4.25"],
  ])("%s → %s", (n, expected) => {
    expect(formatPoints(n)).toBe(expected);
  });
});

describe("halfOf", () => {
  it.each([
    [8, 4],
    [7, 4],
    [1, 1],
  ])("%s votes → %s", (votes, expected) => {
    expect(halfOf(votes)).toBe(expected);
  });
});
