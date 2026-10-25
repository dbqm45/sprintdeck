import { describe, expect, it } from "vitest";
import { FIBONACCI_DECK, numericCards } from "@/lib/deck";
import { analyzeRound, computeStats, nearestCard } from "./analyze";
import type { Vote } from "./types";

const votes = (...values: string[]): Vote[] =>
  values.map((value, i) => ({ voterId: `v${i + 1}`, value }));

describe("analyzeRound — divergence classification", () => {
  it.each([
    // votes, state, pattern
    [["5", "5", "5", "5"], "A_consensus", "unanimous"],
    [["3", "5", "5", "5"], "B_moderate", "adjacent"],
    [["3", "5", "8", "5"], "B_moderate", "adjacent"],
    [["0.5", "1"], "B_moderate", "adjacent"],
    [["3", "3", "8", "8"], "C_high", "polarized"],
    [["3", "8"], "C_high", "polarized"],
    [["1", "2", "3", "5", "13", "21"], "C_high", "polarized"],
    [["2", "3", "5", "8", "13"], "C_high", "wide"],
    [["2", "3", "5", "8"], "C_high", "wide"],
    [["2", "2", "5", "5", "5", "5", "5", "21", "21"], "C_high", "wide"],
    [["5", "5", "5", "5", "21"], "B_moderate", "outlier"],
    [["5", "5", "21"], "B_moderate", "outlier"],
    [["0", "5", "5", "5", "5", "5", "5", "5", "21"], "B_moderate", "outlier"],
    [["5"], "D_insufficient", "insufficient"],
    [["5", "?", "?", "?"], "D_insufficient", "insufficient"],
    [["3", "5", "?", "?"], "B_moderate", "adjacent"],
    [["13", "21", "21"], "B_moderate", "adjacent"],
    [[], "D_insufficient", "insufficient"],
  ] as const)("%j → %s / %s", (values, state, pattern) => {
    const result = analyzeRound(votes(...values));
    expect(result.state).toBe(state);
    expect(result.pattern).toBe(pattern);
  });

  it("reports outliers with their voters", () => {
    const result = analyzeRound(votes("5", "5", "5", "5", "21"));
    expect(result.outliers).toEqual([{ voterId: "v5", value: "21" }]);
    expect(result.questions[0]).toEqual({
      id: "outlier_perspective",
      values: ["21"],
      voterIds: ["v5"],
    });
  });

  it("measures spread in deck steps", () => {
    expect(analyzeRound(votes("1", "2")).spreadSteps).toBe(1);
    expect(analyzeRound(votes("8", "13")).spreadSteps).toBe(1);
    expect(analyzeRound(votes("0", "21")).spreadSteps).toBe(8);
  });
});

describe("analyzeRound — statistics and recommendation", () => {
  it("ignores ? and break cards in numeric statistics", () => {
    const result = analyzeRound(votes("3", "5", "?", "break"));
    expect(result.counts).toEqual({ numeric: 2, unknown: 1, break: 1, total: 4 });
    expect(result.stats).toMatchObject({ mean: 4, median: 4, min: 3, max: 5, range: 2 });
  });

  it("recommends the card closest to the median, rounding ties up", () => {
    const result = analyzeRound(votes("3", "5"));
    expect(result.recommendation).toEqual({ median: 4, card: "5" });
    expect(analyzeRound(votes("0.5", "1")).recommendation).toEqual({ median: 0.75, card: "1" });
    expect(analyzeRound(votes("5", "8", "8")).recommendation).toEqual({ median: 8, card: "8" });
  });

  it("gives no recommendation when data is insufficient", () => {
    expect(analyzeRound(votes("8", "?", "?")).recommendation).toBeNull();
  });

  it("returns the distribution for every card in deck order", () => {
    const result = analyzeRound(votes("5", "5", "?"));
    expect(result.distribution.map((d) => d.value)).toEqual(FIBONACCI_DECK.cards.map((c) => c.value));
    expect(result.distribution.find((d) => d.value === "5")?.count).toBe(2);
    expect(result.distribution.find((d) => d.value === "?")?.count).toBe(1);
  });

  it("rejects values that are not in the deck", () => {
    expect(() => analyzeRound(votes("4"))).toThrow("Unknown card value: 4");
  });
});

describe("analyzeRound — flags and questions", () => {
  it("flags high uncertainty when many voters cannot estimate", () => {
    const result = analyzeRound(votes("3", "5", "?", "?"));
    expect(result.flags).toContain("high_uncertainty");
    expect(result.questions.map((q) => q.id)).toEqual([
      "lower_vs_higher",
      "testing_deployment",
      "missing_info",
    ]);
  });

  it("asks what is missing when the round is insufficient because of ?", () => {
    const result = analyzeRound(votes("5", "?", "?"));
    expect(result.questions.map((q) => q.id)).toEqual(["missing_info", "clarify_or_spike"]);
  });

  it("flags large items and suggests splitting them", () => {
    const result = analyzeRound(votes("13", "21", "21"));
    expect(result.flags).toContain("large_item");
    expect(result.questions.map((q) => q.id)).toContain("split_item");
  });

  it("flags requested breaks", () => {
    expect(analyzeRound(votes("5", "5", "break")).flags).toEqual(["break_requested"]);
  });

  it("asks no questions on full consensus", () => {
    expect(analyzeRound(votes("8", "8", "8")).questions).toEqual([]);
  });

  it("asks about scope when the team is split into camps", () => {
    const ids = analyzeRound(votes("3", "3", "8", "8")).questions.map((q) => q.id);
    expect(ids).toEqual(["shared_scope", "same_approach", "acceptance_criteria"]);
  });

  it("never repeats a question", () => {
    const ids = analyzeRound(votes("3", "8", "13", "21", "21")).questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("computeStats", () => {
  it("finds every mode", () => {
    expect(computeStats([3, 3, 5, 5, 8]).modes).toEqual([3, 5]);
  });

  it("has no mode when all values are equally common", () => {
    expect(computeStats([3, 5, 8]).modes).toEqual([]);
    expect(computeStats([3, 3, 5, 5]).modes).toEqual([]);
  });

  it("treats a unanimous vote as its own mode", () => {
    expect(computeStats([5, 5]).modes).toEqual([5]);
  });
});

describe("nearestCard", () => {
  const scale = numericCards(FIBONACCI_DECK);

  it.each([
    [4, "5"],
    [6.5, "8"],
    [10.5, "13"],
    [1.5, "2"],
    [0.25, "0.5"],
    [6, "5"],
    [30, "21"],
  ])("%d → %s", (points, card) => {
    expect(nearestCard(scale, points).value).toBe(card);
  });
});
