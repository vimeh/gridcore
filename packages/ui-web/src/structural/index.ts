/**
 * Web-specific structural UI integration
 *
 * This module provides pre-configured components and utilities for
 * integrating structural operation UI feedback with web-based spreadsheets.
 */

// Re-export core structural UI components for convenience
export {
  type CellHighlight,
  ConfirmationDialog,
  DEFAULT_STRUCTURAL_UI_CONFIG,
  ProgressIndicator,
  type StructuralHighlightType as HighlightType,
  type StructuralOperation,
  StructuralOperationFeedback,
  StructuralOperationManager,
  type StructuralOperationState,
  type StructuralUIConfig,
  type StructuralUIEvent,
  type StructuralWarning,
  WarningDialog,
} from "../wasm";
export { StatusBar } from "../components/StatusBar";
export {
  createStructuralUI,
  STRUCTURAL_UI_CSS,
  StructuralUIExample,
} from "./StructuralUIExample";
