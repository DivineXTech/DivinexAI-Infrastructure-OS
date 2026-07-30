import { describe, expect, it } from "vitest";
import { validateAgentManifest, type AgentManifest } from "../src/manifest.js";
import {
  CANONICAL_AGENT_SLUGS,
  CANONICAL_AGENT_MANIFESTS,
  saraManifest,
  novaManifest,
  forgeManifest,
  guardianManifest,
  revenManifest,
  pulseManifest,
  type CanonicalAgentSlug,
} from "../src/agents/index.js";

const NAMED_MANIFESTS: Record<CanonicalAgentSlug, AgentManifest> = {
  sara: saraManifest,
  nova: novaManifest,
  forge: forgeManifest,
  guardian: guardianManifest,
  reven: revenManifest,
  pulse: pulseManifest,
};

describe("canonical agent manifests", () => {
  it("CANONICAL_AGENT_SLUGS and CANONICAL_AGENT_MANIFESTS list exactly the six approved agents, in order", () => {
    expect(CANONICAL_AGENT_SLUGS).toEqual([
      "sara",
      "nova",
      "forge",
      "guardian",
      "reven",
      "pulse",
    ]);
    expect(CANONICAL_AGENT_MANIFESTS.map((m) => m.id)).toEqual([
      ...CANONICAL_AGENT_SLUGS,
    ]);
  });

  it.each(CANONICAL_AGENT_SLUGS)(
    "%s's manifest validates via validateAgentManifest",
    (slug) => {
      const manifest = NAMED_MANIFESTS[slug];
      expect(() => validateAgentManifest(manifest)).not.toThrow();
      expect(manifest.id).toBe(slug);
    },
  );

  it("Sara is prohibited from deploying code, changing billing, moving funds, or altering security policy", () => {
    expect(saraManifest.prohibitedActions).toEqual(
      expect.arrayContaining([
        "deploy_code",
        "change_billing_configuration",
        "transfer_or_move_funds",
        "alter_security_policy",
      ]),
    );
  });

  it("Nova cannot approve a restricted business action", () => {
    expect(novaManifest.prohibitedActions).toContain(
      "approve_restricted_business_action",
    );
  });

  it("Forge cannot deploy to production without approval or rotate secrets autonomously", () => {
    expect(forgeManifest.prohibitedActions).toEqual(
      expect.arrayContaining([
        "deploy_to_production_without_approval",
        "expose_or_rotate_secrets_autonomously",
      ]),
    );
    expect(forgeManifest.approvalPolicy.requiresApprovalFor).toContain(
      "production_deployment",
    );
  });

  it("Guardian cannot silently rewrite business requirements and has the strictest auto-approval threshold", () => {
    expect(guardianManifest.prohibitedActions).toContain(
      "silently_rewrite_business_requirements",
    );
    expect(guardianManifest.approvalPolicy.autoApproveBelowRisk).toBe("none");
  });

  it("Reven cannot modify billing, issue refunds, or move funds without approval", () => {
    expect(revenManifest.prohibitedActions).toEqual(
      expect.arrayContaining([
        "modify_billing_configuration",
        "issue_refund",
        "move_funds",
      ]),
    );
  });

  it("Pulse cannot publish external claims automatically and distinguishes facts/estimates/inferences in its output shape", () => {
    expect(pulseManifest.prohibitedActions).toContain(
      "publish_external_claim_automatically",
    );
    const parsed = pulseManifest.outputSchema.parse({
      verifiedFacts: [{ claim: "x", source: "y" }],
      estimates: [{ claim: "x", basis: "y" }],
      inferences: [{ claim: "x", reasoning: "y" }],
    });
    expect(parsed).toHaveProperty("verifiedFacts");
    expect(parsed).toHaveProperty("estimates");
    expect(parsed).toHaveProperty("inferences");
  });

  it("every manifest's escalationTarget, if set, points at a known canonical agent or is null", () => {
    for (const manifest of CANONICAL_AGENT_MANIFESTS) {
      if (manifest.escalationTarget !== null) {
        expect(CANONICAL_AGENT_SLUGS as readonly string[]).toContain(
          manifest.escalationTarget,
        );
      }
    }
  });
});
