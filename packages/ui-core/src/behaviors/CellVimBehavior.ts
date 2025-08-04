import type { CellMode, InsertMode, UIState } from "../state/UIState";
import { isEditingMode } from "../state/UIState";
import type { CellVimAction, KeyMeta } from "./VimBehavior";

interface CellVimInternalState {
  numberBuffer: string;
  commandBuffer: string;
  commandTimeout?: ReturnType<typeof setTimeout>;
  operator?: string;
}

export class CellVimBehavior {
  private internalState: CellVimInternalState;
  private readonly COMMAND_TIMEOUT = 500;

  constructor() {
    this.internalState = {
      numberBuffer: "",
      commandBuffer: "",
    };
  }

  handleKeyPress(key: string, meta: KeyMeta, state: UIState): CellVimAction {
    if (!isEditingMode(state)) {
      return { type: "none" };
    }

    // Handle escape
    if (meta.key === "escape") {
      return this.handleEscape(state);
    }

    // Route based on cell mode
    switch (state.cellMode) {
      case "normal":
        return this.handleNormalMode(key, meta, state);
      case "insert":
        return this.handleInsertMode(key, meta, state);
      case "visual":
        return this.handleVisualMode(key, meta, state);
      default:
        return { type: "none" };
    }
  }

  private handleEscape(state: UIState): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    this.clearBuffers();

    if (state.cellMode === "insert") {
      return { type: "exitInsertMode" };
    } else if (state.cellMode === "visual") {
      return { type: "exitVisualMode" };
    }

