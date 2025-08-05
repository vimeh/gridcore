import { CellAddress } from "@gridcore/core";
import type { Result } from "../utils/Result";
import { err, ok } from "../utils/Result";
import {
  type CellMode,
  createCommandState,
  createEditingState,
  createNavigationState,
  createResizeState,
  createSpreadsheetVisualState,
  type InsertMode,
  isCommandMode,
  isEditingMode,
  isNavigationMode,
  isResizeMode,
  isSpreadsheetVisualMode,
  type Selection,
  type SpreadsheetVisualMode,
  type UIState,
  type VisualMode,
} from "./UIState";

// Action types for state transitions
export type Action =
  | {
      type: "START_EDITING";
      editMode?: InsertMode;
      initialValue?: string;
      cursorPosition?: number;
    }
  | { type: "EXIT_TO_NAVIGATION" }
  | { type: "ENTER_INSERT_MODE"; mode?: InsertMode }
  | { type: "EXIT_INSERT_MODE" }
  | { type: "ENTER_VISUAL_MODE"; visualType: VisualMode; anchor?: number }
  | { type: "EXIT_VISUAL_MODE" }
  | {
      type: "ENTER_SPREADSHEET_VISUAL_MODE";
      visualMode: SpreadsheetVisualMode;
      selection: Selection;
    }
  | { type: "EXIT_SPREADSHEET_VISUAL_MODE" }
  | { type: "UPDATE_SELECTION"; selection: Selection }
  | { type: "ENTER_COMMAND_MODE" }
  | { type: "EXIT_COMMAND_MODE" }
  | {
      type: "ENTER_RESIZE_MODE";
      target: "column" | "row";
      index: number;
      size: number;
    }
  | { type: "EXIT_RESIZE_MODE" }
  | { type: "UPDATE_EDITING_VALUE"; value: string; cursorPosition: number }
  | { type: "UPDATE_COMMAND_VALUE"; value: string }
  | { type: "UPDATE_RESIZE_SIZE"; size: number }
  | { type: "UPDATE_CURSOR"; cursor: CellAddress }
  | { type: "UPDATE_VIEWPORT"; viewport: UIState["viewport"] }
  | { type: "ESCAPE" };

// Transition handler type
type TransitionHandler = (state: UIState, action: Action) => Result<UIState>;

export class UIStateMachine {
  private state: UIState;
  private transitions: Map<string, TransitionHandler>;
  private listeners: Array<(state: UIState, action: Action) => void> = [];
  private history: Array<{
    state: UIState;
    action: Action;
    timestamp: number;
  }> = [];
  private maxHistorySize = 100;

  constructor(initialState?: UIState) {
    const defaultCursor = CellAddress.create(0, 0);
    if (!defaultCursor.ok) throw new Error("Failed to create default cursor");
    this.state =
      initialState ||
      createNavigationState(defaultCursor.value, {
        startRow: 0,
        startCol: 0,
        rows: 20,
        cols: 10,
      });

    // Define valid transitions using the nested state types
    this.transitions = new Map<string, TransitionHandler>([
      ["navigation.START_EDITING", this.startEditing.bind(this)],
      ["navigation.ENTER_COMMAND_MODE", this.enterCommandMode.bind(this)],
      ["navigation.ENTER_RESIZE_MODE", this.enterResizeMode.bind(this)],
      ["navigation.ENTER_SPREADSHEET_VISUAL_MODE", this.handleEnterSpreadsheetVisualMode.bind(this)],
      ["visual.EXIT_SPREADSHEET_VISUAL_MODE", this.handleExitSpreadsheetVisualMode.bind(this)],
      ["visual.UPDATE_SELECTION", this.updateSelection.bind(this)],
      ["editing.EXIT_TO_NAVIGATION", this.exitToNavigation.bind(this)],
      ["editing.normal.ENTER_INSERT_MODE", this.enterInsertMode.bind(this)],
      ["editing.insert.EXIT_INSERT_MODE", this.exitInsertMode.bind(this)],
      ["editing.normal.ENTER_VISUAL_MODE", this.enterVisualMode.bind(this)],
      ["editing.visual.EXIT_VISUAL_MODE", this.exitVisualMode.bind(this)],
      ["editing.UPDATE_EDITING_VALUE", this.updateEditingValue.bind(this)],
      ["command.EXIT_COMMAND_MODE", this.exitCommandMode.bind(this)],
      ["command.UPDATE_COMMAND_VALUE", this.updateCommandValue.bind(this)],
      ["resize.EXIT_RESIZE_MODE", this.exitResizeMode.bind(this)],
      ["resize.UPDATE_RESIZE_SIZE", this.updateResizeSize.bind(this)],
      ["*.UPDATE_CURSOR", this.updateCursor.bind(this)],
      ["*.UPDATE_VIEWPORT", this.updateViewport.bind(this)],
      ["*.ESCAPE", this.handleEscape.bind(this)],
    ]);
  }

