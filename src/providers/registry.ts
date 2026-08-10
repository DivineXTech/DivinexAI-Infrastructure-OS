import "server-only";
import type {
  MusicProvider,
  PublishingProvider,
  StorageProvider,
  VideoProvider,
  VoiceProvider,
} from "@/src/providers/types";

/**
 * Central provider registry. Swap an entry here (e.g. plug in a Runway
 * VideoProvider) and every workflow step that depends on that capability
 * picks it up — nothing in src/workflow or src/graph needs to change.
 *
 * The defaults below are unimplemented stubs: this repo is a blueprint, not
 * a bundle of paid vendor integrations. Wire real adapters before deploying.
 */

function notConfigured(capability: string): never {
  throw new Error(
    `No ${capability} provider is configured. Implement one against ` +
      `src/providers/types.ts and register it in src/providers/registry.ts.`,
  );
}

export const videoProvider: VideoProvider = {
  name: "unconfigured",
  async submitJob() {
    notConfigured("video");
  },
  async getJobStatus() {
    notConfigured("video");
  },
};

export const voiceProvider: VoiceProvider = {
  name: "unconfigured",
  async submitVoiceoverJob() {
    notConfigured("voice");
  },
  async getJobStatus() {
    notConfigured("voice");
  },
};

export const musicProvider: MusicProvider = {
  name: "unconfigured",
  async submitMusicJob() {
    notConfigured("music");
  },
  async getJobStatus() {
    notConfigured("music");
  },
};

export const storageProvider: StorageProvider = {
  name: "unconfigured",
  async upload() {
    notConfigured("storage");
  },
  async download() {
    notConfigured("storage");
  },
};

export const publishingProvider: PublishingProvider = {
  name: "unconfigured",
  async publish() {
    notConfigured("publishing");
  },
};
