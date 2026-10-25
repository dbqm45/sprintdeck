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
const SIZES = { md: "h-[30px] text-caption", sm: "h-[26px] text-overline" };

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
        "inline-flex items-center gap-2 rounded-full px-3 font-medium",
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
