import "server-only";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { getEnv } from "@/src/env";

/** Resolves whether a real composition render is possible in this
 *  environment. Deliberately conservative: if either binary can't be
 *  confirmed, real rendering is skipped in favor of the mock composer
 *  rather than attempting a render that's likely to hang or crash. */
export interface CompositionBinaryStatus {
  readonly ffmpegAvailable: boolean;
  readonly ffmpegDetail?: string;
  readonly chromiumAvailable: boolean;
  readonly chromiumDetail?: string;
}

function runVersionCheck(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    try {
      const child = spawn(command, args, { stdio: "ignore" });
      const timeout = setTimeout(() => {
        child.kill();
        finish(false);
      }, 5_000);

      child.on("error", () => {
        clearTimeout(timeout);
        finish(false);
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        finish(code === 0);
      });
    } catch {
      finish(false);
    }
  });
}

export async function checkCompositionBinaries(): Promise<CompositionBinaryStatus> {
  const env = getEnv();

  const ffmpegAvailable = await runVersionCheck(env.FFMPEG_PATH, ["-version"]);

  let chromiumAvailable = false;
  let chromiumDetail: string | undefined;
  if (env.REMOTION_CHROMIUM_EXECUTABLE) {
    try {
      await access(env.REMOTION_CHROMIUM_EXECUTABLE);
      chromiumAvailable = true;
    } catch {
      chromiumDetail = `REMOTION_CHROMIUM_EXECUTABLE is set but not accessible at "${env.REMOTION_CHROMIUM_EXECUTABLE}"`;
    }
  } else {
    chromiumDetail =
      "REMOTION_CHROMIUM_EXECUTABLE is not set; without a pre-installed Chromium, " +
      "Remotion would need network access to download its own — not attempted automatically.";
  }

  return {
    ffmpegAvailable,
    ffmpegDetail: ffmpegAvailable
      ? undefined
      : `Could not execute "${env.FFMPEG_PATH} -version" — is ffmpeg installed and on PATH?`,
    chromiumAvailable,
    chromiumDetail,
  };
}
