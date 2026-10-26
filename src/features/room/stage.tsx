"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { HiddenCard, PokerCard } from "@/components/ui/poker-card";
import { Tabs } from "@/components/ui/tabs";
import { TextArea } from "@/components/ui/text-field";
import { numericCards } from "@/lib/deck";
import type { RoomState } from "@/lib/supabase/rooms";
import { ConsensusBadge } from "@/features/consensus/consensus-badge";
import { cardLabel } from "@/features/consensus/format";
import { QuestionList } from "@/features/consensus/question-list";
import { StatList } from "@/features/consensus/stat-list";
import { statRows } from "@/features/consensus/stat-rows";
import { VoteDistribution } from "@/features/consensus/vote-distribution";
import { en } from "@/messages/en";
import {
  analyzeRevealed,
  currentItem,
  deckOf,
  isHost,
  latestRound,
  namesById,
  voters,
  type Item,
  type Round,
} from "./derive";
import type { RoomActions } from "./use-room";

const t = en.room;
const c = en.consensus;

interface StageProps {
  state: RoomState;
  actions: RoomActions;
  pending: boolean;
}

/** The current item: waiting, voting with hidden cards, the revealed result, or done. */
export function Stage({ state, actions, pending }: StageProps) {
  const item = currentItem(state);
  const host = isHost(state);

  if (!item) {
    return (
      <Panel>
        <PanelSection className="py-10 text-center text-body text-ink-muted">
          {host ? t.empty.host : t.empty.guest}
        </PanelSection>
      </Panel>
    );
  }

  const round = latestRound(state, item.id);
  return (
    <Panel>
      <ItemHeader state={state} item={item} round={round} />
      {item.status === "estimated" || item.status === "skipped" ? (
        <Done state={state} item={item} actions={actions} pending={pending} />
      ) : !round ? (
        <PanelSection className="flex flex-col items-start gap-3">
          <p className="m-0 text-body text-ink-muted">{host ? t.notStarted.host : t.notStarted.guest}</p>
          {host && (
            <Button variant="primary" disabled={pending} onClick={() => void actions.startRound(item.id)}>
              {t.notStarted.start}
            </Button>
          )}
        </PanelSection>
      ) : round.status === "voting" ? (
        <Voting key={round.id} state={state} round={round} actions={actions} pending={pending} />
      ) : (
        <Revealed key={round.id} state={state} item={item} round={round} actions={actions} pending={pending} />
      )}
    </Panel>
  );
}

function ItemHeader({ state, item, round }: { state: RoomState; item: Item; round: Round | undefined }) {
  return (
    <PanelSection>
      <Eyebrow className="text-label font-normal">
        {t.itemOf(item.position, state.items.length, round?.number ?? null)}
      </Eyebrow>
      <h1 className="m-0 mt-1 text-title">{item.title}</h1>
      {item.description && (
        <p className="m-0 mt-2 max-w-[560px] text-label font-normal whitespace-pre-line text-ink-muted">
          {item.description}
        </p>
      )}
    </PanelSection>
  );
}

function Voting({ state, round, actions, pending }: { state: RoomState; round: Round } & Omit<StageProps, "state">) {
  const deck = deckOf(state);
  const people = voters(state);
  const votedIds = new Set(round.votes.map((vote) => vote.participant_id));
  const waiting = people.filter((p) => !votedIds.has(p.id)).map((p) => p.display_name);
  const voted = people.length - waiting.length;
  const observing = state.me.role === "observer";

  const pick = (value: string) =>
    void (round.my_vote === value ? actions.clearVote(round.id) : actions.castVote(round.id, value));

  return (
    <>
      <PanelSection>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[220px] flex-1">
            <div className="mb-2 flex justify-between gap-3 text-label font-normal">
              <span>
                <strong className="font-semibold">{t.voting.progress(voted, people.length)}</strong>{" "}
                <span className="text-ink-muted">{t.voting.voted}</span>
              </span>
              <span className="truncate text-ink-muted">
                {waiting.length ? t.voting.waitingFor(waiting) : t.voting.everyone}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={people.length}
              aria-valuenow={voted}
            >
              <div
                className="h-full rounded-full bg-ink transition-[width]"
                style={{ width: `${people.length ? (voted / people.length) * 100 : 0}%` }}
              />
            </div>
          </div>
          {isHost(state) && (
            <Button variant="primary" disabled={pending} onClick={() => void actions.reveal(round.id)}>
              {t.voting.reveal}
            </Button>
          )}
        </div>
      </PanelSection>

      <PanelSection className="py-8">
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(88px,1fr))] justify-items-center gap-x-4 gap-y-6 p-0">
          {people.map((person) => {
            const isMe = person.id === state.me.participant_id;
            const hasVoted = votedIds.has(person.id);
            return (
              <li key={person.id} className="flex flex-col items-center gap-2.5">
                <HiddenCard voted={hasVoted} label={t.voting.seatLabel(person.display_name, hasVoted)} />
                <span className={isMe ? "text-label text-brand-ink" : "text-label"}>
                  {isMe ? t.voting.seat.you : person.display_name}
                </span>
                <span className="-mt-2 text-overline font-normal text-ink-muted">
                  {hasVoted ? t.voting.seat.voted : t.voting.seat.thinking}
                </span>
              </li>
            );
          })}
        </ul>
      </PanelSection>

      <PanelSection className="pt-6">
        {observing ? (
          <p className="m-0 text-body text-ink-muted">{t.voting.observing}</p>
        ) : (
          <>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-label font-normal text-ink-muted">{t.voting.yourCard}</span>
              <span className="text-caption text-ink-muted">{t.voting.changeHint}</span>
            </div>
            <div className="flex flex-wrap items-end gap-2 pt-2.5">
              {deck.cards.map((card) => (
                <PokerCard
                  key={card.value}
                  card={card}
                  selected={round.my_vote === card.value}
                  disabled={pending}
                  onClick={() => pick(card.value)}
                />
              ))}
            </div>
          </>
        )}
      </PanelSection>
    </>
  );
}

