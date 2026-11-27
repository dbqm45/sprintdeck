"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow, Panel } from "@/components/ui/panel";
import type { RoomState } from "@/lib/supabase/rooms";
import { ConsensusBadge } from "@/features/consensus/consensus-badge";
import { cardLabel, formatPoints } from "@/features/consensus/format";
import { en } from "@/messages/en";
import { getBrowserClient } from "@/lib/supabase/client";
import { deckOf, summarize } from "./derive";
import { toCsv, toMarkdown } from "./export";

const t = en.room.summary;

/** Results back to the DI Decision agenda: the server signs them and answers with the link to pdi. */
async function sendToPdi(slug: string): Promise<string | null> {
  const { data } = await getBrowserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch("/api/pdi-results", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ slug }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string };
  return res.ok && typeof body.url === "string" ? body.url : null;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

function Tile({ label, value, of, sub }: { label: string; value: string; of?: string; sub?: string }) {
  return (
    <div className="p-6 [&+&]:border-t [&+&]:border-line sm:[&+&]:border-t-0 sm:[&+&]:border-l">
      <div className="text-label font-normal text-ink-muted">{label}</div>
      <div className="mt-1.5 text-[30px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
        {value}
        {of && <span className="text-[20px] font-medium text-ink-muted">{of}</span>}
      </div>
      {sub && <div className="mt-0.5 text-caption text-ink-muted">{sub}</div>}
    </div>
  );
}

/** Results of the session and export (Markdown for pasting, CSV for spreadsheets). */
export function SummaryView({ state }: { state: RoomState }) {
  const [copied, setCopied] = useState(false);
  const [pdiError, setPdiError] = useState(false);
  const deck = deckOf(state);
  const summary = summarize(state);
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(state.room.created_at));
  const fileName = state.room.title.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "sprintdeck";

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(toMarkdown(state));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="text-label font-normal">{t.eyebrow(date)}</Eyebrow>
          <h1 className="m-0 mt-1.5 text-[32px] leading-[38px] font-semibold tracking-[-0.02em]">{state.room.title}</h1>
          {state.room.status === "closed" && <p className="m-0 mt-1 text-label font-normal text-ink-muted">{t.closed}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void copyMarkdown()} aria-live="polite">
            {copied ? t.copied : t.copyMarkdown}
          </Button>
          <Button variant="outline" onClick={() => download(`${fileName}.csv`, toCsv(state), "text/csv")}>
            {t.downloadCsv}
          </Button>
          {process.env.NEXT_PUBLIC_PDI_URL && state.me.role === "host" ? (
            <Button
              variant="outline"
              onClick={() =>
                void sendToPdi(state.room.slug).then((link) => {
                  if (link) window.location.assign(link);
                  else setPdiError(true);
                })
              }
            >
              {t.toPdi}
            </Button>
          ) : null}
        </div>
      </div>
      {pdiError ? (
        <p role="alert" className="m-0 text-label text-ink-muted">
          {t.toPdiFailed}
        </p>
      ) : null}

      <Panel className="grid sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t.estimated}
          value={String(summary.estimated)}
          of={`/${state.items.length}`}
          sub={summary.skipped ? t.skipped(summary.skipped) : undefined}
        />
        {deck.ordinal ? (
          <Tile label={t.highRisk} value={String(summary.highRisk)} of={`/${summary.estimated}`} />
        ) : (
          <Tile
            label={t.totalPoints}
            value={formatPoints(summary.totalPoints)}
            sub={summary.estimated ? t.average((summary.totalPoints / summary.estimated).toFixed(1)) : undefined}
          />
        )}
        <Tile label={t.firstRound} value={String(summary.firstRoundConsensus)} of={`/${summary.estimated}`} />
        <Tile label={t.roundsPerItem} value={summary.roundsPerItem.toFixed(1)} />
      </Panel>

      <Panel className="overflow-x-auto">
        <table className="w-full border-collapse text-label font-normal">
          <thead>
            <tr className="text-ink-muted">
              <th className="border-b border-line py-3 pr-3 pl-6 text-left font-normal">#</th>
              <th className="border-b border-line p-3 text-left font-normal">{t.columns.item}</th>
              <th className="border-b border-line p-3 text-left font-normal">{t.columns.estimate}</th>
              <th className="border-b border-line p-3 text-left font-normal">{t.columns.rounds}</th>
              <th className="border-b border-line py-3 pr-6 pl-3 text-left font-normal">{t.columns.consensus}</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map(({ item, rounds, analysis }, index) => (
              <tr key={item.id} className="[&+&>td]:border-t [&+&>td]:border-line">
                <td className="py-3.5 pr-3 pl-6 align-middle text-ink-muted tabular-nums">{index + 1}</td>
                <td className="p-3 align-middle">
                  <div className="text-[15px] font-medium">{item.title}</div>
                  {item.notes.map((note) => (
                    <div key={note.id} className="mt-0.5 text-caption text-ink-muted">
                      {note.content}
                    </div>
                  ))}
                </td>
                <td className="p-3 align-middle">
                  <span
                    className={
                      item.final_estimate
                        ? "inline-grid h-11 min-w-[34px] place-items-center rounded-sm border border-line-strong bg-surface px-1.5 text-[15px] font-semibold"
                        : "inline-grid h-11 min-w-[34px] place-items-center rounded-sm border border-dashed border-line-strong text-ink-muted"
                    }
                  >
                    {item.final_estimate ? cardLabel(deck, item.final_estimate) : t.none}
                  </span>
                </td>
                <td className="p-3 align-middle tabular-nums">{rounds}</td>
                <td className="py-3 pr-6 pl-3 align-middle">
                  {analysis ? <ConsensusBadge state={analysis.state} size="sm" /> : <span className="text-ink-muted">{t.none}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
