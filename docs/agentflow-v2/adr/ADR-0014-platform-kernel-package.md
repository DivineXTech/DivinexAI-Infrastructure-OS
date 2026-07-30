# ADR-0014: `packages/platform-kernel` — Foundational Platform Primitives

**Status:** Accepted (Phase 3 planning-gate refinement, approved together
with Phase 3 architecture)

## Context

Phase 2 built `computeManifestHash` in
`packages/agent-runtime/src/manifestHash.ts` (canonicalize + sha256) to
detect "content changed without a version bump" for platform agent
definitions. Phase 3's design (`../PHASE_3_WORKFLOW_RUNTIME.md` §14)
identified that `workflow_versions` needs the identical logic, and proposed
extracting it into `packages/shared/src/contentHash.ts` — flagged explicitly
as a deliberate exception to the standing rule that `packages/shared` must
not become a dumping ground (`ADR-0013`, `CAPABILITY_PACKAGE_MAPPING.md`).

On review, that placement was rejected: `packages/shared` is cross-cutting
tenancy/authorization/audit infrastructure (`Queryable`,
`PgTenantAccessEvaluator`, `recordAuditEvent`, feature flags, tenant
settings) — content-addressable versioning is a different, narrower concern,
and "the second package that needs it" would keep recurring (tool manifests,
memory snapshots, marketplace packages) without ever earning its own home if
each occurrence is individually rationalized into `shared`.

## Decision

Create a new, ninth canonical package: **`packages/platform-kernel`**,
scoped narrowly to reusable, dependency-free platform primitives for
versioned/content-addressable artifacts — hashing, canonicalization,
serialization, and (as later needs arise) deterministic ID derivation. It
has no dependency on `packages/shared` or any domain package, and no domain
package depends on it for anything except these primitives.

Phase 3 populates it with exactly one export needed today:

```ts
// packages/platform-kernel/src/contentHash.ts
export function computeContentHash(value: unknown): string; // canonicalize + sha256
```

`packages/agent-runtime/src/manifestHash.ts` and the new
`packages/workflow-engine/src/manifestHash.ts` both become thin wrappers:
each extracts its own package's metadata shape, then calls
`computeContentHash` from `platform-kernel` — the canonicalization and
hashing algorithm itself is defined exactly once.

This is the intended **canonical implementation for every future versioned
artifact** this platform introduces: tool manifests (Phase 5), memory
snapshots (Phase 6), marketplace packages and vertical OS templates
(Phase 11) all hash their content through this same package rather than
each re-deriving canonicalization independently or reaching into
`agent-runtime`/`workflow-engine` for it.

## Consequences

- `packages/shared` remains scoped to tenancy/authorization/audit
  infrastructure only — no exception was actually needed once a properly
  scoped home existed.
- The 8-package taxonomy (`ADR-0013`) is superseded to a **9-package**
  taxonomy by this ADR, per that taxonomy's own rule ("must not be
  superseded without a written ADR and explicit approval") — both
  conditions are satisfied here.
- `CAPABILITY_PACKAGE_MAPPING.md` is updated to add `platform-kernel` and
  its capability ("versioned-artifact primitives: hashing, canonicalization,
  serialization, deterministic IDs").
- Future phases (tool registry, memory engine, vertical OS SDK) that need
  content-hashing reuse this package rather than proposing a new extraction
  each time.
- The package is deliberately minimal at Phase 3 — only `computeContentHash`
  ships now. Serialization helpers and deterministic-ID derivation are named
  in scope but not built until a concrete phase needs them, consistent with
  "smallest coherent increment."

## Alternatives considered

- **`packages/shared/src/contentHash.ts`** (the originally proposed
  placement) — rejected per Context above: conflates cross-cutting tenancy
  infrastructure with a narrower, independently-versioned concern, and
  invites the same "just one more helper" drift `ADR-0013`/row #15 of
  `RISK_REGISTER.md` already flags as a risk for `packages/shared`
  specifically.
- **Duplicate the logic in each consuming package** — rejected: this is
  precisely the drift risk the extraction exists to prevent (two
  independently-maintained canonicalization implementations silently
  diverging).

## Related

- `ADR-0013` — establishes the 8-package taxonomy this ADR extends to 9.
- `CAPABILITY_PACKAGE_MAPPING.md` — updated alongside this ADR.
- `../PHASE_3_WORKFLOW_RUNTIME.md` §14 — the original (superseded)
  `packages/shared` proposal this ADR replaces.
