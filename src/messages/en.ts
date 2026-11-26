import type { RoomErrorCode } from "@/lib/supabase/rooms";
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
      title: "Start a room",
      body: "Free, no account needed. Share the link with your team.",
      roomTitle: "Room title",
      roomTitlePlaceholder: "Sprint 42 refinement",
      yourName: "Your name",
      hostHint: "You'll host the room. You can hand it over later.",
      deck: "Deck",
      create: "Create room",
      creating: "Creating…",
      or: "or join with a link",
      linkPlaceholder: "Paste a room link or code",
      join: "Join",
      invalidLink: "That doesn't look like a room link.",
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
  room: {
    loading: "Loading the room…",
    verify: {
      title: "One quick check",
      body: "Confirm you're a person to open the room. It only takes a moment.",
    },
    configError: "Sprintdeck isn't connected to its database. Set the Supabase keys from .env.example.",
    notFound: {
      title: "This room doesn't exist",
      body: "The link may be mistyped, or the room was deleted after 90 days without activity.",
      back: "Back to start",
    },
    join: {
      invitedTo: "You're invited to",
      here: (names: string[], total: number) =>
        total === 0
          ? "Nobody is here yet"
          : `${names.slice(0, 2).join(", ")}${total > 2 ? ` and ${total - 2} ${total - 2 === 1 ? "other" : "others"}` : ""} ${total === 1 ? "is" : "are"} here`,
      current: (title: string, position: number, count: number) => `Item ${position} of ${count} · ${title}`,
      voting: "Voting",
      revealed: "Revealed",
      yourName: "Your name",
      nameHint: "Votes are shown with names after reveal.",
      joinAs: "Join as",
      voter: "Voter",
      observer: "Observer",
      observerHint: "Observers follow along without voting — handy for the PO.",
      submit: "Join room",
      joining: "Joining…",
      noAccount: "No account needed",
      retention: "Rooms are deleted after 90 days without activity. Data stays in the EU.",
    },
    nav: {
      invite: "Copy link",
      copied: "Link copied",
      summary: "Summary",
      backToRoom: "Back to room",
    },
    hostLink: {
      title: "Save your host link",
      body: "It lets you take the host role back from another device. It is shown only once.",
      copy: "Copy host link",
      dismiss: "I've saved it",
    },
    decks: { fibonacci: "Fibonacci", risk: "Risk" } as Record<string, string>,
    itemOf: (position: number, count: number, round: number | null) =>
      `Item ${position} of ${count}${round ? ` · Round ${round}` : ""}`,
    empty: {
      host: "Add the first item to estimate — the agenda is on the right.",
      guest: "Waiting for the host to add an item.",
    },
    notStarted: {
      host: "Start voting when the team is ready.",
      guest: "Waiting for the host to start voting.",
      start: "Start voting",
    },
    voting: {
      progress: (voted: number, total: number) => `${voted} of ${total}`,
      voted: "voted",
      waitingFor: (names: string[]) => `Waiting for ${names.join(", ")}`,
      everyone: "Everyone has voted",
      reveal: "Reveal cards",
      yourCard: "Your card",
      changeHint: "You can change it until the host reveals",
      observing: "You're observing — you don't vote.",
      seat: { voted: "voted", thinking: "thinking…", you: "You" },
      seatLabel: (name: string, voted: boolean) => `${name}: ${voted ? "voted" : "not voted yet"}`,
    },
    revealed: {
      suggested: "suggested",
      votes: (n: number, total: number) => `${n}/${total} votes`,
      statistics: "Statistics",
      questions: "Questions",
      tabsLabel: "Round details",
      noQuestions: "Nothing to discuss — you can confirm the estimate.",
      revote: "Re-vote",
      skip: "Skip item",
      estimate: "Estimate",
      note: "Decision note (optional)",
      notePlaceholder: "Why this estimate, what we assumed, follow-ups…",
      confirm: (label: string) => `Confirm ${label}`,
      waitingForHost: "The host confirms the estimate or starts a re-vote.",
    },
    done: {
      estimated: (label: string) => `Estimated: ${label}`,
      skipped: "Skipped",
      allDone: "Every item is estimated or skipped.",
      endSession: "End session",
    },
    team: {
      title: (online: number, total: number) => `Team · ${online} of ${total} online`,
      host: "host",
      observer: "observer",
      you: "you",
      online: "online",
      offline: "offline",
      voteMode: "Vote",
      watchMode: "Watch",
      modeLabel: "Your role",
      manage: "show actions",
      makeHost: "Make host",
      makeObserver: "Make observer",
      makeVoter: "Make voter",
      confirmHost: (name: string) => `Hand the host role to ${name}? You'll become a voter.`,
      handOver: "Hand over",
      cancel: "Cancel",
    },
    agenda: {
      title: (done: number, total: number) => `Agenda · ${done} of ${total} done`,
      add: "Add",
      addLabel: "New item",
      addPlaceholder: "Add an item to estimate",
      current: "Current",
      setCurrent: (title: string) => `Make “${title}” the current item`,
    },
    summary: {
      eyebrow: (date: string) => `Session summary · ${date}`,
      copyMarkdown: "Copy as Markdown",
      copied: "Copied",
      downloadCsv: "Download CSV",
      estimated: "Items estimated",
      skipped: (n: number) => `${n} skipped`,
      totalPoints: "Total points",
      average: (avg: string) => `Avg ${avg} per item`,
      highRisk: "High risk or above",
      firstRound: "Consensus in round 1",
      roundsPerItem: "Rounds per item",
      columns: { item: "Item", estimate: "Estimate", rounds: "Rounds", consensus: "Consensus" },
      none: "–",
      closed: "This session has ended.",
    },
    errors: {
      not_authenticated: "Your session expired. Reload the page.",
      room_not_found: "This room doesn't exist.",
      not_a_member: "Join the room first.",
      not_host: "Only the host can do that.",
      room_closed: "This session has ended.",
      rate_limited: "Too many attempts — try again in an hour.",
      invalid_title: "Give it a title (up to 120 characters for rooms, 200 for items).",
      invalid_display_name: "Enter a name between 1 and 32 characters.",
      invalid_description: "The description is too long.",
      invalid_note: "The note is too long (2000 characters max).",
      invalid_role: "That role isn't available.",
      invalid_host_secret: "That host link isn't valid for this room.",
      invalid_item_order: "The item order is out of date — reload and try again.",
      invalid_card: "That card isn't in this room's deck.",
      invalid_estimate: "Pick a card from the deck as the estimate.",
      invalid_deck: "Unknown deck.",
      host_required: "Hand the host role over first.",
      participant_not_found: "That person isn't in the room anymore.",
      item_not_found: "That item no longer exists.",
      item_already_estimated: "This item is already estimated.",
      too_many_items: "A room can hold up to 200 items.",
      round_not_found: "That round no longer exists.",
      round_not_voting: "Voting on this round has ended.",
      round_in_progress: "Finish the current round first.",
      observers_cannot_vote: "Observers don't vote — switch to Vote first.",
      room_full: "This room is full (50 people).",
      captcha_failed: "The human check failed or expired. Try again.",
      offline: "You're offline. The room catches up as soon as you're back — then try again.",
      unknown: "Something went wrong. Try again.",
    } satisfies Record<RoomErrorCode | "captcha_failed" | "offline" | "unknown", string>,
  },
  suite: {
    signIn: "Sign in with the suite",
    signingIn: "Signing you in…",
    refused: {
      "not-member": "Your suite account is not a member of the organization that uses this Sprintdeck.",
      "no-role": "Your suite account has no role in Sprintdeck. Ask your administrator for the role member.",
      failed: "The suite sign-in did not work. Try again.",
    } as Record<string, string>,
  },
  fromPdi: {
    title: "A room from DI Decision",
    lead: "The agenda “Discuss with team” becomes a room: one item per topic, the Risk deck, you as the host.",
    signInFirst: "Sign in with the suite first: the room is opened in your name.",
    creating: "Opening the room…",
    refused: {
      off: "This Sprintdeck is not connected to DI Decision.",
      signature: "This link was not made by DI Decision, or it was changed.",
      expired: "This link has expired. Open the room again from DI Decision.",
      malformed: "This agenda cannot be turned into a room.",
    } as Record<string, string>,
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
