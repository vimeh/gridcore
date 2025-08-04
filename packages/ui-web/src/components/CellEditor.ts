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
    // If we have a controller, delegate complex key handling to it
    if (this.controller) {
      // Get the state before handling the key
      const prevState = this.controller.getState();
      
      const result = this.controller.handleKeyPress(event.key, {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
      });

      if (result.ok) {
        event.preventDefault(); // Always prevent default when controller handles the key
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

  private handleInput(_event: Event): void {
    // Input handling is done through the controller in handleKeyDown
    // This method is kept for any browser-specific input events
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
