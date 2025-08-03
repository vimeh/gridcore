import type { CellAddress } from "@gridcore/core";
import { KEY_CODES } from "../constants";
import type { Viewport } from "./Viewport";
import { VimBehavior, type VimBehaviorCallbacks } from "../interaction/VimMode";
import type { SpreadsheetStateMachine, SpreadsheetState, InsertMode } from "../state/SpreadsheetStateMachine";

export interface CellEditorCallbacks {
  onCommit: (address: CellAddress, value: string) => void;
  onCancel: () => void;
  onEditEnd?: () => void;
  onEditStart?: () => void;
  onModeChange?: () => void;
}

export interface CellEditorOptions extends CellEditorCallbacks {
  modeStateMachine?: SpreadsheetStateMachine;
}

export class CellEditor {
  private editorDiv: HTMLDivElement;
  private isEditing: boolean = false;
  private currentCell: CellAddress | null = null;
  private vimBehavior: VimBehavior;
  private modeIndicator: HTMLDivElement;
  private blockCursor: HTMLDivElement;
  private ignoreNextBlur: boolean = false;
  private modeStateMachine?: SpreadsheetStateMachine;
  private callbacks: CellEditorCallbacks;
  private unsubscribeModeChange?: () => void;

  constructor(
    private container: HTMLElement,
    private viewport: Viewport,
    options: CellEditorOptions,
  ) {
    this.callbacks = options;
    this.modeStateMachine = options.modeStateMachine;
    
    // Create VimBehavior with callbacks that connect to ModeManager
    const vimCallbacks: VimBehaviorCallbacks = {
      onModeChangeRequest: (mode: CellMode, editMode?: EditMode) => {
        this.handleVimModeChangeRequest(mode, editMode);
      },
      onCursorMove: this.updateCursorPosition.bind(this),
      onTextChange: this.handleTextChange.bind(this),
    };
    
    this.vimBehavior = new VimBehavior(
      vimCallbacks,
      () => this.getCurrentCellMode()
    );
    this.editorDiv = this.createEditor();
    this.modeIndicator = this.createModeIndicator();
    this.blockCursor = this.createBlockCursor();
    this.editorDiv.appendChild(this.blockCursor);
    this.container.appendChild(this.editorDiv);
    this.container.appendChild(this.modeIndicator);
    
    // Subscribe to mode changes if SpreadsheetModeStateMachine is available
    if (this.modeStateMachine) {
      this.unsubscribeModeChange = this.modeStateMachine.subscribe(
        this.handleModeStateChange.bind(this)
      );
    }
  }

  private createEditor(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "cell-editor";
    div.contentEditable = "true";
    div.style.position = "absolute";
    div.style.display = "none";
    div.style.border = "2px solid #0066cc";
    div.style.outline = "none";
    div.style.padding = "0 4px";
    div.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    div.style.fontSize = "13px";
    div.style.lineHeight = "1.5";
    div.style.backgroundColor = "white";
    div.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    div.style.zIndex = "1000";
    div.style.whiteSpace = "pre";
    div.style.overflow = "hidden";

    // Event listeners
    div.addEventListener("keydown", this.handleKeyDown.bind(this));
    div.addEventListener("input", this.handleInput.bind(this));
    div.addEventListener("blur", this.handleBlur.bind(this));
    div.addEventListener("paste", this.handlePaste.bind(this));

    return div;
  }

  private createModeIndicator(): HTMLDivElement {
    const indicator = document.createElement("div");
    indicator.className = "mode-indicator";
    indicator.style.position = "absolute";
    indicator.style.display = "none";
    indicator.style.padding = "2px 6px";
    indicator.style.fontSize = "11px";
    indicator.style.fontWeight = "bold";
    indicator.style.color = "white";
    indicator.style.borderRadius = "3px";
    indicator.style.zIndex = "1001";
    indicator.style.pointerEvents = "none";
    return indicator;
  }

