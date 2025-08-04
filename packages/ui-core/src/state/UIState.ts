import type { CellAddress } from "@gridcore/core";

// Core shared state properties
export interface ViewportInfo {
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
}

// Cell editing mode types (when editing a cell)
export type CellMode = "normal" | "insert" | "visual";

// Visual mode types
export type VisualMode = "character" | "line" | "block";

// Insert mode variants
export type InsertMode = "i" | "a" | "A" | "I" | "o" | "O";

// Spreadsheet-level state with nested modes
export type UIState =
  | {
      spreadsheetMode: "navigation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      // No cell editing state when navigating
    }
  | {
      spreadsheetMode: "editing";
      cursor: CellAddress;
      viewport: ViewportInfo;
      cellMode: CellMode; // Required when editing
      editingValue: string; // The cell's text content
      cursorPosition: number; // Position within the text
      visualStart?: number; // For visual selection within cell
      visualType?: VisualMode; // Type of visual selection
      editVariant?: InsertMode; // How we entered insert mode
    }
  | {
      spreadsheetMode: "command";
      cursor: CellAddress;
      viewport: ViewportInfo;
      commandValue: string;
    }
  | {
      spreadsheetMode: "resize";
      cursor: CellAddress;
      viewport: ViewportInfo;
      resizeTarget: "column" | "row";
      resizeIndex: number; // Which column/row is being resized
      originalSize: number; // Original width/height
      currentSize: number; // Current width/height during resize
    }
  | {
      spreadsheetMode: "insert";
      cursor: CellAddress;
      viewport: ViewportInfo;
      insertType: "row" | "column";
      insertPosition: "before" | "after";
      count: number;
      targetIndex: number;
    }
  | {
      spreadsheetMode: "delete";
      cursor: CellAddress;
      viewport: ViewportInfo;
      deleteType: "row" | "column"; 
      selection: number[]; // Indices to delete
      confirmationPending: boolean;
    };

// Type guards for safe access
export function isNavigationMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "navigation" }> {
  return state.spreadsheetMode === "navigation";
}

export function isEditingMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "editing" }> {
  return state.spreadsheetMode === "editing";
}

export function isCommandMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "command" }> {
  return state.spreadsheetMode === "command";
}

export function isResizeMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "resize" }> {
  return state.spreadsheetMode === "resize";
}

export function isInsertMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "insert" }> {
  return state.spreadsheetMode === "insert";
}

export function isDeleteMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "delete" }> {
  return state.spreadsheetMode === "delete";
}

// Helper to check if in cell insert mode within cell editing
export function isCellInsertMode(state: UIState): boolean {
  return isEditingMode(state) && state.cellMode === "insert";
}

// Helper to check if in visual mode within cell editing
export function isVisualMode(state: UIState): boolean {
  return isEditingMode(state) && state.cellMode === "visual";
}

// Default states factory
export function createNavigationState(
  cursor: CellAddress,
  viewport: ViewportInfo,
): UIState {
  return {
    spreadsheetMode: "navigation",
    cursor,
    viewport,
  };
}

export function createEditingState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  cellMode: CellMode = "normal",
  editingValue = "",
): UIState {
  return {
    spreadsheetMode: "editing",
    cursor,
    viewport,
    cellMode,
    editingValue,
    cursorPosition: editingValue.length,
  };
}

export function createCommandState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  commandValue = "",
): UIState {
  return {
    spreadsheetMode: "command",
    cursor,
    viewport,
    commandValue,
  };
}

export function createResizeState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  resizeTarget: "column" | "row",
  resizeIndex: number,
  size: number,
): UIState {
  return {
    spreadsheetMode: "resize",
    cursor,
    viewport,
    resizeTarget,
    resizeIndex,
    originalSize: size,
    currentSize: size,
  };
}

export function createInsertState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  insertType: "row" | "column",
  insertPosition: "before" | "after"
): UIState {
  return {
    spreadsheetMode: "insert",
    cursor,
    viewport,
    insertType,
    insertPosition,
    count: 1,
    targetIndex: insertType === "row" ? cursor.row : cursor.col,
  };
}

export function createDeleteState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  deleteType: "row" | "column",
  selection: number[]
): UIState {
  return {
    spreadsheetMode: "delete",
    cursor,
    viewport,
    deleteType,
    selection,
    confirmationPending: true,
  };
}
