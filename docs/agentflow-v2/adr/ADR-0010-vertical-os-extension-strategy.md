# ADR-0010: Vertical OS Extension Strategy

**Status:** Proposed — to be implemented in Phase 8

## Context

RestaurantOS, BookOS, MediaForgeOS, and future vertical operating systems
must extend AgentFlow Pro without forking its runtime (§XIII). A sibling
repository in the same GitHub org, `DivineXTech/-MediaForgeOS`, exists and
has not yet been inspected — it may already contain relevant prior art.

## Decision

- `packages/vertical-os-sdk` defines the extension contract
  (`VerticalOSManifest`, `DepartmentTemplate`, `AgentTemplate`,
  `WorkflowTemplate`, `MemorySchemaDefinition`, `ToolRequirement`,
  `ExecutiveMetricDefinition`, `PolicyPack`, `CompliancePack`).
- Each `verticals/*` directory contains **only** configuration conforming to
  that contract — manifest data, template definitions, policy packs — never
  a copy of `packages/agent-runtime`, `packages/memory-engine`,
  `packages/tool-registry`, or `packages/workflow-engine`. This is the same
  folder-boundary enforcement pattern used for provider isolation
  (ADR-0001, ADR-0002).
- Installing a vertical OS means loading its manifest and registering its
  templates/policies into the shared runtime's tables (`agent_definitions`,
  `workflow_definitions`, etc., scoped to the installing tenant) — not
  standing up a parallel runtime instance.
- Before writing the MediaForgeOS example manifest (Phase 8), inspect
  `DivineXTech/-MediaForgeOS` to determine whether it already contains a
  working implementation that the manifest should wrap rather than
  duplicate from scratch.

## Consequences

- A vertical OS cannot introduce its own agent runtime or provider
  integration "for speed" — anything it needs must already be expressible
  through the shared runtime's capabilities, which may occasionally require
  extending the SDK itself rather than working around it in a vertical
  package (a healthy pressure toward a genuinely reusable core).
