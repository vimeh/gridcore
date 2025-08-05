import type { CellAddress } from "@gridcore/core";
import type { SpreadsheetController } from "@gridcore/ui-core";
import { KEY_CODES } from "../constants";
import type { Viewport } from "./Viewport";

export interface CellEditorCallbacks {
  onCommit: (address: CellAddress, value: string) => void;
  onCancel: () => void;
  onEditEnd?: () => void;
  onEditStart?: () => void;
  onModeChange?: () => void;
}

export interface CellEditorOptions extends CellEditorCallbacks {
  controller?: SpreadsheetController;
}

export class CellEditor {
  private editorDiv: HTMLDivElement;
  private isEditing: boolean = false;
  private currentCell: CellAddress | null = null;
  private controller?: SpreadsheetController;
  private callbacks: CellEditorCallbacks;
  private ignoreNextBlur: boolean = false;

  constructor(
    private container: HTMLElement,
    private viewport: Viewport,
    options: CellEditorOptions,
  ) {
    this.callbacks = options;
    this.controller = options.controller;

    this.editorDiv = this.createEditor();
    this.container.appendChild(this.editorDiv);
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
    div.addEventListener("beforeinput", this.handleBeforeInput.bind(this));
    div.addEventListener("input", this.handleInput.bind(this));
    div.addEventListener("blur", this.handleBlur.bind(this));
    div.addEventListener("paste", this.handlePaste.bind(this));

    return div;
  }

  startEditing(
    cell: CellAddress,
    initialValue: string = "",
    cursorPosition: number = 0,
  ): void {
    if (this.isEditing) {
      this.commitEdit();
    }

    this.currentCell = cell;
    this.isEditing = true;

    // Notify that editing has started
    this.callbacks.onEditStart?.();

    const position = this.viewport.getCellPosition(cell);

    // Position the editor
    this.editorDiv.style.left = `${position.x - 2}px`; // Account for border
    this.editorDiv.style.top = `${position.y - 2}px`;
    this.editorDiv.style.width = `${position.width}px`;
    this.editorDiv.style.height = `${position.height}px`;
    this.editorDiv.style.display = "block";

    // Set initial text
    console.log(
      "CellEditor.startEditing: Setting initial value:",
      initialValue,
      "at position:",
      cursorPosition,
    );
    this.editorDiv.textContent = initialValue;

    // Focus and set cursor position
    this.editorDiv.focus();
    this.setCursorPosition(cursorPosition);
  }

  stopEditing(commit: boolean = true): void {
    if (!this.isEditing) return;

    if (commit) {
      this.commitEdit();
    } else {
      this.cancelEdit();
    }
  }

  updateContent(content: string, cursorPosition: number): void {
    if (!this.isEditing) return;

    console.log(
      "CellEditor.updateContent: Updating content to:",
      content,
      "at position:",
      cursorPosition,
    );
    this.editorDiv.textContent = content;
    this.setCursorPosition(cursorPosition);
  }

  private commitEdit(): void {
    if (!this.currentCell) return;

    const value = this.editorDiv.textContent || "";
    this.callbacks.onCommit(this.currentCell, value);
    this.hideEditor();
  }

  cancelEdit(): void {
    this.callbacks.onCancel();
    this.hideEditor();
  }

