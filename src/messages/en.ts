import type {
  AnalysisFlag,
  ConsensusState,
  DivergencePattern,
  QuestionId,
} from "@/lib/consensus";

interface QuestionParams {
  /** Card labels the question refers to. */
  values: string[];
  /** People the question is addressed to, e.g. "Anna (21)". */
  people: string[];
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const en = {
  app: {
    name: "Sprintdeck",
    tagline: "Don't just collect votes. Help your team reach a shared decision.",
  },
  consensus: {
    states: {
      A_consensus: "Full consensus",
      B_moderate: "Worth checking the differences in assumptions",
      C_high: "Discuss the differences before you decide",
      D_insufficient: "Not enough votes to draw conclusions",
    } satisfies Record<ConsensusState, string>,
    patterns: {
      unanimous: "Everyone agrees",
      adjacent: "Neighbouring values",
      outlier: "Outlying votes",
      polarized: "Two camps",
      wide: "Widely spread",
      insufficient: "Insufficient data",
    } satisfies Record<DivergencePattern, string>,
    flags: {
      high_uncertainty: "Many people can't estimate this yet",
      large_item: "This looks like a large item",
      break_requested: "Someone asked for a break",
    } satisfies Record<AnalysisFlag, string>,
    questions: {
      lower_vs_higher: ({ values }) =>
        `What makes this a ${values[0]} rather than a ${values[1]}?`,
      testing_deployment: () => "Does the estimate include testing and deployment?",
      outlier_perspective: ({ people }) =>
        `What ${people.length === 1 ? "does" : "do"} ${list(people)} see that the rest of us don't?`,
      dependencies: () => "Have we considered dependencies on other systems?",
      risks_edge_cases: () => "Are there extra risks or edge cases?",
      shared_scope: () => "Do we all understand the scope the same way?",
      same_approach: () => "Are both groups assuming the same technical approach?",
      acceptance_criteria: () => "Are the acceptance criteria precise enough?",
      split_item: () => "Is this item too big — should we split it?",
      missing_info: () => "What's missing for us to estimate this?",
      clarify_or_spike: () => "Do we need clarification from the PO or a spike?",
    } satisfies Record<QuestionId, (params: QuestionParams) => string>,
    stats: {
      votes: "Votes",
      mean: "Mean",
      median: "Median",
      mode: "Mode",
      noMode: "None",
      range: "Range",
      recommendation: "Suggested card",
      medianNote: (median: string, card: string) =>
        `Median is ${median} — closest card is ${card}`,
      steps: (n: number) => `${n} ${n === 1 ? "step" : "steps"} apart`,
    },
  },
  simulator: {
    title: "Consensus Engine simulator",
    intro:
      "Enter the votes from a real refinement and see how Sprintdeck would read them. " +
      "Use plain values (5, 8, ?, break) or name them (Anna:5).",
    inputLabel: "Votes",
    inputPlaceholder: "Anna:3, Ben:5, Cleo:5, Dan:21, Eve:?",
    examples: "Examples",
    addCard: "Add a card",
    clear: "Clear",
    distribution: "Distribution",
    questions: "Questions to discuss",
    noQuestions: "Nothing to discuss — you can confirm the estimate.",
    empty: "Add some votes to see the analysis.",
    invalid: (tokens: string[]) => `Not in the deck: ${tokens.join(", ")}`,
  },
};

export type Messages = typeof en;
