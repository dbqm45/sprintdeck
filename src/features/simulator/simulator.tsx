"use client";

import { useMemo, useState } from "react";
import { analyzeRound, type RoundAnalysis } from "@/lib/consensus";
import { DECKS, type Deck, type DeckId, findCard, numericCards } from "@/lib/deck";
import { Button } from "@/components/ui/button";
import { Chip, Tag } from "@/components/ui/chip";
import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { PokerCard } from "@/components/ui/poker-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import { TextArea } from "@/components/ui/text-field";
import { ConsensusBadge } from "@/features/consensus/consensus-badge";
import { cardLabel, formatPoints } from "@/features/consensus/format";
import { QuestionList } from "@/features/consensus/question-list";
import { StatList, type StatRow } from "@/features/consensus/stat-list";
import { VoteDistribution } from "@/features/consensus/vote-distribution";
import { en } from "@/messages/en";
import { parseVotes } from "./parse-votes";

const t = en.simulator;
const c = en.consensus;

// Example rounds per deck; the third one (an outlier) is shown first.
const EXAMPLES: Record<DeckId, { label: string; input: string }[]> = {
  fibonacci: [
    { label: "Consensus", input: "Anna:5, Ben:5, Cleo:5, Dan:5" },
    { label: "Neighbours", input: "Anna:3, Ben:5, Cleo:5, Dan:5" },
    { label: "Outlier", input: "Anna:5, Ben:5, Cleo:5, Dan:5, Eve:21" },
    { label: "Two camps", input: "Anna:3, Ben:3, Cleo:8, Dan:8" },
    { label: "Wide", input: "Anna:2, Ben:3, Cleo:5, Dan:8, Eve:13" },
    { label: "Uncertain", input: "Anna:3, Ben:5, Cleo:?, Dan:?" },
    { label: "Too few", input: "Anna:5, Ben:?, Cleo:?, Dan:break" },
  ],
  risk: [
    { label: "Consensus", input: "Anna:low, Ben:low, Cleo:low, Dan:low" },
    { label: "Neighbours", input: "Anna:low, Ben:medium, Cleo:medium, Dan:medium" },
    { label: "Outlier", input: "Anna:low, Ben:low, Cleo:low, Dan:low, Eve:very high" },
    { label: "Two camps", input: "Anna:low, Ben:low, Cleo:high, Dan:high" },
    { label: "Wide", input: "Anna:low, Ben:medium, Cleo:high, Dan:very high" },
    { label: "Risky", input: "Anna:high, Ben:high, Cleo:very high, Dan:high" },
    { label: "Uncertain", input: "Anna:medium, Ben:high, Cleo:?, Dan:?" },
  ],
};

const DECK_OPTIONS = (Object.keys(DECKS) as DeckId[]).map((id) => ({ value: id, label: DECKS[id].name }));

export function Simulator() {
  const [deckId, setDeckId] = useState<DeckId>("fibonacci");
  const [input, setInput] = useState(EXAMPLES.fibonacci[2].input);
  const deck = DECKS[deckId];
  const parsed = useMemo(() => parseVotes(input, deck), [input, deck]);
  const analysis = useMemo(() => analyzeRound(parsed.votes, deck), [parsed, deck]);

  const changeDeck = (id: DeckId) => {
    setDeckId(id);
    setInput(EXAMPLES[id][2].input);
  };

  const addCard = (value: string) =>
    setInput((current) => (current.trim() ? `${current.trim().replace(/,$/, "")}, ${value}` : value));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Panel>
        <PanelSection className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-label">{t.deck}</span>
            <SegmentedControl label={t.deck} options={DECK_OPTIONS} value={deckId} onChange={changeDeck} />
            <p className="m-0 text-caption text-ink-muted">{t.deckHint[deckId]}</p>
          </div>

          <TextArea
            label={t.inputLabel}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t.inputPlaceholder[deckId]}
            rows={4}
            mono
            error={parsed.invalid.length > 0 ? t.invalid(parsed.invalid) : undefined}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-label">{t.addCard}</span>
              <Button variant="ghost" size="sm" onClick={() => setInput("")}>
                {t.clear}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {deck.cards.map((card) => (
                <PokerCard key={card.value} card={card} size="sm" onClick={() => addCard(card.value)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label">{t.examples}</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES[deckId].map((example) => (
                <Chip key={example.label} onClick={() => setInput(example.input)} aria-pressed={input === example.input}>
                  {example.label}
                </Chip>
              ))}
            </div>
          </div>
        </PanelSection>
      </Panel>

      <section aria-live="polite">
        {parsed.votes.length === 0 ? (
          <Panel>
            <PanelSection className="text-body text-ink-muted">{t.empty}</PanelSection>
          </Panel>
        ) : (
          <AnalysisPanel analysis={analysis} deck={deck} names={parsed.names} />
        )}
      </section>
    </div>
  );
}

