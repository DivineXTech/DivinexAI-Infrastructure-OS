import { MATCH_SPEND_CAP, SPEND_PROFILES, computeSpendCeiling } from "../../lib/spendCeiling";

const MAX_SCALE = 15; // matches spendCeiling.ts's soft purchasable max, for bar width

export function SpendCeilingPanel() {
  const results = SPEND_PROFILES.map(computeSpendCeiling);

  return (
    <div>
      <p className="search-subtitle">
        Spend keeps growing your collection — it stops growing what a single match can do about it.
        Every profile below is capped at a <strong>+{MATCH_SPEND_CAP} OVR-equivalent</strong> swing
        per match, no matter how much was purchased.
      </p>
      <div className="ceiling-rows">
        {results.map((r) => (
          <div className="ceiling-row" key={r.tier}>
            <div className="ceiling-label">
              <span>{r.tier}</span>
              <span className="mono ceiling-value">
                {r.purchasedOVR} OVR bought
                {r.wasCapped && <span className="ceiling-capped"> → capped at {r.cappedMatchSwing}</span>}
              </span>
            </div>
            <div className="ceiling-track">
              <div
                className="ceiling-fill-full"
                style={{ width: `${Math.min((r.purchasedOVR / MAX_SCALE) * 100, 100)}%` }}
              />
              <div
                className="ceiling-fill-capped"
                style={{ width: `${(r.cappedMatchSwing / MAX_SCALE) * 100}%` }}
              />
              <div
                className="ceiling-cap-line"
                style={{ left: `${(MATCH_SPEND_CAP / MAX_SCALE) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="ceiling-legend">
        <span className="legend-swatch legend-full" /> squad-wide advantage purchased
        <span className="legend-swatch legend-capped" /> what it's worth in any one match
        <span className="legend-swatch legend-line" /> the cap
      </p>
    </div>
  );
}
