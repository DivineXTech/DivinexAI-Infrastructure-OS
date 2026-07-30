/**
 * Small, independently testable pure functions implementing DAG validation
 * (manifest.ts's `validateWorkflowManifest` composes these). Each takes the
 * minimal shape it needs rather than the full `WorkflowStepDefinition` type,
 * so this file has no dependency on manifest.ts (avoids a circular import,
 * since manifest.ts depends on this file).
 */
export interface DagStep {
  stepKey: string;
  dependsOn: readonly string[];
}

export class DuplicateStepKeyError extends Error {
  constructor(public readonly duplicateKeys: readonly string[]) {
    super(
      `Duplicate step keys in workflow manifest: ${duplicateKeys.join(", ")}`,
    );
    this.name = "DuplicateStepKeyError";
  }
}

export class OrphanedStepDependencyError extends Error {
  constructor(
    public readonly stepKey: string,
    public readonly missingDependency: string,
  ) {
    super(`Step "${stepKey}" depends on unknown step "${missingDependency}"`);
    this.name = "OrphanedStepDependencyError";
  }
}

export class CyclicWorkflowDependencyError extends Error {
  constructor(public readonly cyclePath: readonly string[]) {
    super(
      `Workflow manifest contains a dependency cycle: ${cyclePath.join(" -> ")}`,
    );
    this.name = "CyclicWorkflowDependencyError";
  }
}

export class NoEntryStepError extends Error {
  constructor() {
    super("Workflow manifest has no entry step (a step with no dependencies)");
    this.name = "NoEntryStepError";
  }
}

export class UnreachableWorkflowStepError extends Error {
  constructor(public readonly stepKey: string) {
    super(`Step "${stepKey}" is not reachable from any entry step`);
    this.name = "UnreachableWorkflowStepError";
  }
}

export class NoTerminalStepError extends Error {
  constructor() {
    super(
      "Workflow manifest has no reachable terminal step (a step nothing else depends on)",
    );
    this.name = "NoTerminalStepError";
  }
}

/** Returns the step keys that appear more than once, or an empty array. */
export function findDuplicateStepKeys(steps: readonly DagStep[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.stepKey)) {
      duplicates.add(step.stepKey);
    }
    seen.add(step.stepKey);
  }
  return [...duplicates];
}

/** Returns every (stepKey, missingDependency) pair where dependsOn names an unknown step. */
export function findOrphanedDependencies(
  steps: readonly DagStep[],
): { stepKey: string; missingDependency: string }[] {
  const knownKeys = new Set(steps.map((s) => s.stepKey));
  const orphans: { stepKey: string; missingDependency: string }[] = [];
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      if (!knownKeys.has(dep)) {
        orphans.push({ stepKey: step.stepKey, missingDependency: dep });
      }
    }
  }
  return orphans;
}

/**
 * Standard DFS cycle detection over the `stepKey -> dependsOn` adjacency.
 * Returns the cycle path (as step keys) if one exists, or null. Assumes no
 * orphaned dependencies (call findOrphanedDependencies first).
 */
export function detectCycle(steps: readonly DagStep[]): string[] | null {
  const byKey = new Map(steps.map((s) => [s.stepKey, s]));
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];

  function visit(stepKey: string): string[] | null {
    state.set(stepKey, "visiting");
    path.push(stepKey);

    const step = byKey.get(stepKey);
    for (const dep of step?.dependsOn ?? []) {
      const depState = state.get(dep);
      if (depState === "visiting") {
        const cycleStart = path.indexOf(dep);
        return [...path.slice(cycleStart), dep];
      }
      if (depState !== "done") {
        const found = visit(dep);
        if (found) return found;
      }
    }

    path.pop();
    state.set(stepKey, "done");
    return null;
  }

  for (const step of steps) {
    if (!state.has(step.stepKey)) {
      const found = visit(step.stepKey);
      if (found) return found;
    }
  }
  return null;
}

/** Steps with no dependencies — the graph's starting points. */
export function computeEntrySteps(steps: readonly DagStep[]): string[] {
  return steps.filter((s) => s.dependsOn.length === 0).map((s) => s.stepKey);
}

/**
 * Every step key reachable from the given entry steps, walking forward
 * (dependent -> dependency edges reversed, i.e. from a step to the steps
 * that depend on it).
 */
export function computeReachableSteps(
  steps: readonly DagStep[],
  entryStepKeys: readonly string[],
): Set<string> {
  const dependents = new Map<string, string[]>();
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      const list = dependents.get(dep) ?? [];
      list.push(step.stepKey);
      dependents.set(dep, list);
    }
  }

  const reachable = new Set<string>(entryStepKeys);
  const queue = [...entryStepKeys];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of dependents.get(current) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  return reachable;
}

/** Steps that no other step depends on — candidate finish points. */
export function computeTerminalSteps(steps: readonly DagStep[]): string[] {
  const dependedOn = new Set<string>();
  for (const step of steps) {
    for (const dep of step.dependsOn) {
      dependedOn.add(dep);
    }
  }
  return steps.filter((s) => !dependedOn.has(s.stepKey)).map((s) => s.stepKey);
}

/**
 * Composes checks 3-8 of the DAG validation algorithm (manifest.ts's
 * `validateWorkflowManifest` runs checks 1-2 and 9 itself). Throws the first
 * violation found, in the documented order.
 */
export function validateDag(steps: readonly DagStep[]): void {
  const duplicates = findDuplicateStepKeys(steps);
  if (duplicates.length > 0) {
    throw new DuplicateStepKeyError(duplicates);
  }

  const orphans = findOrphanedDependencies(steps);
  if (orphans.length > 0) {
    throw new OrphanedStepDependencyError(
      orphans[0]!.stepKey,
      orphans[0]!.missingDependency,
    );
  }

  const cycle = detectCycle(steps);
  if (cycle) {
    throw new CyclicWorkflowDependencyError(cycle);
  }

  const entrySteps = computeEntrySteps(steps);
  if (entrySteps.length === 0) {
    throw new NoEntryStepError();
  }

  const reachable = computeReachableSteps(steps, entrySteps);
  for (const step of steps) {
    if (!reachable.has(step.stepKey)) {
      throw new UnreachableWorkflowStepError(step.stepKey);
    }
  }

  const terminalSteps = computeTerminalSteps(steps);
  if (!terminalSteps.some((key) => reachable.has(key))) {
    throw new NoTerminalStepError();
  }
}
