import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

const chipBase = "inline-flex items-center rounded-md px-3";
const CHIP_SIZES = { md: "h-9 text-body", sm: "h-[30px] text-caption" };

/** Toggle chip for filters; pass `aria-pressed` for its state. */
export function Chip({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cx(
        chipBase,
        CHIP_SIZES.md,
        "bg-surface-muted text-ink transition-colors hover:bg-surface-hover",
        "aria-pressed:bg-brand-tint aria-pressed:text-brand-ink",
        className,
      )}
      {...props}
    />
  );
}

/** Non-interactive chip, e.g. a flag raised by the Consensus Engine. */
export function Tag({
  tone = "muted",
  size = "md",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: "muted" | "brand"; size?: keyof typeof CHIP_SIZES }) {
  return (
    <span
      className={cx(
        chipBase,
        CHIP_SIZES[size],
        tone === "brand" ? "bg-brand-tint text-brand-ink" : "bg-surface-muted text-ink",
        className,
      )}
      {...props}
    />
  );
}
