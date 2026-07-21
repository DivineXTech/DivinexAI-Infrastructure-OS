import type { Queuer } from "../../lib/matchmakingEngine";

const SCENARIO_LABEL: Record<string, string> = {
  q1: "F2P grinder, high skill",
  q2: "Whale, average skill",
  q3: "Brand new player",
  q4: "Mid-ladder veteran",
};

export function QueuerPicker({
  queuers,
  activeId,
  onSelect,
}: {
  queuers: Queuer[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="match-picker">
      <span className="eyebrow">Who's queuing</span>
      <div className="picker-row">
        {queuers.map((q) => (
          <button
            key={q.id}
            className={`picker-chip ${q.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(q.id)}
          >
            {SCENARIO_LABEL[q.id] ?? q.name}
          </button>
        ))}
      </div>
    </div>
  );
}
