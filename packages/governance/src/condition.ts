import type { ConditionNode } from "./policyDocument.js";

/**
 * Pure, deterministic condition evaluator over a data-only structure — no
 * `eval`, no code strings, no model call (§3b of the Phase 4 design).
 * `field` is a dot-path into the evaluation context (e.g.
 * "parameters.amountUsd", "riskLevel"); an unresolvable path evaluates to
 * `undefined`, which fails every operator except `neq`/`not_in`.
 */
export function resolveFieldPath(
  context: Record<string, unknown>,
  field: string,
): unknown {
  const parts = field.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function compare(operator: string, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual);
    default:
      throw new Error(`Unknown condition operator: ${operator}`);
  }
}

export function evaluateCondition(
  node: ConditionNode,
  context: Record<string, unknown>,
): boolean {
  if ("all" in node) {
    return node.all.every((child) => evaluateCondition(child, context));
  }
  if ("any" in node) {
    return node.any.some((child) => evaluateCondition(child, context));
  }
  const actual = resolveFieldPath(context, node.field);
  return compare(node.operator, actual, node.value);
}
