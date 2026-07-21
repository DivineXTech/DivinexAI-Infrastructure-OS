import type { Candidate, Queuer } from "../lib/matchmakingEngine";

// A snapshot of players currently in queue. Skill ratings are deliberately
// uncorrelated with squad OVR in places — that's the point: real skill and
// real spend are different axes, and a fair queue has to search on the
// right one.
export const CANDIDATE_POOL: Candidate[] = [
  { id: "c1", name: "ShadowStriker22", squadOVR: 91, skillRating: 1180, pingMs: 38, spendTier: "Whale" },
  { id: "c2", name: "ClaraCB", squadOVR: 76, skillRating: 1640, pingMs: 42, spendTier: "F2P" },
  { id: "c3", name: "GoldenBoot_Theo", squadOVR: 95, skillRating: 1510, pingMs: 61, spendTier: "Whale" },
  { id: "c4", name: "TikiTommy", squadOVR: 83, skillRating: 1390, pingMs: 47, spendTier: "Light Spender" },
  { id: "c5", name: "RookieRiver", squadOVR: 64, skillRating: 970, pingMs: 33, spendTier: "F2P" },
  { id: "c6", name: "PackOpenerPat", squadOVR: 97, skillRating: 1090, pingMs: 58, spendTier: "Whale" },
  { id: "c7", name: "MidfieldMara", squadOVR: 79, skillRating: 1620, pingMs: 51, spendTier: "Light Spender" },
  { id: "c8", name: "NewboyNate", squadOVR: 60, skillRating: 930, pingMs: 29, spendTier: "F2P" },
  { id: "c9", name: "SkillSzn_Vee", squadOVR: 71, skillRating: 1670, pingMs: 44, spendTier: "F2P" },
  { id: "c10", name: "GrinderGael", squadOVR: 88, skillRating: 1410, pingMs: 39, spendTier: "Light Spender" },
  { id: "c11", name: "CasualCory", squadOVR: 92, skillRating: 1050, pingMs: 66, spendTier: "Heavy Spender" },
  { id: "c12", name: "VeteranVic", squadOVR: 85, skillRating: 1420, pingMs: 45, spendTier: "Light Spender" },
  { id: "c13", name: "SmurfSanti", squadOVR: 68, skillRating: 1600, pingMs: 36, spendTier: "F2P" },
  { id: "c14", name: "WalletWes", squadOVR: 99, skillRating: 1140, pingMs: 70, spendTier: "Whale" },
  { id: "c15", name: "RisingReyes", squadOVR: 73, skillRating: 1010, pingMs: 41, spendTier: "F2P" },
  { id: "c16", name: "SteadyStef", squadOVR: 90, skillRating: 1350, pingMs: 49, spendTier: "Heavy Spender" },
  { id: "c17", name: "PayToPlayPX", squadOVR: 86, skillRating: 1080, pingMs: 52, spendTier: "Whale" },
  { id: "c18", name: "GrindMasterKofi", squadOVR: 58, skillRating: 1210, pingMs: 60, spendTier: "F2P" },
];

export const SAMPLE_QUEUERS: Queuer[] = [
  {
    id: "q1",
    name: "You — F2P Grinder",
    squadOVR: 74,
    skillRating: 1650,
    pingMs: 40,
    spendTier: "F2P",
  },
  {
    id: "q2",
    name: "You — Whale",
    squadOVR: 96,
    skillRating: 1200,
    pingMs: 55,
    spendTier: "Whale",
  },
  {
    id: "q3",
    name: "You — New Player",
    squadOVR: 62,
    skillRating: 950,
    pingMs: 30,
    spendTier: "F2P",
  },
  {
    id: "q4",
    name: "You — Mid-Ladder Veteran",
    squadOVR: 85,
    skillRating: 1400,
    pingMs: 45,
    spendTier: "Light Spender",
  },
];
