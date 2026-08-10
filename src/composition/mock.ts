import "server-only";
import { uploadSimulatedPlaceholder } from "@/src/providers/storage";
import type { CompositionInput, CompositionResult } from "@/src/composition/types";

/**
 * Mock composer. Used whenever real rendering isn't possible or isn't
 * meaningful: upstream assets are already simulated placeholders, or the
 * ffmpeg/Chromium binaries a real Remotion render needs aren't available in
 * this environment. Produces a JSON manifest describing what WOULD have
 * been rendered — never a fake video file — so it can't be mistaken for
 * real output.
 */
export async function composeMock(
  input: CompositionInput,
  reason: string,
): Promise<CompositionResult> {
  const durationSeconds = input.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);

  const { url, path } = await uploadSimulatedPlaceholder({
    path: `final/${input.runId}/composition`,
    payload: {
      provider: "mock-composer",
      reason,
      title: input.title,
      brandName: input.brandName,
      durationSeconds,
      scenes: input.scenes,
      musicUrl: input.musicUrl,
      note:
        "Placeholder — no real video was rendered. This manifest describes " +
        "the timeline that would be composed with Remotion + ffmpeg once " +
        "real scene/narration/music assets and composition binaries are available.",
    },
  });

  return {
    outputPath: path,
    url,
    simulated: true,
    costUsd: 0,
    durationSeconds,
    note: reason,
  };
}
