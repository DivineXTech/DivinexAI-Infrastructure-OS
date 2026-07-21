import { useState } from "react";
import type { BulkVerifyRow, PackTier } from "../../lib/packEngine";
import { simulateBulk } from "../../lib/packEngine";

const OPENS = 8000;

export function BulkVerify({ tier }: { tier: PackTier }) {
  const [rows, setRows] = useState<BulkVerifyRow[] | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // synchronous — 8k packs of draws resolves in a few ms, no need to
    // fake a loading state longer than a frame
    const result = simulateBulk(tier, OPENS);
    setRows(result);
    setRunning(false);
  }

  return (
    <div className="bulk-verify">
      <div className="bulk-verify-head">
        <span className="eyebrow" style={{ marginBottom: 0 }}>Verify the Odds</span>
        <button className="verify-btn" onClick={run} disabled={running}>
          {rows ? `Re-run ${OPENS.toLocaleString()} opens` : `Simulate ${OPENS.toLocaleString()} opens`}
        </button>
      </div>
      <p className="search-subtitle" style={{ marginTop: 6 }}>
        Runs {tier.name} {OPENS.toLocaleString()} times with the exact odds table above and
        compares what actually dropped against what was published.
      </p>
      {rows && (
        <div className="table-wrap">
          <table className="pool-table mono">
            <thead>
              <tr>
                <th>Rarity</th>
                <th>Stated</th>
                <th>Observed</th>
                <th>Delta</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rarity}>
                  <td>
                    <span className={`rarity-chip rarity-${r.rarity.toLowerCase()}`}>{r.rarity}</span>
                  </td>
                  <td>{r.statedPct}%</td>
                  <td>{r.empiricalPct}%</td>
                  <td className={r.withinTolerance ? "gap-quiet" : "gap-loud"}>
                    {r.delta > 0 ? "+" : ""}{r.delta}pp
                  </td>
                  <td>{r.withinTolerance ? "✓" : "flagged"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
