# ADR-0011: Deployment Topology & Durable Worker Hosting

**Status:** Partially decided — web/API/database topology accepted now;
durable worker hosting explicitly deferred, to be finalized before Phase 5

## Context

The house convention review (`../HOUSE_CONVENTION_REVIEW.md`) found that the
one sibling production app in this org, MediaForgeOS, deploys as Docker
images to Kubernetes via ArgoCD — a real, current convention, but one the
user explicitly overrode for AgentFlow Pro in favor of a different working
assumption. The workflow engine (`ADR-0004`) also needs a worker process that
outlives a single HTTP request, which shapes what "durable" hosting can mean
here.

## Decision — current working assumption (accepted now)

- **Vercel** hosts the Next.js web application and its short-lived API/
  serverless routes (request/response work: agent chat turns, tool-execution
  triggers, dashboard reads, webhook receivers that hand off to the workflow
  engine rather than doing long work inline).
- **Supabase** hosts Postgres (with RLS), auth, storage, and — per `ADR-0005`
  — pgvector, per `ADR-0001`.
- **The durable worker runtime is explicitly not yet selected.** Vercel's
  serverless functions are not suited to long-running, resumable workflow
  execution (execution time limits, no persistent process), so the workflow
  engine's step-claiming worker (`ADR-0004`) needs a home that can run
  continuously or on a reliable schedule. That choice is deferred to before
  Phase 5, once Phases 1-4 give real signal on step volume, concurrency, and
  execution duration.

## Options under consideration for the durable worker (decision deferred)

| Option                                             | Fit                                                                                                                                                                        | Tradeoff                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Always-on VPS/container (e.g. a small Docker host) | Simplest mental model; matches MediaForgeOS's own container experience (rejected for its _destination_, Kubernetes, but the container-based _packaging_ is still reusable) | Someone has to operate it: patching, scaling, uptime, no managed autoscaling                                                                |
| Google Cloud Run Jobs/Services                     | Serverless containers, scales to zero, good fit for a worker that's mostly idle between workflow steps; Jobs suit finite-duration runs, Services suit a long-lived poller  | Adds a GCP dependency alongside Vercel/Supabase; cold starts if scaled to zero and latency-sensitive                                        |
| Railway                                            | Very low ops overhead, container or Nixpacks deploys, easy Postgres/worker co-location in one dashboard                                                                    | Smaller platform; less mature autoscaling/observability than the hyperscalers                                                               |
| Render                                             | Similar profile to Railway — managed background workers as a first-class primitive, low ops burden                                                                         | Same category of tradeoffs as Railway; pricing at scale less predictable than a VPS                                                         |
| Fly.io                                             | Good fit for a small always-on worker close to users globally; supports persistent volumes if needed                                                                       | Another platform to operate; less "one dashboard" than Railway/Render alongside Vercel                                                      |
| Managed workflow engine (Temporal Cloud, Inngest)  | Offloads retry/timeout/durability semantics entirely; would let `ADR-0004`'s bespoke Postgres-native worker be replaced by a managed execution model                       | Real recurring cost and a genuine new dependency at the center of the platform — the exact thing `ADR-0004` deferred until proven necessary |

## Consequences

- Phases 1-4 must avoid building anything into the workflow engine that
  assumes a specific worker host (e.g., no code that only works given a
  particular platform's request-duration limits) — the step-claiming design
  in `ADR-0004` (`SELECT ... FOR UPDATE SKIP LOCKED`-style polling) is
  intentionally host-agnostic for this reason.
- Whatever is chosen, it must reach Supabase Postgres securely (network
  allowlisting or private networking) — a factor to weigh when the decision
  is made, not before.
- This ADR must be revisited and its status changed to "Accepted" with a
  named provider before Phase 5 implementation begins; Phase 5 is blocked
  without that decision.

## Related

- `ADR-0004` — the durable execution _model_ (Postgres tables as source of
  truth, worker polls and claims steps). This ADR is about _where that
  worker process physically runs_, a separable decision.
