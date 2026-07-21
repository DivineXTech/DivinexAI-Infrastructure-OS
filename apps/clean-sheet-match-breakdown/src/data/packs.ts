import type { PackTier } from "../lib/packEngine";

// Quick-sell coin values are intentionally far below what each rarity costs
// to pull — that gap is the actual reason packs "feel expensive" in reviews.
// We publish it instead of hiding it.
export const PACK_TIERS: PackTier[] = [
  {
    id: "bronze",
    name: "Bronze Pack",
    priceCoins: 350,
    cardsPerPack: 5,
    pityThreshold: 40,
    odds: [
      { rarity: "Bronze", probability: 70, marketValueCoins: 10 },
      { rarity: "Silver", probability: 22, marketValueCoins: 60 },
      { rarity: "Gold", probability: 7, marketValueCoins: 300 },
      { rarity: "TOTW", probability: 0.85, marketValueCoins: 1200 },
      { rarity: "Icon", probability: 0.15, marketValueCoins: 3000 },
    ],
  },
  {
    id: "gold",
    name: "Gold Pack",
    priceCoins: 1500,
    cardsPerPack: 5,
    pityThreshold: 25,
    odds: [
      { rarity: "Bronze", probability: 10, marketValueCoins: 10 },
      { rarity: "Silver", probability: 45, marketValueCoins: 60 },
      { rarity: "Gold", probability: 40, marketValueCoins: 300 },
      { rarity: "TOTW", probability: 4.5, marketValueCoins: 1200 },
      { rarity: "Icon", probability: 0.5, marketValueCoins: 3000 },
    ],
  },
  {
    id: "icon-swap",
    name: "Icon Swap Pack",
    priceCoins: 2800,
    cardsPerPack: 3,
    pityThreshold: 10,
    odds: [
      { rarity: "Gold", probability: 55, marketValueCoins: 300 },
      { rarity: "TOTW", probability: 35, marketValueCoins: 1200 },
      { rarity: "Icon", probability: 10, marketValueCoins: 3000 },
    ],
  },
];
