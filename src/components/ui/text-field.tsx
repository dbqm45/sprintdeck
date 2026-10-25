"use client";

import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Geist Mono — room codes, links, vote input. */
  mono?: boolean;
}

const inputClasses = (error: boolean, mono: boolean | undefined) =>
  cx(
    "w-full rounded-md border bg-surface px-3.5 text-body text-ink outline-none transition-[border-color,box-shadow]",
    "placeholder:text-ink-faint focus:border-focus focus:shadow-[0_0_0_3px_var(--brand-tint)] focus-visible:outline-none",
    error ? "border-negative" : "border-line-strong",
    mono && "font-mono text-caption tracking-[0.02em]",
  );

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-caption text-negative">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-caption text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({ label, hint, error, mono, className, ...props }: FieldProps & ComponentProps<"input">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        className={cx(inputClasses(Boolean(error), mono), "h-11", className)}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, mono, className, ...props }: FieldProps & ComponentProps<"textarea">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        className={cx(inputClasses(Boolean(error), mono), "resize-y py-2.5", className)}
        {...props}
      />
    </FieldShell>
  );
}
