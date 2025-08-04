import { CellAddress, type SpreadsheetFacade } from "@gridcore/core";
import { CellVimBehavior } from "../behaviors/CellVimBehavior";
import { type ResizeAction, ResizeBehavior } from "../behaviors/ResizeBehavior";
import {
  type KeyMeta,
  type VimAction,
  VimBehavior,
} from "../behaviors/VimBehavior";
import {
  createNavigationState,
  isCommandMode,
  isEditingMode,
  isNavigationMode,
  isResizeMode,
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
  | { type: "error"; error: string };

export class SpreadsheetController {
  private stateMachine: UIStateMachine;
  private vimBehavior: VimBehavior;
  private cellVimBehavior: CellVimBehavior;
  private resizeBehavior: ResizeBehavior;
  private facade: SpreadsheetFacade;
  private viewportManager: ViewportManager;
  private listeners: Array<(event: ControllerEvent) => void> = [];

  constructor(options: SpreadsheetControllerOptions) {
    this.facade = options.facade;
    this.viewportManager = options.viewportManager;

    // Initialize behaviors
    this.vimBehavior = new VimBehavior();
    this.cellVimBehavior = new CellVimBehavior();
    this.resizeBehavior = new ResizeBehavior();

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
      return this.processCellVimAction(action, state);
    } else if (isResizeMode(state)) {
      const action = this.resizeBehavior.handleKey(key, state);
      return this.processResizeAction(action, state);
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
        return this.startEditing(action.editVariant);
      case "enterCommand":
        return this.stateMachine.transition({ type: "ENTER_COMMAND_MODE" });
      case "enterResize":
        return this.enterResize(action.target, action.index);
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
      default:
        return { ok: true, value: state };
    }
  }

  // Process cell vim actions from editing mode
  private processCellVimAction(
    action: VimAction | any,
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
        return this.stateMachine.transition({ type: "EXIT_TO_NAVIGATION" });
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

    if (key === "Enter") {
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
    action: any,
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
  private startEditing(variant?: string): Result<UIState> {
    const state = this.stateMachine.getState();
    const cursor = state.cursor;

    // Get current cell value
    const cellResult = this.facade.getCell(cursor);
    const currentValue =
      cellResult.ok && cellResult.value
        ? cellResult.value.rawValue?.toString() || ""
        : "";

    // Start editing
    const result = this.stateMachine.transition({
      type: "START_EDITING",
      editMode: variant as any,
    });
    if (!result.ok) return result;

    // Update with current cell value
    return this.stateMachine.transition({
      type: "UPDATE_EDITING_VALUE",
      value: currentValue,
      cursorPosition: variant === "a" ? currentValue.length : 0,
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

    return this.enterResize(state.resizeTarget, newIndex);
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
    // This would handle vim commands like :w, :q, etc.
    // For now, just emit the event
    this.emit({ type: "commandExecuted", command });
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

  getEngine(): SpreadsheetFacade {
    return this.facade;
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
}
