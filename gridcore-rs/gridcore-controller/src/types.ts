/**
 * TypeScript type definitions for the Rust controller
 * These types mirror the Rust types for seamless interop
 */

export interface CellAddress {
  col: number;
  row: number;
}

export interface ViewportInfo {
  start_row: number;
  start_col: number;
  rows: number;
  cols: number;
}

export type SpreadsheetMode =
  | "Navigation"
  | "Editing"
  | "Command"
  | "Visual"
  | "Resize"
  | "Insert"
  | "Delete"
  | "BulkOperation";

export type CellMode = "Normal" | "Insert" | "Visual";

export type VisualMode = "Character" | "Line" | "Block";

export type SpreadsheetVisualMode = "Char" | "Line" | "Block";

export type InsertMode =
  | "I" // Insert at cursor
  | "A" // Append after cursor
  | "O" // Open line below
  | "ShiftO" // Open line above
  | "S" // Substitute line
  | "C" // Change to end of line
  | "ShiftA" // Append at end of line
  | "ShiftI"; // Insert at beginning of line

export type SelectionType =
  | { type: "Cell"; address: CellAddress }
  | { type: "Range"; start: CellAddress; end: CellAddress }
  | { type: "Row"; rows: number[] }
  | { type: "Column"; columns: number[] }
  | { type: "All" };

export interface Selection {
  selection_type: SelectionType;
  anchor: CellAddress | null;
}

export interface ParsedBulkCommand {
  command: string;
  operation: string;
  range_spec: string;
  parameters: string[];
}

export type ResizeTarget =
  | { type: "Column"; index: number }
  | { type: "Row"; index: number };

export type ResizeMoveDirection = "Previous" | "Next";

export type InsertType = "Row" | "Column";

export type InsertPosition = "Before" | "After";

export type DeleteType = "Row" | "Column" | "Cell";

export type BulkOperationStatus =
  | "Preparing"
  | "Previewing"
  | "Executing"
  | "Completed"
  | "Failed";

export type UIState =
  | {
      type: "Navigation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      last_command: string | null;
    }
  | {
      type: "Visual";
      cursor: CellAddress;
      viewport: ViewportInfo;
      visual_mode: SpreadsheetVisualMode;
      visual_start: CellAddress;
      selection: Selection;
    }
  | {
      type: "Editing";
      cursor: CellAddress;
      viewport: ViewportInfo;
      cell_mode: CellMode;
      editing_value: string;
      cursor_position: number;
      visual_type: VisualMode | null;
      visual_start: number | null;
      edit_variant: InsertMode | null;
    }
  | {
      type: "Command";
      cursor: CellAddress;
      viewport: ViewportInfo;
      command_value: string;
    }
  | {
      type: "Resize";
      cursor: CellAddress;
      viewport: ViewportInfo;
      target: ResizeTarget;
      resize_target: ResizeTarget;
      resize_index: number;
      original_size: number;
      current_size: number;
      initial_position: number;
      current_position: number;
    }
  | {
      type: "Insert";
      cursor: CellAddress;
      viewport: ViewportInfo;
      insert_type: InsertType;
      position: InsertPosition;
      insert_position: InsertPosition;
      reference: number;
      count: number;
      target_index: number;
    }
  | {
      type: "Delete";
      cursor: CellAddress;
      viewport: ViewportInfo;
      delete_type: DeleteType;
      targets: number[];
      selection: number[];
      confirmation_pending: boolean;
    }
  | {
      type: "BulkOperation";
      cursor: CellAddress;
      viewport: ViewportInfo;
      parsed_command: ParsedBulkCommand;
      preview_available: boolean;
      preview_visible: boolean;
      affected_cells: number;
      status: BulkOperationStatus;
      error_message: string | null;
    };

export interface Action {
  type: string;
  [key: string]: any;
}

export interface KeyboardEvent {
  key: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

export interface MouseEvent {
  x: number;
  y: number;
  button: "left" | "middle" | "right" | "none";
  event_type: "down" | "up" | "move" | "click" | "doubleclick" | "wheel";
}

export interface SpreadsheetEvent {
  type: string;
  [key: string]: any;
}
