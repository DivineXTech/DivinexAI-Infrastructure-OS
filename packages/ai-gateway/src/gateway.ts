import type { AiCapability } from "@divinexai/schemas";
import { hasActiveConsent } from "@divinexai/rights";
import { DEFAULT_AI_CREDIT_COSTS } from "./credit-schedule";
import type {
  AiGenerationRequest,
  AiGenerationResult,
  AiProvider,
  ConsentSource,
  CreditMeter,
} from "./types";
import { InsufficientCreditsError, NoProviderAvailableError, UnauthorizedCloneError } from "./types";

export interface AiProviderGatewayOptions {
  providers: AiProvider[];
  consentSource: ConsentSource;
  creditMeter: CreditMeter;
  creditCosts?: Partial<Record<AiCapability, number>>;
}

export interface GatewayGenerationOutcome {
  result: AiGenerationResult;
  creditCost: number;
}

/**
 * The only entry point CreatorOS uses to reach any AI vendor. Vendors are
 * fully decoupled behind the AiProvider interface; the gateway owns consent
 * gating, credit metering, and provider cost accounting so those concerns
 * never leak into vendor-specific code.
 */
export class AiProviderGateway {
  private readonly providersByCapability = new Map<AiCapability, AiProvider[]>();
  private readonly consentSource: ConsentSource;
  private readonly creditMeter: CreditMeter;
  private readonly creditCosts: Record<AiCapability, number>;

  constructor(options: AiProviderGatewayOptions) {
    this.consentSource = options.consentSource;
    this.creditMeter = options.creditMeter;
    this.creditCosts = { ...DEFAULT_AI_CREDIT_COSTS, ...options.creditCosts };
    for (const provider of options.providers) {
      for (const capability of provider.supportedCapabilities) {
        const existing = this.providersByCapability.get(capability) ?? [];
        existing.push(provider);
        this.providersByCapability.set(capability, existing);
      }
    }
  }

  private async assertConsent(request: AiGenerationRequest): Promise<void> {
    if (!request.voiceSubjectUserId && !request.likenessSubjectUserId) return;
    const consentRecords = await this.consentSource.getConsentRecords(request.organizationId);
    const targetAssetId = request.targetAssetId ?? null;

    if (request.voiceSubjectUserId) {
      const authorized = hasActiveConsent(
        request.organizationId,
        "VOICE",
        request.voiceSubjectUserId,
        targetAssetId,
        consentRecords,
      );
      if (!authorized) {
        throw new UnauthorizedCloneError(
          `Voice cloning blocked: no active consent from subject ${request.voiceSubjectUserId}.`,
        );
      }
    }
    if (request.likenessSubjectUserId) {
      const authorized = hasActiveConsent(
        request.organizationId,
        "LIKENESS",
        request.likenessSubjectUserId,
        targetAssetId,
        consentRecords,
      );
      if (!authorized) {
        throw new UnauthorizedCloneError(
          `Likeness replication blocked: no active consent from subject ${request.likenessSubjectUserId}.`,
        );
      }
    }
  }

  /** Runs one generation: gates consent, reserves credits, invokes the provider, and refunds credits on failure. */
  async generate(
    request: AiGenerationRequest,
    opts: { preferredProviderId?: string } = {},
  ): Promise<GatewayGenerationOutcome> {
    await this.assertConsent(request);

    const candidates = this.providersByCapability.get(request.capability) ?? [];
    if (candidates.length === 0) {
      throw new NoProviderAvailableError(request.capability);
    }
    const provider = opts.preferredProviderId
      ? candidates.find((p) => p.id === opts.preferredProviderId)
      : candidates[0];
    if (!provider) {
      throw new NoProviderAvailableError(request.capability);
    }

    const creditCost = this.creditCosts[request.capability];
    const balance = await this.creditMeter.getBalance(request.organizationId);
    if (balance < creditCost) {
      throw new InsufficientCreditsError(request.organizationId, creditCost, balance);
    }
    await this.creditMeter.reserve(request.organizationId, creditCost);

    try {
      const result = await provider.generate(request);
      return { result, creditCost };
    } catch (error) {
      await this.creditMeter.refund(request.organizationId, creditCost);
      throw error;
    }
  }

  listCapabilities(): AiCapability[] {
    return Array.from(this.providersByCapability.keys());
  }
}
