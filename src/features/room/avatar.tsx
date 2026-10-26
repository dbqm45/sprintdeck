import { cx } from "@/lib/cx";

/** Initials in a circle, e.g. "AN" for Anna. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({ name, label, className }: { name?: string; label?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted text-caption font-semibold text-ink",
        className,
      )}
    >
      {label ?? initials(name ?? "")}
    </span>
  );
}