  transition(action: Action): Result<UIState> {
    const key = this.getTransitionKey(this.state, action);
    let handler = this.transitions.get(key);

    // Try without substate for editing mode
    if (!handler && isEditingMode(this.state)) {
      handler = this.transitions.get(`editing.${action.type}`);
    }

    // Try universal handler
    if (!handler) {
      handler = this.transitions.get(`*.${action.type}`);
    }

    if (!handler) {
      return err(`Invalid transition: ${key}`);
    }

    const result = handler(this.state, action);
    if (result.ok) {
      this.addToHistory(this.state, action);
      this.state = result.value;
      this.notifyListeners(action);
    }

    return result;
  }

  // Helper methods for common transitions
  startEditingMode(
    editMode?: InsertMode,
    initialValue?: string,
    cursorPosition?: number,
  ): Result<UIState> {
    return this.transition({
      type: "START_EDITING",
      editMode,
      initialValue,
      cursorPosition,
    });
  }

  exitEditingMode(): Result<UIState> {
    return this.transition({ type: "EXIT_TO_NAVIGATION" });
  }

  enterSpreadsheetVisualMode(
    visualMode: SpreadsheetVisualMode,
    selection: Selection,
  ): Result<UIState> {
    return this.transition({
      type: "ENTER_SPREADSHEET_VISUAL_MODE",
      visualMode,
      selection,
    });
  }

  exitSpreadsheetVisualMode(): Result<UIState> {
    return this.transition({ type: "EXIT_SPREADSHEET_VISUAL_MODE" });
  }

  getState(): Readonly<UIState> {
    return this.state;
  }

  subscribe(listener: (state: UIState, action: Action) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getHistory(): ReadonlyArray<{
    state: UIState;
    action: Action;
    timestamp: number;
  }> {
    return this.history;
  }

  // Private transition handlers
  private startEditing(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "START_EDITING") {
      return err("Invalid action type");
    }
    if (!isNavigationMode(state)) {
      return err("Can only start editing from navigation mode");
    }

    const cellMode: CellMode = action.editMode ? "insert" : "normal";
    const newState = createEditingState(state.cursor, state.viewport, cellMode);

    // Preserve the edit variant if we're entering insert mode
    if (action.editMode && isEditingMode(newState)) {
      const editingState = {
        ...newState,
        editVariant: action.editMode,
      };

      // If initial value and cursor position are provided, set them
      if (action.initialValue !== undefined) {
        editingState.editingValue = action.initialValue;
        editingState.cursorPosition = action.cursorPosition ?? 0;
      }

      return ok(editingState);
    }

    // If initial value is provided for normal mode
    if (action.initialValue !== undefined && isEditingMode(newState)) {
      return ok({
        ...newState,
        editingValue: action.initialValue,
        cursorPosition: action.cursorPosition ?? 0,
      });
    }

    return ok(newState);
  }

  private exitToNavigation(state: UIState): Result<UIState> {
    if (
      !isEditingMode(state) &&
      !isCommandMode(state) &&
      !isResizeMode(state) &&
      !isSpreadsheetVisualMode(state)
    ) {
      return err(
        "Can only exit to navigation from editing, command, resize, or visual mode",
      );
    }

    return ok(createNavigationState(state.cursor, state.viewport));
  }

  private enterInsertMode(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "ENTER_INSERT_MODE") {
      return err("Invalid action type");
    }
    if (!isEditingMode(state) || state.cellMode !== "normal") {
      return err("Can only enter insert mode from editing normal mode");
    }

