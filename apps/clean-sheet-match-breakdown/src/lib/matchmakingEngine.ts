import type { SpendTier } from "./breakdownEngine";

export interface Candidate {
  id: string;
  name: string;
  squadOVR: number;
  skillRating: number; // hidden ELO-style rating, derived from actual play
  pingMs: number;
  spendTier: SpendTier;
}

export type Queuer = Candidate;

export type Algorithm = "legacy" | "fair";

export interface MatchResult {
  algorithm: Algorithm;
  opponent: Candidate;
  ovrGap: number; // opponent OVR minus queuer OVR
  skillGap: number; // absolute skill rating distance
  pingGap: number; // absolute ping distance
  searchRound?: number; // fair only — which band it locked in on
  searchRadius?: number; // fair only — the band width in skill points
  rationale: string;
}

const LEGACY_OVR_FLOOR = 12; // mirrors reviewer reports of being matched against inflated OVR
const SKILL_BANDS = [50, 120, 250, 500];

/**
 * Simulates the reviewed behavior: opponents are picked by squad rating
 * proximity to an inflated target, with connection quality as the only
 * tiebreak. Skill is never read.
 */
export function findLegacyMatch(queuer: Queuer, pool: Candidate[]): MatchResult {
  const target = queuer.squadOVR + LEGACY_OVR_FLOOR;
  const sorted = [...pool].sort((a, b) => {
    const da = Math.abs(a.squadOVR - target);
    const db = Math.abs(b.squadOVR - target);
    if (da !== db) return da - db;
    return Math.abs(a.pingMs - queuer.pingMs) - Math.abs(b.pingMs - queuer.pingMs);
  });
  const opponent = sorted[0];
  return buildResult("legacy", queuer, opponent, {
    rationale: `Matched to the squad rating closest to an inflated target of ${target} OVR (your ${queuer.squadOVR} + a ${LEGACY_OVR_FLOOR}-point floor). Skill rating was never read.`,
  });
}

/**
 * Searches by skill distance first, widening the band only if the current
 * queue has no one close. Squad OVR is never a filter or a tiebreak.
 */
export function findFairMatch(queuer: Queuer, pool: Candidate[]): MatchResult {
  for (let i = 0; i < SKILL_BANDS.length; i++) {
    const radius = SKILL_BANDS[i];
    const inBand = pool.filter(
      (c) => Math.abs(c.skillRating - queuer.skillRating) <= radius,
    );
    if (inBand.length > 0) {
      const sorted = [...inBand].sort((a, b) => {
        const da = Math.abs(a.skillRating - queuer.skillRating);
        const db = Math.abs(b.skillRating - queuer.skillRating);
        if (da !== db) return da - db;
        return Math.abs(a.pingMs - queuer.pingMs) - Math.abs(b.pingMs - queuer.pingMs);
      });
      const opponent = sorted[0];
      return buildResult("fair", queuer, opponent, {
        searchRound: i + 1,
        searchRadius: radius,
        rationale: `Found within ±${radius} skill rating on search round ${i + 1} of ${SKILL_BANDS.length}. Squad value (${opponent.squadOVR} OVR) was never checked.`,
      });
    }
  }
  const opponent = [...pool].sort(
    (a, b) =>
      Math.abs(a.skillRating - queuer.skillRating) -
      Math.abs(b.skillRating - queuer.skillRating),
  )[0];
  return buildResult("fair", queuer, opponent, {
    searchRound: SKILL_BANDS.length,
    searchRadius: SKILL_BANDS[SKILL_BANDS.length - 1],
    rationale: `No one was within ±${SKILL_BANDS[SKILL_BANDS.length - 1]} skill rating — widened to the closest player in queue.`,
  });
}

function buildResult(
  algorithm: Algorithm,
  queuer: Queuer,
  opponent: Candidate,
  extra: Partial<Pick<MatchResult, "searchRound" | "searchRadius" | "rationale">> & {
    rationale: string;
  },
): MatchResult {
  return {
    algorithm,
    opponent,
    ovrGap: opponent.squadOVR - queuer.squadOVR,
    skillGap: Math.abs(opponent.skillRating - queuer.skillRating),
    pingGap: Math.abs(opponent.pingMs - queuer.pingMs),
    ...extra,
  };
}

export function compareResults(legacy: MatchResult, fair: MatchResult) {
  const ratio =
    fair.skillGap > 0 ? Math.round((legacy.skillGap / fair.skillGap) * 10) / 10 : 1;
  const statement =
    legacy.skillGap <= fair.skillGap
      ? `Legacy happened to land a similarly close skill game this time (${legacy.skillGap} pts) — but that's luck. It optimizes for OVR proximity, not skill, so the gap is different every match.`
      : `Legacy's skill gap was ${ratio}× wider than fair matchmaking's (${legacy.skillGap} pts vs ${fair.skillGap} pts) — same queue, same moment, two very different games.`;
  return { ratio, statement };
}
