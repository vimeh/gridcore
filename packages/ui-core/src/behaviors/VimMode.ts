import { CellAddress } from "@gridcore/core";
import type { UIState } from "../state/UIState";
import { CellVimBehavior } from "./CellVimBehavior";
import type { CellVimAction, KeyMeta } from "./VimBehavior";

export type VimModeType = "normal" | "insert" | "visual" | "visual-line";
export type EditMode = "insert" | "append" | "replace";

export interface VimState {
  mode: VimModeType;
  cursor: number;
  visualStart?: number;
  visualEnd?: number;
  operator?: string; // 'c', 'd', 'y', etc.
  textObjectModifier?: string; // 'i' or 'a'
  count: string; // accumulate count digits
  lastAction?: string; // for repeat (.)
}

export interface VimCallbacks {
  onModeChange?: (mode: VimModeType) => void;
  onCursorMove?: (position: number) => void;
  onTextChange?: (text: string, cursor: number) => void;
}

/**
 * VimMode provides a unified interface for vim-like text editing behavior.
 * It wraps CellVimBehavior and manages state for single-line text editing.
 */
export class VimMode {
  private state: VimState = {
    mode: "normal",
    cursor: 0,
    count: "",
  };

  private text: string = "";
  private callbacks: VimCallbacks;
  private cellVimBehavior: CellVimBehavior;

  constructor(callbacks: VimCallbacks = {}) {
    this.callbacks = callbacks;
    this.cellVimBehavior = new CellVimBehavior();
  }

  setText(
    text: string,
    cursor?: number,
    skipCursorCallback: boolean = false,
  ): void {
    this.text = text;
    if (cursor !== undefined) {
      // In insert mode, cursor can be at text.length (after last character)
      // In normal mode, cursor is clamped to text.length - 1 (on last character)
      const maxCursor =
        this.state.mode === "insert"
          ? text.length
          : Math.max(0, text.length - 1);
      this.state.cursor = Math.min(cursor, maxCursor);
    }
    if (!skipCursorCallback) {
      this.callbacks.onCursorMove?.(this.state.cursor);
    }
  }

  getText(): string {
    return this.text;
  }

  getCursor(): number {
    return this.state.cursor;
  }

  getMode(): VimModeType {
    return this.state.mode;
  }

  handleKey(
    key: string,
    ctrl: boolean = false,
    shift: boolean = false,
  ): boolean {
    // If in insert mode and it's a regular character, handle text insertion
    if (
      this.state.mode === "insert" &&
      !ctrl &&
      key.length === 1 &&
      key !== "Escape"
    ) {
      this.insertText(key);
      return true;
    }

    // Build UIState for CellVimBehavior
    const uiState = this.buildUIState();

    const keyMeta: KeyMeta = {
      key,
      ctrl,
      shift,
      alt: false,
    };

    // Let CellVimBehavior handle the key
    const action = this.cellVimBehavior.handleKeyPress(key, keyMeta, uiState);

    // Process the action
    return this.processAction(action);
  }

  private buildUIState(): UIState {
    // Build a minimal UIState for CellVimBehavior
    const cellMode =
      this.state.mode === "normal"
        ? "normal"
        : this.state.mode === "insert"
          ? "insert"
          : "visual";

    const cursorResult = CellAddress.create(0, 0);
    if (!cursorResult.ok) {
      throw new Error("Failed to create cell address");
    }

    return {
      spreadsheetMode: "editing",
      cursor: cursorResult.value,
      viewport: { startRow: 0, startCol: 0, rows: 20, cols: 10 },
      cellMode,
      editingValue: this.text,
      cursorPosition: this.state.cursor,
      visualStart: this.state.visualStart,
      visualEnd: this.state.visualEnd,
      visualType: this.state.mode === "visual-line" ? "line" : "character",
    } as UIState;
  }

  private processAction(action: CellVimAction): boolean {
    switch (action.type) {
      case "moveCursor":
        this.moveCursor(action.direction, action.count);
        return true;

      case "enterInsertMode":
        this.enterInsertMode(action.variant);
        return true;

      case "exitInsertMode":
        this.setMode("normal");
        // Move cursor back if at end
        if (this.state.cursor > 0 && this.state.cursor === this.text.length) {
          this.state.cursor--;
          this.callbacks.onCursorMove?.(this.state.cursor);
        }
        return true;

      case "enterVisualMode":
        this.state.visualStart = this.state.cursor;
        this.state.visualEnd = this.state.cursor;
        this.setMode(action.visualType === "line" ? "visual-line" : "visual");
        return true;

      case "exitVisualMode":
        this.setMode("normal");
        return true;

      case "deleteText":
        if (action.range) {
          this.deleteText(action.range.start, action.range.end);
        }
        return true;

      case "exitEditing":
        // This would exit to grid navigation in the full system
        // For now, just go to normal mode
        this.setMode("normal");
        return true;

      case "none":
        return false;

      default:
        return false;
    }
  }

