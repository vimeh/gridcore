import type { UIState } from "../state/UIState";
import { isEditingMode } from "../state/UIState";
import { ReferenceToggleExtension } from "./extensions/ReferenceToggleExtension";
import type { CellVimAction, KeyMeta } from "./VimBehavior";

interface CellVimInternalState {
  numberBuffer: string;
  commandBuffer: string;
  commandTimeout?: ReturnType<typeof setTimeout>;
  operator?: string;
  operatorPending: boolean;
  textObjectModifier?: string; // 'i' or 'a'
  lastAction?: string; // for repeat (.)
}

export class CellVimBehavior {
  private internalState: CellVimInternalState;
  private referenceExtension: ReferenceToggleExtension;

  constructor() {
    this.internalState = {
      numberBuffer: "",
      commandBuffer: "",
      operatorPending: false,
    };
    this.referenceExtension = new ReferenceToggleExtension();
  }

  handleKeyPress(key: string, meta: KeyMeta, state: UIState): CellVimAction {
    if (!isEditingMode(state)) {
      return { type: "none" };
    }

    // Handle escape
    if (meta.key.toLowerCase() === "escape") {
      return this.handleEscape(state);
    }

    // Check reference extension first (works in all modes)
    const referenceAction = this.referenceExtension.handleKeyPress(
      key,
      meta,
      state,
    );
    if (referenceAction) {
      return referenceAction;
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
    } else if (state.cellMode === "normal") {
      // In normal cell mode, escape exits to navigation
      return { type: "exitEditing" };
    }

    return { type: "none" };
  }

  private handleNormalMode(
    key: string,
    meta: KeyMeta,
    state: UIState,
  ): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    // Handle operator pending state
    if (this.internalState.operatorPending) {
      return this.handleOperatorPending(key, meta, state);
    }

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
      case "e":
        this.clearBuffers();
        return { type: "moveCursor", direction: "wordEnd", count };

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
      case "o":
        // In single-line cell context, just go to end
        this.clearBuffers();
        return { type: "moveCursor", direction: "end" };
      case "O":
        // In single-line cell context, just go to beginning
        this.clearBuffers();
        return { type: "moveCursor", direction: "start" };

      // Visual mode
      case "v":
        this.clearBuffers();
        return { type: "enterVisualMode", visualType: "character" };
      case "V":
        this.clearBuffers();
        return { type: "enterVisualMode", visualType: "line" };

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
      case "y":
        this.internalState.operator = key;
        this.internalState.operatorPending = true;
        return { type: "none" };

      // Reference navigation (bracket commands)
      case "[":
      case "]":
        this.internalState.commandBuffer = key;
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
    _meta: KeyMeta,
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

      // Exit visual mode
      case "i":
        this.clearBuffers();
        return { type: "exitVisualMode" };

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

  private handleOperatorPending(
    key: string,
    _meta: KeyMeta,
    state: UIState,
  ): CellVimAction {
    const operator = this.internalState.operator;
    if (!operator || !isEditingMode(state)) {
      this.internalState.operatorPending = false;
      return { type: "none" };
    }

    // Handle double operators (dd, cc, yy)
    if (key === operator) {
      this.clearBuffers();
      this.internalState.operatorPending = false;

      switch (operator) {
        case "d":
          return {
            type: "deleteText",
            range: { start: 0, end: state.editingValue.length },
          };
        case "c":
          // Will delete all and UI should enter insert mode
          return {
            type: "deleteText",
            range: { start: 0, end: state.editingValue.length },
          };
        case "y":
          // Would copy to clipboard in real implementation
          return { type: "none" };
      }
    }

    // Text objects
    if (key === "i" || key === "a") {
      // Store modifier and wait for text object
      this.internalState.textObjectModifier = key;
      return { type: "none" };
    }

    // Check if we're waiting for text object
    if (this.internalState.textObjectModifier) {
      const handled = this.handleTextObject(
        operator,
        this.internalState.textObjectModifier,
        key,
        state,
      );
      this.clearBuffers();
      this.internalState.operatorPending = false;
      return handled;
    }

    // Handle motion after operator
    const count = this.getCount();
    const motion = this.getMotionFromOperator(operator, key, state, count);

    this.clearBuffers();
    this.internalState.operatorPending = false;

    return motion;
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

    // Handle reference navigation commands
    if (command === "[r") {
      return this.handlePreviousReference(state);
    }
    if (command === "]r") {
      return this.handleNextReference(state);
    }

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

  private getMotionFromOperator(
    operator: string,
    motion: string,
    state: UIState,
    count: number,
  ): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    const pos = state.cursorPosition;
    const text = state.editingValue;
    let range: { start: number; end: number } | null = null;

    switch (motion) {
      case "w": {
        let end = pos;
        for (let i = 0; i < count; i++) {
          end = this.findWordBoundary(text, end, true);
        }
        range = { start: pos, end };
        break;
      }
      case "b": {
        let start = pos;
        for (let i = 0; i < count; i++) {
          start = this.findWordBoundary(text, start, false);
        }
        range = { start, end: pos };
        break;
      }
      case "e": {
        let end = pos;
        for (let i = 0; i < count; i++) {
          end = this.findWordEnd(text, end);
        }
        range = { start: pos, end: end + 1 };
        break;
      }
      case "$":
        range = { start: pos, end: text.length };
        break;
      case "0":
        range = { start: 0, end: pos };
        break;
      default:
        return { type: "none" };
    }

    if (!range) return { type: "none" };

    switch (operator) {
      case "d":
      case "c":
        return { type: "deleteText", range };
      case "y":
        // Would copy to clipboard
        return { type: "none" };
      default:
        return { type: "none" };
    }
  }

