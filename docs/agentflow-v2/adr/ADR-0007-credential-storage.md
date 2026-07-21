# ADR-0007: Credential Storage

**Status:** Proposed — mechanism to be finalized in Phase 4 (open item, see below)

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
