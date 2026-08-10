import { describe, expect, it } from "vitest";
import { checkCompositionBinaries } from "@/src/composition/binaries";
import { composeVideo } from "@/src/composition/render";
import type { CompositionInput } from "@/src/composition/types";

const baseInput: CompositionInput = {
  runId: "run-composition-test",
  title: "Test Video",
  brandName: "Atlas",
  scenes: [
    { order: 0, durationSeconds: 5, videoUrl: "file:///tmp/a.json", captionText: "Hello" },
    { order: 1, durationSeconds: 5, videoUrl: "file:///tmp/b.json", captionText: "World" },
  ],
  simulated: false,
};

describe("checkCompositionBinaries", () => {
  it("reports availability without throwing", async () => {
    const status = await checkCompositionBinaries();
    expect(typeof status.ffmpegAvailable).toBe("boolean");
    expect(typeof status.chromiumAvailable).toBe("boolean");
  });
});

describe("composeVideo", () => {
  it("uses the mock composer when the input is already simulated", async () => {
    const result = await composeVideo({ ...baseInput, simulated: true });
    expect(result.simulated).toBe(true);
    expect(result.durationSeconds).toBe(10);
    expect(result.note).toBeDefined();
  });

  it("falls back to the mock composer when composition binaries are unavailable", async () => {
    // This sandbox has no general ffmpeg/Chromium installed, so even a
    // "real" (simulated: false) input must safely degrade rather than
    // throw or hang trying to launch a renderer that isn't there.
    const binaries = await checkCompositionBinaries();
    const result = await composeVideo(baseInput);

    if (!binaries.ffmpegAvailable || !binaries.chromiumAvailable) {
      expect(result.simulated).toBe(true);
      expect(result.note).toMatch(/binaries unavailable/i);
    }
    expect(result.durationSeconds).toBe(10);
  });

  it("never claims simulated output is real", async () => {
    const result = await composeVideo({ ...baseInput, simulated: true });
    expect(result.simulated).toBe(true);
    // The mock composer's manifest is JSON, never a file claiming to be a
    // playable video.
    expect(result.outputPath).toMatch(/\.json$/);
  });
});
