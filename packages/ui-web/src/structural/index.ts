/**
 * Web-specific structural UI integration
 * 
 * This module provides pre-configured components and utilities for
 * integrating structural operation UI feedback with web-based spreadsheets.
 */

export { 
  StructuralUIExample, 
  createStructuralUI, 
  STRUCTURAL_UI_CSS 
} from "./StructuralUIExample";

// Re-export core structural UI components for convenience
export {
  StructuralOperationManager,
  StructuralOperationFeedback,
  ProgressIndicator,
  WarningDialog,
  ConfirmationDialog,
  type StructuralOperation,
  type StructuralUIEvent,
  type StructuralWarning,
  type HighlightType,
  type CellHighlight,
  type StructuralOperationState,
  type StructuralUIConfig,
  DEFAULT_STRUCTURAL_UI_CONFIG
} from "@gridcore/ui-core";