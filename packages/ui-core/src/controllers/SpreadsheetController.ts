import { CellAddress, type SpreadsheetFacade, StructuralEngine, StructuralUndoManager, type StructuralSnapshot } from "@gridcore/core";
import { CellVimBehavior } from "../behaviors/CellVimBehavior";
import { type ResizeAction, ResizeBehavior } from "../behaviors/ResizeBehavior";
import { StructuralOperationManager, type StructuralUIEvent } from "../behaviors/structural";
import type { CellVimAction } from "../behaviors/VimBehavior";
import {
  type KeyMeta,
  type VimAction,
  VimBehavior,
} from "../behaviors/VimBehavior";
import {
  createNavigationState,
  createResizeState,
  type InsertMode,
  isCommandMode,
  isEditingMode,
  isNavigationMode,
  isResizeMode,
  isInsertMode,
  isDeleteMode,
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
  | { type: "structuralOperationCompleted"; operation: string; count: number; position: number }
  | { type: "structuralOperationFailed"; operation: string; error: string }
  | { type: "structuralUIEvent"; event: StructuralUIEvent }
  | { type: "undoCompleted"; description: string; snapshot: StructuralSnapshot }
  | { type: "redoCompleted"; description: string; snapshot: StructuralSnapshot }
  | { type: "undoRedoStateChanged"; canUndo: boolean; canRedo: boolean };

export class SpreadsheetController {
  private stateMachine: UIStateMachine;
  private vimBehavior: VimBehavior;
  private cellVimBehavior: CellVimBehavior;
  private resizeBehavior: ResizeBehavior;
  private facade: SpreadsheetFacade;
  private viewportManager: ViewportManager;
  private structuralEngine: StructuralEngine;
  private structuralUIManager: StructuralOperationManager;
  private structuralUndoManager: StructuralUndoManager;
  private listeners: Array<(event: ControllerEvent) => void> = [];

  constructor(options: SpreadsheetControllerOptions) {
    this.facade = options.facade;
    this.viewportManager = options.viewportManager;

    // Initialize behaviors
    this.vimBehavior = new VimBehavior();
    this.cellVimBehavior = new CellVimBehavior();
    this.resizeBehavior = new ResizeBehavior();
    
    // Initialize structural engine, UI manager, and undo manager
    this.structuralEngine = new StructuralEngine();
    this.structuralUIManager = new StructuralOperationManager();
    this.structuralUndoManager = new StructuralUndoManager();
    
    // Forward structural UI events to controller listeners
    this.structuralUIManager.subscribe((event: StructuralUIEvent) => {
      this.emit({ type: "structuralUIEvent", event });
    });

    // Initialize state machine
    let initialState = options.initialState;
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
    } else if (isInsertMode(state)) {
      return this.handleInsertMode(key, meta, state);
    } else if (isDeleteMode(state)) {
      return this.handleDeleteMode(key, meta, state);
    }

    return { ok: true, value: state };
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
      case "enterResize":
        return this.enterResize(action.target, action.index);
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
      this.executeCommand(state.commandValue);
      return this.stateMachine.transition({ type: "EXIT_COMMAND_MODE" });
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
    const state = this.stateMachine.getState();
    
    // Parse vim commands for structural operations
    const trimmedCommand = command.trim();
    
    // Handle undo/redo commands
    if (this.handleUndoRedoCommands(trimmedCommand)) {
      return; // Command was handled
    }
    
    // Handle insert/delete commands
    if (this.handleStructuralCommands(trimmedCommand, state)) {
      return; // Command was handled
    }
    
    // Fallback for other commands
    this.emit({ type: "commandExecuted", command });
  }

  private handleUndoRedoCommands(command: string): boolean {
    switch (command) {
      case ":undo":
      case ":u":
        this.undo();
        return true;
      case ":redo":
      case ":r":
        this.redo();
        return true;
      default:
        return false;
    }
  }
  
  private handleStructuralCommands(command: string, state: UIState): boolean {
    const cursor = state.cursor;
    
    // Parse count prefix (e.g., ":5insert-row")
    const countMatch = command.match(/^:?(\d+)?(insert-row|insert-col|delete-row|delete-col)$/);
    if (!countMatch) {
      return false; // Not a structural command
    }
    
    const count = countMatch[1] ? parseInt(countMatch[1], 10) : 1;
    const operation = countMatch[2];
    
    let result: Result<UIState>;
    
    switch (operation) {
      case "insert-row":
        result = this.insertRows(cursor.row, count);
        break;
      case "insert-col":
        result = this.insertColumns(cursor.col, count);
        break;
      case "delete-row":
        result = this.deleteRows(cursor.row, count);
        break;
      case "delete-col":
        result = this.deleteColumns(cursor.col, count);
        break;
      default:
        return false;
    }
    
    if (result.ok) {
      this.emit({ 
        type: "structuralOperationCompleted", 
        operation,
        count,
        position: operation.includes("row") ? cursor.row : cursor.col
      });
    } else {
      this.emit({ 
        type: "structuralOperationFailed", 
        operation,
        error: result.error
      });
    }
    
    return true;
  }

  private handleStructuralInsert(action: any, state: UIState): Result<UIState> {
    const cursor = state.cursor;
    const count = action.count || 1;
    
    let result: Result<UIState>;
    
    if (action.target === "row") {
      const insertIndex = action.position === "before" ? cursor.row : cursor.row + 1;
      result = this.insertRows(insertIndex, count);
    } else if (action.target === "column") {
      const insertIndex = action.position === "before" ? cursor.col : cursor.col + 1;
      result = this.insertColumns(insertIndex, count);
    } else {
      return { ok: false, error: "Invalid structural insert target" };
    }
    
    if (result.ok) {
      this.emit({ 
        type: "structuralOperationCompleted", 
        operation: `insert-${action.target}`,
        count,
        position: action.target === "row" ? cursor.row : cursor.col
      });
    } else {
      this.emit({ 
        type: "structuralOperationFailed", 
        operation: `insert-${action.target}`,
        error: result.error
      });
    }
    
    return result;
  }

  private handleStructuralDelete(action: any, state: UIState): Result<UIState> {
    const cursor = state.cursor;
    const count = action.count || 1;
    
    let result: Result<UIState>;
    
    if (action.target === "row") {
      result = this.deleteRows(cursor.row, count);
    } else if (action.target === "column") {
      result = this.deleteColumns(cursor.col, count);
    } else {
      return { ok: false, error: "Invalid structural delete target" };
    }
    
    if (result.ok) {
      this.emit({ 
        type: "structuralOperationCompleted", 
        operation: `delete-${action.target}`,
        count,
        position: action.target === "row" ? cursor.row : cursor.col
      });
    } else {
      this.emit({ 
        type: "structuralOperationFailed", 
        operation: `delete-${action.target}`,
        error: result.error
      });
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

  getStructuralUIManager(): StructuralOperationManager {
    return this.structuralUIManager;
  }

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

  // Structural operations handlers
  private handleInsertMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): Result<UIState> {
    if (!isInsertMode(state)) {
      return { ok: false, error: "Not in insert mode" };
    }

    if (meta.key === "escape") {
      return this.stateMachine.transition({ type: "EXIT_STRUCTURAL_INSERT_MODE" });
    }

    if (meta.key === "enter" || key === "\r" || key === "\n") {
      // Confirm insert operation
      this.executeInsertOperation(state);
      return this.stateMachine.transition({ type: "EXIT_STRUCTURAL_INSERT_MODE" });
    }

    // Handle count input
    if (key >= "1" && key <= "9" && !meta.ctrl && !meta.alt) {
      const newCount = parseInt(key);
      return this.stateMachine.transition({
        type: "UPDATE_INSERT_COUNT",
        count: newCount,
      });
    }

    return { ok: true, value: state };
  }

  private handleDeleteMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): Result<UIState> {
    if (!isDeleteMode(state)) {
      return { ok: false, error: "Not in delete mode" };
    }

    if (meta.key === "escape") {
      return this.stateMachine.transition({ type: "CANCEL_DELETE" });
    }

    if (key === "y" || key === "Y") {
      // Confirm deletion
      return this.stateMachine.transition({ type: "CONFIRM_DELETE" });
    }

    if (key === "n" || key === "N") {
      // Cancel deletion
      return this.stateMachine.transition({ type: "CANCEL_DELETE" });
    }

    if (meta.key === "enter" || key === "\r" || key === "\n") {
      // Default to confirm on enter
      return this.stateMachine.transition({ type: "CONFIRM_DELETE" });
    }

    return { ok: true, value: state };
  }

  // Structural operation methods
  async insertRows(beforeRow: number, count: number = 1): Promise<Result<UIState>> {
    // Create operation object
    const operation = {
      type: "insertRow" as const,
      index: beforeRow,
      count,
      timestamp: Date.now(),
      id: `insert-row-${Date.now()}-${Math.random()}`
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined, // Could be extended for multi-cell selections
      },
      currentState.viewport
    );

    // Analyze the operation first
    const analysisResult = this.structuralEngine.analyzeStructuralChange(operation);
    if (!analysisResult.ok) {
      this.structuralUIManager.failOperation(analysisResult.error);
      return { ok: false, error: analysisResult.error };
    }

    const analysis = analysisResult.value;

    // Start UI operation (may show confirmation dialog)
    const confirmed = await this.structuralUIManager.startOperation(operation, analysis);
    if (!confirmed) {
      return { ok: true, value: this.getState() }; // User cancelled
    }

    // Execute the actual operation
    const result = this.structuralEngine.insertRows(beforeRow, count);
    
    if (result.ok) {
      const finalAnalysis = result.value;
      
      // Update viewport if needed (rows were inserted before current view)
      const state = this.getState();
      if (beforeRow <= state.viewport.startRow) {
        this.stateMachine.transition({
          type: "UPDATE_VIEWPORT",
          viewport: {
            ...state.viewport,
            startRow: state.viewport.startRow + count
          }
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
        afterState.viewport
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Insert ${count} row${count === 1 ? '' : 's'} at row ${beforeRow + 1}`,
        beforeSnapshot,
        afterSnapshot
      );

      // Complete the UI operation
      this.structuralUIManager.completeOperation(
        finalAnalysis.affectedCells,
        finalAnalysis.formulaUpdates
      );

      // Emit legacy events for backward compatibility
      this.emit({
        type: "commandExecuted",
        command: `insertRows ${beforeRow} ${count}`,
      });

      // Emit undo/redo state change
      this.emitUndoRedoStateChanged();
    } else {
      this.structuralUIManager.failOperation(result.error);
      this.emit({
        type: "error",
        error: `Failed to insert rows: ${result.error}`,
      });
    }

    return { ok: true, value: this.getState() };
  }

  async insertColumns(beforeCol: number, count: number = 1): Promise<Result<UIState>> {
    // Create operation object
    const operation = {
      type: "insertColumn" as const,
      index: beforeCol,
      count,
      timestamp: Date.now(),
      id: `insert-column-${Date.now()}-${Math.random()}`
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport
    );

    // Analyze the operation first
    const analysisResult = this.structuralEngine.analyzeStructuralChange(operation);
    if (!analysisResult.ok) {
      this.structuralUIManager.failOperation(analysisResult.error);
      return { ok: false, error: analysisResult.error };
    }

    const analysis = analysisResult.value;

    // Start UI operation (may show confirmation dialog)
    const confirmed = await this.structuralUIManager.startOperation(operation, analysis);
    if (!confirmed) {
      return { ok: true, value: this.getState() }; // User cancelled
    }

    // Execute the actual operation
    const result = this.structuralEngine.insertColumns(beforeCol, count);
    
    if (result.ok) {
      const finalAnalysis = result.value;
      
      // Update viewport if needed (columns were inserted before current view)
      const state = this.getState();
      if (beforeCol <= state.viewport.startCol) {
        this.stateMachine.transition({
          type: "UPDATE_VIEWPORT",
          viewport: {
            ...state.viewport,
            startCol: state.viewport.startCol + count
          }
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
        afterState.viewport
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Insert ${count} column${count === 1 ? '' : 's'} at column ${beforeCol + 1}`,
        beforeSnapshot,
        afterSnapshot
      );

      // Complete the UI operation
      this.structuralUIManager.completeOperation(
        finalAnalysis.affectedCells,
        finalAnalysis.formulaUpdates
      );

      // Emit legacy events for backward compatibility
      this.emit({
        type: "commandExecuted", 
        command: `insertColumns ${beforeCol} ${count}`,
      });

      // Emit undo/redo state change
      this.emitUndoRedoStateChanged();
    } else {
      this.structuralUIManager.failOperation(result.error);
      this.emit({
        type: "error",
        error: `Failed to insert columns: ${result.error}`,
      });
    }

    return { ok: true, value: this.getState() };
  }

  async deleteRows(startRow: number, count: number = 1): Promise<Result<UIState>> {
    // Create operation object
    const operation = {
      type: "deleteRow" as const,
      index: startRow,
      count,
      timestamp: Date.now(),
      id: `delete-row-${Date.now()}-${Math.random()}`
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport
    );

    // Analyze the operation first
    const analysisResult = this.structuralEngine.analyzeStructuralChange(operation);
    if (!analysisResult.ok) {
      this.structuralUIManager.failOperation(analysisResult.error);
      return { ok: false, error: analysisResult.error };
    }

    const analysis = analysisResult.value;

    // Start UI operation (may show confirmation dialog)
    const confirmed = await this.structuralUIManager.startOperation(operation, analysis);
    if (!confirmed) {
      return { ok: true, value: this.getState() }; // User cancelled
    }

    // Execute the actual operation
    const result = this.structuralEngine.deleteRows(startRow, count);
    
    if (result.ok) {
      const finalAnalysis = result.value;
      
      // Update viewport if needed (rows were deleted before/within current view)
      const state = this.getState();
      if (startRow < state.viewport.startRow + state.viewport.rows) {
        const deletedInView = Math.min(count, Math.max(0, state.viewport.startRow + state.viewport.rows - startRow));
        const deletedBeforeView = Math.min(count, Math.max(0, state.viewport.startRow - startRow));
        
        this.stateMachine.transition({
          type: "UPDATE_VIEWPORT",
          viewport: {
            ...state.viewport,
            startRow: Math.max(0, state.viewport.startRow - deletedBeforeView)
          }
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
        afterState.viewport
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Delete ${count} row${count === 1 ? '' : 's'} starting at row ${startRow + 1}`,
        beforeSnapshot,
        afterSnapshot
      );

      // Complete the UI operation
      this.structuralUIManager.completeOperation(
        finalAnalysis.affectedCells,
        finalAnalysis.formulaUpdates
      );

      // Emit legacy events for backward compatibility
      this.emit({
        type: "commandExecuted",
        command: `deleteRows ${startRow} ${count}`,
      });

      // Emit undo/redo state change
      this.emitUndoRedoStateChanged();
    } else {
      this.structuralUIManager.failOperation(result.error);
      this.emit({
        type: "error",
        error: `Failed to delete rows: ${result.error}`,
      });
    }

    return { ok: true, value: this.getState() };
  }

  async deleteColumns(startCol: number, count: number = 1): Promise<Result<UIState>> {
    // Create operation object
    const operation = {
      type: "deleteColumn" as const,
      index: startCol,
      count,
      timestamp: Date.now(),
      id: `delete-column-${Date.now()}-${Math.random()}`
    };

    // Capture state before operation for undo
    const currentState = this.getState();
    const beforeSnapshot = this.structuralUndoManager.createSnapshot(
      this.structuralEngine.getGrid(),
      {
        cursor: currentState.cursor,
        selection: undefined,
      },
      currentState.viewport
    );

    // Analyze the operation first
    const analysisResult = this.structuralEngine.analyzeStructuralChange(operation);
    if (!analysisResult.ok) {
      this.structuralUIManager.failOperation(analysisResult.error);
      return { ok: false, error: analysisResult.error };
    }

    const analysis = analysisResult.value;

    // Start UI operation (may show confirmation dialog)
    const confirmed = await this.structuralUIManager.startOperation(operation, analysis);
    if (!confirmed) {
      return { ok: true, value: this.getState() }; // User cancelled
    }

    // Execute the actual operation
    const result = this.structuralEngine.deleteColumns(startCol, count);
    
    if (result.ok) {
      const finalAnalysis = result.value;
      
      // Update viewport if needed (columns were deleted before/within current view)
      const state = this.getState();
      if (startCol < state.viewport.startCol + state.viewport.cols) {
        const deletedInView = Math.min(count, Math.max(0, state.viewport.startCol + state.viewport.cols - startCol));
        const deletedBeforeView = Math.min(count, Math.max(0, state.viewport.startCol - startCol));
        
        this.stateMachine.transition({
          type: "UPDATE_VIEWPORT",
          viewport: {
            ...state.viewport,
            startCol: Math.max(0, state.viewport.startCol - deletedBeforeView)
          }
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
        afterState.viewport
      );

      // Record the operation for undo/redo
      this.structuralUndoManager.recordOperation(
        operation.id,
        operation,
        `Delete ${count} column${count === 1 ? '' : 's'} starting at column ${startCol + 1}`,
        beforeSnapshot,
        afterSnapshot
      );

      // Complete the UI operation
      this.structuralUIManager.completeOperation(
        finalAnalysis.affectedCells,
        finalAnalysis.formulaUpdates
      );

      // Emit legacy events for backward compatibility
      this.emit({
        type: "commandExecuted",
        command: `deleteColumns ${startCol} ${count}`,
      });

      // Emit undo/redo state change
      this.emitUndoRedoStateChanged();
    } else {
      this.structuralUIManager.failOperation(result.error);
      this.emit({
        type: "error",
        error: `Failed to delete columns: ${result.error}`,
      });
    }

    return { ok: true, value: this.getState() };
  }

  private executeInsertOperation(state: UIState): void {
    if (!isInsertMode(state)) {
      return;
    }

    if (state.insertType === "row") {
      const insertRow = state.insertPosition === "before" ? state.targetIndex : state.targetIndex + 1;
      this.insertRows(insertRow, state.count);
    } else {
      const insertCol = state.insertPosition === "before" ? state.targetIndex : state.targetIndex + 1;
      this.insertColumns(insertCol, state.count);
    }
  }

  // Helper methods for entering structural modes
  enterInsertRowMode(position: "before" | "after" = "before"): Result<UIState> {
    return this.stateMachine.transition({
      type: "ENTER_STRUCTURAL_INSERT_MODE",
      insertType: "row",
      insertPosition: position,
    });
  }

  enterInsertColumnMode(position: "before" | "after" = "before"): Result<UIState> {
    return this.stateMachine.transition({
      type: "ENTER_STRUCTURAL_INSERT_MODE",
      insertType: "column", 
      insertPosition: position,
    });
  }

  enterDeleteRowMode(selection: number[]): Result<UIState> {
    return this.stateMachine.transition({
      type: "ENTER_DELETE_MODE",
      deleteType: "row",
      selection,
    });
  }

  enterDeleteColumnMode(selection: number[]): Result<UIState> {
    return this.stateMachine.transition({
      type: "ENTER_DELETE_MODE",
      deleteType: "column",
      selection,
    });
  }

  // Undo/Redo Methods

  /**
   * Undo the last structural operation
   */
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

  /**
   * Redo the last undone structural operation
   */
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

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.structuralUndoManager.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.structuralUndoManager.canRedo();
  }

  /**
   * Get undo/redo statistics for debugging
   */
  getUndoRedoStats(): {
    undoStackSize: number;
    redoStackSize: number;
    maxStackSize: number;
    currentTransactionId?: string;
  } {
    return this.structuralUndoManager.getStats();
  }

  /**
   * Start a transaction group for related operations
   */
  startTransaction(description: string): string {
    return this.structuralUndoManager.startTransaction(description);
  }

  /**
   * End the current transaction
   */
  endTransaction(): void {
    this.structuralUndoManager.endTransaction();
    this.emitUndoRedoStateChanged();
  }

  /**
   * Cancel the current transaction
   */
  cancelTransaction(): void {
    this.structuralUndoManager.cancelTransaction();
  }

  /**
   * Clear all undo/redo history
   */
  clearUndoHistory(): void {
    this.structuralUndoManager.clearHistory();
    this.emitUndoRedoStateChanged();
  }

  /**
   * Handle menu events (for integration with menu system)
   */
  handleMenuEvent(eventType: string): void {
    switch (eventType) {
      case "menu:undo":
        this.undo();
        break;
      case "menu:redo":
        this.redo();
        break;
      default:
        // Ignore unknown menu events
        break;
    }
  }

  /**
   * Emit undo/redo state change event
   */
  private emitUndoRedoStateChanged(): void {
    this.emit({
      type: "undoRedoStateChanged",
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }
}
