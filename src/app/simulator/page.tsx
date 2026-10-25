import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { Simulator } from "@/features/simulator/simulator";
import { en } from "@/messages/en";

export const metadata: Metadata = {
  title: `${en.simulator.title} · ${en.app.name}`,
};

export default function SimulatorPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 sm:px-6">
      <nav className="flex h-16 items-center justify-between">
        <Link href="/" aria-label={en.simulator.back}>
          <Wordmark />
        </Link>
        <Link href="/" className={buttonClasses({ variant: "ghost" })}>
          {en.simulator.back}
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-[32px] leading-[38px] font-semibold tracking-[-0.02em]">{en.simulator.title}</h1>
        <p className="m-0 max-w-2xl text-body text-ink-muted">{en.simulator.intro}</p>
      </header>
      <Simulator />
    </main>
  );
}
