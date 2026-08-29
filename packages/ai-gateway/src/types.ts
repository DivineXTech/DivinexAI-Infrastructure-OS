import type { AiCapability, ConsentRecord } from "@divinexai/schemas";

export interface AiGenerationRequest {
  organizationId: string;
  capability: AiCapability;
  prompt?: string;
  sourceAssetIds?: string[];
  /** Set when this generation clones a specific person's voice or likeness; gated by consent. */
  voiceSubjectUserId?: string;
  likenessSubjectUserId?: string;
  /** For SPECIFIC_ASSETS-scoped consent to apply, the asset this generation will ultimately feed into. */
  targetAssetId?: string;
  params?: Record<string, unknown>;
}

export interface AiGenerationResult {
  providerId: string;
  providerModel: string;
  outputStoragePath: string;
  durationSeconds?: number;
  /** What the vendor actually charged the platform, in minor units — independent of the credit cost charged to the org. */
  providerCostMinorUnits: number;
}

/**
 * Every AI vendor integration implements this interface. CreatorOS never
 * imports a vendor SDK directly — it only ever talks to an AiProvider
 * through the AiProviderGateway.
 */
export interface AiProvider {
  id: string;
  supportedCapabilities: AiCapability[];
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}

export class UnauthorizedCloneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedCloneError";
  }
}

export class NoProviderAvailableError extends Error {
  constructor(capability: AiCapability) {
    super(`No AI provider registered for capability ${capability}`);
    this.name = "NoProviderAvailableError";
  }
}

/** Supplies the organization's current consent records so the gateway can gate cloning requests. */
export interface ConsentSource {
  getConsentRecords(organizationId: string): Promise<ConsentRecord[]> | ConsentRecord[];
}

/** Tracks and debits an organization's AI generation credit balance. Config-driven cost per capability, never hard-coded per call site. */
export interface CreditMeter {
  getBalance(organizationId: string): Promise<number> | number;
  reserve(organizationId: string, credits: number): Promise<void> | void;
  refund(organizationId: string, credits: number): Promise<void> | void;
}

export class InsufficientCreditsError extends Error {
  constructor(organizationId: string, required: number, available: number) {
    super(
      `Organization ${organizationId} has insufficient AI credits: needs ${required}, has ${available}`,
    );
    this.name = "InsufficientCreditsError";
  }
}
