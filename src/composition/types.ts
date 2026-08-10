/** Input contract for the Atlas video composition — both the Remotion
 *  React composition (remotion/AtlasVideoComposition.tsx) and the mock
 *  composer (src/composition/mock.ts) render from this same shape. */
export interface CompositionScene {
  readonly order: number;
  readonly durationSeconds: number;
  readonly videoUrl: string;
  readonly narrationUrl?: string;
  readonly captionText: string;
}

export interface CompositionInput {
  readonly runId: string;
  readonly title: string;
  readonly brandName: string;
  readonly scenes: readonly CompositionScene[];
  readonly musicUrl?: string;
  /** True if any upstream asset (video/narration/music) is a simulated
   *  placeholder rather than real media — drives the on-screen "SIMULATION"
   *  watermark so composed output is never mistaken for a real render. */
  readonly simulated: boolean;
}

export interface CompositionResult {
  readonly outputPath: string;
  readonly url?: string;
  readonly simulated: boolean;
  readonly costUsd: number;
  readonly durationSeconds: number;
  readonly note?: string;
}
