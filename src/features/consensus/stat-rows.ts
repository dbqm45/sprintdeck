import type { RoundAnalysis } from "@/lib/consensus";
import { type Deck, findCard, numericCards } from "@/lib/deck";
import { en } from "@/messages/en";
import { cardLabel, formatPoints } from "./format";
import type { StatRow } from "./stat-list";

const c = en.consensus;

/** Level name for a rank of an ordinal deck; between two levels: "Medium–High". */
export function levelOf(deck: Deck, points: number): string {
  const scale = numericCards(deck);
  const exact = scale.find((card) => card.points === points);
  if (exact) return exact.label;
  const below = scale.filter((card) => card.points! < points).at(-1);
  const above = scale.find((card) => card.points! > points);
  return `${below?.label}–${above?.label}`;
}

export function statRows(analysis: RoundAnalysis, deck: Deck): StatRow[] {
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

