import { describe, expect, it } from "vitest";
import {
  GOVERNED_ACTIONS,
  GovernedActionSchema,
  GovernedActionOrWildcardSchema,
  isGovernedAction,
} from "../src/actionCatalog.js";

describe("GovernedActionSchema", () => {
  it("has exactly 19 named actions", () => {
    expect(GOVERNED_ACTIONS).toHaveLength(19);
  });

  it.each(GOVERNED_ACTIONS)("accepts %s", (action) => {
    expect(() => GovernedActionSchema.parse(action)).not.toThrow();
  });

  it("rejects an arbitrary unregistered action string", () => {
    expect(() => GovernedActionSchema.parse("restaurant-os.order.refund")).toThrow();
  });

  it("rejects the wildcard on the plain schema (wildcard is a separate, explicit union)", () => {
    expect(() => GovernedActionSchema.parse("*")).toThrow();
  });
});

describe("GovernedActionOrWildcardSchema", () => {
  it("accepts the wildcard", () => {
    expect(() => GovernedActionOrWildcardSchema.parse("*")).not.toThrow();
  });

  it("accepts a real governed action", () => {
    expect(() => GovernedActionOrWildcardSchema.parse("data.export")).not.toThrow();
  });

  it("rejects an unregistered action", () => {
    expect(() => GovernedActionOrWildcardSchema.parse("not.real")).toThrow();
  });
});

describe("isGovernedAction", () => {
  it("is a type guard agreeing with the schema", () => {
    expect(isGovernedAction("secret.access")).toBe(true);
    expect(isGovernedAction("not.real")).toBe(false);
    expect(isGovernedAction("*")).toBe(false);
  });
});
