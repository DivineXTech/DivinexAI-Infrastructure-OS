import React from "react";
import { Composition, type AnyZodObject } from "remotion";
import { AtlasVideoComposition, FPS, totalFramesFor } from "./AtlasVideoComposition";
import type { CompositionInput } from "@/src/composition/types";

/** Remotion's <Composition> requires its Props generic to structurally
 *  satisfy Record<string, unknown> (an explicit index signature), which a
 *  plain readonly interface doesn't declare even though it's assignable in
 *  practice. This intersection satisfies the constraint without loosening
 *  CompositionInput itself anywhere else in the codebase. */
type AtlasCompositionProps = CompositionInput & Record<string, unknown>;

const defaultAtlasVideoProps: AtlasCompositionProps = {
  runId: "preview",
  title: "Atlas Video Factory — Preview",
  brandName: "Atlas",
  scenes: [],
  simulated: true,
};

export function RemotionRoot() {
  return (
    <Composition<AnyZodObject, AtlasCompositionProps>
      id="AtlasVideo"
      component={AtlasVideoComposition}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS}
      defaultProps={defaultAtlasVideoProps}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: totalFramesFor(props),
      })}
    />
  );
}
