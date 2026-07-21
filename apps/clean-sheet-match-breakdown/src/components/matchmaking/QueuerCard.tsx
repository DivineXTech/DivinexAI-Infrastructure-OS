import type { Queuer } from "../../lib/matchmakingEngine";

export function QueuerCard({ queuer }: { queuer: Queuer }) {
  return (
    <div className="queuer-card">
      <div className="queuer-row">
        <div>
          <div className="queuer-name">{queuer.name}</div>
          <div className="queuer-meta">{queuer.spendTier} · {queuer.pingMs}ms</div>
        </div>
        <div className="queuer-stats">
          <div className="queuer-stat">
            <span className="mono">{queuer.squadOVR}</span>
            <span className="queuer-stat-label">Squad OVR</span>
          </div>
          <div className="queuer-stat">
            <span className="mono">{queuer.skillRating}</span>
            <span className="queuer-stat-label">Skill Rating</span>
          </div>
        </div>
      </div>
    </div>
  );
}
