/**
 * Interfaces for future DivinexAI ecosystem services (section 23). Mock
 * implementations are the default so the rest of the app can be built
 * against a stable contract before real endpoints exist. See
 * docs/DIVINEXAI_INTEGRATION.md for which service maps to which real
 * DivinexAI API once connected.
 */
export interface BrandNameSuggestion {
  name: string;
  rationale: string;
}

export interface DivinexAIAssistant {
  suggestBrandNames(input: {
    industryKeywords: string[];
    targetAudience: string;
  }): Promise<BrandNameSuggestion[]>;

  generateProductDescription(input: {
    productName: string;
    garmentType: string;
    keyFeatures: string[];
  }): Promise<string>;

  generateSocialCopy(input: {
    productName: string;
    tone: "playful" | "premium" | "streetwear" | "professional";
  }): Promise<string>;

  recommendStartupKit(input: {
    budgetCents: number;
    expectedMonthlyOrderVolume: number;
    printMethod: string;
    experienceLevel: "new" | "some-experience" | "experienced";
  }): Promise<{ kitSlug: string; rationale: string }>;
}
