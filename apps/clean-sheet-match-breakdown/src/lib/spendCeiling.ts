import type { SpendTier } from "./breakdownEngine";

/** Coins per purchased OVR-equivalent point of squad advantage. */
const COINS_PER_OVR_POINT = 20000;
/** Nobody can buy their way past this — squad strength keeps growing, but a single match can only ever swing this far from spend. */
export const MATCH_SPEND_CAP = 6;
/** Soft ceiling on how much squad-advantage spend can buy overall, before it stops mattering even for collection depth. */
const MAX_PURCHASABLE_OVR = 15;

export interface SpendProfile {
  tier: SpendTier;
  coinsSpentEquivalent: number;
}

export const SPEND_PROFILES: SpendProfile[] = [
  { tier: "F2P", coinsSpentEquivalent: 500 },
  { tier: "Light Spender", coinsSpentEquivalent: 5000 },
  { tier: "Heavy Spender", coinsSpentEquivalent: 40000 },
  { tier: "Whale", coinsSpentEquivalent: 250000 },
];

export interface SpendCeilingResult {
  tier: SpendTier;
  purchasedOVR: number; // squad-wide advantage bought, uncapped up to the soft max
  cappedMatchSwing: number; // what that's actually worth in any single match
  wasCapped: boolean;
}

export function computeSpendCeiling(profile: SpendProfile): SpendCeilingResult {
  const purchasedOVR = Math.min(
    Math.round((profile.coinsSpentEquivalent / COINS_PER_OVR_POINT) * 100) / 100,
    MAX_PURCHASABLE_OVR,
  );
  const cappedMatchSwing = Math.min(purchasedOVR, MATCH_SPEND_CAP);
  return {
    tier: profile.tier,
    purchasedOVR,
    cappedMatchSwing,
    wasCapped: purchasedOVR > MATCH_SPEND_CAP,
  };
}
