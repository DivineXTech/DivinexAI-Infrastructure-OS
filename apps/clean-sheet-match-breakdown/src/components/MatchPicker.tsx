import type { MatchData } from "../lib/breakdownEngine";

const SCENARIO_LABEL: Record<string, string> = {
  "spend-gap": "Spend really was the reason",
  "tactical-loss": "Outplayed tactically",
  "execution-loss": "Outplayed them, still lost",
  "variance-loss": "Bad luck decided it",
};

export function MatchPicker({
  matches,
  activeId,
  onSelect,
}: {
  matches: MatchData[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="match-picker">
      <span className="eyebrow">Sample match</span>
      <div className="picker-row">
        {matches.map((m) => (
          <button
            key={m.id}
            className={`picker-chip ${m.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(m.id)}
          >
            {SCENARIO_LABEL[m.id] ?? m.id}
          </button>
        ))}
      </div>
    </div>
  );
}
