# ADR-0007: Credential Storage

**Status:** Mechanism finalized at the Phase 5 planning gate — see the
addendum below and `ADR-0016`. The original decision (below) predates the
addendum and is kept as historical record.

## Context

Provider API keys and tool credentials (`provider_configs`, `tool_credentials`)
must never be exposed to the browser or logged in plaintext (rules #9, #10).

## Decision (partial — flagged as an open item)

- Provider- and tool-level secrets are stored server-side only, referenced by
  ID from application code, never embedded in client-shipped bundles or API
  responses.
- Tenant-supplied tool credentials (e.g., a tenant's own Stripe key) are
  encrypted at rest; candidates are Supabase Vault or application-level
  envelope encryption with a KMS-held key — **final choice deferred to
  Phase 4**, when the first real tool adapter needing tenant credentials is
  built, so the decision is made against a concrete requirement rather than
  speculatively.
- Secret rotation is a requirement on whichever mechanism is chosen: rotating
  a provider or tenant credential must not require a code deploy.
- Logging helpers redact known credential-shaped fields by default
  (`RISK_REGISTER.md` #10) rather than relying on every call site to
  remember to do so.

## Consequences

- Phase 4 cannot start tool-adapter work requiring real tenant credentials
  until this ADR is completed with a concrete mechanism — noted here so it
  isn't missed.

## Addendum (Phase 5 planning gate): mechanism finalized

Phase 4 needed no tenant credentials (its approvals are purely internal
state); the first real need arrives with Phase 5's Model and Tool
Gateways. Finalized mechanism, full detail in `ADR-0016` and
`PHASE_5_MODEL_TOOL_GATEWAYS.md` §7:

- **`CredentialReference`** — a typed record (id, provider type,
  secret-manager type, secret path/opaque locator, optional version,
  scope, status, created/rotation metadata) stored in
  `tenant_model_provider_configurations.credential_reference`/
  `tenant_tool_credentials.credential_reference` (both `jsonb`). Never a
  plaintext secret value.
- **`CredentialResolver`** — a pluggable interface
  (`resolve(reference) -> ResolvedCredential`) living in
  `packages/shared/src/credentials.ts` (a placement decision itself
  flagged for confirmation, `PHASE_5_MODEL_TOOL_GATEWAYS.md` §19 item 3).
  Phase 5 ships exactly one implementation: `EnvCredentialResolver`
  (locator = environment variable name), sufficient for local development
  and every Phase 5 mock adapter.
- **Rotation**: a credential's `locator`/`version` can change without a
  code deploy — rotating a secret means updating the referenced
  secret-manager entry (or, for `EnvCredentialResolver`, the environment
  variable) and optionally bumping `CredentialReference.version`; the
  `tenant_model_provider_configurations`/`tenant_tool_credentials` row
  itself is updated through a governed command, never a direct client
  write (both tables are read-only for every tenant role, per §2/§5b of
  the Phase 5 design — the same lockdown pattern Phase 4 established for
  `approval_requests`).
- **Production mechanism** (Supabase Vault- or KMS-backed
  `CredentialResolver`) is **not implemented in Phase 5** — the interface
  is the reusable seam; a real implementation is built when a real
  (non-mock) tool or model provider actually needs one, avoiding
  speculative infrastructure.
- **Redaction discipline**: `ResolvedCredential.value` exists only in
  memory for the duration of one adapter call and is never assigned to
  anything a log line, event payload, approval snapshot, or test fixture
  could serialize — enforced by scoping (`ToolExecutionContext`/the model
  provider adapter's own argument), not by convention alone.

This addendum resolves this ADR's open item; no further Phase 4/5 work is
blocked on credential storage.
