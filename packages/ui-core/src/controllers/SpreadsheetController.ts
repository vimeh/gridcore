import {
  CellAddress,
  type CellReference,
  ReferenceAdjuster,
  ReferenceDetector,
  type SpreadsheetFacade,
  StructuralEngine,
  StructuralUndoManager,
} from "@gridcore/core";
import { CellVimBehavior } from "../behaviors/CellVimBehavior";
import { type ResizeAction, ResizeBehavior } from "../behaviors/ResizeBehavior";
import {
  type StructuralOperation,
  StructuralOperationManager,
  type StructuralUIEvent,
} from "../behaviors/structural";
import type { CellVimAction } from "../behaviors/VimBehavior";
import {
  type KeyMeta,
  type VimAction,
  VimBehavior,
} from "../behaviors/VimBehavior";
import {
  type ParsedBulkCommand,
  VimBulkCommandParser,
} from "../commands/BulkCommandParser";
import {
  DefaultSelectionManager,
  type SelectionManager,
} from "../managers/SelectionManager";
import {
  createNavigationState,
  createResizeState,
  type InsertMode,
  // isBulkOperationMode,
  isCommandMode,
  isEditingMode,
  // isFillMode,
  isNavigationMode,
  isResizeMode,
  isSpreadsheetVisualMode,
  type Selection,
  type SpreadsheetVisualMode,
  type UIState,
} from "../state/UIState";
import { type Action, UIStateMachine } from "../state/UIStateMachine";
import type { Result } from "../utils/Result";

export interface ViewportManager {
  getColumnWidth(index: number): number;
  setColumnWidth(index: number, width: number): void;
  getRowHeight(index: number): number;
  setRowHeight(index: number, height: number): void;
  getTotalRows(): number;
  getTotalCols(): number;
  scrollTo(row: number, col: number): void;
}

export interface SpreadsheetControllerOptions {
  facade: SpreadsheetFacade;
  viewportManager: ViewportManager;
  initialState?: UIState;
}

export type ControllerEvent =
  | { type: "stateChanged"; state: UIState; action: Action }
  | { type: "cellValueChanged"; address: CellAddress; value: string }
  | { type: "selectionChanged"; start: CellAddress; end?: CellAddress }
  | { type: "viewportChanged"; viewport: UIState["viewport"] }
  | { type: "commandExecuted"; command: string }
  | { type: "error"; error: string }
  | {
      type: "structuralOperationCompleted";
      operation: string;
      count: number;
      position: number;
    }
  | { type: "structuralOperationFailed"; operation: string; error: string }
  | { type: "structuralUIEvent"; event: StructuralUIEvent }
  // | { type: "undoCompleted"; description: string; snapshot: StructuralSnapshot }
  // | { type: "redoCompleted"; description: string; snapshot: StructuralSnapshot }
  | { type: "undoRedoStateChanged"; canUndo: boolean; canRedo: boolean };

export class SpreadsheetController {
  private stateMachine: UIStateMachine;
  private vimBehavior: VimBehavior;
  private cellVimBehavior: CellVimBehavior;
  private resizeBehavior: ResizeBehavior;
  private bulkCommandParser: VimBulkCommandParser;
  private facade: SpreadsheetFacade;
  private viewportManager: ViewportManager;
  private selectionManager: SelectionManager;
  private structuralManager: StructuralOperationManager;
  private structuralEngine: StructuralEngine;
  private structuralUndoManager: StructuralUndoManager;
  private listeners: Array<(event: ControllerEvent) => void> = [];

  constructor(options: SpreadsheetControllerOptions | SpreadsheetFacade) {
    // Handle both constructor signatures for backward compatibility
    if ("facade" in options) {
      this.facade = options.facade;
      this.viewportManager = options.viewportManager;
    } else {
      // Simple facade-only constructor for tests
      this.facade = options;
      // Create a simple viewport manager for tests
      this.viewportManager = {
        getColumnWidth: () => 100,
        setColumnWidth: () => {},
        getRowHeight: () => 20,
        setRowHeight: () => {},
        getTotalRows: () => 1000000,
        getTotalCols: () => 16384,
        scrollTo: () => {},
      };
    }

    // Initialize behaviors and managers
    this.vimBehavior = new VimBehavior();
    this.cellVimBehavior = new CellVimBehavior();
    this.resizeBehavior = new ResizeBehavior();
    this.bulkCommandParser = new VimBulkCommandParser();
    this.selectionManager = new DefaultSelectionManager(this.facade);
    this.structuralManager = new StructuralOperationManager();
    this.structuralEngine = new StructuralEngine();
    this.structuralUndoManager = new StructuralUndoManager();

    // Initialize fill engine
    // const formulaAdjuster = createFormulaAdjuster();
    // this.fillEngine = new FillEngine(this.facade.getCellRepository(), formulaAdjuster);

    // Initialize state machine
    let initialState =
      "initialState" in options ? options.initialState : undefined;
    if (!initialState) {
      const defaultCursor = CellAddress.create(0, 0);
      if (!defaultCursor.ok) throw new Error("Failed to create default cursor");
      initialState = createNavigationState(defaultCursor.value, {
        startRow: 0,
        startCol: 0,
        rows: 20,
        cols: 10,
      });
    }
    this.stateMachine = new UIStateMachine(initialState);

    // Subscribe to state changes
    this.stateMachine.subscribe((state, action) => {
      this.emit({ type: "stateChanged", state, action });
    });

    // Subscribe to structural operation events
    this.structuralManager.subscribe((event) => {
      this.emit({ type: "structuralUIEvent", event });

      // Emit specific events for completed operations
      if (event.type === "structuralOperationCompleted" && event.operation) {
        this.emit({
          type: "structuralOperationCompleted",
          operation: event.operation.type,
          count: event.operation.count || 1,
          position: event.operation.index || 0,
        });
      } else if (
        event.type === "structuralOperationFailed" &&
        event.operation
      ) {
        this.emit({
          type: "structuralOperationFailed",
          operation: event.operation.type,
          error: event.error || "Unknown error",
        });
      }
    });
  }

  // Main keyboard handler
  handleKeyPress(key: string, meta: KeyMeta): Result<UIState> {
    const state = this.stateMachine.getState();

    // Special handling for command mode
    if (isCommandMode(state)) {
      return this.handleCommandMode(key, meta, state);
    }

    // Route to appropriate behavior handler
    if (isNavigationMode(state)) {
      const action = this.vimBehavior.handleKeyPress(key, meta, state);
      return this.processVimAction(action, state);
    } else if (isSpreadsheetVisualMode(state)) {
      const action = this.vimBehavior.handleKeyPress(key, meta, state);
      return this.processVimAction(action, state);
    } else if (isEditingMode(state)) {
      // Cell-level vim handling
      const action = this.cellVimBehavior.handleKeyPress(key, meta, state);

      // If vim behavior returns none, handle text input for insert mode
      if (action.type === "none" && state.cellMode === "insert") {
        return this.handleTextInput(key, meta, state);
      }

      return this.processCellVimAction(action, state);
    } else if (isResizeMode(state)) {
      const action = this.resizeBehavior.handleKey(key, state);
      return this.processResizeAction(action, state);
      // } else if (isInsertMode(state)) {
      //   return this.handleInsertMode(key, meta, state);
      // } else if (isDeleteMode(state)) {
      //   return this.handleDeleteMode(key, meta, state);
    }

    return { ok: true, value: state };
  }

