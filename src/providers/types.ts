/**
 * Provider adapter interfaces. Concrete implementations (Runway, ElevenLabs,
 * YouTube, ...) live behind these so a vendor swap never touches workflow
 * or graph code — only the adapter registered in src/providers/registry.ts.
 */

import type { Scene } from "@/src/schemas/script";
import type { VideoJob } from "@/src/schemas/video-job";
import type { AudioJob } from "@/src/schemas/audio-job";

export interface VideoProvider {
  readonly name: string;
  submitJob(input: { scene: Scene; ideaId: string }): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<VideoJob>;
}

export interface VoiceProvider {
  readonly name: string;
  submitVoiceoverJob(input: {
    text: string;
    voiceId?: string;
  }): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<AudioJob>;
}

export interface MusicProvider {
  readonly name: string;
  submitMusicJob(input: { mood: string; durationSeconds: number }): Promise<{
    jobId: string;
  }>;
  getJobStatus(jobId: string): Promise<AudioJob>;
}

export interface StorageProvider {
  readonly name: string;
  upload(input: {
    path: string;
    data: Uint8Array | Blob;
    contentType: string;
  }): Promise<{ url: string }>;
  download(path: string): Promise<Uint8Array>;
}

export interface PublishingProvider {
  readonly name: string;
  publish(input: {
    videoUrl: string;
    title: string;
    description: string;
  }): Promise<{ publicUrl: string }>;
}
