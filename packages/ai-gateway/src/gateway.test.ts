import { describe, expect, test } from "bun:test";
import type { ConsentRecord } from "@divinexai/schemas";
import { AiProviderGateway } from "./gateway";
import { MockAiProvider } from "./mock-provider";
import type { ConsentSource, CreditMeter } from "./types";
import { InsufficientCreditsError, NoProviderAvailableError, UnauthorizedCloneError } from "./types";

class InMemoryConsentSource implements ConsentSource {
  constructor(private records: ConsentRecord[] = []) {}
  getConsentRecords(): ConsentRecord[] {
    return this.records;
  }
}

class InMemoryCreditMeter implements CreditMeter {
  private balances = new Map<string, number>();
  constructor(initial: Record<string, number> = {}) {
    for (const [org, bal] of Object.entries(initial)) this.balances.set(org, bal);
  }
  getBalance(organizationId: string): number {
    return this.balances.get(organizationId) ?? 0;
  }
  reserve(organizationId: string, credits: number): void {
    this.balances.set(organizationId, this.getBalance(organizationId) - credits);
  }
  refund(organizationId: string, credits: number): void {
    this.balances.set(organizationId, this.getBalance(organizationId) + credits);
  }
}

describe("AiProviderGateway", () => {
  test("generates via the registered provider and meters credits", async () => {
    const creditMeter = new InMemoryCreditMeter({ org1: 100 });
    const gateway = new AiProviderGateway({
      providers: [new MockAiProvider()],
      consentSource: new InMemoryConsentSource(),
      creditMeter,
    });
    const outcome = await gateway.generate({
      organizationId: "org1",
      capability: "TEXT_TO_MUSIC",
      prompt: "an upbeat synth pop track",
    });
    expect(outcome.result.providerId).toBe("mock");
    expect(outcome.creditCost).toBe(20);
    expect(creditMeter.getBalance("org1")).toBe(80);
  });

  test("throws NoProviderAvailableError for an unregistered capability", async () => {
    const gateway = new AiProviderGateway({
      providers: [],
      consentSource: new InMemoryConsentSource(),
      creditMeter: new InMemoryCreditMeter({ org1: 100 }),
    });
    await expect(
      gateway.generate({ organizationId: "org1", capability: "TEXT_TO_MUSIC" }),
    ).rejects.toBeInstanceOf(NoProviderAvailableError);
  });

  test("blocks voice cloning without consent", async () => {
    const gateway = new AiProviderGateway({
      providers: [new MockAiProvider()],
      consentSource: new InMemoryConsentSource([]),
      creditMeter: new InMemoryCreditMeter({ org1: 100 }),
    });
    await expect(
      gateway.generate({
        organizationId: "org1",
        capability: "VOICE",
        voiceSubjectUserId: "singer1",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedCloneError);
  });

  test("allows voice cloning with active consent", async () => {
    const consent: ConsentRecord = {
      id: "consent1",
      organizationId: "org1",
      subjectType: "VOICE",
      subjectUserId: "singer1",
      grantedByUserId: "singer1",
      scope: "ORGANIZATION_ONLY",
      assetIdScope: [],
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    const gateway = new AiProviderGateway({
      providers: [new MockAiProvider()],
      consentSource: new InMemoryConsentSource([consent]),
      creditMeter: new InMemoryCreditMeter({ org1: 100 }),
    });
    const outcome = await gateway.generate({
      organizationId: "org1",
      capability: "VOICE",
      voiceSubjectUserId: "singer1",
    });
    expect(outcome.result.providerId).toBe("mock");
  });

  test("rejects when the organization has insufficient credits", async () => {
    const gateway = new AiProviderGateway({
      providers: [new MockAiProvider()],
      consentSource: new InMemoryConsentSource(),
      creditMeter: new InMemoryCreditMeter({ org1: 5 }),
    });
    await expect(
      gateway.generate({ organizationId: "org1", capability: "TEXT_TO_MUSIC" }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  test("refunds credits when the provider throws", async () => {
    const creditMeter = new InMemoryCreditMeter({ org1: 100 });
    const failingProvider = {
      id: "failing",
      supportedCapabilities: ["TEXT_TO_MUSIC"] as const,
      generate: async () => {
        throw new Error("vendor outage");
      },
    };
    const gateway = new AiProviderGateway({
      providers: [failingProvider as never],
      consentSource: new InMemoryConsentSource(),
      creditMeter,
    });
    await expect(
      gateway.generate({ organizationId: "org1", capability: "TEXT_TO_MUSIC" }),
    ).rejects.toThrow("vendor outage");
    expect(creditMeter.getBalance("org1")).toBe(100);
  });
});
