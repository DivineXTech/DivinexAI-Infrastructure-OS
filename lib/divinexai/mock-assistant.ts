import "server-only";

import type { BrandNameSuggestion, DivinexAIAssistant } from "@/lib/divinexai/types";

/**
 * Deterministic mock implementation — no external calls. Used until the
 * real DivinexAI "Sara" business assistant API is connected (see
 * docs/DIVINEXAI_INTEGRATION.md). Output is clearly templated, not
 * represented as AI-generated in any user-facing copy while this mock is
 * active.
 */
export class MockDivinexAIAssistant implements DivinexAIAssistant {
  async suggestBrandNames(input: {
    industryKeywords: string[];
    targetAudience: string;
  }): Promise<BrandNameSuggestion[]> {
    const keyword = input.industryKeywords[0] ?? "Apparel";
    return [
      {
        name: `${keyword} Collective`,
        rationale: `Placeholder suggestion combining "${keyword}" with your target audience (${input.targetAudience}).`,
      },
      {
        name: `${keyword} Supply Co.`,
        rationale: "Placeholder suggestion in a supply-brand naming pattern.",
      },
    ];
  }

  async generateProductDescription(input: {
    productName: string;
    garmentType: string;
    keyFeatures: string[];
  }): Promise<string> {
    return `${input.productName} — a ${input.garmentType} featuring ${input.keyFeatures.join(", ") || "custom details"}. (Mock description; connect a real DivinexAI endpoint for production copy.)`;
  }

  async generateSocialCopy(input: {
    productName: string;
    tone: "playful" | "premium" | "streetwear" | "professional";
  }): Promise<string> {
    return `Introducing ${input.productName}. (Mock ${input.tone}-tone caption; connect a real DivinexAI endpoint for production copy.)`;
  }

  async recommendStartupKit(input: {
    budgetCents: number;
    expectedMonthlyOrderVolume: number;
    printMethod: string;
    experienceLevel: "new" | "some-experience" | "experienced";
  }): Promise<{ kitSlug: string; rationale: string }> {
    if (input.budgetCents < 50_000) {
      return {
        kitSlug: "beginner-creator-kit",
        rationale: "Placeholder recommendation based on entry-level budget.",
      };
    }
    return {
      kitSlug: "small-production-studio-kit",
      rationale: `Placeholder recommendation based on ${input.expectedMonthlyOrderVolume} expected monthly orders and ${input.printMethod} print method.`,
    };
  }
}
