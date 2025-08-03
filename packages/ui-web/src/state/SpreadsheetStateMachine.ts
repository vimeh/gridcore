import type { CellAddress } from "@gridcore/core";

// Core types for interaction modes
export type InteractionMode = "normal" | "keyboard-only";

// Make invalid states unrepresentable through discriminated unions
export type SpreadsheetState = NavigationState | EditingState;

export type NavigationState = {
  type: "navigation";
  interactionMode: InteractionMode;
};

export type EditingState = {
  type: "editing";
  substate: EditingSubstate;
  interactionMode: InteractionMode;
};

export type EditingSubstate =
  | { type: "normal" }
  | { type: "insert"; mode: InsertMode }
  | { type: "visual"; mode: VisualMode; anchor?: CellAddress }
  | { type: "resize"; target: ResizeTarget };

export type InsertMode = "insert" | "append" | "replace";
export type VisualMode = "character" | "line" | "block";
export type ResizeTarget = { type: "column" | "row"; index: number };

// Action types for state transitions
export type Action =
  | { type: "START_EDITING"; editMode?: InsertMode }
  | { type: "STOP_EDITING" }
  | { type: "ENTER_INSERT_MODE"; mode?: InsertMode }
  | { type: "EXIT_INSERT_MODE" }
  | { type: "ENTER_VISUAL_MODE"; visualType: VisualMode; anchor?: CellAddress }
  | { type: "EXIT_VISUAL_MODE" }
  | { type: "ENTER_VISUAL_BLOCK_MODE"; anchor?: CellAddress }
  | { type: "ENTER_RESIZE_MODE"; target: ResizeTarget }
  | { type: "EXIT_RESIZE_MODE" }
  | { type: "TOGGLE_INTERACTION_MODE" }
  | { type: "SET_INTERACTION_MODE"; mode: InteractionMode }
  | { type: "SET_EDIT_MODE"; mode: InsertMode }
  | { type: "ESCAPE" };

// Result type for safe error handling
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Transition handler type
type TransitionHandler<S extends SpreadsheetState = SpreadsheetState> = (
  state: S,
  action: Action,
) => Result<SpreadsheetState>;

