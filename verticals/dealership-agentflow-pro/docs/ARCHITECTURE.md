# Architecture — AgentFlow Pro for Dealerships

## Overview

Seven module agents (M1–M7) each own one slice of dealership operations. A single
orchestrator agent, the **Sales Floor Director**, runs them on a schedule, aggregates
their output, and is the one agent a GM or sales manager actually talks to.

```
DEALERSHIP DATA FEED (CRM + DMS: leads · deals · inventory)
        │  live sync
        ▼
MASTER ORCHESTRATOR — Sales Floor Director  ──every morning──▶  GM's Daily Report
        │                                                        (who's hot, aging,
        │  fires all 7 modules in order, waits on each,          reprice, gross)
        │  merges results, writes the report
        │
        ├─▶ M1 Social & Sales           ─┐
        ├─▶ M2 Inventory & Pricing       │
        ├─▶ M3 Finance & Deal Desk       ├─ also run continuously on their own
        ├─▶ M4 Trade-In Appraisal        │  event triggers throughout the day
        ├─▶ M5 Service Retention         │  (new DM, new lead, RO closed, deal
        ├─▶ M6 Reviews & Reputation      │  funded, etc.) — not just the morning run
        └─▶ M7 Lead Reactivation        ─┘
```

## Data flow

1. **Ingest.** The Dealership Data Feed is a live sync from the dealer's CRM (e.g. VinSolutions, DealerSocket, Elead) and DMS (e.g. CDK, Reynolds & Reynolds, Tekion) — leads, deals, inventory, RO history. AgentFlow Pro reads from this feed; it does not replace the CRM/DMS.
2. **Orchestrate.** Every morning (default 6:00 AM dealership-local time), the Sales Floor Director fires M1–M7 in sequence, waits on each to complete, and pulls a structured result object from each (see each agent spec's Outputs section).
3. **Report.** The orchestrator merges the seven results into the GM's Daily Report: hot leads today, units aging 60+, deals in the desk, gross MTD, inventory aging by days-on-lot, gross by month, and a "what moved overnight" log line per module.
4. **Act.** Each module agent also runs independently on its own event trigger throughout the day — a dealership doesn't wait until the next morning to get a lead response or a review request sent.
5. **Surface.** The Dealership App (see [`../app`](../app)) is the branded UI that renders the Command Center (live module run status + KPIs) and the GM's Daily Report. It's a thin client over the orchestrator's output — no business logic lives in the frontend.

## Trust boundary and escalation

Every module agent operates inside guardrails, not full autonomy:

- **Auto-execute**: low-risk, reversible actions (posting content, sending a follow-up DM, logging a lead, sending a service reminder).
- **Draft + approve**: money-adjacent or customer-facing-at-scale actions (reprice a unit, submit a credit application to a lender, send a review request campaign) are drafted and require one-click GM/manager approval inside the Dealership App, unless the dealership explicitly opts a module into full auto-execute.
- **Alert GM immediately**: anything that can damage the dealership (a bad review, a stalled high-value deal, a lender decline on a near-prime buyer) bypasses the daily digest and pages the GM in real time (SMS/Slack/email, configurable).

## Integration points

| System | Used by | Direction |
|---|---|---|
| CRM (leads, deals, contacts) | Orchestrator, M1, M3, M7 | Read/write |
| DMS (inventory, RO history, deal desk) | Orchestrator, M2, M3, M4, M5 | Read/write |
| Social platforms (Instagram, TikTok, Facebook) | M1 | Write (post), Read (comments/DMs) |
| Market comp data (vAuto, Marketcheck, or equivalent) | M2 | Read |
| Lender network / credit bureaus | M3 | Read/write (submit + status) |
| VIN decode + condition photos | M4 | Read |
| Review platforms (Google, DealerRater, Cars.com) | M6 | Read/write |
| Email/SMS/Slack | Orchestrator, M5, M6, M7 | Write |
| Dealership App | Orchestrator | Read (dashboard queries), Write (approvals) |

## Multi-rooftop

For dealer groups, one Sales Floor Director instance can run per rooftop (isolated data,
isolated report) or one orchestrator can run across a group with a rolled-up GM/Group
report — the difference between the Growth and Enterprise pricing tiers (see
[`../pricing/PRICING.md`](../pricing/PRICING.md)).

## Model tiering

Agents that reason over ambiguous, high-stakes, or freeform inputs (lender matching,
appraisal offers, review-sentiment triage, orchestration/report synthesis) run on a
frontier model tier. Agents doing narrower, higher-volume, more mechanical work (caption
generation, comment replies, reminder scheduling) run on a faster/cheaper tier to keep
per-dealership inference cost predictable at the lower subscription tiers. See each
agent's spec in [`../agents`](../agents) for its assigned tier.