  private handleTextObject(
    operator: string,
    modifier: string,
    object: string,
    state: UIState,
  ): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    let boundaries: [number, number] | null = null;
    const text = state.editingValue;
    const pos = state.cursorPosition;

    switch (object) {
      case "w":
        boundaries = this.getWordBoundaries(text, pos);
        if (boundaries && modifier === "a") {
          // "a word" includes surrounding whitespace
          let [start, end] = boundaries;
          while (start > 0 && text[start - 1] === " ") start--;
          while (end < text.length - 1 && text[end + 1] === " ") end++;
          boundaries = [start, end];
        }
        break;

      case '"':
      case "'":
      case "`":
        boundaries = this.getQuoteBoundaries(text, pos, object);
        if (boundaries && modifier === "a") {
          // Include the quotes themselves
          boundaries[0]--;
          boundaries[1]++;
        }
        break;

      case "(":
      case ")":
      case "b":
        boundaries = this.getParenBoundaries(text, pos, "(", ")");
        if (boundaries && modifier === "a") {
          // Include the parentheses
          boundaries[0]--;
          boundaries[1]++;
        }
        break;

      case "[":
      case "]":
        boundaries = this.getParenBoundaries(text, pos, "[", "]");
        if (boundaries && modifier === "a") {
          boundaries[0]--;
          boundaries[1]++;
        }
        break;

      case "{":
      case "}":
      case "B":
        boundaries = this.getParenBoundaries(text, pos, "{", "}");
        if (boundaries && modifier === "a") {
          boundaries[0]--;
          boundaries[1]++;
        }
        break;

      case "r":
        // Reference text object
        const refBounds = this.referenceExtension.getReferenceTextObject(
          text,
          pos,
          modifier === "a" // includeSpaces for 'around'
        );
        if (refBounds) {
          boundaries = [refBounds.start, refBounds.end];
        }
        break;

      default:
        return { type: "none" };
    }

    if (!boundaries) return { type: "none" };

    const [start, end] = boundaries;
    const range = { start, end: end + 1 };

    switch (operator) {
      case "d":
      case "c":
        return { type: "deleteText", range };
      case "y":
        // Would copy to clipboard
        return { type: "none" };
      default:
        return { type: "none" };
    }
  }

  private getWordBoundaries(
    text: string,
    pos: number,
  ): [number, number] | null {
    const isWordChar = (ch: string) => /\w/.test(ch);

    if (pos >= text.length) return null;

    // If on whitespace, no word boundaries
    if (!isWordChar(text[pos])) {
      return null;
    }

    let start = pos;
    let end = pos;

    // Find word start
    while (start > 0 && isWordChar(text[start - 1])) start--;

    // Find word end
    while (end < text.length - 1 && isWordChar(text[end + 1])) end++;

    return [start, end];
  }

  private getQuoteBoundaries(
    text: string,
    pos: number,
    quote: string,
  ): [number, number] | null {
    // Find the nearest quote pair that contains the cursor
    let start = -1;
    let end = -1;

    // Look backward for opening quote
    for (let i = pos; i >= 0; i--) {
      if (text[i] === quote) {
        start = i;
        break;
      }
    }

    if (start === -1) return null;

    // Look forward for closing quote
    for (let i = pos; i < text.length; i++) {
      if (text[i] === quote && i > start) {
        end = i;
        break;
      }
    }

    if (end === -1) return null;

    // Return inner boundaries (excluding quotes)
    return [start + 1, end - 1];
  }

  private getParenBoundaries(
    text: string,
    pos: number,
    open: string,
    close: string,
  ): [number, number] | null {
    let depth = 0;
    let start = -1;
    let end = -1;

    // First check if we're inside parentheses by scanning backwards
    for (let i = pos; i >= 0; i--) {
      if (text[i] === close) {
        depth++;
      } else if (text[i] === open) {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }

    if (start === -1) return null;

    // Now find the matching closing paren
    depth = 0;
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === open) {
        depth++;
      } else if (text[i] === close) {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }

    if (end === -1) return null;

    // Return inner boundaries (excluding parens)
    return [start + 1, end - 1];
  }

  private findWordEnd(text: string, position: number): number {
    const isWordChar = (ch: string) => /\w/.test(ch);
    let pos = position;

    // Skip to end of current word
    while (pos < text.length - 1 && isWordChar(text[pos + 1])) pos++;

    return pos;
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
    this.internalState.operatorPending = false;
    this.internalState.textObjectModifier = undefined;
    if (this.internalState.commandTimeout) {
      clearTimeout(this.internalState.commandTimeout);
      this.internalState.commandTimeout = undefined;
    }
  }

  /**
   * Navigate to the previous reference in the formula
   */
  private handlePreviousReference(state: UIState): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    const refInfo = this.referenceExtension.findPreviousReference(
      state.editingValue,
      state.cursorPosition,
    );

    if (refInfo) {
      return { type: "moveCursor", direction: "start" };
      // Note: The actual cursor positioning would need to be handled by the UI layer
      // This follows the existing pattern where movement actions are generic
    }

    return { type: "none" };
  }

  /**
   * Navigate to the next reference in the formula
   */
  private handleNextReference(state: UIState): CellVimAction {
    if (!isEditingMode(state)) return { type: "none" };

    const refInfo = this.referenceExtension.findNextReference(
      state.editingValue,
      state.cursorPosition,
    );

    if (refInfo) {
      return { type: "moveCursor", direction: "end" };
      // Note: The actual cursor positioning would need to be handled by the UI layer
      // This follows the existing pattern where movement actions are generic
    }

    return { type: "none" };
  }

  reset(): void {
    this.clearBuffers();
  }
}
