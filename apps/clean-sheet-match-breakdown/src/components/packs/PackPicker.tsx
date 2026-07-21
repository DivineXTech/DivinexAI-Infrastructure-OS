import type { PackTier } from "../../lib/packEngine";

export function PackPicker({
  tiers,
  activeId,
  onSelect,
}: {
  tiers: PackTier[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="match-picker">
      <span className="eyebrow">Pack tier</span>
      <div className="picker-row">
        {tiers.map((t) => (
          <button
            key={t.id}
            className={`picker-chip ${t.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
