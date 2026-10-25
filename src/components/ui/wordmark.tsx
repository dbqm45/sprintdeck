import { en } from "@/messages/en";

/** Placeholder wordmark until a real logo exists: name + a tilted card. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[20px] leading-6 font-semibold tracking-[-0.02em] text-ink">
      <span aria-hidden="true" className="h-5 w-3.5 -rotate-8 rounded-[4px] bg-brand" />
      {en.app.name}
    </span>
  );
}
