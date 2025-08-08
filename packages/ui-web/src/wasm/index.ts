/**
 * WASM Re-exports for UI-Web
 * 
 * This module re-exports all WASM types and functions needed by the ui-web package.
 * It acts as a single entry point for all WASM-related imports.
 */

// Import CellAddress for both type use and re-export
import { CellAddress } from "gridcore-wasm"
type CellAddressType = CellAddress

// Core types from gridcore-wasm
export { 
  CellAddress,
  WasmCell,
  WasmCell as Cell,
  WasmEvaluator,
  WasmSpreadsheetFacade,
  WasmSpreadsheetFacade as SpreadsheetFacade,
  WasmSheet,
  WasmSheet as Sheet,
  WasmSheetManager,
  WasmWorkbook,
  WasmWorkbook as Workbook,
} from "gridcore-wasm"

// Function-based API from gridcore-wasm
export * from "gridcore-wasm"

// Controller types from gridcore-controller
export {
  WasmSpreadsheetController,
  WasmSpreadsheetController as SpreadsheetController,
  WasmViewportManager,
  WasmViewportManager as ViewportManager,
  WasmUIStateMachine,
  initController,
  controllerVersion,
  ActionBuilder,
  EventFactory,
  EventTypes,
  MouseButtons,
  MouseEventTypes,
} from "gridcore-controller"

// Cell range types
export interface CellRange {
  start: CellAddressType
  end: CellAddressType
}

// Selection types  
export interface Selection {
  anchor: CellAddressType
  focus: CellAddressType
  primary?: CellAddressType
  ranges?: CellRange[]
  type?: string
}

// UI State types (comprehensive definition)
export interface UIState {
  mode: string
  spreadsheetMode: string
  cursor: CellAddressType
  selection?: Selection
  visualMode?: string
  cellMode?: string
  editingValue?: string
  cursorPosition?: number
}

export interface ControllerEvent {
  type: string
  payload: any
}

export interface Result<T> {
  ok?: T
  error?: string
}

// Structural UI types (mock for now)
export interface StructuralOperation {
  type: string
  parameters: any
}

export interface StructuralOperationState {
  operation: StructuralOperation
  status: string
}

export interface StructuralUIConfig {
  enableAnimations: boolean
  showProgress: boolean
}

export interface StructuralUIEvent {
  type: string
  data: any
}

export interface StructuralWarning {
  message: string
  level: string
}

export type StructuralHighlightType = "inserted" | "deleted" | "modified"

export interface CellHighlight {
  address: CellAddressType
  type: StructuralHighlightType
}

// Structural UI components (mock for now)
export class ConfirmationDialog {
  constructor() {}
  show(message: string): Promise<boolean> {
    return Promise.resolve(true)
  }
}

export class ProgressIndicator {
  constructor() {}
  show(message: string): void {}
  hide(): void {}
}

export class StructuralOperationFeedback {
  constructor() {}
}

export class StructuralOperationManager {
  constructor() {}
}

export class WarningDialog {
  constructor() {}
  show(warning: StructuralWarning): void {}
}

export const DEFAULT_STRUCTURAL_UI_CONFIG: StructuralUIConfig = {
  enableAnimations: true,
  showProgress: true,
}


// SpreadsheetVisualMode enum
export enum SpreadsheetVisualMode {
  CharacterWise = "CharacterWise",
  LineWise = "LineWise", 
  BlockWise = "BlockWise",
}

// Helper functions
export function cellAddressToString(address: CellAddress): string {
  const colName = String.fromCharCode(65 + address.col)
  return `${colName}${address.row + 1}`
}

export function isSpreadsheetVisualMode(mode: any): boolean {
  return mode && (mode === "CharacterWise" || mode === "LineWise" || mode === "BlockWise")
}

// CellAddress static methods (extend the class)
export function createCellAddress(col: number, row: number): CellAddressType {
  const CellAddressClass = CellAddress as any
  return new CellAddressClass(col, row)
}

// Add static create method to CellAddress - must be after the class is imported
// This must be done after the initial setup
setTimeout(() => {
  ;(CellAddress as any).create = function(col: number, row: number): CellAddressType {
    return new CellAddress(col, row)
  }
}, 0)