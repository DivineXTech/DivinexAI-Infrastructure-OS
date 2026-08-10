import "server-only";
import path from "node:path";
import os from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getEnv } from "@/src/env";
import { checkCompositionBinaries } from "@/src/composition/binaries";
import { normalizeOutputAudio } from "@/src/composition/ffmpeg";
import { composeMock } from "@/src/composition/mock";
import { storageProvider } from "@/src/providers/storage";
import type { CompositionInput, CompositionResult } from "@/src/composition/types";

let cachedServeUrl: string | null = null;

async function getServeUrl(): Promise<string> {
  if (!cachedServeUrl) {
    const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
    cachedServeUrl = await bundle({ entryPoint });
  }
  return cachedServeUrl;
}

/**
 * Composes the final video for a run. Real Remotion + ffmpeg rendering is
 * only attempted when (a) every upstream asset is real, not a simulated
 * placeholder, and (b) both ffmpeg and a Chromium executable are actually
 * available in this environment. Otherwise this falls back to the mock
 * composer — a deliberate, clearly-labeled degradation, not a silent one.
 * A genuine render failure (binaries present, render throws) propagates so
 * the calling Inngest step retries/dead-letters it rather than masking the
 * failure as a "simulation."
 */
export async function composeVideo(input: CompositionInput): Promise<CompositionResult> {
  if (input.simulated) {
    return composeMock(
      input,
      "One or more upstream assets (video/narration/music) are simulated placeholders.",
    );
  }

  const binaries = await checkCompositionBinaries();
  if (!binaries.ffmpegAvailable || !binaries.chromiumAvailable) {
    const reasons = [binaries.ffmpegDetail, binaries.chromiumDetail]
      .filter(Boolean)
      .join(" ");
    return composeMock(input, `Composition binaries unavailable in this environment: ${reasons}`);
  }

  const env = getEnv();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "atlas-render-"));
  const rawOutput = path.join(tmpDir, "raw.mp4");
  const finalOutput = path.join(tmpDir, "final.mp4");

  try {
    const serveUrl = await getServeUrl();
    const inputProps = input as unknown as Record<string, unknown>;

    const composition = await selectComposition({
      serveUrl,
      id: "AtlasVideo",
      inputProps,
      browserExecutable: env.REMOTION_CHROMIUM_EXECUTABLE ?? null,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: rawOutput,
      inputProps,
      browserExecutable: env.REMOTION_CHROMIUM_EXECUTABLE ?? null,
    });

    await normalizeOutputAudio(rawOutput, finalOutput);

    const data = await readFile(finalOutput);
    const { url, path: storagePath } = await storageProvider.upload({
      path: `final/${input.runId}/final.mp4`,
      data: new Uint8Array(data),
      contentType: "video/mp4",
    });

    return {
      outputPath: storagePath,
      url,
      simulated: false,
      costUsd: 0,
      durationSeconds: composition.durationInFrames / composition.fps,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
