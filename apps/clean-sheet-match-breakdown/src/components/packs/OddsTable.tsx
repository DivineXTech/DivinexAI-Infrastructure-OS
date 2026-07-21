import type { PackTier } from "../../lib/packEngine";
import { expectedValuePerPack } from "../../lib/packEngine";

export function OddsTable({ tier }: { tier: PackTier }) {
  const ev = expectedValuePerPack(tier);
  const ratio = Math.round((ev / tier.priceCoins) * 1000) / 10;

  return (
    <div>
      <div className="table-wrap">
        <table className="pool-table mono">
          <thead>
            <tr>
              <th>Rarity</th>
              <th>Odds per card</th>
              <th>Quick-sell value</th>
            </tr>
          </thead>
          <tbody>
            {tier.odds.map((row) => (
              <tr key={row.rarity}>
                <td>
                  <span className={`rarity-chip rarity-${row.rarity.toLowerCase()}`}>
                    {row.rarity}
                  </span>
                </td>
                <td>{row.probability}%</td>
                <td>{row.marketValueCoins.toLocaleString()}c</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ev-callout">
        <div>
          <span className="eyebrow">Published expected value</span>
          <p>
            {tier.cardsPerPack} cards for {tier.priceCoins.toLocaleString()}c returns{" "}
            <strong>{ev.toLocaleString()}c</strong> in average quick-sell value —{" "}
            <strong>{ratio}%</strong> of what you paid.
          </p>
        </div>
      </div>
    </div>
  );
}
