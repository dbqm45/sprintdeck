import type { ConsensusConfig } from "./config";
import type { AnalysisFlag, DivergencePattern, Outlier, Question } from "./types";

interface QuestionContext {
  pattern: DivergencePattern;
  flags: AnalysisFlag[];
  /** Numeric card values, ascending. */
  numeric: string[];
  outliers: Outlier[];
}

function patternQuestions({ pattern, numeric, outliers }: QuestionContext): Question[] {
  switch (pattern) {
    case "adjacent":
      return [
        { id: "lower_vs_higher", values: [numeric[0], numeric[numeric.length - 1]] },
        { id: "testing_deployment" },
      ];
    case "outlier":
      return [
        {
          id: "outlier_perspective",
          values: [...new Set(outliers.map((o) => o.value))],
          voterIds: outliers.map((o) => o.voterId),
        },
        { id: "dependencies" },
        { id: "risks_edge_cases" },
      ];
    case "polarized":
      return [{ id: "shared_scope" }, { id: "same_approach" }, { id: "acceptance_criteria" }];
    case "wide":
      return [{ id: "shared_scope" }, { id: "split_item" }];
    case "unanimous":
    case "insufficient":
      return [];
  }
}

function flagQuestions(flags: AnalysisFlag[]): Question[] {
  const questions: Question[] = [];
  if (flags.includes("high_uncertainty")) {
    questions.push({ id: "missing_info" }, { id: "clarify_or_spike" });
  }
  if (flags.includes("large_item")) questions.push({ id: "split_item" });
  return questions;
}

/**
 * Picks a few questions that match the detected divergence: the two most
 * relevant for the pattern first, then the ones raised by flags, then the rest.
 */
export function pickQuestions(context: QuestionContext, config: ConsensusConfig): Question[] {
  const byPattern = patternQuestions(context);
  const ordered = [...byPattern.slice(0, 2), ...flagQuestions(context.flags), ...byPattern.slice(2)];

  const picked: Question[] = [];
  for (const question of ordered) {
    if (picked.length === config.maxQuestions) break;
    if (!picked.some((q) => q.id === question.id)) picked.push(question);
  }
  return picked;
}
