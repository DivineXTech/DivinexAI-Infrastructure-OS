import { useMemo, useState } from "react";
import { PACK_TIERS } from "../data/packs";
import type { DrawnCard } from "../lib/packEngine";
import { nextPacksSinceLastTotw, openPackWithPity } from "../lib/packEngine";
import { PackPicker } from "../components/packs/PackPicker";
import { OddsTable } from "../components/packs/OddsTable";
import { CardReveal } from "../components/packs/CardReveal";
import { PityTracker } from "../components/packs/PityTracker";
import { BulkVerify } from "../components/packs/BulkVerify";
import { SpendCeilingPanel } from "../components/packs/SpendCeilingPanel";

export default function PackOdds() {
  const [activeId, setActiveId] = useState(PACK_TIERS[0].id);
  const tier = useMemo(() => PACK_TIERS.find((t) => t.id === activeId)!, [activeId]);

  const [pityCounters, setPityCounters] = useState<Record<string, number>>({});
  const packsSinceLastTotw = pityCounters[tier.id] ?? 0;

  const [lastDraw, setLastDraw] = useState<{ cards: DrawnCard[]; pityTriggered: boolean } | null>(null);

  function handleSelectTier(id: string) {
    setActiveId(id);
    setLastDraw(null);
  }

  function handleOpen() {
    const result = openPackWithPity(tier, packsSinceLastTotw, Math.random);
    setLastDraw(result);
    setPityCounters((prev) => ({
      ...prev,
      [tier.id]: nextPacksSinceLastTotw(packsSinceLastTotw, result.cards),
    }));
  }

  return (
    <div>
      <header className="page-header">
        <span className="eyebrow">Clean Sheet · Store</span>
        <h1 className="display">Pack Odds</h1>
        <p className="page-sub">
          Every rarity's real odds and quick-sell value, published before you
          buy — and a live simulator that proves the odds are what's stated,
          not what's convenient.
        </p>
      </header>

      <PackPicker tiers={PACK_TIERS} activeId={activeId} onSelect={handleSelectTier} />

      <main className="card">
        <div className="section" style={{ borderTop: "none" }}>
          <span className="eyebrow">Odds &amp; Value</span>
          <OddsTable tier={tier} />
        </div>

        <div className="section">
          <PityTracker tier={tier} packsSinceLastTotw={packsSinceLastTotw} />
        </div>

        <div className="section">
          <span className="eyebrow">Open a Pack</span>
          <button className="open-pack-btn" onClick={handleOpen}>
            Open {tier.name} — {tier.priceCoins.toLocaleString()}c
          </button>
          {lastDraw && (
            <div style={{ marginTop: 16 }}>
              <CardReveal cards={lastDraw.cards} pityTriggered={lastDraw.pityTriggered} />
            </div>
          )}
        </div>

        <div className="section">
          <BulkVerify key={tier.id} tier={tier} />
        </div>

        <div className="section">
          <span className="eyebrow">Spend Ceiling</span>
          <SpendCeilingPanel />
        </div>
      </main>

      <footer className="app-footer">
        Prototype of feature #3 from the Clean Sheet rebuild brief. Odds,
        quick-sell values, and the pity window are all read from one table —
        the same table the simulator and the bulk verifier use, so there's no
        gap between what's published and what's rolled. The spend ceiling
        connects to the fair-matchmaking and match-breakdown prototypes: it's
        the mechanism that keeps a purchased squad edge from ever fully
        deciding a single match.
      </footer>
    </div>
  );
}
