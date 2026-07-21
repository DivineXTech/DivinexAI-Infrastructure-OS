export type SpendTier = "F2P" | "Light Spender" | "Heavy Spender" | "Whale";

export interface TeamStats {
  name: string;
  score: number;
  possession: number; // %
  xG: number;
  shots: number;
  shotsOnTarget: number;
  passAccuracy: number; // %
  duelsWonPct: number; // %
  squadOVR: number; // 1-99
  spendTier: SpendTier;
}

export interface MatchData {
  id: string;
  competition: string;
  pingMs: number;
  redCardAgainstYou: boolean;
  ownGoalAgainstYou: boolean;
  you: TeamStats;
  opponent: TeamStats;
}

export type FactorKey = "squad" | "tactical" | "execution" | "variance";

export interface FactorBreakdown {
  key: FactorKey;
  label: string;
  pct: number;
  detail: string;
}

export interface MatchVerdict {
  outcome: "win" | "loss" | "draw";
  headline: string;
  factors: FactorBreakdown[];
  primaryFactor: FactorKey;
  spendStatement: string;
  spendWasDecisive: boolean;
  coachTip: string;
  math: { label: string; value: string }[];
}

const FACTOR_LABELS: Record<FactorKey, string> = {
  squad: "Squad Value",
  tactical: "Tactical Setup",
  execution: "Execution",
  variance: "Variance",
};

