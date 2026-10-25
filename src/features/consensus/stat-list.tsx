import { cx } from "@/lib/cx";

export interface StatRow {
  title: string;
  caption?: string;
  value: string;
  /** Signed change against the previous round, e.g. "−1 step". */
  delta?: { text: string; direction: "better" | "worse" };
}

/** Round statistics: title with a muted reason, a value and an optional signed change. */
export function StatList({ rows, headers }: { rows: StatRow[]; headers: [string, string, string?] }) {
  const hasDelta = rows.some((row) => row.delta);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-label font-normal text-ink-muted">
          <th className="pb-3 text-left font-normal">{headers[0]}</th>
          <th className="pb-3 pl-6 text-right font-normal">{headers[1]}</th>
          {hasDelta && <th className="pb-3 pl-6 text-right font-normal">{headers[2]}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.title}>
            <td className="py-3 align-middle">
              <div className="text-[16px] leading-[22px] font-medium">{row.title}</div>
              {row.caption && <div className="mt-0.5 text-caption text-ink-muted">{row.caption}</div>}
            </td>
            <td className="py-3 pl-6 text-right align-middle tabular-nums">{row.value}</td>
            {hasDelta && (
              <td
                className={cx(
                  "py-3 pl-6 text-right align-middle font-medium tabular-nums",
                  row.delta?.direction === "better" ? "text-positive" : "text-negative",
                )}
              >
                {row.delta?.text}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
