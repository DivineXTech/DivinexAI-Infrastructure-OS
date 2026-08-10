import "server-only";
import { spawn } from "node:child_process";
import { getEnv } from "@/src/env";

/** Runs the configured ffmpeg binary with the given args, rejecting on a
 *  non-zero exit code with stderr attached for diagnostics. */
export function runFfmpeg(args: string[]): Promise<void> {
  const env = getEnv();
  return new Promise((resolve, reject) => {
    const child = spawn(env.FFMPEG_PATH, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

/**
 * Final loudness-normalization pass (EBU R128 via ffmpeg's loudnorm filter)
 * run on the Remotion-rendered output before it's treated as publishable.
 * This is the one step in the pipeline that genuinely needs a system
 * ffmpeg binary rather than Remotion's own compositor.
 */
export async function normalizeOutputAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:v",
    "copy",
    outputPath,
  ]);
}