type Tab = "statistics" | "questions";

function Revealed({
  state,
  item,
  round,
  actions,
  pending,
}: { state: RoomState; item: Item; round: Round } & Omit<StageProps, "state">) {
  const deck = deckOf(state);
  const analysis = analyzeRevealed(state, round);
  const [tab, setTab] = useState<Tab>("statistics");
  const [estimate, setEstimate] = useState(analysis.recommendation?.card ?? null);
  const [note, setNote] = useState("");
  const host = isHost(state);

  return (
    <>
      <PanelSection>
        <div className="flex flex-wrap items-baseline gap-2">
          {analysis.recommendation ? (
            <>
              <span className="text-kpi tabular-nums">{cardLabel(deck, analysis.recommendation.card)}</span>
              <span className="text-body text-ink-muted">{t.revealed.suggested} ·</span>
            </>
          ) : null}
          <span className="text-body text-ink-muted tabular-nums">
            {t.revealed.votes(analysis.counts.total, voters(state).length)}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ConsensusBadge state={analysis.state} />
          <Tag size="sm">
            {c.patterns[analysis.pattern]}
            {analysis.counts.numeric > 1 && ` · ${c.stats.steps(analysis.spreadSteps)}`}
          </Tag>
          {analysis.flags.map((flag) => (
            <Tag key={flag} tone="brand" size="sm">
              {c.flags[flag]}
            </Tag>
          ))}
        </div>
      </PanelSection>

      <PanelSection>
        <VoteDistribution analysis={analysis} deck={deck} />
      </PanelSection>

      <Tabs
        label={t.revealed.tabsLabel}
        value={tab}
        onChange={setTab}
        items={[
          { value: "statistics", label: t.revealed.statistics },
          { value: "questions", label: `${t.revealed.questions} · ${analysis.questions.length}` },
        ]}
      />
      <PanelSection role="tabpanel" className="pt-4">
        {tab === "statistics" ? (
          <StatList rows={statRows(analysis, deck)} headers={c.stats.headers} />
        ) : (
          <QuestionList
            analysis={analysis}
            deck={deck}
            names={namesById(state)}
            emptyText={t.revealed.noQuestions}
          />
        )}
      </PanelSection>

      {host ? (
        <PanelSection className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-label">{t.revealed.estimate}</span>
            <div className="flex flex-wrap items-end gap-2 pt-1.5">
              {numericCards(deck).map((card) => (
                <PokerCard
                  key={card.value}
                  card={card}
                  size="sm"
                  selected={estimate === card.value}
                  onClick={() => setEstimate(card.value)}
                />
              ))}
            </div>
          </div>
          <TextArea
            label={t.revealed.note}
            placeholder={t.revealed.notePlaceholder}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={2000}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => void actions.skip(item.id)}>
              {t.revealed.skip}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => void actions.startRound(item.id)}>
              {t.revealed.revote}
            </Button>
            <Button
              variant="accent"
              disabled={pending || !estimate}
              onClick={() => estimate && void actions.finalize(item.id, estimate, note)}
            >
              {t.revealed.confirm(estimate ? cardLabel(deck, estimate) : "")}
            </Button>
          </div>
        </PanelSection>
      ) : (
        <PanelSection className="text-label font-normal text-ink-muted">{t.revealed.waitingForHost}</PanelSection>
      )}
    </>
  );
}

function Done({ state, item, actions, pending }: { state: RoomState; item: Item } & Omit<StageProps, "state">) {
  const deck = deckOf(state);
  const allDone = state.items.every((i) => i.status === "estimated" || i.status === "skipped");
  return (
    <PanelSection className="flex flex-col items-start gap-3">
      <div className="text-heading">
        {item.status === "estimated" && item.final_estimate
          ? t.done.estimated(cardLabel(deck, item.final_estimate))
          : t.done.skipped}
      </div>
      {item.notes.map((note) => (
        <p key={note.id} className="m-0 text-body text-ink-muted">
          {note.content}
        </p>
      ))}
      {allDone && <p className="m-0 text-body text-ink-muted">{t.done.allDone}</p>}
      {allDone && isHost(state) && (
        <Button variant="accent" disabled={pending} onClick={() => void actions.closeRoom()}>
          {t.done.endSession}
        </Button>
      )}
    </PanelSection>
  );
}
