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

export function isBulkOperationMode(
  state: UIState,
): state is Extract<UIState, { spreadsheetMode: "bulkOperation" }> {
  return state.spreadsheetMode === "bulkOperation";
}

// Helper to check if in insert mode within cell editing
export function isInsertMode(state: UIState): boolean {
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

export function createBulkOperationState(
  cursor: CellAddress,
  viewport: ViewportInfo,
  command: ParsedBulkCommand,
  affectedCells = 0,
): UIState {
  return {
    spreadsheetMode: "bulkOperation",
    cursor,
    viewport,
    command,
    previewVisible: command.requiresPreview,
    affectedCells,
    status: "preparing",
  };
}
