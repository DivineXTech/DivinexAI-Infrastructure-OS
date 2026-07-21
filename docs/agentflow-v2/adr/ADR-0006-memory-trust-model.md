# ADR-0006: Memory Trust Model

**Status:** Proposed — to be implemented in Phase 3

## Context

Agent- and workflow-generated facts must not become trusted business memory
automatically (§VII). Without an explicit trust-state machine, there is a
predictable risk (`../RISK_REGISTER.md` #5) that unverified AI output gets
treated as fact by downstream consumers, including Sara's executive
briefings.

## Decision

Every `memory_facts` row (and by extension anything derived from it) carries
a mandatory `trust_state` enum:

`unverified → machine_extracted → user_confirmed | system_confirmed →
superseded | expired | restricted`

- New agent- or workflow-proposed facts enter at `unverified` or
  `machine_extracted` and are never returned to a caller as if confirmed.
- Promotion to `user_confirmed`/`system_confirmed` requires an explicit
  action (a human confirming it, or a deterministic system check verifying
  it against an authoritative source) — never automatic promotion by the
  same agent that proposed the fact.
- The retrieval service (§VII) returns `trust_state` alongside every result
  and refuses to let a caller silently drop it — Sara's briefing template
  (§XII) is required to visually distinguish verified facts from AI
  interpretation for this reason.

## Consequences

- Every memory-writing code path must set a trust state explicitly; there is
  no default that reads as "trusted."
- Retrieval and summarization logic must handle mixed-trust results rather
  than assuming uniform confidence — slightly more complex ranking/display
  logic, accepted as the cost of not misrepresenting AI output as fact.
