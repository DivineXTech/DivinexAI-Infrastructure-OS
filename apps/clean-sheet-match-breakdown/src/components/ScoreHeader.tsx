import type { MatchData } from "../lib/breakdownEngine";

export function ScoreHeader({ match }: { match: MatchData }) {
  const { you, opponent } = match;
  return (
    <div className="score-header">
      <div className="score-header-top">
        <span className="eyebrow">{match.competition}</span>
        <span className="ping mono">{match.pingMs}ms ping</span>
      </div>
      <div className="score-row">
        <div className="team">
          <div className="badge you">{initials(you.name)}</div>
          <div className="team-name">{you.name}</div>
          <div className="team-meta">{you.squadOVR} OVR · {you.spendTier}</div>
        </div>
        <div className="score mono">
          {you.score}<span className="dash">–</span>{opponent.score}
        </div>
        <div className="team">
          <div className="badge opp">{initials(opponent.name)}</div>
          <div className="team-name">{opponent.name}</div>
          <div className="team-meta">{opponent.squadOVR} OVR · {opponent.spendTier}</div>
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
