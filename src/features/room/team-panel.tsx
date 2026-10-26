"use client";

import { useState } from "react";
import { Button, Chevron } from "@/components/ui/button";
import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cx } from "@/lib/cx";
import type { RoomState } from "@/lib/supabase/rooms";
import { cardLabel } from "@/features/consensus/format";
import { en } from "@/messages/en";
import { Avatar } from "./avatar";
import { analyzeRevealed, currentItem, deckOf, isHost, latestRound, type Participant } from "./derive";
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
  // The host manages others from this list: hand the host role over, or switch voter/observer.
  const canManage = isHost(state) && state.room.status === "open";
  const [managing, setManaging] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const toggle = (id: string) => {
    setManaging((current) => (current === id ? null : id));
    setConfirming(false);
  };
  const apply = async (participant: Participant, role: Participant["role"]) => {
    if (await actions.setRole(participant.id, role)) setManaging(null);
    setConfirming(false);
  };

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
            const manageable = canManage && !isMe;
            const open = manageable && managing === participant.id;
            const tags = [participant.role !== "voter" && t[participant.role], isMe && t.you].filter(Boolean);
            const name = (
              <>
                {participant.display_name}
                {tags.length > 0 && (
                  <span className="text-caption font-normal text-ink-muted"> · {tags.join(", ")}</span>
                )}
              </>
            );
            return (
              <li key={participant.id} className="py-2.5 [&+&]:border-t [&+&]:border-line">
                <div className="flex items-center gap-3">
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
                  {manageable ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`manage-${participant.id}`}
                      onClick={() => toggle(participant.id)}
                      className="min-w-0 flex-1 truncate rounded-sm text-left text-[15px] leading-5 font-medium hover:text-brand-ink"
                    >
                      {name}
                      <Chevron className={cx("ml-1.5 inline text-ink-muted transition-transform", open && "rotate-180")} />
                      <span className="sr-only"> — {t.manage}</span>
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium">
                      {name}
                    </span>
                  )}
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
                </div>
                {open && (
                  <div id={`manage-${participant.id}`} className="mt-2.5 flex flex-wrap items-center gap-2 pl-11">
                    {confirming ? (
                      <>
                        <p className="m-0 w-full text-caption text-ink-muted">{t.confirmHost(participant.display_name)}</p>
                        <Button size="sm" variant="accent" onClick={() => void apply(participant, "host")}>
                          {t.handOver}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                          {t.cancel}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
                          {t.makeHost}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void apply(participant, participant.role === "observer" ? "voter" : "observer")}
                        >
                          {participant.role === "observer" ? t.makeVoter : t.makeObserver}
                        </Button>
                      </>
                    )}
                  </div>
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
