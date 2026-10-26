import type { ConsensusConfig } from "./config";
import type { AnalysisFlag, DivergencePattern, Outlier, Question } from "./types";

interface QuestionContext {
  pattern: DivergencePattern;
  flags: AnalysisFlag[];
  /** Numeric card values, ascending. */
  numeric: string[];
  outliers: Outlier[];
}

type Bank = ConsensusConfig["questionBank"];

function outlierQuestion(id: "outlier_perspective" | "outlier_knowledge", outliers: Outlier[]): Question {
  return {
    id,
    values: [...new Set(outliers.map((o) => o.value))],
    voterIds: outliers.map((o) => o.voterId),
  };
}

// Effort (Fibonacci): is the size right? Risk: do we understand it the same way, and can we tell it works?
function patternQuestions({ pattern, numeric, outliers }: QuestionContext, bank: Bank): Question[] {
  const lowerVsHigher: Question = { id: "lower_vs_higher", values: [numeric[0], numeric[numeric.length - 1]] };
  switch (pattern) {
    case "adjacent":
      return bank === "risk"
        ? [lowerVsHigher, { id: "how_to_verify" }]
        : [lowerVsHigher, { id: "testing_deployment" }];
    case "outlier":
      return bank === "risk"
        ? [outlierQuestion("outlier_knowledge", outliers), { id: "what_breaks" }, { id: "risks_edge_cases" }]
        : [outlierQuestion("outlier_perspective", outliers), { id: "dependencies" }, { id: "risks_edge_cases" }];
    case "polarized":
      return bank === "risk"
        ? [{ id: "shared_scope" }, { id: "criteria_for_newcomer" }, { id: "how_to_verify" }]
        : [{ id: "shared_scope" }, { id: "same_approach" }, { id: "acceptance_criteria" }];
    case "wide":
      return bank === "risk"
        ? [{ id: "shared_scope" }, { id: "what_breaks" }]
        : [{ id: "shared_scope" }, { id: "split_item" }];
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
  if (flags.includes("high_risk")) questions.push({ id: "reduce_risk" });
  return questions;
}

/**
 * Picks a few questions that match the detected divergence: the two most
 * relevant for the pattern first, then the ones raised by flags, then the rest.
 */
export function pickQuestions(context: QuestionContext, config: ConsensusConfig): Question[] {
  const byPattern = patternQuestions(context, config.questionBank);
  const ordered = [...byPattern.slice(0, 2), ...flagQuestions(context.flags), ...byPattern.slice(2)];

  const picked: Question[] = [];
  for (const question of ordered) {
    if (picked.length === config.maxQuestions) break;
    if (!picked.some((q) => q.id === question.id)) picked.push(question);
  }
  return picked;
}
