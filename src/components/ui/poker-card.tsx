import type { ComponentProps } from "react";
import type { Card } from "@/lib/deck";
import { cx } from "@/lib/cx";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-16 w-11 text-[20px] leading-6",
  md: "h-20 w-14 text-card",
  lg: "h-[104px] w-[72px] text-[28px] leading-8",
};

// Word labels ("Very high") get a wider card with a smaller font.
const WORD_SIZES: Record<Size, string> = {
  sm: "h-16 min-w-16 px-3 text-label font-semibold",
  md: "h-20 min-w-20 px-3 text-body font-semibold",
  lg: "h-[104px] min-w-24 px-3 text-heading font-semibold",
};

const sizeClasses = (card: Card, size: Size) => (card.label.length > 2 ? WORD_SIZES[size] : SIZES[size]);

const base = "inline-flex shrink-0 items-center justify-center rounded-md font-semibold tabular-nums";

/** A card from the deck the player can pick. Selected = `aria-pressed`. */
export function PokerCard({
  card,
  selected = false,
  size = "md",
  className,
  type = "button",
  ...props
}: { card: Card; selected?: boolean; size?: Size } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        base,
        sizeClasses(card, size),
        "border transition-[translate,box-shadow,background-color] duration-150 ease-out",
        selected
          ? "-translate-y-1.5 border-brand bg-brand text-on-brand shadow-lift"
          : cx("border-line-strong bg-surface hover:-translate-y-0.5", card.kind === "numeric" ? "text-ink" : "text-ink-muted"),
        className,
      )}
      {...props}
    >
      {card.label}
    </button>
  );
}

/** A seat's card on the table: face down once voted, a dashed outline while thinking. */
export function HiddenCard({ voted, size = "lg", label }: { voted: boolean; size?: Size; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        base,
        SIZES[size],
        voted
          ? "bg-surface-muted bg-[radial-gradient(var(--line-strong)_1.5px,transparent_1.6px)] bg-size-[10px_10px]"
          : "border-[1.5px] border-dashed border-line-strong",
      )}
    />
  );
}