function round(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Every number below is derived from the match stats passed in — nothing here
 * is invented by an LLM. This is the part of "Clean Sheet" that has to be
 * auditable: the plain-language verdict is a rendering of this math, not a
 * black box guess.
 */
export function computeVerdict(match: MatchData): MatchVerdict {
  const { you, opponent } = match;

  if (you.score > opponent.score) {
    return winVerdict(match);
  }
  if (you.score === opponent.score) {
    return drawVerdict(match);
  }

  const squadGap = opponent.squadOVR - you.squadOVR; // positive = they were rated higher
  const xgDiff = you.xG - opponent.xG; // negative = they created better chances
  const finishingYou = you.score - you.xG; // negative = you underperformed your chances
  const finishingOpp = opponent.score - opponent.xG; // positive = they overperformed (lucky/clinical)
  const defenseGap = you.duelsWonPct - opponent.duelsWonPct; // negative = you lost the physical battle

  const squadPoints = Math.max(0, squadGap) * 2.2;
  const tacticalPoints = Math.max(0, -xgDiff) * 9;
  const executionPoints =
    Math.max(0, -finishingYou) * 10 + Math.max(0, -defenseGap) * 0.6;
  const variancePoints =
    Math.max(0, finishingOpp) * 8 +
    (match.redCardAgainstYou ? 12 : 0) +
    (match.ownGoalAgainstYou ? 15 : 0);

  const rawTotal =
    squadPoints + tacticalPoints + executionPoints + variancePoints;
  const total = rawTotal > 0 ? rawTotal : 1; // guard: near-identical teams, tiny margin loss

  const factors: FactorBreakdown[] = [
    {
      key: "squad",
      label: FACTOR_LABELS.squad,
      pct: round((squadPoints / total) * 100),
      detail:
        squadGap > 0
          ? `Opponent squad rated ${squadGap} OVR higher (${you.squadOVR} vs ${opponent.squadOVR}).`
          : `Your squad was rated equal or higher (${you.squadOVR} vs ${opponent.squadOVR}) — this wasn't a roster mismatch.`,
    },
    {
      key: "tactical",
      label: FACTOR_LABELS.tactical,
      pct: round((tacticalPoints / total) * 100),
      detail:
        xgDiff < 0
          ? `Opponent created ${round(-xgDiff)} more xG than you (${round(opponent.xG)} vs ${round(you.xG)}), at ${opponent.possession}% possession.`
          : `You created the better chances (${round(you.xG)} xG vs ${round(opponent.xG)} xG) — chance creation wasn't the problem.`,
    },
    {
      key: "execution",
      label: FACTOR_LABELS.execution,
      pct: round((executionPoints / total) * 100),
      detail:
        finishingYou < -0.1
          ? `You scored ${round(-finishingYou)} goals below your expected ${round(you.xG)} xG, and won only ${you.duelsWonPct}% of duels.`
          : `Your finishing (${you.score} goals from ${round(you.xG)} xG) was on par with expectation.`,
    },
    {
      key: "variance",
      label: FACTOR_LABELS.variance,
      pct: round((variancePoints / total) * 100),
      detail: varianceDetail(match, finishingOpp),
    },
  ];

  // fix rounding drift so the bars always sum to 100
  const sum = factors.reduce((s, f) => s + f.pct, 0);
  factors[factors.length - 1].pct = round(
    factors[factors.length - 1].pct + (100 - sum),
  );

  const primary = [...factors].sort((a, b) => b.pct - a.pct)[0];

  return {
    outcome: "loss",
    headline: headlineFor(primary.key, match, { squadGap, xgDiff }),
    factors,
    primaryFactor: primary.key,
    spendStatement: spendStatementFor(match, factors[0]),
    spendWasDecisive: factors[0].pct >= 45,
    coachTip: coachTipFor(primary.key, match, { defenseGap, xgDiff }),
    math: [
      { label: "Squad OVR gap (opp − you)", value: `${squadGap}` },
      { label: "xG differential (you − opp)", value: `${round(xgDiff)}` },
      { label: "Your finishing vs xG", value: `${round(finishingYou)}` },
      { label: "Opponent finishing vs xG", value: `${round(finishingOpp)}` },
      { label: "Duel win-rate gap (you − opp)", value: `${round(defenseGap)} pts` },
      {
        label: "Match ping",
        value: `${match.pingMs}ms${match.pingMs > 120 ? " (elevated)" : ""}`,
      },
    ],
  };
}

function varianceDetail(match: MatchData, finishingOpp: number): string {
  const bits: string[] = [];
  if (match.redCardAgainstYou) bits.push("you played a man down after a red card");
  if (match.ownGoalAgainstYou) bits.push("an own goal went against you");
  if (finishingOpp > 0.3)
    bits.push(
      `the opponent finished ${round(finishingOpp)} goals above their expected xG`,
    );
  if (bits.length === 0)
    return "No red cards, own goals, or major finishing luck either way — low variance in this one.";
  return `Bad-luck factors: ${bits.join("; ")}.`;
}

function headlineFor(
  key: FactorKey,
  match: MatchData,
  extra: { squadGap: number; xgDiff: number },
): string {
  const { you, opponent } = match;
  switch (key) {
    case "squad":
      return `You lost this because the opponent's squad was rated ${extra.squadGap} points higher — that's a matchmaking gap, not something you controlled in the 90 minutes.`;
    case "tactical":
      return `You lost this because your setup let ${opponent.name} create the better chances, not because of your card collection.`;
    case "execution":
      return `You lost this because your finishing and defending underperformed on the day — the chances and the squad were both there.`;
    case "variance":
      return `You lost this to variance — a red card, an own goal, or a hot streak from the opponent decided a game that was close on the numbers.`;
    default:
      return `${you.name} ${you.score}-${opponent.score} ${opponent.name}.`;
  }
}

function spendStatementFor(match: MatchData, squadFactor: FactorBreakdown): string {
  const { you, opponent } = match;
  if (squadFactor.pct >= 45) {
    return `Squad value explains ${squadFactor.pct}% of this loss. Your opponent (${opponent.spendTier}) fielded a squad rated ${opponent.squadOVR - you.squadOVR} OVR above yours (${you.spendTier}). That gap is real — this is on matchmaking, not on your play.`;
  }
  return `Squad value explains only ${squadFactor.pct}% of this loss, even though your opponent is a ${opponent.spendTier.toLowerCase()} and you're ${you.spendTier === "F2P" ? "playing free-to-play" : `a ${you.spendTier.toLowerCase()}`}. Most of this result came from the match itself, not from wallets.`;
}

function coachTipFor(
  key: FactorKey,
  match: MatchData,
  extra: { defenseGap: number; xgDiff: number },
): string {
  const { you } = match;
  switch (key) {
    case "squad":
      return `Nothing to fix tactically here — queue into events with fewer OVR restrictions, or target ${you.name}'s weakest-rated position first with your next pack pulls.`;
    case "tactical":
      return `Your possession/chance creation lagged behind — try dropping a line deeper out of possession and committing an extra midfielder to build-up before the final third.`;
    case "execution":
      return extra.defenseGap < -5
        ? `Your duel win-rate was the bigger leak — work on jockeying before the tackle attempt instead of diving in early.`
        : `Chances were there; work finishing drills on first-time shots inside the box before your next ranked run.`;
    case "variance":
      return `Nothing systemic to fix — review the sending-off or deflection in the replay, then queue back in. This one was noise, not signal.`;
    default:
      return "Keep doing what you're doing.";
  }
}

function winVerdict(match: MatchData): MatchVerdict {
  const { you, opponent } = match;
  return {
    outcome: "win",
    headline: `${you.name} beat ${opponent.name} ${you.score}-${opponent.score}. Nothing to explain away here.`,
    factors: [],
    primaryFactor: "tactical",
    spendStatement: "This one's a win — the breakdown only runs on losses and draws.",
    spendWasDecisive: false,
    coachTip: "Review the replay for what worked and repeat it.",
    math: [],
  };
}

function drawVerdict(match: MatchData): MatchVerdict {
  const { you, opponent } = match;
  return {
    outcome: "draw",
    headline: `${you.name} ${you.score}-${opponent.score} ${opponent.name}. A draw — close to an even match on the numbers.`,
    factors: [],
    primaryFactor: "tactical",
    spendStatement: "Squad and spend were close enough that neither side had a clear edge.",
    spendWasDecisive: false,
    coachTip: "Small margins — one more clinical finish either way decides this next time.",
    math: [],
  };
}
