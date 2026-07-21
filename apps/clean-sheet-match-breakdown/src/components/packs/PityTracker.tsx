import type { PackTier } from "../../lib/packEngine";

export function PityTracker({
  tier,
  packsSinceLastTotw,
}: {
  tier: PackTier;
  packsSinceLastTotw: number;
}) {
  const remaining = Math.max(0, tier.pityThreshold - packsSinceLastTotw);
  const pct = Math.min(100, (packsSinceLastTotw / tier.pityThreshold) * 100);

  return (
    <div className="pity-tracker">
      <div className="pity-row">
        <span className="eyebrow" style={{ marginBottom: 0 }}>Pity Counter</span>
        <span className="mono pity-count">
          {packsSinceLastTotw}/{tier.pityThreshold}
        </span>
      </div>
      <div className="impact-track">
        <div className="impact-fill is-primary impact-execution" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="pity-caption">
        {remaining === 0
          ? "Your next pack is guaranteed a TOTW-or-better card."
          : `Guaranteed TOTW-or-better within ${remaining} more ${tier.name.toLowerCase()}${remaining === 1 ? "" : "s"} if you don't pull one naturally first.`}
      </p>
    </div>
  );
}