  private createBlockCursor(): HTMLDivElement {
    const cursor = document.createElement("div");
    cursor.className = "block-cursor";
    cursor.style.position = "absolute";
    cursor.style.display = "none";
    cursor.style.top = "0";
    cursor.style.left = "0";
    cursor.style.width = "1ch";
    cursor.style.height = "1.5em";
    cursor.style.backgroundColor = "rgba(0, 0, 0, 0.4)";
    cursor.style.pointerEvents = "none";
    cursor.style.transition = "left 0.1s ease-out";
    cursor.style.zIndex = "1";
    return cursor;
  }

  startEditing(
    cell: CellAddress,
    initialValue: string = "",
    mode: "insert" | "append" | "replace" = "append",
  ): void {
    if (this.isEditing) {
      this.commitEdit();
    }

    this.currentCell = cell;
    this.isEditing = true;

    // Start editing mode in SpreadsheetModeStateMachine with the specified edit mode
    this.modeStateMachine?.transition({ type: "START_EDITING", editMode: mode as InsertMode });

    // Notify that editing has started
    this.callbacks.onEditStart?.();

    const position = this.viewport.getCellPosition(cell);

    // Position the editor
    this.editorDiv.style.left = `${position.x - 2}px`; // Account for border
    this.editorDiv.style.top = `${position.y - 2}px`;
    this.editorDiv.style.width = `${position.width}px`;
    this.editorDiv.style.height = `${position.height}px`;
    this.editorDiv.style.display = "block";

    // Position mode indicator
    this.modeIndicator.style.left = `${position.x}px`;
    this.modeIndicator.style.top = `${position.y + position.height + 4}px`;
    this.modeIndicator.style.display = "block";

    // Set initial text and vim state
    this.editorDiv.textContent = initialValue;
    this.vimBehavior.reset();
    
    // Set text in vim behavior
    this.vimBehavior.setText(initialValue);
    // Start in appropriate mode
    if (mode === "replace") {
      // For replace mode, clear text and start in insert mode
      this.editorDiv.textContent = "";
      this.vimBehavior.setText("", 0);
      this.modeStateMachine?.transition({ type: "ENTER_INSERT_MODE", mode: "replace" });
    } else if (mode === "append") {
      // Set text first, then append mode will move cursor to end
      this.vimBehavior.setText(initialValue, initialValue.length);
      this.modeStateMachine?.transition({ type: "ENTER_INSERT_MODE", mode: "append" });
    } else {
      // For insert mode, enter insert mode at current position
      this.vimBehavior.setText(initialValue, initialValue.length);
      this.modeStateMachine?.transition({ type: "ENTER_INSERT_MODE", mode: "insert" });
    }
    // Focus and set cursor
    this.editorDiv.focus();
    this.updateCursorPosition(this.vimBehavior.getCursor());
  }

  stopEditing(commit: boolean = true): void {
    if (!this.isEditing) return;

    if (commit) {
      this.commitEdit();
    } else {
      this.cancelEdit();
    }
  }

  private commitEdit(): void {
    if (!this.currentCell) return;

    const value = this.editorDiv.textContent || "";
    this.callbacks.onCommit(this.currentCell, value);
    this.modeStateMachine?.transition({ type: "STOP_EDITING" });
    this.hideEditor();
  }

  private cancelEdit(): void {
    this.callbacks.onCancel();
    this.modeStateMachine?.transition({ type: "STOP_EDITING" });
    this.hideEditor();
  }

  private hideEditor(): void {
    this.isEditing = false;
    this.currentCell = null;
    this.editorDiv.style.display = "none";
    this.modeIndicator.style.display = "none";
    this.blockCursor.style.display = "none";
    this.editorDiv.textContent = "";
    this.vimBehavior.reset();

    // Return focus to the main container
    this.callbacks.onEditEnd?.();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const modeBefore = this.getCurrentCellMode();
    
    // Let vim behavior handle the key first
    const handled = this.vimBehavior.handleKey(
      event.key,
      event.ctrlKey || event.metaKey,
      event.shiftKey,
    );

    if (handled) {
      event.preventDefault();

      // Update selection if in visual mode
      const selection = this.vimBehavior.getSelection();
      if (selection) {
        this.setSelection(selection.start, selection.end);
      } else {
        // Clear selection
        const sel = window.getSelection();
        sel?.removeAllRanges();
      }

      return;
    }

    // Get the current mode after vim has processed the key
    const modeAfter = this.getCurrentCellMode();
    // Handle special keys not handled by vim
    if (modeAfter === "normal") {
      // In normal mode, prevent all default behavior except for special keys
      event.preventDefault();

      switch (event.key) {
        case KEY_CODES.ENTER:
          this.commitEdit();
          break;
        case KEY_CODES.ESCAPE:
          // Handle escape through SpreadsheetModeStateMachine
          this.modeStateMachine?.transition({ type: "ESCAPE" });
          break;
      }
    } else if (modeAfter === "insert") {
      switch (event.key) {
        case KEY_CODES.ENTER:
          // In insert mode, Enter should insert a newline, not commit
          // Let the browser handle it naturally
          break;
        case KEY_CODES.TAB:
          event.preventDefault();
          this.commitEdit();
          break;
      }
    }
  }

