import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from "remotion";
import type { CompositionInput } from "@/src/composition/types";

export const FPS = 30;

export function totalFramesFor(input: CompositionInput): number {
  const totalSeconds = input.scenes.reduce(
    (sum, scene) => sum + scene.durationSeconds,
    0,
  );
  return Math.max(1, Math.round(totalSeconds * FPS));
}

/**
 * The canonical Atlas video composition: one <Sequence> per scene with its
 * background clip, narration, on-screen caption, and branding — plus a
 * global music bed and an unmissable "SIMULATION" watermark whenever any
 * input asset is a mock placeholder rather than real generated media.
 */
export function AtlasVideoComposition({
  title,
  brandName,
  scenes,
  musicUrl,
  simulated,
}: CompositionInput) {
  const { fps } = useVideoConfig();

  const sceneTimings: { scene: (typeof scenes)[number]; from: number; durationInFrames: number }[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    const durationInFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
    sceneTimings.push({ scene, from: cursor, durationInFrames });
    cursor += durationInFrames;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {musicUrl ? <Audio src={musicUrl} volume={0.2} /> : null}

      {sceneTimings.map(({ scene, from, durationInFrames }) => {
        return (
          <Sequence key={scene.order} from={from} durationInFrames={durationInFrames}>
            <AbsoluteFill>
              <OffthreadVideo src={scene.videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {scene.narrationUrl ? <Audio src={scene.narrationUrl} /> : null}
              <AbsoluteFill
                style={{
                  justifyContent: "flex-end",
                  alignItems: "center",
                  padding: 64,
                }}
              >
                <div
                  style={{
                    color: "#fff",
                    fontSize: 48,
                    fontWeight: 700,
                    textAlign: "center",
                    textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                    maxWidth: "90%",
                  }}
                >
                  {scene.captionText}
                </div>
              </AbsoluteFill>
            </AbsoluteFill>
          </Sequence>
        );
      })}

      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start", padding: 32 }}>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 28, fontWeight: 600 }}>
          {brandName}
        </div>
      </AbsoluteFill>

      {simulated ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              color: "rgba(255,60,60,0.85)",
              fontSize: 72,
              fontWeight: 900,
              transform: "rotate(-20deg)",
              border: "6px solid rgba(255,60,60,0.85)",
              padding: "16px 48px",
              borderRadius: 16,
            }}
          >
            SIMULATION
          </div>
        </AbsoluteFill>
      ) : null}

      <span style={{ display: "none" }}>{title}</span>
    </AbsoluteFill>
  );
}
