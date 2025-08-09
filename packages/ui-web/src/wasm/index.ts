/**
 * WASM Re-exports for UI-Web
 *
 * This module re-exports all WASM types and functions needed by the ui-web package.
 * It acts as a single entry point for all WASM-related imports.
 */

// Import CellAddress for both type use and re-export
import { CellAddress } from "gridcore-wasm";

type CellAddressType = CellAddress;

// Controller types from gridcore-controller
export {
  ActionBuilder,
  controllerVersion,
  Direction,
  EventFactory,
  EventTypes,
  initController,
  MouseButtons,
  MouseEventTypes,
  WasmSelectionManager,
  WasmSelectionManager as SelectionManager,
  WasmSpreadsheetController,
  WasmSpreadsheetController as SpreadsheetController,
  WasmUIStateMachine,
  WasmViewportManager,
  WasmViewportManager as ViewportManager,
} from "gridcore-controller";

// Function-based API from gridcore-wasm
export * from "gridcore-wasm";
// Core types from gridcore-wasm
export {
  CellAddress,
  WasmCell,
  WasmCell as Cell,
  WasmEvaluator,
  WasmSheet,
  WasmSheet as Sheet,
  WasmSheetManager,
  WasmSpreadsheetFacade,
  WasmSpreadsheetFacade as SpreadsheetFacade,
  WasmWorkbook,
  WasmWorkbook as Workbook,
} from "gridcore-wasm";

// Cell range types
export interface CellRange {
  start: CellAddressType;
  end: CellAddressType;
}

// CellRange factory object
export const CellRange = {
  create(start: CellAddressType, end: CellAddressType): CellRange {
    return { start, end };
  },
};

// Selection types
export interface Selection {
  anchor: CellAddressType;
  focus: CellAddressType;
  primary?: CellAddressType;
  ranges?: CellRange[];
  type?: string;
}

// UI State types (comprehensive definition)
export interface UIState {
  mode: string;
  spreadsheetMode: string;
  cursor: CellAddressType;
  selection?: Selection;
  visualMode?: string;
  cellMode?: string;
  editingValue?: string;
  cursorPosition?: number;
}

export interface ControllerEvent {
  type: string;
  payload: any;
}

export interface Result<T> {
  ok?: T;
  error?: string;
}

// SpreadsheetVisualMode enum
export enum SpreadsheetVisualMode {
  CharacterWise = "CharacterWise",
  LineWise = "LineWise",
  BlockWise = "BlockWise",
}

// Helper functions
export function cellAddressToString(address: CellAddress): string {
  const colName = String.fromCharCode(65 + address.col);
  return `${colName}${address.row + 1}`;
}

export function isSpreadsheetVisualMode(mode: any): boolean {
  return (
    mode &&
    (mode === "CharacterWise" || mode === "LineWise" || mode === "BlockWise")
  );
}

// CellAddress static methods (extend the class)
export function createCellAddress(col: number, row: number): CellAddressType {
  const CellAddressClass = CellAddress as any;
  return new CellAddressClass(col, row);
}

// Add static create method to CellAddress - must be after the class is imported
// This must be done after the initial setup
setTimeout(() => {
  (CellAddress as any).create = (col: number, row: number): CellAddressType =>
    new CellAddress(col, row);

  (CellAddress as any).fromString = (str: string): CellAddressType => {
    // Parse column letters and row number
    const match = str.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`Invalid cell address: ${str}`);
    }

    const colStr = match[1];
    const rowStr = match[2];

    // Convert column letters to number (A=0, B=1, AA=26, etc.)
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 65) + 1;
    }
    col -= 1; // Convert to 0-based

    const row = parseInt(rowStr) - 1; // Convert to 0-based

    return new CellAddress(col, row);
  };
}, 0);
