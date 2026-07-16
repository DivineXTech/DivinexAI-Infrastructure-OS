/**
 * Pure undo/redo reducer over the normalized DesignProjectState
 * (lib/design-studio/project-schema.ts). No I/O, no canvas-library
 * objects — every action is a plain data transform, so the whole history
 * stack is trivially serializable and testable. History depth is bounded
 * (`MAX_HISTORY_DEPTH`) per section 22's "bounded project history
 * retrieval" — old entries are dropped rather than growing the stack
 * forever in a long editing session.
 */
import type { DesignElement, DesignProjectState, GarmentView, Placement } from "./project-schema";

export const MAX_HISTORY_DEPTH = 50;

export type DesignAction =
  | { type: "set_garment"; garmentTemplateId: string | null; garmentColorId: string | null }
  | { type: "set_view"; view: GarmentView }
  | { type: "add_element"; element: DesignElement }
  | { type: "update_element"; id: string; patch: Partial<Omit<DesignElement, "id" | "placement">> }
  | { type: "update_placement"; id: string; patch: Partial<Placement> }
  | { type: "remove_element"; id: string }
  | { type: "duplicate_element"; id: string; newId: string }
  | { type: "reorder_element"; id: string; zIndex: number }
  | { type: "replace_state"; state: DesignProjectState };

/** Applies one action to produce the next state. Never mutates the input. */
export function applyDesignAction(state: DesignProjectState, action: DesignAction): DesignProjectState {
  switch (action.type) {
    case "set_garment":
      return { ...state, garmentTemplateId: action.garmentTemplateId, garmentColorId: action.garmentColorId };
    case "set_view":
      return { ...state, activeView: action.view };
    case "add_element":
      return { ...state, elements: [...state.elements, action.element] };
    case "update_element":
      return {
        ...state,
        elements: state.elements.map((el) => (el.id === action.id ? { ...el, ...action.patch } : el)),
      };
    case "update_placement":
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, placement: { ...el.placement, ...action.patch } } : el,
        ),
      };
    case "remove_element":
      return { ...state, elements: state.elements.filter((el) => el.id !== action.id) };
    case "duplicate_element": {
      const source = state.elements.find((el) => el.id === action.id);
      if (!source) return state;
      const maxZ = Math.max(0, ...state.elements.map((el) => el.zIndex));
      const copy: DesignElement = { ...source, id: action.newId, zIndex: maxZ + 1 };
      return { ...state, elements: [...state.elements, copy] };
    }
    case "reorder_element":
      return {
        ...state,
        elements: state.elements.map((el) => (el.id === action.id ? { ...el, zIndex: action.zIndex } : el)),
      };
    case "replace_state":
      return action.state;
  }
}

export type HistoryState = {
  past: DesignProjectState[];
  present: DesignProjectState;
  future: DesignProjectState[];
};

export function initHistory(state: DesignProjectState): HistoryState {
  return { past: [], present: state, future: [] };
}

/** Dispatching any new action always clears redo history — the same
 * convention every undo/redo implementation follows (a fresh branch of
 * edits invalidates the old "future"). */
export function dispatchDesignAction(history: HistoryState, action: DesignAction): HistoryState {
  const nextPresent = applyDesignAction(history.present, action);
  const nextPast = [...history.past, history.present].slice(-MAX_HISTORY_DEPTH);
  return { past: nextPast, present: nextPresent, future: [] };
}

export function undo(history: HistoryState): HistoryState {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: HistoryState): HistoryState {
  if (history.future.length === 0) return history;
  const [next, ...restFuture] = history.future;
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY_DEPTH),
    present: next,
    future: restFuture,
  };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}
