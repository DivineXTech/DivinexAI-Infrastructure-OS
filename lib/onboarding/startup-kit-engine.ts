/**
 * Deterministic, explainable startup-kit recommendation engine. Pure
 * function — no I/O, no randomness, no database access — so it's fully
 * unit-testable (tests/unit/startup-kit-engine.test.ts) and safe to call
 * from a Server Action every time relevant answers change (section 10:
 * "Recalculate when relevant inputs change"). See
 * docs/STARTUP_KIT_ENGINE.md for the full rule rationale.
 *
 * Never claims guaranteed profitability — `estimatedRange` is a starting
 * configuration range derived from the user's own selected budget band,
 * not a business projection, and every result carries at least one risk/
 * assumption disclosure.
 */
export const STARTUP_KIT_RULE_VERSION = "2026-07-18.1";

export type BudgetBand =
  | "under_500"
  | "500_1500"
  | "1500_5000"
  | "5000_15000"
  | "15000_plus"
  | "custom_undecided";

export type ProductionMethod =
  | "heat_transfer_vinyl"
  | "dtf"
  | "sublimation"
  | "screen_printing"
  | "embroidery"
  | "outsourced"
  | "hybrid";

export type ExperienceLevel = "new" | "some_experience" | "experienced";

export type Workspace = "none" | "mobile" | "shared_space" | "home_dedicated" | "commercial";

export type GrowthObjective =
  | "test_idea"
  | "side_income"
  | "full_time_business"
  | "scale_wholesale";

export type StartupKitEngineInput = {
  budgetBand: BudgetBand;
  productCategories: string[];
  productionMethod: ProductionMethod | null;
  monthlyOrderVolume: number | null;
  workspace: Workspace | null;
  experienceLevel: ExperienceLevel | null;
  equipmentOwned: boolean;
  growthObjective: GrowthObjective | null;
};

export type StartupKitRecommendation = {
  recommendedKitSlug: string;
  secondaryKitSlug: string | null;
  score: number;
  explanation: string;
  requiredCategories: string[];
  optionalCategories: string[];
  ownedItems: string[];
  estimatedRange: { minCents: number; maxCents: number | null } | null;
  risks: string[];
  nextSteps: string[];
  ruleVersion: string;
};

type KitProfile = {
  slug: string;
  methods: ProductionMethod[] | "any";
  budgetBands: BudgetBand[];
  workspaces: Workspace[] | "any";
  experienceLevels: ExperienceLevel[];
  volumeRange: [number, number];
  requiredCategories: string[];
  optionalCategories: string[];
  nextSteps: string[];
};

const GENERIC_OPTIONAL_CATEGORIES = [
  "Packaging and shipping supplies",
  "Product photography setup",
  "Academy: pricing and profit margins",
];

