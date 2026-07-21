export type Rarity = "Bronze" | "Silver" | "Gold" | "TOTW" | "Icon";

export interface OddsRow {
  rarity: Rarity;
  /** 0-100, all rows for a tier must sum to 100 */
  probability: number;
  /** quick-sell coin value — deliberately far below what the card cost to pull */
  marketValueCoins: number;
}

export interface PackTier {
  id: string;
  name: string;
  priceCoins: number;
  cardsPerPack: number;
  odds: OddsRow[];
  /** packs opened since your last TOTW-or-better before one is guaranteed */
  pityThreshold: number;
}

export interface DrawnCard {
  rarity: Rarity;
}

export interface BulkVerifyRow {
  rarity: Rarity;
  statedPct: number;
  empiricalPct: number;
  delta: number;
  withinTolerance: boolean;
}

const isTotwOrBetter = (r: Rarity) => r === "TOTW" || r === "Icon";

export function drawCard(odds: OddsRow[], rng: () => number = Math.random): Rarity {
  const roll = rng() * 100;
  let cumulative = 0;
  for (const row of odds) {
    cumulative += row.probability;
    if (roll < cumulative) return row.rarity;
  }
  return odds[odds.length - 1].rarity;
}

export function openPack(tier: PackTier, rng: () => number = Math.random): DrawnCard[] {
  return Array.from({ length: tier.cardsPerPack }, () => ({
    rarity: drawCard(tier.odds, rng),
  }));
}

/**
 * Same odds table, but honors the published pity rule: if the player has
 * gone pityThreshold-1 packs without a TOTW-or-better and didn't naturally
 * pull one this time, the last slot is upgraded. Returns whether pity fired
 * so the UI can say so instead of pretending it was a natural pull.
 */
export function openPackWithPity(
  tier: PackTier,
  packsSinceLastTotw: number,
  rng: () => number = Math.random,
): { cards: DrawnCard[]; pityTriggered: boolean } {
  const cards = openPack(tier, rng);
  const willReachPity = packsSinceLastTotw + 1 >= tier.pityThreshold;
  const hasTotwPlus = cards.some((c) => isTotwOrBetter(c.rarity));

  if (willReachPity && !hasTotwPlus) {
    cards[cards.length - 1] = { rarity: "TOTW" };
    return { cards, pityTriggered: true };
  }
  return { cards, pityTriggered: false };
}

export function nextPacksSinceLastTotw(current: number, cards: DrawnCard[]): number {
  return cards.some((c) => isTotwOrBetter(c.rarity)) ? 0 : current + 1;
}

export function expectedValuePerPack(tier: PackTier): number {
  const evPerCard = tier.odds.reduce(
    (sum, row) => sum + (row.probability / 100) * row.marketValueCoins,
    0,
  );
  return Math.round(evPerCard * tier.cardsPerPack);
}

function toleranceForPct(pct: number, n: number): number {
  // ~3 standard deviations of a binomial proportion, in percentage points,
  // with a floor so razor-thin odds don't demand impossible sample sizes.
  const p = pct / 100;
  const sigmaPct = Math.sqrt((p * (1 - p)) / n) * 100;
  return Math.max(sigmaPct * 3, 0.12);
}

/**
 * Runs `opens` packs with no pity logic (pity would bias the sample on
 * purpose) and reports the stated vs. observed rarity split — the actual
 * verification mechanic: the UI doesn't just print the odds, it proves them.
 */
export function simulateBulk(
  tier: PackTier,
  opens: number,
  rng: () => number = Math.random,
): BulkVerifyRow[] {
  const counts: Partial<Record<Rarity, number>> = {};
  tier.odds.forEach((row) => (counts[row.rarity] = 0));

  const totalDraws = opens * tier.cardsPerPack;
  for (let i = 0; i < totalDraws; i++) {
    const rarity = drawCard(tier.odds, rng);
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }

  return tier.odds.map((row) => {
    const empiricalPct = ((counts[row.rarity] ?? 0) / totalDraws) * 100;
    const delta = empiricalPct - row.probability;
    return {
      rarity: row.rarity,
      statedPct: row.probability,
      empiricalPct: Math.round(empiricalPct * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      withinTolerance: Math.abs(delta) < toleranceForPct(row.probability, totalDraws),
    };
  });
}
