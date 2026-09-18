# Startup-Kit Recommendation Engine

`lib/onboarding/startup-kit-engine.ts` — a pure, deterministic, explainable
rules engine with no I/O, no randomness, and no external calls. Given the
same input, it always returns the same output until
`STARTUP_KIT_RULE_VERSION` changes; every result is unit-tested in
`tests/unit/startup-kit-engine.test.ts`.

## Why rules, not a model

The spec requires the recommendation to be explainable and never imply
guaranteed profitability. A hand-written, weighted scoring function over a
fixed set of kit profiles satisfies both directly: every point of the
score traces to a specific matched input, and there's no black box to
disclaim around.

## Inputs (`StartupKitEngineInput`)

`budgetBand`, `productCategories`, `productionMethod`,
`monthlyOrderVolume`, `workspace`, `experienceLevel`, `equipmentOwned`,
`growthObjective` — all sourced from the products/production/budget steps
already saved for the tenant (`app/app/onboarding/wizard-actions.ts`,
`generateStartupKitRecommendationAction`), never asked again on this step.

## Scoring

Eight kit profiles (`KIT_PROFILES`), each scored 0–100 against the input:

| Signal | Points | Behavior when the signal is absent |
|---|---|---|
| Production method match | 40 | +15 (weak default, no strong signal either way) |
| Budget band match | 20 | 0 (budget band is always required, never absent) |
| Workspace match | 15 | +5 |
| Experience level match | 15 | +5 |
| Monthly volume in range | 10 | +5 |

The highest-scoring profile becomes `recommendedKitSlug`; the second becomes
`secondaryKitSlug` (an alternative worth considering). If the best score is
below `CUSTOM_FALLBACK_SCORE` (35), the engine returns
`custom-recommendation` instead of forcing a best-effort match onto sparse
or contradictory answers — the honest answer to "nothing matched well" is
a flagged custom plan, not a fabricated fit.

## Output (`StartupKitRecommendation`)

`recommendedKitSlug`, `secondaryKitSlug`, `score`, `explanation`,
`requiredCategories`, `optionalCategories`, `ownedItems`, `estimatedRange`
(derived from the *selected budget band*, not a business projection — `null`
for `custom_undecided`), `risks` (contextual warnings, e.g. "budget below
what this configuration typically requires," plus an unconditional closing
disclosure), `nextSteps`, and `ruleVersion`.

If `equipmentOwned` is true, any required category that reads as
equipment/press/printer/machine moves from `requiredCategories` into
`ownedItems` instead — the recommendation reflects what the founder
already has rather than re-listing it as something to acquire.

## Persistence and override

`startup_kit_recommendations` is one row per tenant
(`lib/onboarding/data-access.ts`). Saving a fresh recommendation
(`saveStartupKitRecommendation`) always resets `user_selected_kit_slug` to
`null` and `overridden` to `false` — a recalculation (triggered by editing
an upstream step and revisiting this one) requires the founder to
re-confirm or re-override against the *new* recommendation, rather than
silently carrying forward a stale override.

`overrideStartupKitSelection(tenantId, selectedKitSlug)` records the
founder's final choice separately from the engine's recommendation — both
values persist, so "what did we recommend" and "what did they actually
pick" are never conflated. Whether a selection counts as an override is a
pure comparison (`isKitOverridden`, exported alongside the engine,
unit-tested) rather than logic duplicated at the call site.

## Recalculation

The startup-kit step page never auto-advances on recommend: generating a
recommendation (`generateStartupKitRecommendationAction`) and confirming
the step (`confirmStartupKitStepAction`) are separate actions, so a founder
can review, optionally override, and only then continue. Editing any of
production/products/budget and revisiting this step lets them regenerate
against the updated inputs via the same action.

## What this is not

The recommendation and its `estimatedRange` are planning guidance derived
from stated preferences and a stated budget band — never a guarantee of
sales, profitability, or fit. Every result's `risks` array always includes
that disclosure, and the UI (`components/onboarding/startup-kit-panel.tsx`)
surfaces it unconditionally, not just when a risk happens to apply.
