# AgentFlow Pro — Dealership Automation

A vertical AI operating system for auto dealerships, built on DivinexAI Infrastructure OS.
Eight **AgentFlow Pro** agents run a dealership's marketing, sales, pricing, finance,
trade-in, service, reputation, and lead-reactivation workflows end to end, coordinated by
a central orchestrator agent and delivered through a white-label **Dealership App**.

## What this is

Every morning, the **Sales Floor Director** (the orchestrator agent) wakes up, runs all
seven module agents against the dealership's live CRM/DMS feed, and drops a single GM's
Daily Report on the desk before the sales floor opens: who's hot, what's aging, what to
reprice, what closed, what needs a review request, and what old leads are worth
reviving. The seven module agents also run continuously throughout the day on their own
event triggers (a new DM, a new lead, a completed RO, a closed deal).

```
                         ┌─────────────────────────────┐
  Dealership Data Feed → │      MASTER ORCHESTRATOR     │ → GM's Daily Report
  (CRM + DMS: leads,     │   Sales Floor Director agent │   (who's hot · aging ·
   deals, inventory)     │      runs every morning      │    reprice · gross)
                         └───────────────┬───────────────┘
           ┌──────────────┬──────────────┼──────────────┬──────────────┬──────────────┬──────────────┐
           ▼              ▼              ▼              ▼              ▼              ▼              ▼
         M1              M2             M3             M4             M5             M6             M7
    Social & Sales  Inventory &   Finance & Deal   Trade-In      Service       Reviews &      Lead
                     Pricing          Desk         Appraisal     Retention    Reputation   Reactivation
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data flow, and
[`agents/`](agents) for the exact agent specs — role, triggers, tools, inputs/outputs, and
model tier for each of the eight agents.

## Components

| Path | What it is |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, data flow, integration points |
| [`agents/`](agents) | The 8 AgentFlow Pro agent specs (orchestrator + M1–M7) |
| [`pricing/PRICING.md`](pricing/PRICING.md) | Setup fee and subscription tier packaging |
| [`app/`](app) | Branded Dealership App — Command Center dashboard + GM's Daily Report UI |

## Positioning

This package is sold as a done-for-you AI operating system for a dealership's sales
floor, not a chatbot add-on: a one-time build/integration fee plus a monthly seat for the
agent stack, with the Dealership App as the branded surface the GM and sales team touch
every day. See [`pricing/PRICING.md`](pricing/PRICING.md) for tiering.
