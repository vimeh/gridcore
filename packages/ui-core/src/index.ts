// State types and utilities

// Commands
export * from "./commands";

export { CellVimBehavior } from "./behaviors/CellVimBehavior";
export { type ResizeAction, ResizeBehavior } from "./behaviors/ResizeBehavior";

// Behaviors
export {
  type CellVimAction,
  type KeyMeta,
  type VimAction,
  VimBehavior,
} from "./behaviors/VimBehavior";

// Managers
export {
  type SelectionBounds,
  type SelectionManager,
  DefaultSelectionManager,
} from "./managers/SelectionManager";

// VimMode - unified interface for vim text editing
export {
  type EditMode,
  type VimCallbacks,
  VimMode,
  type VimModeType,
  type VimState,
} from "./behaviors/VimMode";
// Controller
export {
  type ControllerEvent,
  SpreadsheetController,
  type SpreadsheetControllerOptions,
  type ViewportManager,
} from "./controllers/SpreadsheetController";
export {
  type CellMode,
  createBulkOperationState,
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
