/**
 * Results of a room opened from the DI Decision (pdi) agenda, back to pdi (dbqm45/pdi docs/plan-wyniki-sprintdecka.md).
 * Only items that came from pdi (`external_ref`) go back: the final card, the last revealed round's votes counted by
 * card (no names), the Consensus Engine's state, the number of rounds and up to three short notes. The server builds
 * them from the room state it reads itself and signs them with the shared secret; the browser only carries the link.
 */

import { createHmac } from "node:crypto";
import { cardLabel } from "@/features/consensus/format";
import { deckOf, summarize } from "@/features/room/derive";
import type { RoomState } from "@/lib/supabase/rooms";
import { en } from "@/messages/en";

const VALID_SECONDS = 50 * 60;
const MAX_NOTES = 3;
const NOTE_LENGTH = 400;

export interface ItemRef {
  item_id: string;
  external_ref: string;
}

export interface ItemResult {
  ref: string;
  title: string;
  status: string;
  final: string | null;
  rounds: number;
  votes: Record<string, number>;
  consensus: string | null;
  notes: string[];
}

export interface Results {
  v: 1;
  exp: number;
  room: { title: string; url: string; deck: string };
  items: ItemResult[];
}

const short = (text: string) => (text.length <= NOTE_LENGTH ? text : `${text.slice(0, NOTE_LENGTH - 1)}…`);

export function buildResults(state: RoomState, refs: ItemRef[], opts: { roomUrl: string; now: number }): Results {
  const deck = deckOf(state);
  const byItem = new Map(refs.map((r) => [r.item_id, r.external_ref]));
  const items: ItemResult[] = [];
  for (const { item, rounds, analysis } of summarize(state).rows) {
    const ref = byItem.get(item.id);
    if (!ref) continue;
    const revealed = state.rounds.filter((r) => r.item_id === item.id && r.status === "revealed").at(-1);
    const votes: Record<string, number> = {};
    for (const vote of revealed?.votes ?? []) {
      if (vote.value === undefined) continue;
      const label = cardLabel(deck, vote.value);
      votes[label] = (votes[label] ?? 0) + 1;
    }
    items.push({
      ref,
      title: item.title,
      status: item.status,
      final: item.final_estimate === null ? null : cardLabel(deck, item.final_estimate),
      rounds,
      votes,
      consensus: analysis ? en.consensus.states[analysis.state] : null,
      notes: item.notes.slice(-MAX_NOTES).map((n) => short(n.content)),
    });
  }
  return { v: 1, exp: opts.now + VALID_SECONDS, room: { title: state.room.title, url: opts.roomUrl, deck: deck.name }, items };
}

export function signResults(secret: string, results: Results): { d: string; s: string } {
  const d = Buffer.from(JSON.stringify(results)).toString("base64url");
  return { d, s: createHmac("sha256", secret).update(d).digest("hex") };
}
