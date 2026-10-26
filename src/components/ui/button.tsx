import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  // The next step of a round (Reveal cards). One per view.
  primary: "border-transparent bg-ink text-surface hover:opacity-90",
  // The one commit action of a screen (Confirm, Create room, Join room).
  accent: "border-transparent bg-brand-strong text-on-brand hover:bg-brand",
  outline: "border-line-strong bg-surface text-ink hover:bg-surface-muted",
  ghost: "border-transparent bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  /** `sm`: 32px, for inline actions inside a panel; `lg`: 44px, next to a text field. */
  size?: "md" | "sm" | "lg";
  /** Full width, 44px tall — for the main action of a form. */
  block?: boolean;
  className?: string;
}

/** Button classes, also usable on links (`<Link className={buttonClasses(…)}>`). */
export function buttonClasses({ variant = "outline", size = "md", block, className }: ButtonStyleOptions = {}) {
  return cx(
    // Each variant sets its own border colour, so none competes with a base one.
    "inline-flex items-center gap-1.5 rounded-md border whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-muted disabled:text-ink-faint",
    block
      ? "h-11 w-full justify-center px-4 text-label"
      : { sm: "h-8 px-2 text-caption font-medium", md: "h-10 px-4 text-label", lg: "h-11 px-4 text-label" }[size],
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyleOptions) {
  return <button type={type} className={buttonClasses({ variant, size, block, className })} {...props} />;
}

export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      className={cx("size-2.5", className)}
    >
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  );
}
