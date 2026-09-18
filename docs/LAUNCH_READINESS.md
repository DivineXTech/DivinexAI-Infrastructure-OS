# Launch-Readiness Score

`lib/onboarding/launch-readiness-engine.ts` — a pure, transparent 0–100
scoring function, no I/O, recalculated on demand rather than trusted as a
cached value. Unit-tested in `tests/unit/launch-readiness-engine.test.ts`.

**This is an operational-planning score, not a prediction of business
success.** Every place it's displayed (`components/onboarding/review-panel.tsx`,
`app/app/onboarding/complete/page.tsx`, the dashboard) presents it with that
framing intact — it measures how much of the onboarding planning surface is
filled in, not whether the resulting business will succeed.

## Categories and weights

| Category | Max points | What it checks |
|---|---|---|
| Brand foundation | 15 | Name, logo, colors, personality, description |
| Audience clarity | 10 | Customer types, age ranges, market type, style preferences |
| Product strategy | 15 | Categories, launch quantity, design count, price range, sales model |
| Production readiness | 20 | Method, experience level, workspace, volume estimate, equipment decision |
| Budget planning | 10 | Budget band, allocation detail |
| Storefront readiness | 10 | Name, theme direction, domain status, payment-method planning |
| Fulfillment readiness | 10 | Model, lead time, return-policy status, shipping regions |
| Compliance / operational planning | 10 | Return policy defined, QC responsibility assigned, budget planned |

Each category's score is `round(max * (checks passed / total checks))`
(`scoreChecks`) — a missing section (the founder hasn't reached that step
yet) scores 0 for that category rather than throwing, so the engine is
safe to call at any point in the wizard, not just after every step is done.
The total is the sum of all eight categories, capped at 100.

## Labels

| Score | Label |
|---|---|
| 90–100 | Launch Ready |
| 75–89 | Launch Preparation |
| 60–74 | Building |
| 40–59 | Early Planning |
| 0–39 | Foundation Needed |

## Strengths, gaps, priority actions, blocking issues

- **Strengths** — any category at ≥80% of its max.
- **Gaps** — any category below 50% of its max, each paired with a
  priority action ("Complete the &lt;category&gt; step.").
- **Priority actions** — capped at 5, in category order.
- **Blocking issues** — hard requirements independent of the score: no
  brand name, no production method selected, or no budget band selected.
  These surface even at a high overall score, since a high score in every
  *other* category shouldn't paper over a genuinely missing prerequisite.

## Recalculation and access

`recalculateLaunchReadinessAction`
(`app/app/onboarding/wizard-actions.ts`) recomputes the score from every
saved step's current data every time it's invoked — there is no cached
"stale" score to worry about invalidating. It's owner/admin only,
mirroring the `launch_readiness_assessments` RLS policy exactly (no
designer/production-manager read, since the score is derived in part from
budget data those roles can't see) — the action returns a permission error
rather than silently succeeding for a role the database would have
rejected anyway.