  // Wrapper method for tests that use handleKey
  handleKey(key: string): Result<UIState> {
    return this.handleKeyPress(key, {
      key,
      ctrl: false,
      shift: false,
      alt: false,
    });
  }

  // Wrapper method for tests that use handleControlKey
  handleControlKey(key: string): Result<UIState> {
    return this.handleKeyPress(key, {
      key,
      ctrl: true,
      shift: false,
      alt: false,
    });
  }

  // Process vim actions from navigation mode
  private processVimAction(action: VimAction, state: UIState): Result<UIState> {
    switch (action.type) {
      case "move":
        return this.handleMove(action.direction, action.count || 1, state);
      case "moveTo":
        return this.handleMoveTo(action.target, action.count, state);
      case "startEditing":
        return this.startEditing(action.editVariant, action.initialChar);
      case "enterCommand":
        return this.stateMachine.transition({ type: "ENTER_COMMAND_MODE" });
      case "enterResize": {
        const index = action.target === "column" ? state.cursor.col : state.cursor.row;
        return this.enterResize(action.target, index);
      }
      case "enterVisual": {
        // From navigation mode, we need to first enter editing mode, then visual mode
        const editResult = this.startEditing("normal");
        if (!editResult.ok) {
          return editResult;
        }
        // Now transition to visual mode
        return this.stateMachine.transition({
          type: "ENTER_VISUAL_MODE",
          visualType: action.visualType,
        });
      }
      case "enterSpreadsheetVisual": {
        return this.enterSpreadsheetVisual(action.visualMode, state);
      }
      case "extendSelection": {
        return this.extendSelection(action.direction, action.count || 1, state);
      }
      case "exitVisual": {
        return this.exitSpreadsheetVisual(state);
      }
      case "scroll":
        return this.handleScroll(action.direction, state);
      case "center":
        return this.handleCenter(action.position, state);
      case "delete":
      case "change":
      case "yank":
      case "paste":
        // These would be implemented based on selection
        return this.handleCellOperation(action.type, action, state);
      case "structuralInsert":
        return this.handleStructuralInsert(action, state);
      case "structuralDelete":
        return this.handleStructuralDelete(action, state);
      default:
        return { ok: true, value: state };
    }
  }

  // Process cell vim actions from editing mode
  private processCellVimAction(
    action: VimAction | CellVimAction,
    state: UIState,
  ): Result<UIState> {
    if (!isEditingMode(state)) {
      return { ok: false, error: "Not in editing mode" };
    }

    switch (action.type) {
      case "moveCursor":
        return this.handleCellCursorMove(
          action.direction,
          action.count || 1,
          state,
        );
      case "enterInsertMode":
        return this.stateMachine.transition({
          type: "ENTER_INSERT_MODE",
          mode: action.variant,
        });
      case "exitInsertMode":
        return this.stateMachine.transition({ type: "EXIT_INSERT_MODE" });
      case "enterVisualMode":
        return this.stateMachine.transition({
          type: "ENTER_VISUAL_MODE",
          visualType: action.visualType,
        });
      case "exitVisualMode":
        return this.stateMachine.transition({ type: "EXIT_VISUAL_MODE" });
      case "deleteText":
        return this.handleCellTextDelete(action.range, state);
      case "replaceFormula":
        return this.handleReplaceFormula(
          action.newFormula,
          action.newCursorPosition,
          state,
        );
      case "exitEditing":
        // Save the value when exiting editing mode
        return this.saveAndExitEditing();
      default:
        return { ok: true, value: state };
    }
  }

  // Process resize actions
  private processResizeAction(
    action: ResizeAction,
    state: UIState,
  ): Result<UIState> {
    if (!isResizeMode(state)) {
      return { ok: false, error: "Not in resize mode" };
    }

    switch (action.type) {
      case "resize":
        return this.handleResize(action.delta, state);
      case "autoFit":
        return this.handleAutoFit(state);
      case "moveTarget":
        return this.handleResizeTargetMove(action.direction, state);
      case "confirm":
      case "cancel":
        return this.stateMachine.transition({ type: "EXIT_RESIZE_MODE" });
      default:
        return { ok: true, value: state };
    }
  }

