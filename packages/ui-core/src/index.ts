// State types and utilities

export { CellVimBehavior } from "./behaviors/CellVimBehavior";
export { type ResizeAction, ResizeBehavior } from "./behaviors/ResizeBehavior";

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
// Controller
export {
  type ControllerEvent,
  SpreadsheetController,
  type SpreadsheetControllerOptions,
  type ViewportManager,
} from "./controllers/SpreadsheetController";
export {
  type CellMode,
  createCommandState,
  createEditingState,
  createNavigationState,
  createResizeState,
  type InsertMode,
  isCommandMode,
  isEditingMode,
  isInsertMode,
  isNavigationMode,
  isResizeMode,
  isVisualMode,
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
