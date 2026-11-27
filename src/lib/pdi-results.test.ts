import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { RoomState } from "@/lib/supabase/rooms";
import { buildResults, signResults } from "./pdi-results";

const NOW = 1_795_000_000;
const SECRET = "pdi-sprintdeck-test";

const state = {
  room: { id: "r1", slug: "NhkrbG3RxFqo", title: "Discuss with team — 2026-11-27", status: "open", deck: "risk", current_item_id: null, version: 9, created_at: "", last_activity_at: "" },
  me: { participant_id: "p1", role: "host" },
  participants: [
    { id: "p1", display_name: "Ola", role: "host", joined_at: "" },
    { id: "p2", display_name: "Adm", role: "voter", joined_at: "" },
    { id: "p3", display_name: "Ed", role: "voter", joined_at: "" },
  ],
  items: [
    { id: "i1", title: "Gate B2 for CHG-1", description: null, position: 0, status: "estimated", final_estimate: "high", finalized_at: "x",
      notes: [{ id: "n1", author_id: "p1", content: "Security review before B2 <b>", created_at: "" }] },
    { id: "i2", title: "Gate B2 for CHG-2", description: null, position: 1, status: "pending", final_estimate: null, finalized_at: null, notes: [] },
    { id: "i3", title: "Added in the room", description: null, position: 2, status: "estimated", final_estimate: "low", finalized_at: "x", notes: [] },
  ],
  rounds: [
    { id: "o1", item_id: "i1", number: 1, status: "revealed", started_at: "1", revealed_at: "2", my_vote: "high",
      votes: [{ participant_id: "p1", value: "high" }, { participant_id: "p2", value: "high" }, { participant_id: "p3", value: "low" }] },
    { id: "o2", item_id: "i1", number: 2, status: "revealed", started_at: "3", revealed_at: "4", my_vote: "high",
      votes: [{ participant_id: "p1", value: "high" }, { participant_id: "p2", value: "high" }, { participant_id: "p3", value: "high" }] },
  ],
} as unknown as RoomState;

describe("results of a room opened from the pdi agenda", () => {
  it("gives one entry per item with a pdi ref: final card, last revealed votes by card, consensus, rounds, notes", () => {
    const refs = [{ item_id: "i1", external_ref: "evt-1" }, { item_id: "i2", external_ref: "evt-2" }];
    const r = buildResults(state, refs, { roomUrl: "http://127.0.0.1:3000/r/NhkrbG3RxFqo", now: NOW });
    expect(r.v).toBe(1);
    expect(r.room).toEqual({ title: "Discuss with team — 2026-11-27", url: "http://127.0.0.1:3000/r/NhkrbG3RxFqo", deck: "Risk" });
    expect(r.exp - NOW).toBeGreaterThan(0);
    expect(r.items).toHaveLength(2);
    const [first, second] = r.items;
    expect(first).toMatchObject({ ref: "evt-1", title: "Gate B2 for CHG-1", status: "estimated", final: "High", rounds: 2, votes: { High: 3 } });
    expect(typeof first.consensus).toBe("string");
    expect(first.notes).toEqual(["Security review before B2 <b>"]);
    expect(second).toMatchObject({ ref: "evt-2", status: "pending", final: null, rounds: 0, votes: {}, consensus: null, notes: [] });
  });

  it("signs exactly what it sends, so pdi can check it with the shared secret", () => {
    const r = buildResults(state, [{ item_id: "i1", external_ref: "evt-1" }], { roomUrl: "http://x/r/a", now: NOW });
    const { d, s } = signResults(SECRET, r);
    expect(s).toBe(createHmac("sha256", SECRET).update(d).digest("hex"));
    expect(JSON.parse(Buffer.from(d, "base64url").toString("utf8"))).toEqual(r);
  });

  it("keeps notes short so the link stays small", () => {
    const long = { ...state, items: [{ ...state.items[0], notes: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, author_id: "p1", content: "x".repeat(900), created_at: "" })) }] } as RoomState;
    const r = buildResults(long, [{ item_id: "i1", external_ref: "evt-1" }], { roomUrl: "http://x/r/a", now: NOW });
    expect(r.items[0].notes).toHaveLength(3);
    expect(r.items[0].notes.every((n) => n.length <= 400)).toBe(true);
  });
});
