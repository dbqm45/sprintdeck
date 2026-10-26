"use client";

import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cx } from "@/lib/cx";
import type { RoomState } from "@/lib/supabase/rooms";
import { cardLabel } from "@/features/consensus/format";
import { en } from "@/messages/en";
import { Avatar } from "./avatar";
import { analyzeRevealed, currentItem, deckOf, latestRound } from "./derive";
import type { RoomActions } from "./use-room";

const t = en.room.team;

/** Who is in the room, who is online, and — per round — who voted (or what, once revealed). */
export function TeamPanel({
  state,
  online,
  actions,
}: {
  state: RoomState;
  online: ReadonlySet<string>;
  actions: RoomActions;
}) {
  const item = currentItem(state);
  const round = item ? latestRound(state, item.id) : undefined;
  const me = state.participants.find((p) => p.id === state.me.participant_id);
  const deck = deckOf(state);
  // After reveal, the card the engine suggests stands out.
  const hot = round?.status === "revealed" ? analyzeRevealed(state, round).recommendation?.card : null;

  return (
    <Panel>
      <PanelSection className="pb-3">
        <Eyebrow className="text-label font-normal">
          {t.title(state.participants.filter((p) => online.has(p.id)).length, state.participants.length)}
        </Eyebrow>
        <ul className="m-0 mt-2 list-none p-0">
          {state.participants.map((participant) => {
            const vote = round?.votes.find((v) => v.participant_id === participant.id);
            const isMe = participant.id === state.me.participant_id;
            const isOnline = online.has(participant.id);
            return (
              <li key={participant.id} className="flex items-center gap-3 py-2.5 [&+&]:border-t [&+&]:border-line">
                <span className="relative">
                  <Avatar name={participant.display_name} />
                  <span
                    className={cx(
                      "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface",
                      isOnline ? "bg-positive" : "bg-ink-faint",
                    )}
                  />
                  <span className="sr-only">{isOnline ? t.online : t.offline}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium">
                  {participant.display_name}
                  {(participant.role !== "voter" || isMe) && (
                    <span className="text-caption font-normal text-ink-muted">
                      {" · "}
                      {[participant.role !== "voter" && t[participant.role], isMe && t.you].filter(Boolean).join(", ")}
                    </span>
                  )}
                </span>
                {round && participant.role !== "observer" && (
                  <span
                    className={cx(
                      "grid h-[38px] min-w-7 place-items-center rounded-[6px] px-1.5 text-label font-semibold tabular-nums",
                      round.status === "voting"
                        ? vote
                          ? "bg-ink text-surface"
                          : "bg-surface-muted text-ink-faint"
                        : !vote?.value
                          ? "bg-surface-muted text-ink-faint"
                          : vote.value === hot
                            ? "bg-brand-strong text-on-brand"
                            : "border border-line-strong bg-surface text-ink",
                    )}
                  >
                    {round.status === "voting" ? (vote ? "✓" : "–") : vote?.value ? cardLabel(deck, vote.value) : "–"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </PanelSection>
      {me && me.role !== "host" && state.room.status === "open" && (
        <PanelSection className="py-4">
          <SegmentedControl
            label={t.modeLabel}
            value={me.role === "observer" ? "observer" : "voter"}
            onChange={(role) => void actions.setRole(me.id, role)}
            options={[
              { value: "voter", label: t.voteMode },
              { value: "observer", label: t.watchMode },
            ]}
          />
        </PanelSection>
      )}
    </Panel>
  );
}