const KIT_PROFILES: KitProfile[] = [
  {
    slug: "creator-starter-kit",
    methods: "any",
    budgetBands: ["under_500", "500_1500"],
    workspaces: ["none", "shared_space", "home_dedicated"],
    experienceLevels: ["new"],
    volumeRange: [0, 20],
    requiredCategories: ["Design software recommendations", "Blank apparel guidance"],
    optionalCategories: ["Academy: starting a clothing brand"],
    nextSteps: [
      "Validate your first design with a small test batch before buying equipment.",
      "Complete the Academy module on starting a clothing brand.",
    ],
  },
  {
    slug: "heat-press-business-kit",
    methods: ["heat_transfer_vinyl"],
    budgetBands: ["500_1500", "1500_5000"],
    workspaces: ["home_dedicated"],
    experienceLevels: ["new", "some_experience"],
    volumeRange: [10, 100],
    requiredCategories: ["Heat press selection guidance", "Blank apparel", "Consumables"],
    optionalCategories: ["Setup training"],
    nextSteps: [
      "Choose a heat press sized for your expected order volume.",
      "Set up a dedicated pressing area with proper ventilation.",
    ],
  },
  {
    slug: "dtf-launch-kit",
    methods: ["dtf"],
    budgetBands: ["1500_5000", "5000_15000"],
    workspaces: ["home_dedicated", "commercial"],
    experienceLevels: ["some_experience", "experienced"],
    volumeRange: [20, 200],
    requiredCategories: ["DTF printer selection guidance", "Film and powder consumables", "Curing equipment guidance"],
    optionalCategories: ["Bulk transfer ordering as an alternative to owning a printer"],
    nextSteps: [
      "Decide between owning a DTF printer or ordering transfers from a supplier.",
      "Plan curing equipment and workspace ventilation before ordering film.",
    ],
  },
  {
    slug: "sublimation-kit",
    methods: ["sublimation"],
    budgetBands: ["1500_5000", "5000_15000"],
    workspaces: ["home_dedicated", "commercial"],
    experienceLevels: ["some_experience", "experienced"],
    volumeRange: [20, 200],
    requiredCategories: ["Sublimation printer guidance", "Heat press guidance", "Blank selection"],
    optionalCategories: ["All-over-print garment sourcing"],
    nextSteps: [
      "Confirm your blank garments are sublimation-compatible (poly/poly-blend).",
      "Test color accuracy with a calibration print before your first batch.",
    ],
  },
  {
    slug: "embroidery-starter-kit",
    methods: ["embroidery"],
    budgetBands: ["1500_5000", "5000_15000"],
    workspaces: ["home_dedicated", "commercial"],
    experienceLevels: ["some_experience", "experienced"],
    volumeRange: [10, 150],
    requiredCategories: ["Embroidery machine guidance", "Digitizing resources", "Thread and stabilizer consumables"],
    optionalCategories: ["Patch production add-on"],
    nextSteps: [
      "Get your logo digitized for embroidery before ordering a machine.",
      "Run a stitch-count test to estimate per-unit production time.",
    ],
  },
  {
    slug: "mobile-vendor-kit",
    methods: ["heat_transfer_vinyl", "dtf"],
    budgetBands: ["500_1500", "1500_5000"],
    workspaces: ["mobile", "none"],
    experienceLevels: ["new", "some_experience"],
    volumeRange: [0, 50],
    requiredCategories: ["Portable heat press guidance", "Compact workspace planning", "Event-ready packaging"],
    optionalCategories: ["Point-of-sale setup for in-person events"],
    nextSteps: [
      "Confirm power access requirements for your target markets/events.",
      "Plan a compact, transportable equipment layout.",
    ],
  },
  {
    slug: "small-production-studio",
    methods: ["dtf", "sublimation", "screen_printing", "embroidery", "hybrid"],
    budgetBands: ["5000_15000", "15000_plus"],
    workspaces: ["commercial"],
    experienceLevels: ["some_experience", "experienced"],
    volumeRange: [100, 1000],
    requiredCategories: ["Multi-method equipment plan", "Workspace layout guidance", "Production workflow basics"],
    optionalCategories: ["Dedicated setup consultation"],
    nextSteps: [
      "Map your production workflow before committing to a workspace layout.",
      "Plan equipment maintenance schedules for higher-volume operation.",
    ],
  },
  {
    slug: "outsourced-brand-launch-kit",
    methods: ["outsourced"],
    budgetBands: ["under_500", "500_1500", "1500_5000"],
    workspaces: "any",
    experienceLevels: ["new", "some_experience", "experienced"],
    volumeRange: [0, 10000],
    requiredCategories: ["Supplier sourcing guidance", "Quality-control checklist", "Order-handoff workflow basics"],
    optionalCategories: ["Sample-approval process guidance"],
    nextSteps: [
      "Request samples from at least two production partners before committing.",
      "Define your quality-control checklist before your first live order.",
    ],
  },
];

/** Pure comparison used by the override flow (lib/onboarding/data-access.ts)
 * to decide whether a founder's final selection differs from what the
 * engine recommended — kept here, alongside the engine, so it's covered by
 * the same unit tests rather than only exercised through a DB round trip. */
export function isKitOverridden(recommendedSlug: string, selectedSlug: string): boolean {
  return recommendedSlug !== selectedSlug;
}

const CUSTOM_FALLBACK_SLUG = "custom-recommendation";
/** Baseline score for the fallback recommendation — real kits must beat
 * this to be recommended; if none do, the honest answer is "this needs a
 * custom plan," not a forced fit. */
const CUSTOM_FALLBACK_SCORE = 35;

function scoreKit(kit: KitProfile, input: StartupKitEngineInput): number {
  let score = 0;

  if (input.productionMethod) {
    if (kit.methods === "any" || kit.methods.includes(input.productionMethod)) score += 40;
  } else {
    score += 15; // no strong signal either way
  }

  if (kit.budgetBands.includes(input.budgetBand)) score += 20;

  if (input.workspace) {
    if (kit.workspaces === "any" || kit.workspaces.includes(input.workspace)) score += 15;
  } else {
    score += 5;
  }

  if (input.experienceLevel) {
    if (kit.experienceLevels.includes(input.experienceLevel)) score += 15;
  } else {
    score += 5;
  }

  if (typeof input.monthlyOrderVolume === "number") {
    const [min, max] = kit.volumeRange;
    if (input.monthlyOrderVolume >= min && input.monthlyOrderVolume <= max) score += 10;
  } else {
    score += 5;
  }

  return score;
}

const BUDGET_RANGE_CENTS: Record<BudgetBand, { minCents: number; maxCents: number | null }> = {
  under_500: { minCents: 0, maxCents: 50_000 },
  "500_1500": { minCents: 50_000, maxCents: 150_000 },
  "1500_5000": { minCents: 150_000, maxCents: 500_000 },
  "5000_15000": { minCents: 500_000, maxCents: 1_500_000 },
  "15000_plus": { minCents: 1_500_000, maxCents: null },
  custom_undecided: { minCents: 0, maxCents: null },
};