  // Handle command mode input
  private handleCommandMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): Result<UIState> {
    if (!isCommandMode(state)) {
      return { ok: false, error: "Not in command mode" };
    }

    if (meta.key === "escape") {
      return this.stateMachine.transition({ type: "EXIT_COMMAND_MODE" });
    }

    if (meta.key === "enter" || key === "\r" || key === "\n") {
      // Execute command
      try {
        this.executeCommand(state.commandValue);
        return this.stateMachine.transition({ type: "EXIT_COMMAND_MODE" });
      } catch (error) {
        console.error("Error executing command:", error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    if (meta.key === "tab" || key === "\t") {
      // Handle tab completion
      const completion = this.getCommandCompletion(state.commandValue);
      if (completion) {
        return this.stateMachine.transition({
          type: "UPDATE_COMMAND_VALUE",
          value: completion,
        });
      }
      return { ok: true, value: state }; // No completion found, do nothing
    }

    // Handle backspace
    if (meta.key === "backspace" || key === "\b") {
      const newValue = state.commandValue.slice(0, -1);
      return this.stateMachine.transition({
        type: "UPDATE_COMMAND_VALUE",
        value: newValue,
      });
    }

    // Add character to command
    const newValue = state.commandValue + key;
    return this.stateMachine.transition({
      type: "UPDATE_COMMAND_VALUE",
      value: newValue,
    });
  }

  // Movement handlers
  private handleMove(
    direction: "up" | "down" | "left" | "right",
    count: number,
    state: UIState,
  ): Result<UIState> {
    const cursor = state.cursor;
    let newRow = cursor.row;
    let newCol = cursor.col;

    switch (direction) {
      case "up":
        newRow = Math.max(0, cursor.row - count);
        break;
      case "down":
        newRow = Math.min(
          this.viewportManager.getTotalRows() - 1,
          cursor.row + count,
        );
        break;
      case "left":
        newCol = Math.max(0, cursor.col - count);
        break;
      case "right":
        newCol = Math.min(
          this.viewportManager.getTotalCols() - 1,
          cursor.col + count,
        );
        break;
    }

    const newCursorResult = CellAddress.create(newRow, newCol);
    if (!newCursorResult.ok) {
      return { ok: false, error: newCursorResult.error };
    }

    return this.stateMachine.transition({
      type: "UPDATE_CURSOR",
      cursor: newCursorResult.value,
    });
  }

  private handleMoveTo(
    target: string,
    count: number | undefined,
    state: UIState,
  ): Result<UIState> {
    let newRow = state.cursor.row;
    let newCol = state.cursor.col;

    switch (target) {
      case "firstColumn":
        newCol = 0;
        break;
      case "lastColumn":
        newCol = this.viewportManager.getTotalCols() - 1;
        break;
      case "firstRow":
        newRow = count ? count - 1 : 0; // 1-indexed in vim
        break;
      case "lastRow":
        newRow = count
          ? Math.min(count - 1, this.viewportManager.getTotalRows() - 1)
          : this.viewportManager.getTotalRows() - 1;
        break;
    }

    const newCursorResult = CellAddress.create(newRow, newCol);
    if (!newCursorResult.ok) {
      return { ok: false, error: newCursorResult.error };
    }

    return this.stateMachine.transition({
      type: "UPDATE_CURSOR",
      cursor: newCursorResult.value,
    });
  }

  // Cell operations
  private handleCellOperation(
    operation: string,
    _action: VimAction,
    state: UIState,
  ): Result<UIState> {
    // These would interact with the facade to perform actual operations
    const cursor = state.cursor;

    switch (operation) {
      case "delete":
        this.facade.setCellValue(cursor, "");
        this.emit({ type: "cellValueChanged", address: cursor, value: "" });
        break;
      case "change":
        this.facade.setCellValue(cursor, "");
        return this.startEditing("i");
      case "yank": {
        // Store cell value in clipboard
        const cellResult = this.facade.getCell(cursor);
        if (cellResult.ok && cellResult.value) {
          const value = cellResult.value.rawValue?.toString() || "";
          this.vimBehavior.setClipboard(value, "cell");
        }
        break;
      }
      case "paste": {
        const clipboard = this.vimBehavior.getClipboard();
        if (clipboard) {
          this.facade.setCellValue(cursor, clipboard.content);
          this.emit({
            type: "cellValueChanged",
            address: cursor,
            value: clipboard.content,
          });
        }
        break;
      }
    }

    return { ok: true, value: state };
  }

  // Editing helpers
  private startEditing(
    variant?: string,
    initialChar?: string,
  ): Result<UIState> {
    const state = this.stateMachine.getState();
    const cursor = state.cursor;

    // Get current cell value for editing (raw value including formula text)
    const currentValue = this.getCellEditValue(cursor);

    // Map vim variants to proper edit modes
    let editMode: InsertMode | undefined;
    if (variant === "a") {
      editMode = "a";
    } else if (variant === "A") {
      editMode = "A";
    } else if (variant === "I") {
      editMode = "I";
    } else if (variant === "o") {
      editMode = "o";
    } else if (variant === "O") {
      editMode = "O";
    } else if (variant === "i" || variant === "replace") {
      editMode = "i";
    } else if (variant === "normal") {
      // Start in normal mode (no insert mode)
      editMode = undefined;
    }

    // Determine initial value and cursor position
    let value = currentValue;
    let cursorPosition = 0;

    if (variant === "replace") {
      // Replace mode: clear content (used by Enter key)
      value = initialChar || "";
      cursorPosition = initialChar ? 1 : 0;
    } else if (variant === "i" && initialChar) {
      // Direct typing: start with the typed character (replacing content)
      value = initialChar;
      cursorPosition = 1;
    } else if (variant === "i") {
      // 'i' mode without initialChar: preserve content, cursor at beginning
      cursorPosition = 0;
    } else if (variant === "a") {
      // Append mode: keep content and position cursor at end
      cursorPosition = currentValue.length;
    } else if (variant === "A") {
      // Append at end of line
      cursorPosition = currentValue.length;
    } else if (variant === "I") {
      // Insert at beginning
      cursorPosition = 0;
    } else {
      // Default 'i' mode or others: position at beginning
      cursorPosition = 0;
    }

    // Start editing with initial value and cursor position in a single transition
    return this.stateMachine.transition({
      type: "START_EDITING",
      editMode: editMode,
      initialValue: value,
      cursorPosition: cursorPosition,
    });
  }

  // Resize helpers
  private enterResize(
    target: "column" | "row",
    index: number,
  ): Result<UIState> {
    const size =
      target === "column"
        ? this.viewportManager.getColumnWidth(index)
        : this.viewportManager.getRowHeight(index);

    return this.stateMachine.transition({
      type: "ENTER_RESIZE_MODE",
      target,
      index,
      size,
    });
  }

  private handleResize(delta: number, state: UIState): Result<UIState> {
    if (!isResizeMode(state)) {
      return { ok: false, error: "Not in resize mode" };
    }

    const newSize = Math.max(10, state.currentSize + delta); // Minimum size
    if (state.resizeTarget === "column") {
      this.viewportManager.setColumnWidth(state.resizeIndex, newSize);
    } else {
      this.viewportManager.setRowHeight(state.resizeIndex, newSize);
    }

    return this.stateMachine.transition({
      type: "UPDATE_RESIZE_SIZE",
      size: newSize,
    });
  }

  private handleAutoFit(state: UIState): Result<UIState> {
    if (!isResizeMode(state)) {
      return { ok: false, error: "Not in resize mode" };
    }

    // Calculate content size (simplified - real implementation would measure content)
    const autoSize = state.resizeTarget === "column" ? 100 : 25;

    if (state.resizeTarget === "column") {
      this.viewportManager.setColumnWidth(state.resizeIndex, autoSize);
    } else {
      this.viewportManager.setRowHeight(state.resizeIndex, autoSize);
    }

    return this.stateMachine.transition({
      type: "UPDATE_RESIZE_SIZE",
      size: autoSize,
    });
  }

  private handleResizeTargetMove(
    direction: "prev" | "next",
    state: UIState,
  ): Result<UIState> {
    if (!isResizeMode(state)) {
      return { ok: false, error: "Not in resize mode" };
    }

    const maxIndex =
      state.resizeTarget === "column"
        ? this.viewportManager.getTotalCols() - 1
        : this.viewportManager.getTotalRows() - 1;
    const newIndex =
      direction === "next"
        ? Math.min(maxIndex, state.resizeIndex + 1)
        : Math.max(0, state.resizeIndex - 1);

    if (newIndex === state.resizeIndex) {
      return { ok: true, value: state };
    }

    // Get the new size for the target
    const newSize =
      state.resizeTarget === "column"
        ? this.viewportManager.getColumnWidth(newIndex)
        : this.viewportManager.getRowHeight(newIndex);

    // Create a new resize state for the new target
    return {
      ok: true,
      value: createResizeState(
        state.cursor,
        state.viewport,
        state.resizeTarget,
        newIndex,
        newSize,
      ),
    };
  }

  // Cell editing helpers
  private handleCellCursorMove(
    direction: string,
    count: number,
    state: UIState,
  ): Result<UIState> {
    if (!isEditingMode(state)) {
      return { ok: false, error: "Not in editing mode" };
    }

    let newPosition = state.cursorPosition;
    const text = state.editingValue;

    switch (direction) {
      case "left":
        newPosition = Math.max(0, state.cursorPosition - count);
        break;
      case "right":
        newPosition = Math.min(text.length, state.cursorPosition + count);
        break;
      case "start":
        newPosition = 0;
        break;
      case "end":
        newPosition = text.length;
        break;
      // Word movement would be implemented here
    }

    return this.stateMachine.transition({
      type: "UPDATE_EDITING_VALUE",
      value: state.editingValue,
      cursorPosition: newPosition,
    });
  }

  private handleCellTextDelete(
    range: { start: number; end: number },
    state: UIState,
  ): Result<UIState> {
    if (!isEditingMode(state)) {
      return { ok: false, error: "Not in editing mode" };
    }

    const text = state.editingValue;
    const newText = text.slice(0, range.start) + text.slice(range.end);
    const newCursor = range.start;

    return this.stateMachine.transition({
      type: "UPDATE_EDITING_VALUE",
      value: newText,
      cursorPosition: newCursor,
    });
  }

  private handleReplaceFormula(
    newFormula: string,
    newCursorPosition: number,
    state: UIState,
  ): Result<UIState> {
    if (!isEditingMode(state)) {
      return { ok: false, error: "Not in editing mode" };
    }
    return this.stateMachine.transition({
      type: "UPDATE_EDITING_VALUE",
      value: newFormula,
      cursorPosition: newCursorPosition,
    });
  }

  private handleTextInput(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): Result<UIState> {
    if (!isEditingMode(state) || state.cellMode !== "insert") {
      return { ok: false, error: "Not in insert mode" };
    }

    // Handle special keys
    if (meta.key === "backspace") {
      if (state.cursorPosition > 0) {
        const newText =
          state.editingValue.slice(0, state.cursorPosition - 1) +
          state.editingValue.slice(state.cursorPosition);
        return this.stateMachine.transition({
          type: "UPDATE_EDITING_VALUE",
          value: newText,
          cursorPosition: state.cursorPosition - 1,
        });
      }
      return { ok: true, value: state };
    }

    if (meta.key === "delete") {
      if (state.cursorPosition < state.editingValue.length) {
        const newText =
          state.editingValue.slice(0, state.cursorPosition) +
          state.editingValue.slice(state.cursorPosition + 1);
        return this.stateMachine.transition({
          type: "UPDATE_EDITING_VALUE",
          value: newText,
          cursorPosition: state.cursorPosition,
        });
      }
      return { ok: true, value: state };
    }

    if (meta.key === "escape") {
      return this.stateMachine.transition({ type: "EXIT_INSERT_MODE" });
    }

    if (meta.key === "enter" || key === "\r" || key === "\n") {
      // Save the value and exit editing
      const cellResult = this.facade.getCell(state.cursor);
      if (cellResult.ok) {
        this.facade.setCellValue(state.cursor, state.editingValue);
        this.emit({
          type: "cellValueChanged",
          address: state.cursor,
          value: state.editingValue,
        });
      }
      return this.stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });
    }

    // Regular character input
    if (key.length === 1 && !meta.ctrl && !meta.alt) {
      const newText =
        state.editingValue.slice(0, state.cursorPosition) +
        key +
        state.editingValue.slice(state.cursorPosition);
      return this.stateMachine.transition({
        type: "UPDATE_EDITING_VALUE",
        value: newText,
        cursorPosition: state.cursorPosition + 1,
      });
    }

    return { ok: true, value: state };
  }

  // Scrolling and centering
  private handleScroll(direction: string, state: UIState): Result<UIState> {
    const viewport = state.viewport;
    let deltaRows = 0;

    switch (direction) {
      case "up":
        deltaRows = -1;
        break;
      case "down":
        deltaRows = 1;
        break;
      case "pageUp":
        deltaRows = -viewport.rows;
        break;
      case "pageDown":
        deltaRows = viewport.rows;
        break;
      case "halfUp":
        deltaRows = -Math.floor(viewport.rows / 2);
        break;
      case "halfDown":
        deltaRows = Math.floor(viewport.rows / 2);
        break;
    }

    const newStartRow = Math.max(
      0,
      Math.min(
        this.viewportManager.getTotalRows() - viewport.rows,
        viewport.startRow + deltaRows,
      ),
    );

    return this.stateMachine.transition({
      type: "UPDATE_VIEWPORT",
      viewport: { ...viewport, startRow: newStartRow },
    });
  }

  private handleCenter(position: string, state: UIState): Result<UIState> {
    const viewport = state.viewport;
    const cursor = state.cursor;
    let newStartRow = viewport.startRow;

    switch (position) {
      case "center":
        newStartRow = Math.max(0, cursor.row - Math.floor(viewport.rows / 2));
        break;
      case "top":
        newStartRow = cursor.row;
        break;
      case "bottom":
        newStartRow = Math.max(0, cursor.row - viewport.rows + 1);
        break;
    }

    return this.stateMachine.transition({
      type: "UPDATE_VIEWPORT",
      viewport: { ...viewport, startRow: newStartRow },
    });
  }

  // Command execution
  private executeCommand(command: string): void {
    // Remove leading : if present
    const trimmedCommand = command.trim().replace(/^:/, "");

    // Try to parse as bulk command first
    const bulkCommand = this.bulkCommandParser.parse(`:${trimmedCommand}`);

    if (bulkCommand) {
      this.handleBulkCommand(bulkCommand);
      return;
    }

    // Handle reference conversion commands
    if (trimmedCommand === "refrel") {
      this.convertAllReferencesToType("relative");
      return;
    }

    if (trimmedCommand === "refabs") {
      this.convertAllReferencesToType("absolute");
      return;
    }

    if (trimmedCommand === "refmix") {
      this.convertAllReferencesToType("mixed");
      return;
    }

    // Handle structural commands
    const structuralMatch = trimmedCommand.match(
      /^(\d*)?(insert-row|insert-col|delete-row|delete-col)$/,
    );
    if (structuralMatch) {
      const count = structuralMatch[1] ? parseInt(structuralMatch[1], 10) : 1;
      const operation = structuralMatch[2];
      const cursor = this.stateMachine.getState().cursor;

      switch (operation) {
        case "insert-row":
          this.insertRows(cursor.row, count);
          break;
        case "insert-col":
          this.insertColumns(cursor.col, count);
          break;
        case "delete-row":
          this.deleteRows(cursor.row, count);
          break;
        case "delete-col":
          this.deleteColumns(cursor.col, count);
          break;
      }
      return;
    }

    // Handle other vim commands like :w, :q, etc.
    // For now, just emit the event for unhandled commands
    this.emit({ type: "commandExecuted", command });
  }

  private handleBulkCommand(command: ParsedBulkCommand): void {
    const _state = this.stateMachine.getState();

    // Validate command
    const hasSelection = this.hasSelection();
    const validationError = this.bulkCommandParser.validateCommand(
      command,
      hasSelection,
    );

    if (validationError) {
      this.emit({ type: "error", error: validationError });
      return;
    }

    // Start bulk operation
    const result = this.stateMachine.transition({
      type: "START_BULK_OPERATION",
      command,
      affectedCells: this.getAffectedCellCount(command),
    });

    if (!result.ok) {
      console.error("Failed to start bulk operation:", result.error);
      this.emit({ type: "error", error: result.error });
      return;
    }

    // If command requires preview, show it
    if (command.requiresPreview) {
      this.stateMachine.transition({ type: "SHOW_BULK_PREVIEW" });
    } else {
      // Execute immediately for non-preview commands
      this.executeBulkOperation(command);
    }
  }

  private hasSelection(): boolean {
    const state = this.stateMachine.getState();
    return (
      isSpreadsheetVisualMode(state) ||
      (isNavigationMode(state) && state.selection !== undefined)
    );
  }

  private getAffectedCellCount(command: ParsedBulkCommand): number {
    const _state = this.stateMachine.getState();

    // For now, return a placeholder count
    // TODO: Calculate actual affected cells based on selection
    if (this.hasSelection()) {
      return 1; // Placeholder
    }

    // For sheet-wide operations
    if (command.type === "findReplace" && command.options.scope === "sheet") {
      return (
        this.viewportManager.getTotalRows() *
        this.viewportManager.getTotalCols()
      );
    }

    return 0;
  }

  private executeBulkOperation(command: ParsedBulkCommand): void {
    // TODO: Implement actual bulk operation execution
    this.emit({ type: "bulkOperationExecuted", command });

    // Return to navigation mode
    this.stateMachine.transition({ type: "BULK_OPERATION_COMPLETE" });
  }

  // Get command completion for tab completion
  private getCommandCompletion(currentInput: string): string | null {
    const referenceCommands = ["refrel", "refabs", "refmix"];
    // Remove leading : for processing, but keep track if it was there
    const hasColon = currentInput.startsWith(":");
    const cleanInput = currentInput.replace(/^:/, "").trim().toLowerCase();

    if (!cleanInput && !hasColon) {
      return null;
    }

    // Try bulk command completions first
    const bulkCompletions = this.bulkCommandParser.getCompletions(
      `:${cleanInput}`,
    );
    if (bulkCompletions.length > 0) {
      // Keep the : prefix if original input had it
      const cleanedCompletions = bulkCompletions.map((c) =>
        hasColon ? c : c.substring(1),
      );
      if (cleanedCompletions.length === 1) {
        return cleanedCompletions[0];
      }
      // Return the first match for now
      return cleanedCompletions[0];
    }

    // Find commands that start with the current input
    const matches = referenceCommands.filter((cmd) =>
      cmd.startsWith(cleanInput),
    );

    if (matches.length === 1) {
      // Exact match found, complete it (with : prefix if original had it)
      return hasColon ? `:${matches[0]}` : matches[0];
    }

    if (matches.length > 1) {
      // Multiple matches, find the longest common prefix
      let commonPrefix = matches[0];
      for (let i = 1; i < matches.length; i++) {
        let j = 0;
        while (
          j < commonPrefix.length &&
          j < matches[i].length &&
          commonPrefix[j] === matches[i][j]
        ) {
          j++;
        }
        commonPrefix = commonPrefix.substring(0, j);
      }

      // Only return if the common prefix is longer than current input
      if (commonPrefix.length > cleanInput.length) {
        return hasColon ? `:${commonPrefix}` : commonPrefix;
      }
    }

    return null; // No completion found
  }

  // Convert all references in current cell to specified type
  private convertAllReferencesToType(
    targetType: "relative" | "absolute" | "mixed",
  ): void {
    const state = this.stateMachine.getState();

    // Only work if we're in editing mode with a formula
    if (!isEditingMode(state) || !state.editingValue.startsWith("=")) {
      return;
    }

    try {
      const detector = new ReferenceDetector();
      const _adjuster = new ReferenceAdjuster();
      const analysis = detector.analyzeFormula(state.editingValue);

      if (analysis.references.length === 0) {
        return; // No references to convert
      }

      let newFormula = state.editingValue;
      let cursorOffset = 0;

      // Process references from right to left to avoid position shifts
      const sortedRefs = analysis.references.sort(
        (a, b) => b.position - a.position,
      );

      for (const refInfo of sortedRefs) {
        let newRef: CellReference;

        if (targetType === "relative") {
          newRef = {
            ...refInfo.reference,
            columnAbsolute: false,
            rowAbsolute: false,
          };
        } else if (targetType === "absolute") {
          newRef = {
            ...refInfo.reference,
            columnAbsolute: true,
            rowAbsolute: true,
          };
        } else {
          // mixed - alternate between mixed-column and mixed-row
          const isMixedColumn = Math.random() > 0.5; // Could be improved with better logic
          newRef = {
            ...refInfo.reference,
            columnAbsolute: isMixedColumn,
            rowAbsolute: !isMixedColumn,
          };
        }

        // Format the new reference
        const newRefText = this.formatCellReference(newRef);

        // Replace in formula
        const before = newFormula.substring(0, refInfo.position);
        const after = newFormula.substring(refInfo.position + refInfo.length);
        newFormula = before + newRefText + after;

        // Adjust cursor position if needed
        if (state.cursorPosition >= refInfo.position) {
          const lengthDiff = newRefText.length - refInfo.length;
          cursorOffset += lengthDiff;
        }
      }

      // Update the editing state with the new formula
      this.stateMachine.transition({
        type: "UPDATE_EDITING_VALUE",
        value: newFormula,
        cursorPosition: Math.max(0, state.cursorPosition + cursorOffset),
      });
    } catch (error) {
      // If anything fails, just ignore the command
      console.warn("Failed to convert references:", error);
    }
  }

  // Format a cell reference back to string representation
  private formatCellReference(ref: CellReference): string {
    const colStr = this.numberToColumn(ref.column);
    const rowStr = (ref.row + 1).toString(); // Convert 0-based to 1-based

    const col = ref.columnAbsolute ? `$${colStr}` : colStr;
    const row = ref.rowAbsolute ? `$${rowStr}` : rowStr;

    const cellRef = `${col}${row}`;

    return ref.sheet ? `${ref.sheet}!${cellRef}` : cellRef;
  }

  // Convert column number to letter representation (0 = A, 1 = B, etc.)
  private numberToColumn(colNum: number): string {
    let result = "";
    let num = colNum;

    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26) - 1;
      if (num < 0) break;
    }

    return result;
  }

  // Event handling
  private emit(event: ControllerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: (event: ControllerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // Public API
  getState(): Readonly<UIState> {
    return this.stateMachine.getState();
  }

  updateEditingValue(value: string, cursorPosition: number): void {
    const state = this.stateMachine.getState();
    if (isEditingMode(state)) {
      this.stateMachine.transition({
        type: "UPDATE_EDITING_VALUE",
        value: value,
        cursorPosition: cursorPosition,
      });
    }
  }

  getEngine(): SpreadsheetFacade {
    return this.facade;
  }

  // getStructuralUIManager(): StructuralOperationManager {
  //   return this.structuralUIManager;
  // }

  // Save cell and exit editing
  saveAndExitEditing(): Result<UIState> {
    const state = this.stateMachine.getState();
    if (!isEditingMode(state)) {
      return { ok: true, value: state };
    }

    // Save the value
    this.facade.setCellValue(state.cursor, state.editingValue);
    this.emit({
      type: "cellValueChanged",
      address: state.cursor,
      value: state.editingValue,
    });

    // Exit to navigation
    return this.stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });
  }

  // Cancel editing without saving
  cancelEditing(): Result<UIState> {
    return this.stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });
  }

  // Get the display value for a cell (computed value for formulas, raw value otherwise)
  getCellDisplayValue(address: CellAddress): string {
    const cellResult = this.facade.getCell(address);
    if (!cellResult.ok || !cellResult.value) {
      return "";
    }

    const cell = cellResult.value;

    // If the cell has a formula, return the computed value
    if (cell.hasFormula()) {
      const computedValue = cell.computedValue;
      if (cell.hasError()) {
        return cell.displayValue; // This will show #ERROR: ...
      }
      return computedValue !== null && computedValue !== undefined
        ? String(computedValue)
        : "";
    }

    // For non-formula cells, return the raw value
    const rawValue = cell.rawValue;
    return rawValue !== null && rawValue !== undefined ? String(rawValue) : "";
  }

  // Get the edit value for a cell (always the raw value, including formula text)
  getCellEditValue(address: CellAddress): string {
    const cellResult = this.facade.getCell(address);
    if (!cellResult.ok || !cellResult.value) {
      return "";
    }

    const rawValue = cellResult.value.rawValue;
    return rawValue !== null && rawValue !== undefined ? String(rawValue) : "";
  }

  // Spreadsheet visual mode handlers
  private enterSpreadsheetVisual(
    visualMode: SpreadsheetVisualMode,
    state: UIState,
  ): Result<UIState> {
    if (!isNavigationMode(state)) {
      return { ok: false, error: "Can only enter visual mode from navigation" };
    }

    // Create initial selection based on visual mode
    const selection = this.selectionManager.createSelection(
      visualMode,
      state.cursor,
      state.cursor,
    );

    return this.stateMachine.transition({
      type: "ENTER_SPREADSHEET_VISUAL_MODE",
      visualMode,
      selection,
    });
  }

  private extendSelection(
    direction: "up" | "down" | "left" | "right",
    count: number,
    state: UIState,
  ): Result<UIState> {
    if (!isSpreadsheetVisualMode(state)) {
      return { ok: false, error: "Can only extend selection in visual mode" };
    }

    // Calculate new cursor position
    const newCursor = this.calculateNewCursor(state.cursor, direction, count);
    if (!newCursor.ok) {
      return newCursor;
    }

    // Extend the selection to the new cursor position
    const newSelection = this.selectionManager.extendSelection(
      state.selection,
      newCursor.value,
      state.visualMode,
    );

    // Update both cursor and selection
    const cursorResult = this.stateMachine.transition({
      type: "UPDATE_CURSOR",
      cursor: newCursor.value,
    });
    if (!cursorResult.ok) {
      return cursorResult;
    }

    return this.stateMachine.transition({
      type: "UPDATE_SELECTION",
      selection: newSelection,
    });
  }

  private exitSpreadsheetVisual(state: UIState): Result<UIState> {
    if (!isSpreadsheetVisualMode(state)) {
      return { ok: false, error: "Not in spreadsheet visual mode" };
    }

    return this.stateMachine.transition({
      type: "EXIT_SPREADSHEET_VISUAL_MODE",
    });
  }

  private calculateNewCursor(
    currentCursor: CellAddress,
    direction: "up" | "down" | "left" | "right",
    count: number,
  ): Result<CellAddress> {
    let newRow = currentCursor.row;
    let newCol = currentCursor.col;

    switch (direction) {
      case "up":
        newRow = Math.max(0, newRow - count);
        break;
      case "down":
        newRow = Math.min(
          this.viewportManager.getTotalRows() - 1,
          newRow + count,
        );
        break;
      case "left":
        newCol = Math.max(0, newCol - count);
        break;
      case "right":
        newCol = Math.min(
          this.viewportManager.getTotalCols() - 1,
          newCol + count,
        );
        break;
    }

    const newCursor = CellAddress.create(newRow, newCol);
    if (!newCursor.ok) {
      return { ok: false, error: "Invalid cursor position" };
    }

    return newCursor;
  }

  // Public API for selection management
  getCurrentSelection(): Selection | undefined {
    return this.selectionManager.getCurrentSelection(
      this.stateMachine.getState(),
    );
  }

  getSelectionBounds(selection?: Selection) {
    const sel = selection || this.getCurrentSelection();
    if (!sel) {
      return undefined;
    }
    return this.selectionManager.getSelectionBounds(sel);
  }

  getCellsInSelection(
    selection?: Selection,
  ): Iterable<CellAddress> | undefined {
    const sel = selection || this.getCurrentSelection();
    if (!sel) {
      return undefined;
    }
    return this.selectionManager.getCellsInSelection(sel);
  }

  isCellSelected(address: CellAddress, selection?: Selection): boolean {
    const sel = selection || this.getCurrentSelection();
    if (!sel) {
      return false;
    }
    return this.selectionManager.isCellSelected(address, sel);
  }

  // Structural operation handlers
  private handleStructuralInsert(
    action: VimAction,
    state: UIState,
  ): Result<UIState> {
    if (action.type !== "structuralInsert") {
      return { ok: true, value: state };
    }

    const cursor = state.cursor;
    const count = action.count || 1;

    if (action.target === "row") {
      this.insertRows(cursor.row, count);
    } else if (action.target === "column") {
      this.insertColumns(cursor.col, count);
    }

    return { ok: true, value: state };
  }

  private handleStructuralDelete(
    action: VimAction,
    state: UIState,
  ): Result<UIState> {
    if (action.type !== "structuralDelete") {
      return { ok: true, value: state };
    }

    const cursor = state.cursor;
    const count = action.count || 1;

    if (action.target === "row") {
      this.deleteRows(cursor.row, count);
    } else if (action.target === "column") {
      this.deleteColumns(cursor.col, count);
    }

    return { ok: true, value: state };
  }

  // Public API for state access
  getUIState(): UIState {
    return this.stateMachine.getState();
  }

  getCurrentViewport(): UIState["viewport"] {
    return this.stateMachine.getState().viewport;
  }

  // Get the selection manager for direct access (used in tests)
  getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  // Structural operations
  async insertRows(
    beforeRow: number,
    count: number = 1,
  ): Promise<Result<UIState>> {
    const operation: StructuralOperation = {
      type: "insertRow",
      index: beforeRow,
      count,
      timestamp: Date.now(),
      id: `insertRow-${Date.now()}-${Math.random()}`,
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport,
    );

    // Start operation with UI feedback
    await this.structuralManager.startOperation(operation, {
      affectedCells: [],
      formulaUpdates: [],
      warnings: [],
      estimatedTime: 100,
      requiresConfirmation: false,
    });

    try {
      // Execute the actual operation
      const result = await this.structuralEngine.insertRows(beforeRow, count);

      if (!result.ok) {
        this.structuralManager.failOperation(operation, result.error);
        return { ok: false, error: result.error };
      }

      // Update cursor if needed (move down if inserting above current position)
      const state = this.stateMachine.getState();
      if (state.cursor.row >= beforeRow) {
        this.stateMachine.transition({
          type: "UPDATE_CURSOR",
          cursor: { ...state.cursor, row: state.cursor.row + count },
        });
      }

      // Capture state after operation for redo
      const afterState = this.getState();
      const afterSnapshot = this.structuralUndoManager.createSnapshot(
        this.structuralEngine.getGrid(),
        {
          cursor: afterState.cursor,
          selection: undefined,
        },
        afterState.viewport,
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Insert ${count} row${count === 1 ? "" : "s"} at row ${beforeRow + 1}`,
        beforeSnapshot,
        afterSnapshot,
      );

      this.structuralManager.completeOperation([], new Map());
      this.emitUndoRedoStateChanged();

      return { ok: true, value: this.stateMachine.getState() };
    } catch (error) {
      this.structuralManager.failOperation(operation, String(error));
      return { ok: false, error: String(error) };
    }
  }

  async insertColumns(
    beforeCol: number,
    count: number = 1,
  ): Promise<Result<UIState>> {
    const operation: StructuralOperation = {
      type: "insertColumn",
      index: beforeCol,
      count,
      timestamp: Date.now(),
      id: `insertColumn-${Date.now()}-${Math.random()}`,
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport,
    );

    await this.structuralManager.startOperation(operation, {
      affectedCells: [],
      formulaUpdates: [],
      warnings: [],
      estimatedTime: 100,
      requiresConfirmation: false,
    });

    try {
      // Execute the actual operation
      const result = await this.structuralEngine.insertColumns(
        beforeCol,
        count,
      );

      if (!result.ok) {
        this.structuralManager.failOperation(operation, result.error);
        return { ok: false, error: result.error };
      }

      // Update cursor if needed (move right if inserting before current position)
      const state = this.stateMachine.getState();
      if (state.cursor.col >= beforeCol) {
        this.stateMachine.transition({
          type: "UPDATE_CURSOR",
          cursor: { ...state.cursor, col: state.cursor.col + count },
        });
      }

      // Update viewport if inserting columns affects it
      if (state.viewport.startCol >= beforeCol) {
        this.stateMachine.transition({
          type: "UPDATE_VIEWPORT",
          viewport: {
            ...state.viewport,
            startCol: state.viewport.startCol + count,
          },
        });
      }

      // Capture state after operation for redo
      const afterState = this.getState();
      const afterSnapshot = this.structuralUndoManager.createSnapshot(
        this.structuralEngine.getGrid(),
        {
          cursor: afterState.cursor,
          selection: undefined,
        },
        afterState.viewport,
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Insert ${count} column${count === 1 ? "" : "s"} at column ${beforeCol + 1}`,
        beforeSnapshot,
        afterSnapshot,
      );

      this.structuralManager.completeOperation([], new Map());
      this.emitUndoRedoStateChanged();

      return { ok: true, value: this.stateMachine.getState() };
    } catch (error) {
      this.structuralManager.failOperation(operation, String(error));
      return { ok: false, error: String(error) };
    }
  }

  async deleteRows(
    startRow: number,
    count: number = 1,
  ): Promise<Result<UIState>> {
    const operation: StructuralOperation = {
      type: "deleteRow",
      index: startRow,
      count,
      timestamp: Date.now(),
      id: `deleteRow-${Date.now()}-${Math.random()}`,
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport,
    );

    await this.structuralManager.startOperation(operation, {
      affectedCells: [],
      formulaUpdates: [],
      warnings: [],
      estimatedTime: 100,
      requiresConfirmation: count > 5,
    });

    try {
      // Execute the actual operation
      const result = await this.structuralEngine.deleteRows(startRow, count);

      if (!result.ok) {
        this.structuralManager.failOperation(operation, result.error);
        return { ok: false, error: result.error };
      }

      // Update cursor if needed
      const state = this.stateMachine.getState();
      let newCursorRow = state.cursor.row;

      if (state.cursor.row >= startRow + count) {
        // Cursor is below deleted rows, move up
        newCursorRow = state.cursor.row - count;
      } else if (state.cursor.row >= startRow) {
        // Cursor is within deleted rows, move to start of deletion
        newCursorRow = Math.max(0, startRow - 1);
      }

      if (newCursorRow !== state.cursor.row) {
        this.stateMachine.transition({
          type: "UPDATE_CURSOR",
          cursor: { ...state.cursor, row: newCursorRow },
        });
      }

      // Capture state after operation for redo
      const afterState = this.getState();
      const afterSnapshot = this.structuralUndoManager.createSnapshot(
        this.structuralEngine.getGrid(),
        {
          cursor: afterState.cursor,
          selection: undefined,
        },
        afterState.viewport,
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Delete ${count} row${count === 1 ? "" : "s"} starting at row ${startRow + 1}`,
        beforeSnapshot,
        afterSnapshot,
      );

      this.structuralManager.completeOperation([], new Map());
      this.emitUndoRedoStateChanged();

      return { ok: true, value: this.stateMachine.getState() };
    } catch (error) {
      this.structuralManager.failOperation(operation, String(error));
      return { ok: false, error: String(error) };
    }
  }

  async deleteColumns(
    startCol: number,
    count: number = 1,
  ): Promise<Result<UIState>> {
    const operation: StructuralOperation = {
      type: "deleteColumn",
      index: startCol,
      count,
      timestamp: Date.now(),
      id: `deleteColumn-${Date.now()}-${Math.random()}`,
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport,
    );

    await this.structuralManager.startOperation(operation, {
      affectedCells: [],
      formulaUpdates: [],
      warnings: [],
      estimatedTime: 100,
      requiresConfirmation: count > 5,
    });

    try {
      // Execute the actual operation
      const result = await this.structuralEngine.deleteColumns(startCol, count);

      if (!result.ok) {
        this.structuralManager.failOperation(operation, result.error);
        return { ok: false, error: result.error };
      }

      // Update cursor if needed
      const state = this.stateMachine.getState();
      let newCursorCol = state.cursor.col;

      if (state.cursor.col >= startCol + count) {
        // Cursor is to the right of deleted columns, move left
        newCursorCol = state.cursor.col - count;
      } else if (state.cursor.col >= startCol) {
        // Cursor is within deleted columns, move to start of deletion
        newCursorCol = Math.max(0, startCol - 1);
      }

      if (newCursorCol !== state.cursor.col) {
        this.stateMachine.transition({
          type: "UPDATE_CURSOR",
          cursor: { ...state.cursor, col: newCursorCol },
        });
      }

      // Capture state after operation for redo
      const afterState = this.getState();
      const afterSnapshot = this.structuralUndoManager.createSnapshot(
        this.structuralEngine.getGrid(),
        {
          cursor: afterState.cursor,
          selection: undefined,
        },
        afterState.viewport,
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Delete ${count} column${count === 1 ? "" : "s"} starting at column ${startCol + 1}`,
        beforeSnapshot,
        afterSnapshot,
      );

      this.structuralManager.completeOperation([], new Map());
      this.emitUndoRedoStateChanged();

      return { ok: true, value: this.stateMachine.getState() };
    } catch (error) {
      this.structuralManager.failOperation(operation, String(error));
      return { ok: false, error: String(error) };
    }
  }

  // Update cursor position (used in tests)
  updateCursor(cursor: CellAddress): Result<UIState> {
    const state = this.stateMachine.getState();

    // In visual mode, we need to extend the selection
    if (isSpreadsheetVisualMode(state)) {
      const newSelection = this.selectionManager.extendSelection(
        state.selection,
        cursor,
        state.visualMode,
      );

      // Update both cursor and selection
      const cursorResult = this.stateMachine.transition({
        type: "UPDATE_CURSOR",
        cursor,
      });

      if (!cursorResult.ok) {
        return cursorResult;
      }

      return this.stateMachine.transition({
        type: "UPDATE_SELECTION",
        selection: newSelection,
      });
    }

    // Normal cursor update
    return this.stateMachine.transition({
      type: "UPDATE_CURSOR",
      cursor,
    });
  }

  // Undo/Redo methods
  async undo(): Promise<void> {
    try {
      const grid = this.structuralEngine.getGrid();
      const result = await this.structuralUndoManager.undo(grid);

      if (result.ok) {
        const snapshot = result.value;

        // Restore cursor and viewport state if available
        if (snapshot.cursorState) {
          this.stateMachine.transition({
            type: "UPDATE_CURSOR",
            cursor: snapshot.cursorState.cursor,
          });
        }

        if (snapshot.viewportState) {
          this.stateMachine.transition({
            type: "UPDATE_VIEWPORT",
            viewport: snapshot.viewportState,
          });
        }

        this.emit({
          type: "undoCompleted",
          description: "Structural operation undone",
          snapshot,
        });

        this.emitUndoRedoStateChanged();
      } else {
        this.emit({
          type: "error",
          error: result.error,
        });
      }
    } catch (error) {
      this.emit({
        type: "error",
        error: `Undo failed: ${error}`,
      });
    }
  }

  async redo(): Promise<void> {
    try {
      const grid = this.structuralEngine.getGrid();
      const result = await this.structuralUndoManager.redo(grid);

      if (result.ok) {
        const snapshot = result.value;

        // Restore cursor and viewport state if available
        if (snapshot.cursorState) {
          this.stateMachine.transition({
            type: "UPDATE_CURSOR",
            cursor: snapshot.cursorState.cursor,
          });
        }

        if (snapshot.viewportState) {
          this.stateMachine.transition({
            type: "UPDATE_VIEWPORT",
            viewport: snapshot.viewportState,
          });
        }

        this.emit({
          type: "redoCompleted",
          description: "Structural operation redone",
          snapshot,
        });

        this.emitUndoRedoStateChanged();
      } else {
        this.emit({
          type: "error",
          error: result.error,
        });
      }
    } catch (error) {
      this.emit({
        type: "error",
        error: `Redo failed: ${error}`,
      });
    }
  }

  canUndo(): boolean {
    return this.structuralUndoManager.canUndo();
  }

  canRedo(): boolean {
    return this.structuralUndoManager.canRedo();
  }

  getUndoRedoStats(): {
    undoStackSize: number;
    redoStackSize: number;
    maxStackSize: number;
    currentTransactionId?: string;
  } {
    return this.structuralUndoManager.getStats();
  }

  private emitUndoRedoStateChanged(): void {
    this.emit({
      type: "undoRedoStateChanged",
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }

  // Transaction methods for grouping undo/redo operations
  startTransaction(description: string): string {
    const transactionId =
      this.structuralUndoManager.startTransaction(description);
    return transactionId;
  }

  endTransaction(): void {
    this.structuralUndoManager.endTransaction();
    this.emitUndoRedoStateChanged();
  }

  cancelTransaction(): void {
    this.structuralUndoManager.cancelTransaction();
    this.emitUndoRedoStateChanged();
  }

  clearUndoHistory(): void {
    this.structuralUndoManager.clearHistory();
    this.emitUndoRedoStateChanged();
  }

  // Menu event handler
  async handleMenuEvent(event: string): Promise<void> {
    switch (event) {
      case "menu:undo":
        await this.undo();
        break;
      case "menu:redo":
        await this.redo();
        break;
      case "menu:copy":
        this.handleKeyPress("y", {
          key: "y",
          ctrl: false,
          shift: false,
          alt: false,
        });
        break;
      case "menu:paste":
        this.handleKeyPress("p", {
          key: "p",
          ctrl: false,
          shift: false,
          alt: false,
        });
        break;
      case "menu:cut":
        this.handleKeyPress("d", {
          key: "d",
          ctrl: false,
          shift: false,
          alt: false,
        });
        break;
      case "menu:selectAll":
        this.handleKeyPress("a", {
          key: "a",
          ctrl: true,
          shift: false,
          alt: false,
        });
        break;
      default:
        // Handle other menu events if needed
        break;
    }
  }
}