    // In normal mode, escape does nothing at cell level
    return { type: "none" };
  }

  private handleNormalMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    // Handle number accumulation
    if (/\d/.test(key) && (this.internalState.numberBuffer || key !== "0")) {
      this.internalState.numberBuffer += key;
      return { type: "none" };
    }

    const count = this.getCount();

    // Handle command buffer
    if (this.internalState.commandBuffer) {
      this.internalState.commandBuffer += key;
      const action = this.processCommand(
        this.internalState.commandBuffer,
        count,
        state,
      );
      if (action.type !== "none") {
        this.clearBuffers();
      }
      return action;
    }

    // Handle Ctrl combinations
    if (meta.ctrl) {
      return this.handleControlKey(key, meta, state);
    }

    // Single key commands
    switch (key) {
      // Movement
      case "h":
        this.clearBuffers();
        return { type: "moveCursor", direction: "left", count };
      case "l":
        this.clearBuffers();
        return { type: "moveCursor", direction: "right", count };
      case "0":
        this.clearBuffers();
        return { type: "moveCursor", direction: "start" };
      case "$":
        this.clearBuffers();
        return { type: "moveCursor", direction: "end" };

      // Word movement
      case "w":
        this.clearBuffers();
        return { type: "moveCursor", direction: "wordForward", count };
      case "b":
        this.clearBuffers();
        return { type: "moveCursor", direction: "wordBackward", count };

      // Insert modes
      case "i":
        this.clearBuffers();
        return { type: "enterInsertMode", variant: "i" };
      case "a":
        this.clearBuffers();
        return { type: "enterInsertMode", variant: "a" };
      case "A":
        this.clearBuffers();
        return { type: "enterInsertMode", variant: "A" };
      case "I":
        this.clearBuffers();
        return { type: "enterInsertMode", variant: "I" };

      // Visual mode
      case "v":
        this.clearBuffers();
        return { type: "enterVisualMode", visualType: "character" };

      // Exit to navigation
      case "Escape":
      case "\x1b":
        this.clearBuffers();
        return { type: "exitEditing" };

      // Delete
      case "x": {
        this.clearBuffers();
        const pos = state.cursorPosition;
        return {
          type: "deleteText",
          range: {
            start: pos,
            end: Math.min(pos + count, state.editingValue.length),
          },
        };
      }

      // Delete/change/yank operators
      case "d":
      case "c":
        this.startCommandBuffer(key);
        this.internalState.operator = key;
        return { type: "none" };

      default:
        this.clearBuffers();
        return { type: "none" };
    }
  }

  private handleInsertMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): CellVimAction {
    if (!isEditingMode(state) || state.cellMode !== "insert")
      return { type: "none" };

    // In insert mode, most keys just insert text
    // Only handle special keys
    if (meta.ctrl) {
      switch (key) {
        case "h": // Backspace
          return {
            type: "deleteText",
            range: {
              start: Math.max(0, state.cursorPosition - 1),
              end: state.cursorPosition,
            },
          };
        case "w": {
          // Delete word backward
          const wordStart = this.findWordBoundary(
            state.editingValue,
            state.cursorPosition,
            false,
          );
          return {
            type: "deleteText",
            range: { start: wordStart, end: state.cursorPosition },
          };
        }
        default:
          return { type: "none" };
      }
    }

    // Regular character insertion is handled by the UI layer
    return { type: "none" };
  }

  private handleVisualMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): CellVimAction {
    if (!isEditingMode(state) || state.cellMode !== "visual")
      return { type: "none" };

    const count = this.getCount();

    switch (key) {
      // Movement extends selection
      case "h":
        this.clearNumberBuffer();
        return { type: "moveCursor", direction: "left", count };
      case "l":
        this.clearNumberBuffer();
        return { type: "moveCursor", direction: "right", count };
      case "0":
        this.clearNumberBuffer();
        return { type: "moveCursor", direction: "start" };
      case "$":
        this.clearNumberBuffer();
        return { type: "moveCursor", direction: "end" };
      case "w":
        this.clearNumberBuffer();
        return { type: "moveCursor", direction: "wordForward", count };
      case "b":
        this.clearNumberBuffer();
        return { type: "moveCursor", direction: "wordBackward", count };

      // Operations on selection
      case "d":
      case "x": {
        this.clearBuffers();
        const start = Math.min(
          state.visualStart ?? state.cursorPosition,
          state.cursorPosition,
        );
        const end = Math.max(
          state.visualStart ?? state.cursorPosition,
          state.cursorPosition,
        );
        return { type: "deleteText", range: { start, end } };
      }

      case "c": {
        this.clearBuffers();
        const start = Math.min(
          state.visualStart ?? state.cursorPosition,
          state.cursorPosition,
        );
        const end = Math.max(
          state.visualStart ?? state.cursorPosition,
          state.cursorPosition,
        );
        // Delete and enter insert mode
        return { type: "deleteText", range: { start, end } };
      }

      default:
        if (/\d/.test(key)) {
          this.internalState.numberBuffer += key;
          return { type: "none" };
        }
        return { type: "none" };
    }
  }

  private handleControlKey(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): CellVimAction {
    if (!meta.ctrl || !isEditingMode(state)) return { type: "none" };

    this.clearBuffers();

    switch (key) {
      case "a": // Beginning of line
        return { type: "moveCursor", direction: "start" };
      case "e": // End of line
        return { type: "moveCursor", direction: "end" };
      default:
        return { type: "none" };
    }
  }

  private processCommand(
    command: string,
    count: number,
    state: UIState,
  ): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    const operator = this.internalState.operator;

    // Handle double operators (dd, cc)
    if (command.length === 2 && command[0] === command[1]) {
      switch (command[0]) {
        case "d":
          // Delete entire line (in cell context, delete all text)
          return {
            type: "deleteText",
            range: { start: 0, end: state.editingValue.length },
          };
        case "c":
          // Change entire line (delete all and enter insert)
          return {
            type: "deleteText",
            range: { start: 0, end: state.editingValue.length },
          };
      }
    }

    // Handle operator + motion
    if (operator && command.length === 2) {
      const motion = command[1];
      switch (operator) {
        case "d":
          return this.getDeleteMotion(motion, state, count);
        case "c":
          return this.getChangeMotion(motion, state, count);
      }
    }

    return { type: "none" };
  }

  private getDeleteMotion(
    motion: string,
    state: UIState,
    count: number,
  ): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    const pos = state.cursorPosition;
    const text = state.editingValue;

    switch (motion) {
      case "w": {
        // Delete to next word
        let end = pos;
        for (let i = 0; i < count; i++) {
          end = this.findWordBoundary(text, end, true);
        }
        return { type: "deleteText", range: { start: pos, end } };
      }
      case "b": {
        // Delete to previous word
        let start = pos;
        for (let i = 0; i < count; i++) {
          start = this.findWordBoundary(text, start, false);
        }
        return { type: "deleteText", range: { start, end: pos } };
      }
      case "$":
        // Delete to end of line
        return { type: "deleteText", range: { start: pos, end: text.length } };
      case "0":
        // Delete to beginning of line
        return { type: "deleteText", range: { start: 0, end: pos } };
      default:
        return { type: "none" };
    }
  }

  private getChangeMotion(
    motion: string,
    state: UIState,
    count: number,
  ): CellVimAction {
    // Change is like delete but we'll let the controller handle entering insert mode
    return this.getDeleteMotion(motion, state, count);
  }

  private findWordBoundary(
    text: string,
    position: number,
    forward: boolean,
  ): number {
    const wordRegex = /\w/;
    let pos = position;

    if (forward) {
      // Skip current word
      while (pos < text.length && wordRegex.test(text[pos])) pos++;
      // Skip whitespace
      while (pos < text.length && !wordRegex.test(text[pos])) pos++;
    } else {
      // Move back one if at boundary
      if (pos > 0) pos--;
      // Skip whitespace
      while (pos > 0 && !wordRegex.test(text[pos])) pos--;
      // Skip to beginning of word
      while (pos > 0 && wordRegex.test(text[pos - 1])) pos--;
    }

    return pos;
  }

  private startCommandBuffer(key: string): void {
    this.internalState.commandBuffer = key;
    if (this.internalState.commandTimeout) {
      clearTimeout(this.internalState.commandTimeout);
    }
    this.internalState.commandTimeout = setTimeout(() => {
      this.clearBuffers();
    }, this.COMMAND_TIMEOUT);
  }

  private getCount(): number {
    const count = parseInt(this.internalState.numberBuffer, 10);
    return Number.isNaN(count) || count === 0 ? 1 : count;
  }

  private clearBuffers(): void {
    this.clearNumberBuffer();
    this.clearCommandBuffer();
  }

  private clearNumberBuffer(): void {
    this.internalState.numberBuffer = "";
  }

  private clearCommandBuffer(): void {
    this.internalState.commandBuffer = "";
    this.internalState.operator = undefined;
    if (this.internalState.commandTimeout) {
      clearTimeout(this.internalState.commandTimeout);
      this.internalState.commandTimeout = undefined;
    }
  }

  reset(): void {
    this.clearBuffers();
  }
}
