import { cx } from "@/lib/cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Single choice among 2–3 options, shown as one pill track (e.g. Voter / Observer). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-surface-muted p-1">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cx(
              "h-10 rounded-sm text-label transition-colors",
              checked ? "bg-surface-raised text-ink shadow-[0_1px_2px_rgba(26,25,24,0.08)]" : "text-ink-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
