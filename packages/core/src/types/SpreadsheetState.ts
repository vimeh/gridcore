import type { CellAddress, Cell } from "../types";

/**
 * Complete spreadsheet state including cells, dimensions, and view properties
 */
export interface SpreadsheetState {
  version: string;
  metadata?: {
    title?: string;
    createdAt?: string;
    modifiedAt?: string;
    author?: string;
  };
  dimensions: {
    rows: number;
    cols: number;
  };
  cells: Array<{
    address: CellAddress;
    cell: Cell;
  }>;
  view?: {
    columnWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
    frozenRows?: number;
    frozenCols?: number;
  };
  dependencies: {
    dependencies: Array<{ cell: string; deps: string[] }>;
    dependents: Array<{ cell: string; deps: string[] }>;
  };
}

export interface SpreadsheetStateOptions {
  includeView?: boolean;
  includeMetadata?: boolean;
  includeComputedValues?: boolean;
}