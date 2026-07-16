import { describe, expect, it } from "vitest";

import {
  applyDesignAction,
  canRedo,
  canUndo,
  dispatchDesignAction,
  initHistory,
  MAX_HISTORY_DEPTH,
  redo,
  undo,
} from "@/lib/design-studio/history-reducer";
import { createEmptyProjectState, type DesignElement } from "@/lib/design-studio/project-schema";

function textElement(id: string, overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id,
    elementType: "text",
    zIndex: 1,
    locked: false,
    hidden: false,
    textContent: "Hello",
    fontKey: "sans",
    fontSize: 24,
    textColor: "#000000",
    textAlign: "center",
    designAssetId: null,
    placement: { printZoneId: null, garmentView: "front", x: 10, y: 10, width: 20, height: 10, rotation: 0 },
    ...overrides,
  };
}

describe("applyDesignAction", () => {
  it("add_element appends without mutating the input state", () => {
    const state = createEmptyProjectState();
    const next = applyDesignAction(state, { type: "add_element", element: textElement("a") });
    expect(state.elements).toHaveLength(0);
    expect(next.elements).toHaveLength(1);
  });

  it("update_element patches only the targeted element", () => {
    const state = { ...createEmptyProjectState(), elements: [textElement("a"), textElement("b")] };
    const next = applyDesignAction(state, { type: "update_element", id: "a", patch: { textContent: "Changed" } });
    expect(next.elements.find((e) => e.id === "a")?.textContent).toBe("Changed");
    expect(next.elements.find((e) => e.id === "b")?.textContent).toBe("Hello");
  });

  it("update_placement patches only the placement fields given", () => {
    const state = { ...createEmptyProjectState(), elements: [textElement("a")] };
    const next = applyDesignAction(state, { type: "update_placement", id: "a", patch: { x: 50 } });
    const placement = next.elements[0].placement;
    expect(placement.x).toBe(50);
    expect(placement.y).toBe(10);
  });

  it("remove_element removes exactly the targeted element", () => {
    const state = { ...createEmptyProjectState(), elements: [textElement("a"), textElement("b")] };
    const next = applyDesignAction(state, { type: "remove_element", id: "a" });
    expect(next.elements.map((e) => e.id)).toEqual(["b"]);
  });

  it("duplicate_element copies content and assigns a new id with a higher z-index", () => {
    const state = { ...createEmptyProjectState(), elements: [textElement("a", { zIndex: 3 })] };
    const next = applyDesignAction(state, { type: "duplicate_element", id: "a", newId: "a-copy" });
    expect(next.elements).toHaveLength(2);
    const copy = next.elements.find((e) => e.id === "a-copy");
    expect(copy?.textContent).toBe("Hello");
    expect(copy?.zIndex).toBe(4);
  });

  it("duplicate_element is a no-op when the source id doesn't exist", () => {
    const state = { ...createEmptyProjectState(), elements: [textElement("a")] };
    const next = applyDesignAction(state, { type: "duplicate_element", id: "missing", newId: "new" });
    expect(next.elements).toHaveLength(1);
  });

  it("reorder_element updates z-index only", () => {
    const state = { ...createEmptyProjectState(), elements: [textElement("a", { zIndex: 1 })] };
    const next = applyDesignAction(state, { type: "reorder_element", id: "a", zIndex: 9 });
    expect(next.elements[0].zIndex).toBe(9);
  });

  it("set_garment and set_view update top-level state", () => {
    const state = createEmptyProjectState();
    const next = applyDesignAction(state, { type: "set_garment", garmentTemplateId: "t1", garmentColorId: "c1" });
    expect(next.garmentTemplateId).toBe("t1");
    expect(next.garmentColorId).toBe("c1");
    const nextView = applyDesignAction(next, { type: "set_view", view: "back" });
    expect(nextView.activeView).toBe("back");
  });

  it("replace_state swaps in an entirely new state (used for version restore)", () => {
    const state = createEmptyProjectState();
    const replacement = { ...createEmptyProjectState(), activeView: "left" as const };
    const next = applyDesignAction(state, { type: "replace_state", state: replacement });
    expect(next.activeView).toBe("left");
  });
});

describe("undo/redo history", () => {
  it("undo reverts the last dispatched action, redo reapplies it", () => {
    let history = initHistory(createEmptyProjectState());
    history = dispatchDesignAction(history, { type: "set_view", view: "back" });
    expect(history.present.activeView).toBe("back");

    history = undo(history);
    expect(history.present.activeView).toBe("front");
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(true);

    history = redo(history);
    expect(history.present.activeView).toBe("back");
    expect(canRedo(history)).toBe(false);
  });

  it("dispatching a new action after undo clears the redo stack", () => {
    let history = initHistory(createEmptyProjectState());
    history = dispatchDesignAction(history, { type: "set_view", view: "back" });
    history = undo(history);
    history = dispatchDesignAction(history, { type: "set_view", view: "left" });
    expect(canRedo(history)).toBe(false);
    expect(history.present.activeView).toBe("left");
  });

  it("undo/redo on an empty history is a safe no-op", () => {
    const history = initHistory(createEmptyProjectState());
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it("bounds history depth — the past stack never exceeds MAX_HISTORY_DEPTH", () => {
    let history = initHistory(createEmptyProjectState());
    for (let i = 0; i < MAX_HISTORY_DEPTH + 20; i++) {
      history = dispatchDesignAction(history, { type: "set_view", view: i % 2 === 0 ? "back" : "front" });
    }
    expect(history.past.length).toBeLessThanOrEqual(MAX_HISTORY_DEPTH);
  });

  it("is deterministic — replaying the same action sequence from the same start yields the same present state", () => {
    const actions = [
      { type: "add_element" as const, element: textElement("a") },
      { type: "update_element" as const, id: "a", patch: { textContent: "Hi" } },
      { type: "reorder_element" as const, id: "a", zIndex: 5 },
    ];
    let h1 = initHistory(createEmptyProjectState());
    let h2 = initHistory(createEmptyProjectState());
    for (const action of actions) {
      h1 = dispatchDesignAction(h1, action);
      h2 = dispatchDesignAction(h2, action);
    }
    expect(h1.present).toEqual(h2.present);
  });
});
