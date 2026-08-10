/**
 * Provider adapter interfaces. Concrete implementations (a real vendor, or
 * the deterministic mocks in src/providers/mock/) live behind these so a
 * vendor swap never touches workflow or graph code — only the registry in
 * src/providers/registry.ts.
 *
 * Every capability exposes `checkHealth()` so the /providers screen and
 * src/providers/health.ts can report configured/missing/healthy/failing
 * without ever touching a secret value.
 */

import type { VideoJob } from "@/src/schemas/video-job";
import type { AudioJob } from "@/src/schemas/audio-job";
import type { PublishResult } from "@/src/schemas/publish";

export interface HealthCheckResult {
  readonly healthy: boolean;
  readonly detail?: string;
}

export interface AiProvider {
  readonly name: string;
  readonly simulated: boolean;
  checkHealth(): Promise<HealthCheckResult>;
}

export interface VideoProvider {
  readonly name: string;
  readonly simulated: boolean;
  submitJob(input: {
    runId: string;
    sceneOrder: number;
    visualPrompt: string;
    durationSeconds: number;
  }): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<VideoJob>;
  checkHealth(): Promise<HealthCheckResult>;
}

export interface VoiceProvider {
  readonly name: string;
  readonly simulated: boolean;
  /** ElevenLabs' TTS API is synchronous, so this resolves once audio is
   *  generated and uploaded — the returned jobId is still used for
   *  correlation/idempotency and getJobStatus() will immediately report
   *  "completed". */
  submitVoiceoverJob(input: {
    runId: string;
    sceneId: string;
    text: string;
    voiceId?: string;
  }): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<AudioJob>;
  checkHealth(): Promise<HealthCheckResult>;
}

export interface MusicProvider {
  readonly name: string;
  readonly simulated: boolean;
  submitMusicJob(input: {
    runId: string;
    mood: string;
    direction: string;
    durationSeconds: number;
  }): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<AudioJob>;
  checkHealth(): Promise<HealthCheckResult>;
}

export interface StorageProvider {
  readonly name: string;
  readonly simulated: boolean;
  upload(input: {
    path: string;
    data: Uint8Array;
    contentType: string;
  }): Promise<{ url: string; path: string }>;
  download(path: string): Promise<Uint8Array>;
  checkHealth(): Promise<HealthCheckResult>;
}

export interface PublishingProvider {
  readonly name: string;
  readonly simulated: boolean;
  publish(input: {
    videoUrl: string;
    title: string;
    description: string;
  }): Promise<PublishResult>;
  checkHealth(): Promise<HealthCheckResult>;
}
