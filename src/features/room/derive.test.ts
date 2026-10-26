import { describe, expect, it } from "vitest";
import { analyzeRevealed, currentItem, latestRound, summarize, voters } from "./derive";
import { toCsv, toMarkdown } from "./export";
import { item, revealed, roomState } from "./fixtures";

const session = roomState({
  room: { current_item_id: "item-3" },
  items: [
    item("item-1", 1, { title: "Checkout", status: "estimated", final_estimate: "3" }),
    item("item-2", 2, {
      title: "Payment retries",
      status: "estimated",
      final_estimate: "5",
      notes: [{ id: "n1", author_id: "p-anna", content: "Dunning emails need legal review", created_at: "x" }],
    }),
    item("item-3", 3, { title: "Spike, Stripe | Tax", status: "skipped" }),
  ],
  rounds: [
    revealed("r1", "item-1", 1, { "p-anna": "3", "p-ben": "3" }),
    revealed("r2", "item-2", 1, { "p-anna": "3", "p-ben": "8" }),
    revealed("r3", "item-2", 2, { "p-anna": "5", "p-ben": "5" }),
  ],
});

describe("room derivations", () => {
  it("finds the current item and the latest round", () => {
    expect(currentItem(session)?.title).toBe("Spike, Stripe | Tax");
    expect(latestRound(session, "item-2")?.id).toBe("r3");
    expect(latestRound(session, "item-3")).toBeUndefined();
  });

  it("counts hosts and voters, not observers", () => {
    expect(voters(session).map((p) => p.display_name)).toEqual(["Anna", "Ben"]);
  });

  it("analyzes a revealed round with the room's deck", () => {
    expect(analyzeRevealed(session, session.rounds[1]).state).toBe("C_high");
  });

  it("summarizes the session", () => {
    const summary = summarize(session);
    expect(summary).toMatchObject({
      estimated: 2,
      skipped: 1,
      totalPoints: 8,
      firstRoundConsensus: 1,
      roundsPerItem: 1.5,
      highRisk: 0,
    });
    expect(summary.rows.map((row) => row.analysis?.state ?? null)).toEqual(["A_consensus", "A_consensus", null]);
  });

  it("counts high-risk items on the Risk deck", () => {
    const risky = roomState({
      room: { deck: "risk" },
      items: [
        item("a", 1, { status: "estimated", final_estimate: "high" }),
        item("b", 2, { status: "estimated", final_estimate: "low" }),
      ],
    });
    expect(summarize(risky).highRisk).toBe(1);
  });
});

describe("export", () => {
  it("writes a Markdown table with notes and escaped pipes", () => {
    expect(toMarkdown(session)).toBe(
      [
        "# Sprint 42 refinement",
        "",
        "| # | Item | Estimate | Rounds | Consensus |",
        "|---|---|---|---|---|",
        "| 1 | Checkout | 3 | 1 | Full consensus |",
        "| 2 | Payment retries — Dunning emails need legal review | 5 | 2 | Full consensus |",
        "| 3 | Spike, Stripe \\| Tax | – | 0 | – |",
        "",
      ].join("\n"),
    );
  });

  it("writes CSV with quoting", () => {
    const lines = toCsv(session).trim().split("\n");
    expect(lines[0]).toBe("position,title,status,estimate,rounds,consensus,notes");
    expect(lines[1]).toBe("1,Checkout,estimated,3,1,Full consensus,");
    expect(lines[3]).toBe('3,"Spike, Stripe | Tax",skipped,,0,,');
  });
});
