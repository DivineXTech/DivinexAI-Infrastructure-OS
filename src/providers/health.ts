import "server-only";
import {
  aiProvider,
  musicProvider,
  publishingProvider,
  storageProvider,
  videoProvider,
  voiceProvider,
} from "@/src/providers/registry";
import { checkCompositionBinaries } from "@/src/composition/binaries";
import type { HealthCheckResult } from "@/src/providers/types";

export type ProviderCapability =
  | "ai"
  | "video"
  | "voice"
  | "music"
  | "storage"
  | "publishing"
  | "composition";

export type ProviderState = "missing" | "configured" | "healthy" | "failing";

/** One row of the /providers status screen. Deliberately carries no secret
 *  values — only the provider's public name, whether it's real or
 *  simulated, and a human-readable health detail. */
export interface ProviderStatusReport {
  readonly capability: ProviderCapability;
  readonly providerName: string;
  readonly mode: "real" | "simulated";
  readonly state: ProviderState;
  readonly detail?: string;
  readonly checkedAt: string;
}

async function reportFor(
  capability: ProviderCapability,
  provider: { name: string; simulated: boolean; checkHealth(): Promise<HealthCheckResult> },
): Promise<ProviderStatusReport> {
  const checkedAt = new Date().toISOString();

  if (provider.simulated) {
    const health = await provider.checkHealth();
    return {
      capability,
      providerName: provider.name,
      mode: "simulated",
      state: "missing",
      detail: health.detail,
      checkedAt,
    };
  }

  try {
    const health = await provider.checkHealth();
    return {
      capability,
      providerName: provider.name,
      mode: "real",
      state: health.healthy ? "healthy" : "failing",
      detail: health.detail,
      checkedAt,
    };
  } catch (error) {
    return {
      capability,
      providerName: provider.name,
      mode: "real",
      state: "configured",
      detail:
        error instanceof Error
          ? `Health probe threw unexpectedly: ${error.message}`
          : "Health probe threw unexpectedly",
      checkedAt,
    };
  }
}

async function compositionReport(): Promise<ProviderStatusReport> {
  const checkedAt = new Date().toISOString();
  const binaries = await checkCompositionBinaries();
  const available = binaries.ffmpegAvailable && binaries.chromiumAvailable;

  return {
    capability: "composition",
    providerName: "remotion+ffmpeg",
    mode: available ? "real" : "simulated",
    state: available ? "healthy" : "missing",
    detail: [binaries.ffmpegDetail, binaries.chromiumDetail].filter(Boolean).join(" ") || undefined,
    checkedAt,
  };
}

/** Aggregates live status for every provider capability. Never returns a
 *  secret value — only configured/missing/healthy/failing plus a short,
 *  human-readable detail string. */
export async function getProviderStatusReport(): Promise<ProviderStatusReport[]> {
  return Promise.all([
    reportFor("ai", aiProvider),
    reportFor("video", videoProvider),
    reportFor("voice", voiceProvider),
    reportFor("music", musicProvider),
    reportFor("storage", storageProvider),
    reportFor("publishing", publishingProvider),
    compositionReport(),
  ]);
}

export function isRunningInSimulationMode(reports: ProviderStatusReport[]): boolean {
  return reports.some((report) => report.mode === "simulated");
}
