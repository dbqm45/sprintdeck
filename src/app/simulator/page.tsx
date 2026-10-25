import type { Metadata } from "next";
import Link from "next/link";
import { Simulator } from "@/features/simulator/simulator";
import { en } from "@/messages/en";

export const metadata: Metadata = {
  title: `${en.simulator.title} · ${en.app.name}`,
};

export default function SimulatorPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          ← {en.app.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{en.simulator.title}</h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">{en.simulator.intro}</p>
      </header>
      <Simulator />
    </main>
  );
}
