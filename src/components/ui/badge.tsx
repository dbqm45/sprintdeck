import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type BadgeTone = "positive" | "warning" | "negative" | "muted";

const TONES: Record<BadgeTone, string> = {
  positive: "bg-positive-tint text-positive",
  warning: "bg-warning-tint text-warning",
  negative: "bg-negative-tint text-negative",
  muted: "bg-surface-muted text-ink-muted",
};

/** Status pill with a dot. Always carries words — colour is never the only signal. */
// Minimum heights: a long state name may wrap on a narrow screen.
const SIZES = {
  md: "min-h-[30px] py-1 text-caption",
  sm: "min-h-[26px] py-0.5 text-overline",
  xs: "min-h-[22px] py-0.5 text-[11px] leading-4",
};

export function Badge({
  tone,
  size = "md",
  children,
  className,
}: {
  tone: BadgeTone;
  size?: keyof typeof SIZES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 font-medium before:shrink-0",
        SIZES[size],
        "before:size-2 before:rounded-full before:bg-current",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
