import type { CellAddress } from "@gridcore/core";
import type { ParsedBulkCommand } from "../commands/BulkCommandParser";

// Core shared state properties
export interface ViewportInfo {
  startRow: number;
  startCol: number;
  rows: number;
  cols: number;
}

// Cell editing mode types (when editing a cell)
export type CellMode = "normal" | "insert" | "visual";

// Visual mode types for cell-level editing
export type VisualMode = "character" | "line" | "block";

// Spreadsheet-level visual selection modes
export type SpreadsheetVisualMode = "char" | "line" | "block" | "column" | "row";

// Insert mode variants
export type InsertMode = "i" | "a" | "A" | "I" | "o" | "O";

// Selection types for spreadsheet-level selections
export type SelectionType = 
  | { type: "cell"; address: CellAddress }
  | { type: "range"; start: CellAddress; end: CellAddress }
  | { type: "column"; columns: number[] }
  | { type: "row"; rows: number[] }
  | { type: "multi"; selections: Selection[] };

export interface Selection {
  type: SelectionType;
  anchor?: CellAddress; // For extending selections
}

// Spreadsheet-level state with nested modes
export type UIState =
  | {
      spreadsheetMode: "navigation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      selection?: Selection; // Optional selection in navigation
    }
  | {
      spreadsheetMode: "visual";
      cursor: CellAddress;
      viewport: ViewportInfo;
      selection: Selection; // Required in visual mode
      visualMode: SpreadsheetVisualMode; // Type of visual selection
      anchor: CellAddress; // Where selection started
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
    }
  | {
      spreadsheetMode: "bulkOperation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      command: ParsedBulkCommand;
      previewVisible: boolean;
      affectedCells: number;
      status: "preparing" | "previewing" | "executing" | "completed" | "error";
      errorMessage?: string;
    };

// Type guards for safe access
export function isNavigationMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "navigation" }> {
  return state.spreadsheetMode === "navigation";
}

export function isSpreadsheetVisualMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "visual" }> {
  return state.spreadsheetMode === "visual";
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
): state is Extract<UIState, { spreadsheetMode: "editing"; cellMode: "insert" }> {
  return state.spreadsheetMode === "editing" && state.cellMode === "insert";
}

export function isStructuralInsertMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "insert" }> {
  return state.spreadsheetMode === "insert";
}

export function isDeleteMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "delete" }> {
  return state.spreadsheetMode === "delete";
}

export function isBulkOperationMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "bulkOperation" }> {
  return state.spreadsheetMode === "bulkOperation";
}

// Helper to check if in cell insert mode within cell editing
export function isCellInsertMode(state: UIState): boolean {
  return isEditingMode(state) && state.cellMode === "insert";
}

// Helper to check if in visual mode within cell editing (renamed for clarity)
export function isCellVisualMode(state: UIState): boolean {
  return isEditingMode(state) && state.cellMode === "visual";
}

// Legacy helper - kept for backward compatibility but deprecated
export function isVisualMode(state: UIState): boolean {
  return isCellVisualMode(state);
}

// Default states factory
export function createNavigationState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  selection?: Selection,
): UIState {
  return {
    spreadsheetMode: "navigation",
    cursor,
    viewport,
    selection,
  };
}

export function createSpreadsheetVisualState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  visualMode: SpreadsheetVisualMode,
  anchor: CellAddress,
  selection: Selection,
): UIState {
  return {
    spreadsheetMode: "visual",
    cursor,
    viewport,
    visualMode,
    anchor,
    selection,
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
  commandValue = ":",
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

export function createBulkOperationState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  command: ParsedBulkCommand
): UIState {
  return {
    spreadsheetMode: "bulkOperation",
    cursor,
    viewport,
    command,
    previewVisible: false,
    affectedCells: 0,
    status: "preparing",
  };
}