// Declarative transition map
export const transitions: Record<string, TransitionHandler> = {
  // Navigation state transitions
  "navigation.START_EDITING": (state: SpreadsheetState, action: Action) => {
    if (state.type !== "navigation")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "START_EDITING")
      return { ok: false, error: "Invalid action" };

    const newState: EditingState = {
      type: "editing",
      substate: action.editMode
        ? { type: "insert", mode: action.editMode }
        : { type: "normal" },
      interactionMode: state.interactionMode,
    };
    return { ok: true, value: newState };
  },

  "navigation.TOGGLE_INTERACTION_MODE": (state: SpreadsheetState) => {
    if (state.type !== "navigation")
      return { ok: false, error: "Invalid state type" };

    return {
      ok: true,
      value: {
        ...state,
        interactionMode:
          state.interactionMode === "normal" ? "keyboard-only" : "normal",
      },
    };
  },

  "navigation.SET_INTERACTION_MODE": (
    state: SpreadsheetState,
    action: Action,
  ) => {
    if (state.type !== "navigation")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "SET_INTERACTION_MODE")
      return { ok: false, error: "Invalid action" };
    return { ok: true, value: { ...state, interactionMode: action.mode } };
  },

  // Editing state transitions
  "editing.STOP_EDITING": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };

    return {
      ok: true,
      value: {
        type: "navigation",
        interactionMode: state.interactionMode,
      } as NavigationState,
    };
  },

  "editing.ESCAPE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };

    return {
      ok: true,
      value: {
        type: "navigation",
        interactionMode: state.interactionMode,
      } as NavigationState,
    };
  },

  "editing.TOGGLE_INTERACTION_MODE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };

    return {
      ok: true,
      value: {
        ...state,
        interactionMode:
          state.interactionMode === "normal" ? "keyboard-only" : "normal",
      },
    };
  },

  "editing.SET_INTERACTION_MODE": (state: SpreadsheetState, action: Action) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "SET_INTERACTION_MODE")
      return { ok: false, error: "Invalid action" };
    return { ok: true, value: { ...state, interactionMode: action.mode } };
  },

  // Normal editing substate transitions
  "editing.normal.ENTER_INSERT_MODE": (
    state: SpreadsheetState,
    action: Action,
  ) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "ENTER_INSERT_MODE")
      return { ok: false, error: "Invalid action" };
    if (state.substate.type !== "normal")
      return { ok: false, error: "Not in normal mode" };

    return {
      ok: true,
      value: {
        ...state,
        substate: { type: "insert", mode: action.mode || "insert" },
      },
    };
  },

  "editing.normal.ESCAPE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "normal")
      return { ok: false, error: "Not in normal mode" };
    // Escape in normal mode exits to navigation
    return {
      ok: true,
      value: {
        type: "navigation",
        interactionMode: state.interactionMode,
      } as NavigationState,
    };
  },

  "editing.normal.ENTER_VISUAL_MODE": (
    state: SpreadsheetState,
    action: Action,
  ) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "ENTER_VISUAL_MODE")
      return { ok: false, error: "Invalid action" };
    if (state.substate.type !== "normal")
      return { ok: false, error: "Not in normal mode" };

    return {
      ok: true,
      value: {
        ...state,
        substate: {
          type: "visual",
          mode: action.visualType,
          anchor: action.anchor,
        },
      },
    };
  },

  "editing.normal.ENTER_VISUAL_BLOCK_MODE": (
    state: SpreadsheetState,
    action: Action,
  ) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "ENTER_VISUAL_BLOCK_MODE")
      return { ok: false, error: "Invalid action" };
    if (state.substate.type !== "normal")
      return { ok: false, error: "Not in normal mode" };

    return {
      ok: true,
      value: {
        ...state,
        substate: { type: "visual", mode: "block", anchor: action.anchor },
      },
    };
  },

  "editing.normal.ENTER_RESIZE_MODE": (
    state: SpreadsheetState,
    action: Action,
  ) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "ENTER_RESIZE_MODE")
      return { ok: false, error: "Invalid action" };
    if (state.substate.type !== "normal")
      return { ok: false, error: "Not in normal mode" };

    return {
      ok: true,
      value: { ...state, substate: { type: "resize", target: action.target } },
    };
  },

  // Insert mode transitions
  "editing.insert.EXIT_INSERT_MODE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "insert")
      return { ok: false, error: "Not in insert mode" };
    return { ok: true, value: { ...state, substate: { type: "normal" } } };
  },

  "editing.insert.ESCAPE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "insert")
      return { ok: false, error: "Not in insert mode" };
    return { ok: true, value: { ...state, substate: { type: "normal" } } };
  },

  "editing.insert.SET_EDIT_MODE": (state: SpreadsheetState, action: Action) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (action.type !== "SET_EDIT_MODE")
      return { ok: false, error: "Invalid action" };
    if (state.substate.type !== "insert")
      return { ok: false, error: "Not in insert mode" };

    return {
      ok: true,
      value: { ...state, substate: { type: "insert", mode: action.mode } },
    };
  },

  // Visual mode transitions
  "editing.visual.EXIT_VISUAL_MODE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "visual")
      return { ok: false, error: "Not in visual mode" };
    return { ok: true, value: { ...state, substate: { type: "normal" } } };
  },

  "editing.visual.ESCAPE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "visual")
      return { ok: false, error: "Not in visual mode" };
    return { ok: true, value: { ...state, substate: { type: "normal" } } };
  },

  "editing.visual.ENTER_INSERT_MODE": (
    state: SpreadsheetState,
    action: Action,
  ) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "visual")
      return { ok: false, error: "Not in visual mode" };
    if (action.type !== "ENTER_INSERT_MODE")
      return { ok: false, error: "Invalid action" };

    return {
      ok: true,
      value: {
        ...state,
        substate: { type: "insert", mode: action.mode || "insert" },
      },
    };
  },

  // Resize mode transitions
  "editing.resize.EXIT_RESIZE_MODE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "resize")
      return { ok: false, error: "Not in resize mode" };
    return { ok: true, value: { ...state, substate: { type: "normal" } } };
  },

  "editing.resize.ESCAPE": (state: SpreadsheetState) => {
    if (state.type !== "editing")
      return { ok: false, error: "Invalid state type" };
    if (state.substate.type !== "resize")
      return { ok: false, error: "Not in resize mode" };
    return { ok: true, value: { ...state, substate: { type: "normal" } } };
  },
};

// Helper function to get transition key
function getTransitionKey(state: SpreadsheetState, action: Action): string {
  if (state.type === "navigation") {
    return `navigation.${action.type}`;
  }

  const substate = state.substate.type;
  return `editing.${substate}.${action.type}`;
}

