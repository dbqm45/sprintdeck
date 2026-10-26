"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { cx } from "@/lib/cx";
import type { RoomState } from "@/lib/supabase/rooms";
import { cardLabel } from "@/features/consensus/format";
import { en } from "@/messages/en";
import { deckOf, isHost, latestRound } from "./derive";
import type { RoomActions } from "./use-room";

const t = en.room.agenda;

export function AgendaPanel({
  state,
  actions,
  pending,
}: {
  state: RoomState;
  actions: RoomActions;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const host = isHost(state);
  const deck = deckOf(state);
  const items = [...state.items].sort((a, b) => a.position - b.position);
  const done = items.filter((item) => item.status === "estimated" || item.status === "skipped").length;
  const voting = state.rounds.some((round) => round.status === "voting");

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (await actions.addItem(title)) setTitle("");
  };

  return (
    <Panel>
      <PanelSection className="px-3 pt-5 pb-3">
        <Eyebrow className="px-3 pb-2 text-label font-normal">{t.title(done, items.length)}</Eyebrow>
        <ol className="m-0 list-none p-0">
          {items.map((item, index) => {
            const isCurrent = item.id === state.room.current_item_id;
            const round = latestRound(state, item.id);
            const canSelect = host && !isCurrent && !voting && item.status !== "estimated";
            const content = (
              <>
                <span
                  className={cx(
                    "w-5 shrink-0 tabular-nums",
                    isCurrent ? "font-semibold text-brand-ink" : "text-ink-muted",
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cx(
                    "min-w-0 flex-1 truncate text-left",
                    isCurrent ? "font-medium text-ink" : item.status === "pending" ? "text-ink" : "text-ink-muted",
                    item.status === "skipped" && "line-through",
                  )}
                >
                  {item.title}
                </span>
                {item.status === "estimated" && item.final_estimate && (
                  <span className="grid h-8 min-w-6 place-items-center rounded-[6px] border border-line-strong px-1 text-caption font-semibold">
                    {cardLabel(deck, item.final_estimate)}
                  </span>
                )}
                {isCurrent && round?.status === "voting" && (
                  <Badge tone="positive" size="xs">
                    {en.room.join.voting}
                  </Badge>
                )}
              </>
            );
            const rowClasses = cx(
              "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-label font-normal",
              isCurrent && "bg-brand-tint",
            );
            return (
              <li key={item.id} aria-current={isCurrent ? "step" : undefined}>
                {canSelect ? (
                  <button
                    type="button"
                    className={cx(rowClasses, "transition-colors hover:bg-surface-muted")}
                    onClick={() => void actions.setCurrentItem(item.id)}
                    aria-label={t.setCurrent(item.title)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={rowClasses}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </PanelSection>
      {host && state.room.status === "open" && (
        <PanelSection className="py-4">
          <form onSubmit={(event) => void add(event)} className="flex gap-2">
            <label className="sr-only" htmlFor="new-item">
              {t.addLabel}
            </label>
            <input
              id="new-item"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t.addPlaceholder}
              maxLength={200}
              className="h-10 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-faint focus:border-focus focus:shadow-[0_0_0_3px_var(--brand-tint)] focus-visible:outline-none"
            />
            <Button type="submit" variant="outline" disabled={pending || !title.trim()}>
              {t.add}
            </Button>
          </form>
        </PanelSection>
      )}
    </Panel>
  );
}
