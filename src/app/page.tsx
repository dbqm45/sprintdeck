import Link from "next/link";
import { analyzeRound } from "@/lib/consensus";
import { FIBONACCI_DECK } from "@/lib/deck";
import { buttonClasses } from "@/components/ui/button";
import { Tag } from "@/components/ui/chip";
import { Eyebrow, Panel, PanelSection } from "@/components/ui/panel";
import { Wordmark } from "@/components/ui/wordmark";
import { ConsensusBadge } from "@/features/consensus/consensus-badge";
import { QuestionList } from "@/features/consensus/question-list";
import { VoteDistribution } from "@/features/consensus/vote-distribution";
import { CreateRoomForm } from "@/features/room/create-room-form";
import { parseVotes } from "@/features/simulator/parse-votes";
import { en } from "@/messages/en";

const t = en.landing;

export default function Home() {
  // A real round run through the engine — the landing shows what it does, not an illustration.
  const preview = parseVotes(t.preview.votes, FIBONACCI_DECK);
  const analysis = analyzeRound(preview.votes, FIBONACCI_DECK);
  const firstQuestion = { ...analysis, questions: analysis.questions.slice(0, 1) };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <nav className="flex h-16 items-center justify-between">
        <Wordmark />
        <Link href="/simulator" className={buttonClasses({ variant: "outline" })}>
          {t.nav.simulator}
        </Link>
      </nav>

      <div className="grid items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14 lg:py-14">
        <div className="flex flex-col gap-6">
          <Tag tone="brand" size="sm" className="self-start">
            {t.overline}
          </Tag>
          <h1 className="m-0 text-[36px]/[40px] font-semibold tracking-[-0.03em] sm:text-hero">
            {t.hero[0]}
            <br />
            {t.hero[1]}
          </h1>
          <p className="m-0 max-w-[460px] text-lead text-ink-muted">{t.lead}</p>

          <Panel className="max-w-[420px]">
            <PanelSection className="p-5">
              <div className="mb-3 flex flex-col items-start gap-2">
                <Eyebrow className="text-label font-normal">{t.preview.title}</Eyebrow>
                <ConsensusBadge state={analysis.state} size="sm" />
              </div>
              <VoteDistribution analysis={analysis} deck={FIBONACCI_DECK} height={96} compact />
              <div className="mt-2 border-t border-line">
                <QuestionList analysis={firstQuestion} deck={FIBONACCI_DECK} names={preview.names} emptyText="" />
              </div>
            </PanelSection>
          </Panel>
        </div>

        <Panel>
          <PanelSection className="p-8">
            <CreateRoomForm />
          </PanelSection>
        </Panel>
      </div>

      <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
        {t.steps.map((step, index) => (
          <li key={step.title}>
            <Panel className="h-full">
              <PanelSection>
                <div className="text-caption font-semibold text-brand-ink">{String(index + 1).padStart(2, "0")}</div>
                <h3 className="m-0 mt-2 text-[16px] leading-[22px] font-medium">{step.title}</h3>
                <p className="m-0 mt-1 text-label font-normal text-ink-muted">{step.body}</p>
              </PanelSection>
            </Panel>
          </li>
        ))}
      </ol>
    </main>
  );
}
