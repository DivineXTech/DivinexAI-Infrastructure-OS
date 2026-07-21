import type { FactorBreakdown, FactorKey } from "../lib/breakdownEngine";

export function ImpactBars({
  factors,
  primary,
}: {
  factors: FactorBreakdown[];
  primary: FactorKey;
}) {
  return (
    <div className="impact-bars">
      {factors.map((f) => (
        <div className="impact-row" key={f.key}>
          <div className="impact-label-row">
            <span className={`impact-label ${f.key === primary ? "is-primary" : ""}`}>
              {f.label}
            </span>
            <span className="impact-pct mono">{f.pct}%</span>
          </div>
          <div className="impact-track">
            <div
              className={`impact-fill impact-${f.key} ${f.key === primary ? "is-primary" : ""}`}
              style={{ width: `${Math.max(f.pct, 2)}%` }}
            />
          </div>
          <p className="impact-detail">{f.detail}</p>
        </div>
      ))}
    </div>
  );
}
