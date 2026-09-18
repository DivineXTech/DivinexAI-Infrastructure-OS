import { describe, expect, it } from "vitest";

import {
  createEmptyProjectState,
  parseProjectState,
  serializeProjectState,
} from "@/lib/design-studio/project-schema";

describe("project state serialization", () => {
  it("round-trips an empty state through serialize/parse", () => {
    const state = createEmptyProjectState();
    const parsed = parseProjectState(JSON.parse(serializeProjectState(state)));
    expect(parsed).toEqual(state);
  });

  it("round-trips a state with a text element", () => {
    const state = {
      garmentTemplateId: "t1",
      garmentColorId: "c1",
      activeView: "front" as const,
      elements: [
        {
          id: "el-1",
          elementType: "text" as const,
          zIndex: 1,
          locked: false,
          hidden: false,
          textContent: "Hi",
          fontKey: "sans",
          fontSize: 24,
          textColor: "#111111",
          textAlign: "center" as const,
          designAssetId: null,
          placement: { printZoneId: null, garmentView: "front" as const, x: 10, y: 10, width: 30, height: 20, rotation: 0 },
        },
      ],
    };
    const roundTripped = parseProjectState(JSON.parse(serializeProjectState(state)));
    expect(roundTripped).toEqual(state);
  });

  it("rejects a state missing required fields rather than silently coercing it", () => {
    expect(() => parseProjectState({ garmentTemplateId: null })).toThrow();
  });

  it("rejects an element with an invalid elementType", () => {
    expect(() =>
      parseProjectState({
        garmentTemplateId: null,
        garmentColorId: null,
        activeView: "front",
        elements: [{ id: "x", elementType: "video", zIndex: 0, placement: { garmentView: "front", x: 0, y: 0, width: 1, height: 1 } }],
      }),
    ).toThrow();
  });

  it("rejects an invalid garment view", () => {
    expect(() =>
      parseProjectState({ garmentTemplateId: null, garmentColorId: null, activeView: "top-down", elements: [] }),
    ).toThrow();
  });
});
