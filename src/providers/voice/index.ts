import "server-only";
import { hasElevenLabsCredentials } from "@/src/env";
import { elevenLabsVoiceProvider } from "@/src/providers/voice/elevenlabs";
import { mockVoiceProvider } from "@/src/providers/voice/mock";
import type { VoiceProvider } from "@/src/providers/types";

export const voiceProvider: VoiceProvider = hasElevenLabsCredentials()
  ? elevenLabsVoiceProvider
  : mockVoiceProvider;
