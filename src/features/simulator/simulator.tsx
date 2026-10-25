"use client";

import { useMemo, useState } from "react";
import { analyzeRound, type ConsensusState, type RoundAnalysis } from "@/lib/consensus";
import { FIBONACCI_DECK, findCard } from "@/lib/deck";
import { en } from "@/messages/en";
import { parseVotes } from "./parse-votes";

const t = en.simulator;
const c = en.consensus;
const deck = FIBONACCI_DECK;

const EXAMPLES: { label: string; input: string }[] = [
  { label: "Consensus", input: "Anna:5, Ben:5, Cleo:5, Dan:5" },
  { label: "Neighbours", input: "Anna:3, Ben:5, Cleo:5, Dan:5" },
  { label: "Outlier", input: "Anna:5, Ben:5, Cleo:5, Dan:5, Eve:21" },
  { label: "Two camps", input: "Anna:3, Ben:3, Cleo:8, Dan:8" },
  { label: "Wide", input: "Anna:2, Ben:3, Cleo:5, Dan:8, Eve:13" },
  { label: "Uncertain", input: "Anna:3, Ben:5, Cleo:?, Dan:?" },
  { label: "Too few", input: "Anna:5, Ben:?, Cleo:?, Dan:break" },
];

const STATE_STYLES: Record<ConsensusState, string> = {
  A_consensus: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  B_moderate: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  C_high: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  D_insufficient: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
};

const label = (value: string) => findCard(deck, value)?.label ?? value;
const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export function Simulator() {
  const [input, setInput] = useState(EXAMPLES[2].input);
  const parsed = useMemo(() => parseVotes(input, deck), [input]);
  const analysis = useMemo(() => analyzeRound(parsed.votes, deck), [parsed]);

  const addCard = (value: string) =>
    setInput((current) => (current.trim() ? `${current.trim().replace(/,$/, "")}, ${value}` : value));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="votes" className="text-sm font-medium">
            {t.inputLabel}
          </label>
          <textarea
            id="votes"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t.inputPlaceholder}
            rows={4}
            className="w-full resize-y rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700"
          />
          {parsed.invalid.length > 0 && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {t.invalid(parsed.invalid)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t.addCard}</span>
          <div className="flex flex-wrap gap-2">
            {deck.cards.map((card) => (
              <button
                key={card.value}
                type="button"
                onClick={() => addCard(card.value)}
                className="flex h-14 w-10 items-center justify-center rounded-md border border-zinc-300 text-base font-semibold transition hover:-translate-y-0.5 hover:border-indigo-500 dark:border-zinc-700"
              >
                {card.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setInput("")}
              className="h-14 rounded-md px-3 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {t.clear}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t.examples}</span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setInput(example.input)}
                aria-pressed={input === example.input}
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:border-indigo-500 aria-pressed:border-indigo-500 aria-pressed:bg-indigo-500/10 dark:border-zinc-700"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-live="polite">
        {parsed.votes.length === 0 ? (
          <p className="text-sm text-zinc-500">{t.empty}</p>
        ) : (
          <AnalysisPanel analysis={analysis} names={parsed.names} />
        )}
      </section>
    </div>
  );
}

function AnalysisPanel({ analysis, names }: { analysis: RoundAnalysis; names: Record<string, string> }) {
  const { stats, recommendation } = analysis;
  const maxCount = Math.max(1, ...analysis.distribution.map((d) => d.count));

  const valueOf = (voterId: string) => analysis.outliers.find((o) => o.voterId === voterId)?.value;

  return (
    <div className="flex flex-col gap-6">
      <div className={`rounded-lg border px-4 py-3 ${STATE_STYLES[analysis.state]}`}>
        <p className="font-semibold">{c.states[analysis.state]}</p>
        <p className="text-sm opacity-80">
          {c.patterns[analysis.pattern]}
          {analysis.counts.numeric > 1 && ` · ${c.stats.steps(analysis.spreadSteps)}`}
        </p>
        {analysis.flags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {analysis.flags.map((flag) => (
              <li key={flag} className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                {c.flags[flag]}
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat label={c.stats.votes} value={`${analysis.counts.numeric}/${analysis.counts.total}`} />
        <Stat label={c.stats.recommendation} value={recommendation ? label(recommendation.card) : "—"} highlight />
        <Stat label={c.stats.median} value={stats ? formatPoints(stats.median) : "—"} />
        <Stat label={c.stats.mean} value={stats ? stats.mean.toFixed(1) : "—"} />
        <Stat
          label={c.stats.mode}
          value={stats ? (stats.modes.length ? stats.modes.map(formatPoints).join(", ") : c.stats.noMode) : "—"}
        />
        <Stat label={c.stats.range} value={stats ? `${formatPoints(stats.min)}–${formatPoints(stats.max)}` : "—"} />
      </dl>
      {recommendation && findCard(deck, String(recommendation.median)) === undefined && (
        <p className="-mt-3 text-sm text-zinc-500">
          {c.stats.medianNote(formatPoints(recommendation.median), label(recommendation.card))}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{t.distribution}</h2>
        <div className="flex h-32 items-end gap-1.5">
          {analysis.distribution.map((entry) => (
            <div key={entry.value} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-zinc-500">{entry.count || ""}</span>
              <div
                className={`w-full rounded-t ${
                  entry.value === recommendation?.card ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
                style={{ height: `${(entry.count / maxCount) * 80}px`, minHeight: entry.count ? 4 : 0 }}
              />
              <span className="text-xs font-medium">{label(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">{t.questions}</h2>
        {analysis.questions.length === 0 ? (
          <p className="text-sm text-zinc-500">{t.noQuestions}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {analysis.questions.map((question) => (
              <li
                key={question.id}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                {c.questions[question.id]({
                  values: (question.values ?? []).map(label),
                  people: (question.voterIds ?? []).map((id) => `${names[id]} (${label(valueOf(id) ?? "")})`),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`text-lg font-semibold ${highlight ? "text-indigo-600 dark:text-indigo-400" : ""}`}>{value}</dd>
    </div>
  );
}