function buildRisks(kit: KitProfile | null, input: StartupKitEngineInput): string[] {
  const risks: string[] = [];

  if (!kit) {
    risks.push(
      "Your answers didn't closely match a standard configuration — treat this as a starting point for a conversation, not a final plan.",
    );
    return risks;
  }

  if (
    input.experienceLevel === "new" &&
    input.productionMethod &&
    ["dtf", "sublimation", "embroidery", "screen_printing"].includes(input.productionMethod)
  ) {
    risks.push(
      "This production method has a real learning curve — budget extra time before your first sellable batch.",
    );
  }

  if (input.budgetBand === "under_500" && kit.budgetBands.includes("1500_5000")) {
    risks.push(
      "Your stated budget is below what this configuration typically requires — consider the Creator Starter Kit first, or plan to phase equipment purchases over time.",
    );
  }

  if (
    typeof input.monthlyOrderVolume === "number" &&
    input.monthlyOrderVolume > kit.volumeRange[1]
  ) {
    risks.push(
      "Your expected order volume is above what this configuration is typically sized for — you may need to scale equipment sooner than planned.",
    );
  }

  if (input.growthObjective === "scale_wholesale" && kit.slug === "creator-starter-kit") {
    risks.push(
      "A wholesale-scale goal will likely outgrow a starter configuration quickly — treat this as a validation step, not your final setup.",
    );
  }

  risks.push("This is planning guidance, not a guarantee of business results.");
  return risks;
}

/**
 * Scores every kit profile against the given inputs and returns the top
 * recommendation plus a secondary alternative. Deterministic: identical
 * input always produces identical output (ties broken by profile order,
 * which is stable), so the same answers always yield the same
 * recommendation until `STARTUP_KIT_RULE_VERSION` changes.
 */
export function recommendStartupKit(
  input: StartupKitEngineInput,
): StartupKitRecommendation {
  const scored = KIT_PROFILES.map((kit) => ({ kit, score: scoreKit(kit, input) })).sort(
    (a, b) => b.score - a.score,
  );

  const best = scored[0];
  const useFallback = !best || best.score < CUSTOM_FALLBACK_SCORE;

  const primaryKit = useFallback ? null : best.kit;
  const primaryScore = useFallback ? CUSTOM_FALLBACK_SCORE : best.score;
  const secondary = useFallback ? scored[0] : scored[1];

  const requiredCategories = primaryKit ? [...primaryKit.requiredCategories] : [];
  const ownedItems: string[] = [];
  if (input.equipmentOwned && requiredCategories.length > 0) {
    // Move anything that reads as "equipment" out of required and into
    // owned — the user already told us they have it.
    const equipmentIndex = requiredCategories.findIndex((c) =>
      /equipment|press|printer|machine/i.test(c),
    );
    if (equipmentIndex !== -1) {
      ownedItems.push(requiredCategories[equipmentIndex]);
      requiredCategories.splice(equipmentIndex, 1);
    }
  }

  const budgetRange = BUDGET_RANGE_CENTS[input.budgetBand];
  const estimatedRange =
    input.budgetBand === "custom_undecided" ? null : budgetRange;

  const explanation = primaryKit
    ? `Recommended based on your production method${
        input.productionMethod ? ` (${input.productionMethod.replace(/_/g, " ")})` : ""
      }, budget band, workspace, and experience level. Score reflects how closely your answers match this configuration's typical profile, not a guarantee of fit.`
    : "No standard configuration closely matched your combination of answers — this is flagged as a custom recommendation rather than forcing a best-effort fit.";

  return {
    recommendedKitSlug: primaryKit?.slug ?? CUSTOM_FALLBACK_SLUG,
    secondaryKitSlug: secondary && secondary.kit.slug !== (primaryKit?.slug ?? CUSTOM_FALLBACK_SLUG)
      ? secondary.kit.slug
      : null,
    score: Math.min(100, primaryScore),
    explanation,
    requiredCategories,
    optionalCategories: primaryKit
      ? [...primaryKit.optionalCategories, ...GENERIC_OPTIONAL_CATEGORIES]
      : GENERIC_OPTIONAL_CATEGORIES,
    ownedItems,
    estimatedRange,
    risks: buildRisks(primaryKit, input),
    nextSteps: primaryKit
      ? [...primaryKit.nextSteps, "Review the startup-kit page for full configuration options."]
      : [
          "Book a consultation to build a configuration specific to your goals.",
          "Review the startup-kit page for standard configurations you can compare against.",
        ],
    ruleVersion: STARTUP_KIT_RULE_VERSION,
  };
}
