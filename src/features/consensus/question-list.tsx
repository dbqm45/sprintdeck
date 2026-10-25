import type { RoundAnalysis } from "@/lib/consensus";
import type { Deck } from "@/lib/deck";
import { en } from "@/messages/en";
import { cardLabel } from "./format";

const c = en.consensus;

/** Numbered questions the Consensus Engine suggests discussing after reveal. */
export function QuestionList({
  analysis,
  deck,
  names,
  emptyText,
}: {
  analysis: RoundAnalysis;
  deck: Deck;
  /** Display name per voter id. */
  names: Record<string, string>;
  emptyText: string;
}) {
  if (analysis.questions.length === 0) {
    return <p className="text-body text-ink-muted">{emptyText}</p>;
  }

  const valueOf = (voterId: string) => analysis.outliers.find((o) => o.voterId === voterId)?.value ?? "";
  const label = (value: string) => cardLabel(deck, value);

  return (
    <ol className="m-0 list-none p-0">
      {analysis.questions.map((question, index) => (
        <li key={question.id} className="flex items-start gap-3 py-3 [&+&]:border-t [&+&]:border-line">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-tint text-overline font-semibold text-brand-ink">
            {index + 1}
          </span>
          <span className="text-body">
            {c.questions[question.id]({
              values: (question.values ?? []).map(label),
              people: (question.voterIds ?? []).map((id) => `${names[id] ?? id} (${label(valueOf(id))})`),
            })}
          </span>
        </li>
      ))}
    </ol>
  );
}
