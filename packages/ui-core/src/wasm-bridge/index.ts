/**
 * WASM Bridge Module
 * 
 * This module provides TypeScript wrappers around the function-based WASM API
 * exported by gridcore-core. These wrappers manage instance lifecycles and
 * provide type-safe interfaces for JavaScript/TypeScript code.
 */

export { FacadeWrapper, WasmSpreadsheetFacade } from "./FacadeWrapper"
export { WorkbookWrapper, WasmWorkbook } from "./WorkbookWrapper"
export { EvaluatorWrapper, WasmEvaluator, type EvaluationContext } from "./EvaluatorWrapper"

// Re-export core WASM types that are directly usable
export { CellAddress, WasmCell } from "gridcore-core"