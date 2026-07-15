import "server-only";

import { serverEnv } from "@/lib/env";
import { MockDivinexAIAssistant } from "@/lib/divinexai/mock-assistant";
import type { DivinexAIAssistant } from "@/lib/divinexai/types";

/**
 * Resolves the active DivinexAI assistant implementation. Falls back to the
 * mock unless both DIVINEXAI_API_BASE_URL and DIVINEXAI_API_KEY are set —
 * even then, a real HTTP-backed implementation still needs to be written
 * and swapped in here (see docs/DIVINEXAI_INTEGRATION.md).
 */
export function getDivinexAIAssistant(): DivinexAIAssistant {
  if (serverEnv.DIVINEXAI_API_BASE_URL && serverEnv.DIVINEXAI_API_KEY) {
    throw new Error(
      "DivinexAI credentials are configured but no live DivinexAIAssistant implementation exists yet. Implement one against DIVINEXAI_API_BASE_URL, or unset the credentials to keep using the mock.",
    );
  }
  return new MockDivinexAIAssistant();
}

export type { DivinexAIAssistant } from "@/lib/divinexai/types";
