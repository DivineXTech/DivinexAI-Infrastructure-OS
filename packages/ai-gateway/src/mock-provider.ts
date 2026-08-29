import { randomUUID } from "node:crypto";
import type { AiCapability } from "@divinexai/schemas";
import type { AiGenerationRequest, AiGenerationResult, AiProvider } from "./types";

/**
 * A deterministic in-memory provider for local development and tests. Not a
 * real vendor integration — swap in a real AiProvider implementation per
 * capability without touching CreatorOS or the gateway itself.
 */
export class MockAiProvider implements AiProvider {
  id = "mock";
  supportedCapabilities: AiCapability[] = [
    "TEXT_TO_MUSIC",
    "TEXT_TO_VIDEO",
    "IMAGE_TO_VIDEO",
    "TEXT_TO_IMAGE",
    "VOICE",
    "DUBBING",
    "LYRICS",
    "SCRIPT",
    "THUMBNAIL",
    "SHORT_FORM_VIDEO",
  ];

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    return {
      providerId: this.id,
      providerModel: `mock-${request.capability.toLowerCase()}-v1`,
      outputStoragePath: `mock://${request.organizationId}/${request.capability.toLowerCase()}/${randomUUID()}`,
      durationSeconds: request.capability === "TEXT_TO_MUSIC" ? 180 : undefined,
      providerCostMinorUnits: 10,
    };
  }
}
