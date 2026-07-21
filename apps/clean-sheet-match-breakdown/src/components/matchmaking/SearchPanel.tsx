import type { MatchResult } from "../../lib/matchmakingEngine";

const SKILL_BANDS = [50, 120, 250, 500];

export function SearchPanel({
  title,
  subtitle,
  result,
  roundsShown,
  revealed,
  tone,
}: {
  title: string;
  subtitle: string;
  result: MatchResult;
  roundsShown: number;
  revealed: boolean;
  tone: "legacy" | "fair";
}) {
  const totalRounds = result.searchRound ?? 1;

  return (
    <div className={`search-panel search-panel-${tone}`}>
      <span className="eyebrow">{title}</span>
      <p className="search-subtitle">{subtitle}</p>

      {tone === "fair" ? (
        <ul className="search-rounds">
          {Array.from({ length: totalRounds }).map((_, i) => {
            const active = i < roundsShown;
            const isLast = i === totalRounds - 1;
            return (
              <li
                key={i}
                className={`search-round ${active ? "active" : ""} ${isLast && revealed ? "found" : ""}`}
              >
                <span className="round-dot" />
                <span>
                  Round {i + 1} · ±{SKILL_BANDS[i]} skill
                  {isLast && revealed ? " — found" : active ? " — searching…" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={`search-rounds`}>
          <div className={`search-round ${roundsShown > 0 ? "active" : ""} ${revealed ? "found" : ""}`}>
            <span className="round-dot" />
            <span>
              Nearest available squad rating
              {revealed ? " — found" : roundsShown > 0 ? " — searching…" : ""}
            </span>
          </div>
        </div>
      )}

      {revealed && (
        <div className="opponent-reveal">
          <div className="opponent-name">{result.opponent.name}</div>
          <div className="opponent-stats mono">
            {result.opponent.squadOVR} OVR · {result.opponent.skillRating} skill · {result.opponent.pingMs}ms
          </div>
          <div className="opponent-gaps">
            <span className={Math.abs(result.ovrGap) >= 15 ? "gap-loud" : ""}>
              OVR gap {result.ovrGap > 0 ? "+" : ""}{result.ovrGap}
            </span>
            <span className={result.skillGap >= 150 ? "gap-loud" : "gap-quiet"}>
              Skill gap {result.skillGap}
            </span>
          </div>
          <p className="opponent-rationale">{result.rationale}</p>
        </div>
      )}
    </div>
  );
}
