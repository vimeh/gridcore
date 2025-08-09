/**
 * Core types for the spreadsheet application
 */

// Cell address representation
export type CellAddress = {
  col: number;
  row: number;
  to_a1(): string;
};

// Cell value types
export type CellValue =
  | { type: "empty" }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "error"; message: string };

// Cell structure
export interface Cell {
  address: CellAddress;
  raw_value: CellValue;
  computed_value: CellValue;
  formula?: string;
  is_formula: boolean;
  dependencies: CellAddress[];
  error?: string;
}

// Fill operation types
export interface FillOperation {
  type: "series" | "copy" | "format";
  source: CellAddress;
  target: {
    start: CellAddress;
    end: CellAddress;
  };
  direction?: "down" | "right" | "up" | "left";
  step?: number;
}

export interface FillResult {
  cells_modified: number;
  values: Array<{
    address: CellAddress;
    value: CellValue;
  }>;
}

// Batch operation types
export type BatchOperation =
  | {
      type: "set_cell";
      address: CellAddress;
      value: CellValue;
      formula?: string;
    }
  | {
      type: "delete_cell";
      address: CellAddress;
    }
  | {
      type: "set_range";
      start: CellAddress;
      end: CellAddress;
      values: CellValue[][];
    }
  | {
      type: "delete_range";
      start: CellAddress;
      end: CellAddress;
    };

export interface BatchResult {
  success: boolean;
  operation: string;
  detail?: string;
  error?: string;
}
