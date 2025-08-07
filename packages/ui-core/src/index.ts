// State types and utilities

// Rust adapter exports (optional, based on feature flag)
export { 
  USE_RUST_CONTROLLER,
  RustSpreadsheetController,
  createSpreadsheetController,
  initializeWasm 
} from "./rust/adapter";

export { CellVimBehavior } from "./behaviors/CellVimBehavior";
export { type ResizeAction, ResizeBehavior } from "./behaviors/ResizeBehavior";
// Structural behaviors
export {
  type CellHighlight,
  ConfirmationDialog,
  DEFAULT_STRUCTURAL_UI_CONFIG,
  type HighlightType as StructuralHighlightType,
  ProgressIndicator,
  type StructuralOperation,
  StructuralOperationFeedback,
  StructuralOperationManager,
  type StructuralOperationState,
  type StructuralUIConfig,
  type StructuralUIEvent,
  type StructuralWarning,
  WarningDialog,
} from "./behaviors/structural";

// Behaviors
export {
  type CellVimAction,
  type KeyMeta,
  type VimAction,
  VimBehavior,
} from "./behaviors/VimBehavior";
// VimMode - unified interface for vim text editing
export {
  type EditMode,
  type VimCallbacks,
  VimMode,
  type VimModeType,
  type VimState,
} from "./behaviors/VimMode";
// Commands
export * from "./commands";
// Controller
export {
  type ControllerEvent,
  SpreadsheetController,
  type SpreadsheetControllerOptions,
  type ViewportManager,
} from "./controllers/SpreadsheetController";
// Managers
export {
  DefaultSelectionManager,
  type SelectionBounds,
  type SelectionManager,
} from "./managers/SelectionManager";
export {
  type CellMode,
  // createBulkOperationState,
  createCommandState,
  createEditingState,
  createNavigationState,
  createResizeState,
  createSpreadsheetVisualState,
  type InsertMode,
  isCellVisualMode,
  isCommandMode,
  isEditingMode,
  isInsertMode,
  isNavigationMode,
  isResizeMode,
  isSpreadsheetVisualMode,
  isVisualMode,
  type Selection,
  type SelectionType,
  type SpreadsheetVisualMode,
  type UIState,
  type ViewportInfo,
  type VisualMode,
} from "./state/UIState";
// State machine
export { type Action, UIStateMachine } from "./state/UIStateMachine";
export {
  DEFAULT_HIGHLIGHT_COLORS,
  FormulaHighlighter,
  type HighlightColors,
  type HighlightSegment,
  type HighlightType,
  TUI_HIGHLIGHT_COLORS,
} from "./utils/FormulaHighlighter";
// Utilities
export { err, ok, type Result, unwrap, unwrapOr } from "./utils/Result";
export {
  analyzeStateHistory,
  generateMermaidDiagram,
  generateStateTable,
} from "./utils/StateVisualizer";
