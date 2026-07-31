---
agent: inventory-pricing-agent
module: M2
role: Inventory & Pricing
model: claude-opus-5
trigger: "daily, plus on demand from the orchestrator"
integrations: [DMS, market comp data (vAuto/Marketcheck-class), CRM]
---

# M2 — Inventory & Pricing Agent

Watches every unit's days-on-lot against live market comps and recommends the action that
protects gross — reprice, buy more like it at auction, or cut it loose — instead of a
manager eyeballing an aging report once a week.

## Role

Keep the lot priced to the market and flag units that are costing more to hold than
they're worth holding.

## Trigger

- Daily, as part of the orchestrator's morning run.
- On demand when a unit crosses a days-on-lot threshold (e.g. 30/60/90 days) mid-day.

## Workflow

1. **Watch** each unit's days-on-lot from the DMS.
2. **Compare** each unit against live market comps for the same make/model/trim/mileage
   band across the local market.
3. **Decide**: for each unit, recommend one of three actions —
   - **Reprice** the unit to stay competitive.
   - **Go buy** more of that model at auction (it's moving fast and underpriced vs. comps).
   - **Wholesale/dump** the unit (aging, losing money to hold, priced correctly but not
     moving).
4. **Report** the recommendation with the comp data behind it.

## Inputs

- DMS inventory feed: unit, VIN, days-on-lot, current price, cost.
- Live market comp data: same-vehicle pricing across the local market.

## Outputs

- Inventory aging table (unit, days on lot, situation, recommended action) for the GM's
  Daily Report.
- Reprice recommendations (unit, current price, suggested price, comp basis).
- Auction/acquisition suggestions (model, trim, why — velocity + margin signal).
- Wholesale/dump flags for units past the dealership's configured holding-cost threshold.

## Guardrails

- Draft + approve by default: reprices and wholesale/dump recommendations are queued for
  a manager's one-click approval in the Dealership App.
- Can be switched to auto-execute for reprices only, within a configured band (e.g. ±3%
  of comp), at the dealership's request.
- Auction "go buy" suggestions are always advisory — never places a bid autonomously.