type Tab = "statistics" | "questions";

/** Level name for a rank of an ordinal deck; between two levels: "Medium–High". */
function levelOf(deck: Deck, points: number): string {
  const scale = numericCards(deck);
  const exact = scale.find((card) => card.points === points);
  if (exact) return exact.label;
  const below = scale.filter((card) => card.points! < points).at(-1);
  const above = scale.find((card) => card.points! > points);
  return `${below?.label}–${above?.label}`;
}

function statRows(analysis: RoundAnalysis, deck: Deck): StatRow[] {
  const { stats, recommendation, counts } = analysis;
  const label = (value: string) => cardLabel(deck, value);
  const rows: StatRow[] = [
    {
      title: c.stats.votes,
      caption: c.stats.votesCaption(counts.unknown, counts.break),
      value: `${counts.numeric}/${counts.total}`,
    },
  ];
  if (!stats) return rows;

  const range = {
    title: c.stats.range,
    caption: counts.numeric > 1 ? c.stats.steps(analysis.spreadSteps) : undefined,
  };
  if (deck.ordinal) {
    // Ranks have no meaningful mean: show levels only.
    rows.push(
      { title: c.stats.median, value: levelOf(deck, stats.median) },
      {
        title: c.stats.mode,
        value: stats.modes.length ? stats.modes.map((p) => levelOf(deck, p)).join(", ") : c.stats.noMode,
      },
      {
        ...range,
        value:
          stats.min === stats.max
            ? levelOf(deck, stats.min)
            : `${levelOf(deck, stats.min)} – ${levelOf(deck, stats.max)}`,
      },
    );
    return rows;
  }
  rows.push(
    {
      title: c.stats.median,
      caption:
        recommendation && findCard(deck, String(recommendation.median)) === undefined
          ? c.stats.medianNote(formatPoints(recommendation.median), label(recommendation.card))
          : undefined,
      value: formatPoints(stats.median),
    },
    { title: c.stats.mean, value: stats.mean.toFixed(1) },
    { title: c.stats.mode, value: stats.modes.length ? stats.modes.map(formatPoints).join(", ") : c.stats.noMode },
    { ...range, value: `${formatPoints(stats.min)}–${formatPoints(stats.max)}` },
  );
  return rows;
}

function AnalysisPanel({
  analysis,
  deck,
  names,
}: {
  analysis: RoundAnalysis;
  deck: Deck;
  names: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("statistics");
  const { recommendation, counts } = analysis;
  const label = (value: string) => cardLabel(deck, value);
  const rows = statRows(analysis, deck);


  return (
    <Panel>
      <PanelSection>
        <Eyebrow>{t.analysis}</Eyebrow>
        <div className="mt-1 flex items-baseline gap-2">
          {recommendation ? (
            <>
              <span className="text-kpi tabular-nums">{label(recommendation.card)}</span>
              <span className="text-body text-ink-muted">{t.suggested} ·</span>
              <span className="text-body text-ink-muted tabular-nums">
                {counts.numeric}/{counts.total} {c.stats.votes.toLowerCase()}
              </span>
            </>
          ) : (
            <span className="text-title text-ink-muted">{t.noSuggestion}</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ConsensusBadge state={analysis.state} />
          <Tag size="sm">
            {c.patterns[analysis.pattern]}
            {counts.numeric > 1 && ` · ${c.stats.steps(analysis.spreadSteps)}`}
          </Tag>
          {analysis.flags.map((flag) => (
            <Tag key={flag} tone="brand" size="sm">
              {c.flags[flag]}
            </Tag>
          ))}
        </div>
      </PanelSection>

      <PanelSection>
        <h2 className="sr-only">{t.distribution}</h2>
        <VoteDistribution analysis={analysis} deck={deck} />
      </PanelSection>

      <Tabs
        label={t.tabsLabel}
        value={tab}
        onChange={setTab}
        items={[
          { value: "statistics", label: t.statistics },
          { value: "questions", label: `${t.questions} · ${analysis.questions.length}` },
        ]}
      />
      <PanelSection role="tabpanel" className="pt-4">
        {tab === "statistics" ? (
          <StatList rows={rows} headers={c.stats.headers} />
        ) : (
          <QuestionList analysis={analysis} deck={deck} names={names} emptyText={t.noQuestions} />
        )}
      </PanelSection>
    </Panel>
  );
}
