import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** White rounded container on `canvas` — one topic per panel. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("overflow-hidden rounded-xl bg-surface shadow-panel", className)} {...props} />;
}

/** A padded panel section; consecutive sections are split by a hairline. */
export function PanelSection({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("p-6 [&+&]:border-t [&+&]:border-line", className)} {...props} />;
}

/** Muted label at the top of a panel section. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  // `className` may set another text size; the default is `text-body`.
  return <div className={cx("flex items-center gap-1.5 text-ink-muted", className ?? "text-body")}>{children}</div>;
}
