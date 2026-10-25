import type { RoundAnalysis } from "@/lib/consensus";
import type { Deck } from "@/lib/deck";
import { cx } from "@/lib/cx";
import { en } from "@/messages/en";
import { cardLabel, halfOf } from "./format";

const c = en.consensus.chart;

/**
 * Bar chart of revealed votes per numeric card. The suggested card's bar is
 * `brand`; a dashed line marks how many votes make half of the team.
 */
export function VoteDistribution({
  analysis,
  deck,
  height = 168,
  compact = false,
}: {
  analysis: RoundAnalysis;
  deck: Deck;
  /** Plot height in px, excluding the axis. */
  height?: number;
  /** Smaller axis labels and no reference line — for previews. */
  compact?: boolean;
}) {
  const numericValues = new Set(deck.cards.filter((card) => card.kind === "numeric").map((card) => card.value));
  const entries = analysis.distribution.filter((entry) => numericValues.has(entry.value));
  const voters = analysis.counts.numeric;
  const half = halfOf(voters);
  const showHalf = !compact && voters >= 2;
  const scale = Math.max(1, ...entries.map((entry) => entry.count), showHalf ? half : 0);
  const barSpace = height - 22; // room for the count above the tallest bar
  const halfTop = height - Math.round((half / scale) * barSpace);
  const hot = analysis.recommendation?.card;

  const summary = c.summary(
    entries.filter((entry) => entry.count > 0).map((entry) => `${cardLabel(deck, entry.value)}: ${entry.count}`),
  );

  return (
    <figure className="m-0">
      <div className="relative grid auto-cols-fr grid-flow-col items-end gap-2" role="img" aria-label={summary}>
        {entries.map((entry) => {
          const isHot = entry.value === hot;
          return (
            <div key={entry.value} className="flex flex-col items-center gap-2.5" aria-hidden="true">
              <div className="flex w-full flex-col justify-end gap-1.5" style={{ height }}>
                <span
                  className={cx(
                    "text-center text-caption tabular-nums",
                    isHot ? "font-semibold text-brand-ink" : "font-medium text-ink-muted",
                  )}
                >
                  {entry.count || ""}
                </span>
                <div
                  className={cx("w-full", compact ? "rounded-[10px]" : "rounded-lg", isHot ? "bg-brand" : "bg-surface-muted")}
                  style={{ height: Math.max(8, Math.round((entry.count / scale) * barSpace)) }}
                />
              </div>
              <span
                className={cx(
                  "rounded-sm tabular-nums",
                  compact ? "px-2 py-px text-caption" : "px-2.5 py-0.5 text-label font-normal",
                  isHot ? "bg-brand-tint font-medium text-brand-ink" : "text-ink-muted",
                )}
              >
                {cardLabel(deck, entry.value)}
              </span>
            </div>
          );
        })}
        {showHalf && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0" style={{ top: halfTop }}>
            <div className="absolute right-0 left-[12%] border-t-[1.5px] border-dashed border-ink after:absolute after:-top-[4.5px] after:-right-0.5 after:size-1.5 after:rounded-full after:bg-ink" />
            <span className="absolute left-0 -translate-y-1/2 rounded-sm bg-tooltip px-3 py-[7px] text-caption font-medium whitespace-nowrap text-on-tooltip">
              {c.half(half)}
            </span>
          </div>
        )}
      </div>
      {(analysis.counts.unknown > 0 || analysis.counts.break > 0) && (
        <figcaption className="mt-3 text-caption text-ink-muted">
          {c.nonNumeric(analysis.counts.unknown, analysis.counts.break)}
        </figcaption>
      )}
    </figure>
  );
}