    return ok({
      ...state,
      cellMode: "insert",
      editVariant: action.mode,
    });
  }

  private exitInsertMode(state: UIState): Result<UIState> {
    if (!isEditingMode(state) || state.cellMode !== "insert") {
      return err("Can only exit insert mode when in insert mode");
    }

    return ok({
      ...state,
      cellMode: "normal",
      editVariant: undefined,
    });
  }

  private enterVisualMode(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "ENTER_VISUAL_MODE") {
      return err("Invalid action type");
    }
    if (!isEditingMode(state) || state.cellMode !== "normal") {
      return err("Can only enter visual mode from editing normal mode");
    }

    return ok({
      ...state,
      cellMode: "visual",
      visualType: action.visualType,
      visualStart: action.anchor ?? state.cursorPosition,
    });
  }

  private exitVisualMode(state: UIState): Result<UIState> {
    if (!isEditingMode(state) || state.cellMode !== "visual") {
      return err("Can only exit visual mode when in visual mode");
    }

    return ok({
      ...state,
      cellMode: "normal",
      visualType: undefined,
      visualStart: undefined,
    });
  }

  private handleEnterSpreadsheetVisualMode(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "ENTER_SPREADSHEET_VISUAL_MODE") {
      return err("Invalid action type");
    }
    if (!isNavigationMode(state)) {
      return err("Can only enter spreadsheet visual mode from navigation mode");
    }

    return ok(createSpreadsheetVisualState(
      state.cursor,
      state.viewport,
      action.visualMode,
      state.cursor, // anchor starts at current cursor
      action.selection,
    ));
  }

  private handleExitSpreadsheetVisualMode(state: UIState): Result<UIState> {
    if (!isSpreadsheetVisualMode(state)) {
      return err("Can only exit spreadsheet visual mode when in visual mode");
    }

    return ok(createNavigationState(state.cursor, state.viewport, state.selection));
  }

  private updateSelection(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "UPDATE_SELECTION") {
      return err("Invalid action type");
    }
    if (!isSpreadsheetVisualMode(state)) {
      return err("Can only update selection in spreadsheet visual mode");
    }

    return ok({
      ...state,
      selection: action.selection,
    });
  }

  private enterCommandMode(state: UIState): Result<UIState> {
    if (!isNavigationMode(state)) {
      return err("Can only enter command mode from navigation mode");
    }

    return ok(createCommandState(state.cursor, state.viewport));
  }

  private exitCommandMode(state: UIState): Result<UIState> {
    if (!isCommandMode(state)) {
      return err("Can only exit command mode when in command mode");
    }

    return ok(createNavigationState(state.cursor, state.viewport));
  }

  private enterResizeMode(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "ENTER_RESIZE_MODE") {
      return err("Invalid action type");
    }
    if (!isNavigationMode(state)) {
      return err("Can only enter resize mode from navigation mode");
    }

    return ok(
      createResizeState(
        state.cursor,
        state.viewport,
        action.target,
        action.index,
        action.size,
      ),
    );
  }

  private exitResizeMode(state: UIState): Result<UIState> {
    if (!isResizeMode(state)) {
      return err("Can only exit resize mode when in resize mode");
    }

    return ok(createNavigationState(state.cursor, state.viewport));
  }

  private updateEditingValue(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "UPDATE_EDITING_VALUE") {
      return err("Invalid action type");
    }
    if (!isEditingMode(state)) {
      return err("Can only update editing value in editing mode");
    }

    return ok({
      ...state,
      editingValue: action.value,
      cursorPosition: action.cursorPosition,
    });
  }

  private updateCommandValue(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "UPDATE_COMMAND_VALUE") {
      return err("Invalid action type");
    }
    if (!isCommandMode(state)) {
      return err("Can only update command value in command mode");
    }

    return ok({
      ...state,
      commandValue: action.value,
    });
  }

  private updateResizeSize(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "UPDATE_RESIZE_SIZE") {
      return err("Invalid action type");
    }
    if (!isResizeMode(state)) {
      return err("Can only update resize size in resize mode");
    }

    return ok({
      ...state,
      currentSize: action.size,
    });
  }

  private updateCursor(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "UPDATE_CURSOR") {
      return err("Invalid action type");
    }
    return ok({
      ...state,
      cursor: action.cursor,
    });
  }

  private updateViewport(state: UIState, action: Action): Result<UIState> {
    if (action.type !== "UPDATE_VIEWPORT") {
      return err("Invalid action type");
    }
    return ok({
      ...state,
      viewport: action.viewport,
    });
  }

  private handleEscape(state: UIState): Result<UIState> {
    if (isEditingMode(state)) {
      if (state.cellMode === "insert" || state.cellMode === "visual") {
        // Exit to normal mode within editing
        return ok({
          ...state,
          cellMode: "normal",
          visualType: undefined,
          visualStart: undefined,
          editVariant: undefined,
        });
      }
      // Exit editing mode entirely
      return this.exitToNavigation(state);
    }

    if (isSpreadsheetVisualMode(state)) {
      return this.handleExitSpreadsheetVisualMode(state);
    }

    if (isCommandMode(state) || isResizeMode(state)) {
      return this.exitToNavigation(state);
    }

    // Already in navigation, nothing to do
    return ok(state);
  }

  private getTransitionKey(state: UIState, action: Action): string {
    const mode = state.spreadsheetMode;
    if (isEditingMode(state)) {
      return `${mode}.${state.cellMode}.${action.type}`;
    }
    return `${mode}.${action.type}`;
  }

  private notifyListeners(action: Action): void {
    const currentState = this.state;
    this.listeners.forEach((listener) => listener(currentState, action));
  }

  private addToHistory(state: UIState, action: Action): void {
    this.history.push({ state, action, timestamp: Date.now() });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}
