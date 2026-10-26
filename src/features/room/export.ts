import type { RoomState } from "@/lib/supabase/rooms";
import { en } from "@/messages/en";
import { cardLabel } from "@/features/consensus/format";
import { deckOf, summarize } from "./derive";

const s = en.room.summary;

function estimateText(state: RoomState, value: string | null): string {
  return value === null ? s.none : cardLabel(deckOf(state), value);
}

/** Markdown table of the session, for pasting into Jira, Confluence or a chat. */
export function toMarkdown(state: RoomState): string {
  const { rows } = summarize(state);
  const escape = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
  const lines = [
    `# ${escape(state.room.title)}`,
    "",
    `| # | ${s.columns.item} | ${s.columns.estimate} | ${s.columns.rounds} | ${s.columns.consensus} |`,
    "|---|---|---|---|---|",
    ...rows.map(({ item, rounds, analysis }, index) => {
      const notes = item.notes.map((note) => note.content).join(" ");
      const title = notes ? `${escape(item.title)} — ${escape(notes)}` : escape(item.title);
      const consensus = analysis ? en.consensus.states[analysis.state] : s.none;
      return `| ${index + 1} | ${title} | ${estimateText(state, item.final_estimate)} | ${rounds} | ${consensus} |`;
    }),
  ];
  return lines.join("\n") + "\n";
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV with one row per item: position, title, status, estimate, rounds, consensus, notes. */
export function toCsv(state: RoomState): string {
  const { rows } = summarize(state);
  const header = ["position", "title", "status", "estimate", "rounds", "consensus", "notes"];
  const body = rows.map(({ item, rounds, analysis }, index) =>
    [
      index + 1,
      item.title,
      item.status,
      item.final_estimate === null ? "" : cardLabel(deckOf(state), item.final_estimate),
      rounds,
      analysis ? en.consensus.states[analysis.state] : "",
      item.notes.map((note) => note.content).join("\n"),
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...body].join("\n") + "\n";
}