  private handleInput(event: Event): void {
    // In normal mode, prevent any text changes
    if (this.getCurrentCellMode() === "normal") {
      event.preventDefault();
      // Restore the text to what vim behavior thinks it should be
      const vimText = this.vimBehavior.getText();
      if (this.editorDiv.textContent !== vimText) {
        this.editorDiv.textContent = vimText;
        this.updateCursorPosition(this.vimBehavior.getCursor());
      }
      return;
    }
    
    // Update vim behavior text state
    const text = this.editorDiv.textContent || "";
    const cursorPos = this.getCursorPosition();

    // In insert mode, skip cursor callback to let browser handle cursor naturally
    const skipCursorCallback = this.getCurrentCellMode() === "insert";
    this.vimBehavior.setText(text, cursorPos, skipCursorCallback);
  }

  private handlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    
    if (this.getCurrentCellMode() === "insert") {
      // Insert at current position
      document.execCommand("insertText", false, text);
    }
  }

  private handleBlur(): void {
    // Ignore blur if we're transitioning modes
    if (this.ignoreNextBlur) {
      this.ignoreNextBlur = false;
      return;
    }

    // Delay to allow click events to fire first
    setTimeout(() => {
      if (this.isEditing) {
        this.commitEdit();
      }
    }, 100);
  }

  /**
   * Handle vim behavior mode change requests by delegating to ModeManager
   */
  private handleVimModeChangeRequest(mode: string, editMode?: InsertMode): void {
    if (!this.modeStateMachine) return;
    
    switch (mode) {
      case "normal":
        this.modeStateMachine.transition({ type: "EXIT_INSERT_MODE" });
        break;
      case "insert":
        this.modeStateMachine.transition({ type: "ENTER_INSERT_MODE", mode: editMode });
        break;
      case "visual":
        this.modeStateMachine.transition({ type: "ENTER_VISUAL_MODE", visualType: "character" });
        break;
      case "visual-line":
        this.modeStateMachine.transition({ type: "ENTER_VISUAL_MODE", visualType: "line" });
        break;
    }
  }

  /**
   * Handle mode state changes from ModeManager
   */
  private handleModeStateChange(newState: SpreadsheetState): void {
    // Only handle changes when we're actively editing
    if (!this.isEditing) return;
    
    // Get current mode from state
    let currentMode = "normal";
    if (newState.type === "editing") {
      currentMode = newState.substate.type;
    }
    
    // Update mode indicator
    this.modeIndicator.textContent = currentMode.toUpperCase();
    // Set ignore blur flag when changing contentEditable
    this.ignoreNextBlur = true;
    
    // Update UI based on mode
    switch (currentMode) {
      case "normal":
        this.modeIndicator.style.backgroundColor = "#666";
        this.editorDiv.style.borderColor = "#666";
        // Keep contentEditable true but show block cursor
        this.editorDiv.contentEditable = "true";
        this.blockCursor.style.display = "block";
        this.updateBlockCursorPosition();
        break;
      case "insert":
        this.modeIndicator.style.backgroundColor = "#0066cc";
        this.editorDiv.style.borderColor = "#0066cc";
        // Enable contentEditable in insert mode
        this.editorDiv.contentEditable = "true";
        this.blockCursor.style.display = "none";
        break;
      case "visual":
        this.modeIndicator.style.backgroundColor = "#ff6600";
        this.editorDiv.style.borderColor = "#ff6600";
        // Keep contentEditable true for selection
        this.editorDiv.contentEditable = "true";
        this.blockCursor.style.display = "none";
        break;
    }
    
    // Handle navigation state (exit editing)
    if (newState.type === "navigation") {
      // Editing was stopped externally, hide the editor
      this.hideEditor();
      return;
    }
    
    // Ensure focus is maintained
    setTimeout(() => {
      this.editorDiv.focus();
      this.ignoreNextBlur = false;
    }, 0);

    // Notify mode change for re-rendering
    this.callbacks.onModeChange?.();
  }

  /**
   * Get current cell mode from ModeManager or fallback to normal
   */
  private getCurrentCellMode(): string {
    const state = this.modeStateMachine?.getState();
    if (!state || state.type === "navigation") return "normal";
    return state.substate.type;
  }

  private handleTextChange(text: string, cursor: number): void {
    this.editorDiv.textContent = text;
    this.updateCursorPosition(cursor);
  }

  private updateCursorPosition(position: number): void {
    const text = this.editorDiv.textContent || "";
    const range = document.createRange();
    const sel = window.getSelection();

    if (!this.editorDiv.firstChild) {
      // Create text node if empty
      this.editorDiv.appendChild(document.createTextNode(""));
    }

    const textNode = this.editorDiv.firstChild;
    if (!textNode) return;

    const offset = Math.min(position, text.length);

    range.setStart(textNode, offset);
    range.setEnd(textNode, offset);

    sel?.removeAllRanges();
    sel?.addRange(range);

    // Update block cursor position in normal mode
    if (this.getCurrentCellMode() === "normal") {
      this.updateBlockCursorPosition();
    }
  }

  private updateBlockCursorPosition(): void {
    const text = this.editorDiv.textContent || "";
    const cursor = this.vimBehavior.getCursor();
    
    // In vim, cursor can be on the last character in normal mode
    // Only hide if cursor is past the text when text is empty
    if (text.length === 0) {
      this.blockCursor.style.display = "none";
      return;
    }

    // Calculate position based on character width
    const charWidth = this.getCharWidth();
    // Cursor should be clamped to last character position in normal mode
    const displayCursor = Math.min(cursor, Math.max(0, text.length - 1));
    const left = displayCursor * charWidth;

    this.blockCursor.style.left = `${left}px`;
    this.blockCursor.style.display = "block";
  }

  private getCharWidth(): number {
    // Create a temporary span to measure character width
    const span = document.createElement("span");
    span.style.fontFamily = this.editorDiv.style.fontFamily;
    span.style.fontSize = this.editorDiv.style.fontSize;
    span.style.position = "absolute";
    span.style.visibility = "hidden";
    span.textContent = "M";

    this.editorDiv.appendChild(span);
    const width = span.offsetWidth;
    span.remove();

    return width;
  }

  private setSelection(start: number, end: number): void {
    const text = this.editorDiv.textContent || "";
    const range = document.createRange();
    const sel = window.getSelection();

    if (!this.editorDiv.firstChild) {
      this.editorDiv.appendChild(document.createTextNode(""));
    }

    const textNode = this.editorDiv.firstChild;
    if (!textNode) return;

    const startOffset = Math.min(start, text.length);
    const endOffset = Math.min(end, text.length);

    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);

    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  private getCursorPosition(): number {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;

    const range = sel.getRangeAt(0);
    return range.startOffset;
  }

  updatePosition(): void {
    if (!this.isEditing || !this.currentCell) return;

    const position = this.viewport.getCellPosition(this.currentCell);
    this.editorDiv.style.left = `${position.x - 2}px`;
    this.editorDiv.style.top = `${position.y - 2}px`;

    this.modeIndicator.style.left = `${position.x}px`;
    this.modeIndicator.style.top = `${position.y + position.height + 4}px`;
  }

  isCurrentlyEditing(): boolean {
    return this.isEditing;
  }

  getCurrentCell(): CellAddress | null {
    return this.currentCell;
  }

  destroy(): void {
    // Clean up mode change subscription
    this.unsubscribeModeChange?.();
    
    this.editorDiv.remove();
    this.modeIndicator.remove();
    this.blockCursor.remove();
  }
}