  private hideEditor(): void {
    this.isEditing = false;
    this.currentCell = null;
    this.editorDiv.style.display = "none";
    this.editorDiv.textContent = "";

    // Return focus to the main container
    this.callbacks.onEditEnd?.();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Check if there's a text selection and this is a character input or delete/backspace
    const selection = window.getSelection();
    const hasSelection =
      selection && !selection.isCollapsed && selection.toString().length > 0;
    const isCharInput =
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey;
    const isDeleteKey = event.key === "Delete" || event.key === "Backspace";

    // If there's a selection and user is typing a character or deleting, let browser handle it
    if (hasSelection && (isCharInput || isDeleteKey)) {
      console.log("CellEditor: Letting browser handle input with selection");
      // Stop propagation to prevent KeyboardHandler from also processing this
      event.stopPropagation();
      // Don't prevent default - let browser replace/delete the selection
      return;
    }

    // For normal character input without selection, let browser handle it
    // But only if we're in INSERT mode - in NORMAL mode, let controller handle vim commands
    if (isCharInput && this.controller) {
      const state = this.controller.getState();
      const isInInsertMode =
        state.spreadsheetMode === "editing" && state.cellMode === "insert";

      if (isInInsertMode) {
        console.log(
          "CellEditor: Letting browser handle character input:",
          event.key,
        );
        // Stop propagation but don't prevent default
        event.stopPropagation();
        // Let browser insert the character, then sync in handleInput
        return;
      }
    }

    // If we have a controller, delegate complex key handling to it
    if (this.controller) {
      // Get the state before handling the key
      const _prevState = this.controller.getState();

      const result = this.controller.handleKeyPress(event.key, {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
      });

      if (result.ok) {
        event.preventDefault(); // Always prevent default when controller handles the key
        event.stopPropagation(); // Stop the event from bubbling up to KeyboardHandler
        const state = result.value;

        // Check if we should exit editing
        if (state.spreadsheetMode !== "editing") {
          // Always commit the edit when exiting from editing mode
          // The controller handles saving the value when needed
          this.commitEdit();
          return;
        }

        // Update editor content if it changed
        if (state.editingValue !== this.editorDiv.textContent) {
          this.editorDiv.textContent = state.editingValue;
          this.setCursorPosition(state.cursorPosition);
        }

        // Handle mode change notification
        this.callbacks.onModeChange?.();
      }
      return;
    }

    // Fallback handling without controller
    switch (event.key) {
      case KEY_CODES.ENTER:
        event.preventDefault();
        this.commitEdit();
        break;
      case KEY_CODES.ESCAPE:
        event.preventDefault();
        this.cancelEdit();
        break;
      case KEY_CODES.TAB:
        event.preventDefault();
        this.commitEdit();
        break;
    }
  }

  private handleBeforeInput(_event: InputEvent): void {
    // Allow default browser behavior for text replacement when there's a selection
    if (this.controller && window.getSelection()?.toString()) {
      console.log(
        "CellEditor: Allowing browser to handle selection replacement",
      );
      // Let browser handle selection replacement
      return;
    }
    // Don't prevent default for normal character input
    // The browser will handle the input, then we'll sync with controller in handleInput
    console.log(
      "CellEditor: Allowing browser to handle input, will sync after",
    );
  }

  private handleInput(_event: Event): void {
    // Sync the editor content back to the controller after browser handles input
    if (this.controller) {
      const newText = this.editorDiv.textContent || "";
      const selection = window.getSelection();

      // Calculate cursor position more accurately
      let cursorPosition = 0;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Get cursor position relative to the contentEditable div
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(this.editorDiv);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorPosition = preCaretRange.toString().length;
      }

      console.log("CellEditor: handleInput called, syncing to controller", {
        newText,
        cursorPosition,
      });

      // Update the controller state with the new text and cursor position
      this.controller.updateEditingValue(newText, cursorPosition);
    }
  }

  private handlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    // Always allow paste in the editor
    document.execCommand("insertText", false, text);
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

  private setCursorPosition(position: number): void {
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
  }

  updatePosition(): void {
    if (!this.isEditing || !this.currentCell) return;

    const position = this.viewport.getCellPosition(this.currentCell);
    this.editorDiv.style.left = `${position.x - 2}px`;
    this.editorDiv.style.top = `${position.y - 2}px`;
  }

  isCurrentlyEditing(): boolean {
    return this.isEditing;
  }

  getCurrentCell(): CellAddress | null {
    return this.currentCell;
  }

  destroy(): void {
    this.editorDiv.remove();
  }
}
