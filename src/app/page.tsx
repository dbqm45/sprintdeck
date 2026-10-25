import Link from "next/link";
import { en } from "@/messages/en";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">{en.app.name}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">{en.app.tagline}</p>
      <div>
        <Link
          href="/simulator"
          className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {en.simulator.title} →
        </Link>
      </div>
    </main>
  );
}
