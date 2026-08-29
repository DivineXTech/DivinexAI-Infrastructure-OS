import type { AiCapability } from "@divinexai/schemas";

/**
 * Config-driven AI credit cost per generation, by capability. Change these
 * values (or supply per-organization overrides to AiProviderGateway) rather
 * than hard-coding a cost at any call site.
 */
export const DEFAULT_AI_CREDIT_COSTS: Record<AiCapability, number> = {
  TEXT_TO_MUSIC: 20,
  TEXT_TO_VIDEO: 40,
  IMAGE_TO_VIDEO: 30,
  TEXT_TO_IMAGE: 5,
  VOICE: 15,
  DUBBING: 15,
  LYRICS: 2,
  SCRIPT: 2,
  THUMBNAIL: 3,
  SHORT_FORM_VIDEO: 25,
};
