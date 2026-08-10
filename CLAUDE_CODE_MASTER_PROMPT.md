# Atlas AI Video Factory — Claude Code Master Prompt

Paste this into Claude Code at the root of this repository when you want it
to extend, harden, or re-scaffold the Atlas AI Video Factory. It exists so
every future session starts from the same architectural contract instead of
re-deriving it from scratch.

## What you are building

A governed, production-grade pipeline that turns a scheduled trigger into a
published short-form video, with a human approval gate before anything goes
public:

1. **Idea Generation** — Schedule Trigger → Atlas Ideas Agent → Structured
   Output (schema-validated) → Save Ideas. Retries loop back from Structured
   Output to the Atlas Ideas Agent.
2. **Video Prompts** — Read Ideas → Prompt Director Agent → Script + Scene
   Plan (schema-validated), with the same retry-on-validation-failure loop.
3. **Generate Video** — Submit Video Job (webhook) → Wait/Poll (bounded,
   retry-safe) → Retrieve Video.
4. **Create Audio** — Generate Voiceover + Music (webhook) → Wait/Poll
   (bounded, retry-safe) → Retrieve Audio.
5. **Assemble & Publish** — Merge Assets → Quality Check → **FAIL** loops
   back to Merge Assets, **PASS** proceeds to Human Approval → Publish → Log
   URL to Database.

## Canonical source of truth — do not fork this

- `src/types/graph.ts` and `src/types/contract.ts` define the graph model
  and execution contract (idempotency, retries, schema validation, audit
  log, approval gating). Read these first.
- `src/graph/atlas-video-factory.graph.ts` is the literal encoding of the
  five stages above as nodes and edges. If you add, remove, or rewire a
  step, edit it **here** — the Inngest functions and the React Flow
  designer both read their topology from this file and must stay in sync
  with it, not duplicate it.
- `src/schemas/*.ts` are the Zod schemas that gate every piece of
  AI-generated or externally-fetched structured data before it's allowed to
  advance the graph.
- `src/workflow/inngest/functions.ts` is the current durable-execution
  implementation. It is intentionally engine-agnostic at the contract level
  (`src/types/contract.ts#WorkflowEngine`) — a Trigger.dev port should
  implement that same interface rather than inventing a new one.
- `src/providers/types.ts` + `src/providers/registry.ts` are the seams for
  video/voice/music/storage/publishing vendors. Never call a vendor SDK
  directly from a workflow function — add or edit an adapter and register
  it.

## Non-negotiable production behavior

These are constraints, not suggestions. Any change that violates one of
these needs a very good reason stated in the PR description:

- **Idempotency.** Every run and every step is idempotent. Runs are keyed by
  `(tenant_id, graph_id, idempotency_key)` (see `src/lib/idempotency.ts`);
  redelivering the same trigger must not double-execute a run.
- **Webhooks over polling, polling bounded when unavoidable.** External job
  submission uses a webhook/callback where the provider supports one.
  Where only polling is available, it is bounded — see `PollPolicy` in
  `src/types/graph.ts` (`intervalMs` / `timeoutMs`), never an unbounded loop.
- **Secrets stay server-side.** Provider API keys and the Supabase service
  role key are read only in server-only modules (`import "server-only"`
  at the top — see `src/lib/supabase/server.ts`). The browser client
  (`src/lib/supabase/client.ts`) only ever sees the public anon key.
- **Schema-validated structured output.** Every Claude call that must
  produce structured data goes through `generateStructured()`
  (`src/providers/claude.ts`), which forces tool-use and validates the
  result against a Zod schema before a workflow step is allowed to treat it
  as valid.
- **Retry with backoff, then dead-letter.** Failed steps retry per
  `RetryPolicy` (`src/types/graph.ts`, exponential by default). Once
  attempts are exhausted, the step (and, if terminal, the run) moves to
  `dead_letter` — it does not silently disappear or infinitely retry.
- **Publication requires explicit approval.** `assembleAndPublish` blocks on
  an `atlas/approval.granted` event before calling the publishing provider,
  unless `TenantPolicy.requireApprovalBeforePublish` is explicitly `false`
  for that tenant (`src/types/contract.ts`).
- **Every state transition is audited.** Run creation, step status changes,
  approvals, and publish all go through `appendAuditLog()`
  (`src/lib/audit-log.ts`) writing to the append-only `audit_log` table
  (`supabase/migrations/0001_init.sql`). Do not write pipeline state changes
  through any other path.

## Stack

- Next.js 16, React 19, TypeScript (strict), Tailwind, shadcn/ui
- React Flow for the visual workflow designer (`components/workflow/graph-designer.tsx`)
- Supabase: Postgres, Auth, Storage, Realtime, RLS
- Inngest for durable execution (Trigger.dev is a valid alternate backend
  behind the same `WorkflowEngine` contract)
- Anthropic Claude via `src/providers/claude.ts`
- Remotion + FFmpeg for final composition (wire into the `merge-assets` step
  in `assembleAndPublish`)
- Pluggable video / voice / music / storage / publishing providers
  (`src/providers/types.ts`, `src/providers/registry.ts`)

## Working in this repo

1. Read `src/types/graph.ts`, `src/types/contract.ts`, and
   `src/graph/atlas-video-factory.graph.ts` before touching pipeline code.
2. If you're adding a pipeline step, add a `GraphNode`/`GraphEdge` to the
   canonical graph first, then implement it in the matching Inngest
   function — never the reverse.
3. If you're adding a vendor integration, implement the relevant interface
   in `src/providers/types.ts` and register it in
   `src/providers/registry.ts`; don't reach into `src/workflow` from vendor
   code or vice versa.
4. Run `npm run typecheck` and `npm run lint` before considering a change
   done.
5. Any new AI-generated structured output needs a Zod schema in
   `src/schemas/` and must be validated through `generateStructured()` —
   never trust raw model output past a workflow step boundary.
