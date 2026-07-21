import type { DrawnCard } from "../../lib/packEngine";

export function CardReveal({
  cards,
  pityTriggered,
}: {
  cards: DrawnCard[];
  pityTriggered: boolean;
}) {
  return (
    <div>
      <div className="card-grid">
        {cards.map((c, i) => (
          <div key={i} className={`drawn-card rarity-bg-${c.rarity.toLowerCase()}`}>
            {c.rarity}
          </div>
        ))}
      </div>
      {pityTriggered && (
        <p className="pity-fired">Pity protection guaranteed that TOTW card — you'd gone the full window without one.</p>
      )}
    </div>
  );
}
