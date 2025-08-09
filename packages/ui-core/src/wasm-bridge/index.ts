/**
 * WASM Bridge Module
 *
 * This module provides TypeScript wrappers around the function-based WASM API
 * exported by gridcore-core. These wrappers manage instance lifecycles and
 * provide type-safe interfaces for JavaScript/TypeScript code.
 */

// Re-export core WASM types that are directly usable
export { CellAddress, WasmCell } from "gridcore-core";
export {
  type EvaluationContext,
  EvaluatorWrapper,
  WasmEvaluator,
} from "./EvaluatorWrapper";
export { FacadeWrapper, WasmSpreadsheetFacade } from "./FacadeWrapper";
export { WasmWorkbook, WorkbookWrapper } from "./WorkbookWrapper";
