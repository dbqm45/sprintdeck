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
      high_risk: "This looks risky to ship as specified",
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
      outlier_knowledge: ({ people }) =>
        `What ${people.length === 1 ? "does" : "do"} ${list(people)} know about this that the rest of us don't?`,
      how_to_verify: () => "How will we know it works?",
      what_breaks: () => "What breaks if this is wrong?",
      criteria_for_newcomer: () => "Are the acceptance criteria precise enough for someone who wasn't here?",
      reduce_risk: () => "Can we make it safer to ship — smaller steps, a feature flag, a way back?",
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
      headers: ["Signal", "Value"] as [string, string],
      votesCaption: (unknown: number, breaks: number) =>
        unknown + breaks === 0 ? "All numeric" : `Plus ${unknown} “?” and ${breaks} ☕`,
    },
    chart: {
      half: (n: number) => `Half the team · ${n} ${n === 1 ? "vote" : "votes"}`,
      summary: (entries: string[]) =>
        entries.length ? `Vote distribution — ${entries.join(", ")}` : "Vote distribution — no numeric votes",
      nonNumeric: (unknown: number, breaks: number) =>
        [unknown && `${unknown} × “?”`, breaks && `${breaks} × ☕`].filter(Boolean).join(" · ") +
        " — not shown in the chart",
    },
  },
  landing: {
    nav: { simulator: "Simulator" },
    overline: "Planning Poker with a Consensus Engine",
    hero: ["Don't just collect votes.", "Reach a shared decision."],
    lead:
      "Sprintdeck shows your team why estimates differ — outliers, two camps, hidden uncertainty — " +
      "and suggests the questions worth asking before you commit.",
    preview: {
      title: "Payment retries · revealed",
      votes: "Anna:5, Ben:5, Cleo:3, Dan:21, Eve:5, Filip:3, Gosia:2, Hubert:5",
    },
    start: {
      title: "Try it on your last refinement",
      body:
        "Rooms for live sessions are on the way. Meanwhile, paste the votes from a real refinement " +
        "and see how the Consensus Engine reads them.",
      cta: "Open the simulator",
    },
    steps: [
      {
        title: "Vote in secret",
        body: "Everyone picks a card. Nobody sees a value until the host reveals — no anchoring.",
      },
      {
        title: "See why you disagree",
        body: "The Consensus Engine reads the spread: neighbours, an outlier, two camps or wide uncertainty.",
      },
      {
        title: "Decide together",
        body: "Discuss the suggested questions, re-vote if needed, confirm the estimate and export the session.",
      },
    ],
  },
  simulator: {
    title: "Consensus Engine simulator",
    intro:
      "Enter the votes from a real refinement and see how Sprintdeck would read them. " +
      "Use the deck's values (5, 8, ?, break — or low, very high) and name them if you like (Anna:5).",
    inputLabel: "Votes",
    inputPlaceholder: {
      fibonacci: "Anna:3, Ben:5, Cleo:5, Dan:21, Eve:?",
      risk: "Anna:low, Ben:medium, Cleo:high, Dan:?",
    },
    deck: "Deck",
    deckHint: {
      fibonacci: "How much work is it? Story points.",
      risk: "How risky is it to ship this as specified?",
    },
    examples: "Examples",
    addCard: "Add a card",
    clear: "Clear",
    back: "Back to start",
    analysis: "Analysis",
    suggested: "suggested",
    noSuggestion: "No suggestion yet",
    tabsLabel: "Analysis details",
    statistics: "Statistics",
    distribution: "Distribution",
    questions: "Questions to discuss",
    noQuestions: "Nothing to discuss — you can confirm the estimate.",
    empty: "Add some votes to see the analysis.",
    invalid: (tokens: string[]) => `Not in the deck: ${tokens.join(", ")}`,
  },
};

export type Messages = typeof en;