// Main state machine class
export class SpreadsheetStateMachine {
  private state: SpreadsheetState;
  private listeners: Array<(state: SpreadsheetState) => void> = [];

  constructor(initialState?: SpreadsheetState) {
    this.state = initialState || {
      type: "navigation",
      interactionMode: "normal",
    };
  }

  getState(): SpreadsheetState {
    return this.state;
  }

  transition(action: Action): Result<SpreadsheetState> {
    const key = getTransitionKey(this.state, action);
    const handler = transitions[key];

    if (!handler) {
      // Check for editing-level transitions
      if (this.state.type === "editing") {
        const editingKey = `editing.${action.type}`;
        const editingHandler = transitions[editingKey];
        if (editingHandler) {
          return this.applyTransition(editingHandler, action);
        }
      }
      return { ok: false, error: `Invalid transition: ${key}` };
    }

    return this.applyTransition(handler, action);
  }

  private applyTransition(
    handler: TransitionHandler,
    action: Action,
  ): Result<SpreadsheetState> {
    const result = handler(this.state, action);
    if (result.ok) {
      this.state = result.value;
      this.notifyListeners();
    }
    return result;
  }

  subscribe(listener: (state: SpreadsheetState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // Helper methods for common transitions
  startEditing(editMode?: InsertMode): Result<SpreadsheetState> {
    return this.transition({ type: "START_EDITING", editMode });
  }

  stopEditing(): Result<SpreadsheetState> {
    return this.transition({ type: "STOP_EDITING" });
  }

  enterInsertMode(mode?: InsertMode): Result<SpreadsheetState> {
    return this.transition({ type: "ENTER_INSERT_MODE", mode });
  }

  exitInsertMode(): Result<SpreadsheetState> {
    return this.transition({ type: "EXIT_INSERT_MODE" });
  }

  enterVisualMode(
    visualType: VisualMode,
    anchor?: CellAddress,
  ): Result<SpreadsheetState> {
    return this.transition({ type: "ENTER_VISUAL_MODE", visualType, anchor });
  }

  exitVisualMode(): Result<SpreadsheetState> {
    return this.transition({ type: "EXIT_VISUAL_MODE" });
  }

  enterResizeMode(target: ResizeTarget): Result<SpreadsheetState> {
    return this.transition({ type: "ENTER_RESIZE_MODE", target });
  }

  exitResizeMode(): Result<SpreadsheetState> {
    return this.transition({ type: "EXIT_RESIZE_MODE" });
  }

  toggleInteractionMode(): Result<SpreadsheetState> {
    return this.transition({ type: "TOGGLE_INTERACTION_MODE" });
  }

  setInteractionMode(mode: InteractionMode): Result<SpreadsheetState> {
    return this.transition({ type: "SET_INTERACTION_MODE", mode });
  }

  escape(): Result<SpreadsheetState> {
    return this.transition({ type: "ESCAPE" });
  }

  // Helper query methods
  isNavigating(): boolean {
    return this.state.type === "navigation";
  }

  isEditing(): boolean {
    return this.state.type === "editing";
  }

  isInNormalMode(): boolean {
    return (
      this.state.type === "editing" && this.state.substate.type === "normal"
    );
  }

  isInInsertMode(): boolean {
    return (
      this.state.type === "editing" && this.state.substate.type === "insert"
    );
  }

  isInVisualMode(): boolean {
    return (
      this.state.type === "editing" && this.state.substate.type === "visual"
    );
  }

  isInResizeMode(): boolean {
    return (
      this.state.type === "editing" && this.state.substate.type === "resize"
    );
  }

  getInteractionMode(): InteractionMode {
    return this.state.interactionMode;
  }

  getInsertMode(): InsertMode | undefined {
    if (
      this.state.type === "editing" &&
      this.state.substate.type === "insert"
    ) {
      return this.state.substate.mode;
    }
    return undefined;
  }

  getVisualMode(): VisualMode | undefined {
    if (
      this.state.type === "editing" &&
      this.state.substate.type === "visual"
    ) {
      return this.state.substate.mode;
    }
    return undefined;
  }

  getModeString(): string {
    if (this.state.type === "navigation") {
      return "navigation";
    }

    switch (this.state.substate.type) {
      case "normal":
        return "normal";
      case "insert":
        return `insert:${this.state.substate.mode}`;
      case "visual":
        return `visual:${this.state.substate.mode}`;
      case "resize":
        return "resize";
    }
  }
}
