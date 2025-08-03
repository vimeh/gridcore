import type { SpreadsheetState } from "./SpreadsheetState";

/**
 * Complete workbook state including multiple sheets
 */
export interface WorkbookState {
  version: string;
  metadata?: WorkbookMetadata;
  sheets: SheetState[];
  activeSheetId: string;
  sheetOrder: string[];
}

/**
 * Workbook metadata
 */
export interface WorkbookMetadata {
  title?: string;
  createdAt: string;
  modifiedAt: string;
  author?: string;
  description?: string;
  tags?: string[];
}

/**
 * Individual sheet state extending the base spreadsheet state
 */
export interface SheetState extends SpreadsheetState {
  id: string;
  name: string;
  index: number;
  hidden?: boolean;
  protected?: boolean;
}

/**
 * Options for serializing workbook state
 */
export interface WorkbookStateOptions {
  includeView?: boolean;
  includeMetadata?: boolean;
  includeComputedValues?: boolean;
  includeHiddenSheets?: boolean;
}

/**
 * Cross-sheet reference format
 */
export interface CrossSheetReference {
  sheetName: string;
  sheetId?: string;
  cellReference: string;
  isAbsolute?: boolean;
}