  private moveCursor(direction: string, count: number = 1): void {
    let newCursor = this.state.cursor;

    switch (direction) {
      case "left":
        newCursor = Math.max(0, this.state.cursor - count);
        break;
      case "right":
        newCursor = Math.min(this.text.length - 1, this.state.cursor + count);
        break;
      case "start":
        newCursor = 0;
        break;
      case "end":
        newCursor = Math.max(0, this.text.length - 1);
        break;
      case "wordForward":
        for (let i = 0; i < count; i++) {
          newCursor = this.findWordBoundary(newCursor, true);
        }
        break;
      case "wordBackward":
        for (let i = 0; i < count; i++) {
          newCursor = this.findWordBoundary(newCursor, false);
        }
        break;
      case "wordEnd":
        for (let i = 0; i < count; i++) {
          newCursor = this.findWordEnd(newCursor);
        }
        break;
    }

    this.state.cursor = newCursor;
    this.callbacks.onCursorMove?.(this.state.cursor);

    // Update visual selection if in visual mode
    if (this.state.mode === "visual" || this.state.mode === "visual-line") {
      this.state.visualEnd = this.state.cursor;
    }
  }

  private enterInsertMode(variant?: string): void {
    switch (variant) {
      case "a":
        if (this.text.length > 0) {
          this.state.cursor = Math.min(this.state.cursor + 1, this.text.length);
        }
        break;
      case "A":
        this.state.cursor = this.text.length;
        break;
      case "I":
        this.state.cursor = 0;
        break;
      // 'i' doesn't change cursor position
    }

    this.setMode("insert");
    this.callbacks.onCursorMove?.(this.state.cursor);
  }

  private insertText(char: string): void {
    this.text =
      this.text.slice(0, this.state.cursor) +
      char +
      this.text.slice(this.state.cursor);
    this.state.cursor++;
    this.callbacks.onTextChange?.(this.text, this.state.cursor);
    this.callbacks.onCursorMove?.(this.state.cursor);
  }

  private deleteText(start: number, end: number): void {
    this.text = this.text.slice(0, start) + this.text.slice(end);
    this.state.cursor = start;

    // Ensure cursor is within bounds
    if (this.text.length === 0) {
      this.text = "";
      this.state.cursor = 0;
    } else {
      this.state.cursor = Math.min(this.state.cursor, this.text.length - 1);
    }

    this.callbacks.onTextChange?.(this.text, this.state.cursor);
    this.callbacks.onCursorMove?.(this.state.cursor);

    // Exit visual mode after delete
    if (this.state.mode === "visual" || this.state.mode === "visual-line") {
      this.setMode("normal");
    }
  }

  private findWordBoundary(position: number, forward: boolean): number {
    const isWordChar = (ch: string) => /\w/.test(ch);
    let pos = position;

    if (forward) {
      // Skip current word
      while (pos < this.text.length && isWordChar(this.text[pos])) pos++;
      // Skip whitespace
      while (pos < this.text.length && !isWordChar(this.text[pos])) pos++;
      return Math.min(pos, this.text.length - 1);
    } else {
      if (pos > 0) pos--;
      // Skip whitespace
      while (pos > 0 && !isWordChar(this.text[pos])) pos--;
      // Skip to beginning of word
      while (pos > 0 && isWordChar(this.text[pos - 1])) pos--;
      return pos;
    }
  }

  private findWordEnd(position: number): number {
    const isWordChar = (ch: string) => /\w/.test(ch);
    let pos = position;

    // Skip to end of current word
    while (pos < this.text.length - 1 && isWordChar(this.text[pos + 1])) {
      pos++;
    }
    return pos;
  }

  private setMode(mode: VimModeType): void {
    this.state.mode = mode;
    if (mode !== "visual" && mode !== "visual-line") {
      this.state.visualStart = undefined;
      this.state.visualEnd = undefined;
    }
    this.callbacks.onModeChange?.(mode);
  }

  getSelection(): { start: number; end: number } | null {
    if (this.state.mode === "visual" || this.state.mode === "visual-line") {
      const start = Math.min(
        this.state.visualStart ?? 0,
        this.state.visualEnd ?? 0,
      );
      const end = Math.max(
        this.state.visualStart ?? 0,
        this.state.visualEnd ?? 0,
      );
      return { start, end: end + 1 }; // end is inclusive in selection
    }
    return null;
  }

  reset(): void {
    this.state = {
      mode: "normal",
      cursor: 0,
      count: "",
    };
    this.text = "";
    this.cellVimBehavior.reset();
  }
}
