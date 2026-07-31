# AgentFlow Pro — Dealership Agent Roster

The exact 8 agents that make up this automation. Each file is the full spec for one
agent: role, trigger, integrations, workflow, inputs/outputs, and guardrails.

| # | Agent | Role | Model tier | Trigger |
|---|---|---|---|---|
| 00 | [`sales-floor-director`](00-sales-floor-director.md) | Master Orchestrator | claude-opus-5 | Daily 06:00 + on-demand |
| M1 | [`social-sales-agent`](01-social-sales-agent.md) | Social & Sales | claude-sonnet-5 | New arrival/price drop, new comment/DM, continuous |
| M2 | [`inventory-pricing-agent`](02-inventory-pricing-agent.md) | Inventory & Pricing | claude-opus-5 | Daily + days-on-lot threshold |
| M3 | [`finance-deal-desk-agent`](03-finance-deal-desk-agent.md) | Finance & Deal Desk | claude-opus-5 | Deal enters the desk |
| M4 | [`trade-in-appraisal-agent`](04-trade-in-appraisal-agent.md) | Trade-In Appraisal | claude-opus-5 | Trade-in submitted |
| M5 | [`service-retention-agent`](05-service-retention-agent.md) | Service Retention | claude-sonnet-5 | Service history event, continuous |
| M6 | [`reviews-reputation-agent`](06-reviews-reputation-agent.md) | Reviews & Reputation | claude-sonnet-5 | Deal closed, new review, continuous |
| M7 | [`lead-reactivation-agent`](07-lead-reactivation-agent.md) | Lead Reactivation | claude-sonnet-5 | Daily sweep |

## Why this split

- **Opus-tier agents (M2, M3, M4, orchestrator)** do the work where a wrong answer costs
  real money or compliance exposure: pricing decisions, lender matching, appraisal
  offers, report synthesis. These need the strongest reasoning available.
- **Sonnet-tier agents (M1, M5, M6, M7)** run higher volume, more mechanical work
  (captions, reminders, review requests, reactivation sweeps) where speed and cost per
  run matter more than squeezing out the last bit of reasoning quality.

This split is also what makes the lower subscription tiers viable — see
[`../pricing/PRICING.md`](../pricing/PRICING.md) for which agents ship in which tier.

## Guardrail pattern

Every agent in this roster follows the same three-tier action model, defined per agent in
its own spec:

1. **Auto-execute** — low-risk, reversible, high-volume actions.
2. **Draft + approve** — money-adjacent or public-facing-at-scale actions, one-click
   approved in the Dealership App.
3. **Alert GM fast** — anything reputationally or financially urgent bypasses the daily
   digest and pages the GM in real time.
