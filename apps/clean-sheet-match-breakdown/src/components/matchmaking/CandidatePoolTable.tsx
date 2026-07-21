import { useState } from "react";
import type { Candidate, MatchResult } from "../../lib/matchmakingEngine";

export function CandidatePoolTable({
  pool,
  legacy,
  fair,
}: {
  pool: Candidate[];
  legacy: MatchResult;
  fair: MatchResult;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...pool].sort((a, b) => a.skillRating - b.skillRating);

  return (
    <div className="math-reveal">
      <button className="math-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide the queue" : "Show the queue"}
        <span className="chevron">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="table-wrap">
          <table className="pool-table mono">
            <thead>
              <tr>
                <th>Player</th>
                <th>OVR</th>
                <th>Skill</th>
                <th>Ping</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const isLegacy = c.id === legacy.opponent.id;
                const isFair = c.id === fair.opponent.id;
                return (
                  <tr
                    key={c.id}
                    className={isLegacy ? "row-legacy" : isFair ? "row-fair" : ""}
                  >
                    <td className="pool-name">
                      {c.name}
                      {isLegacy && <span className="pool-tag tag-legacy">legacy pick</span>}
                      {isFair && <span className="pool-tag tag-fair">fair pick</span>}
                    </td>
                    <td>{c.squadOVR}</td>
                    <td>{c.skillRating}</td>
                    <td>{c.pingMs}ms</td>
                    <td>{c.spendTier}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
