import type { CellAddress } from "@gridcore/core";
import type { UIState } from "../state/UIState";
import {
  isEditingMode,
  isNavigationMode,
  isResizeMode,
} from "../state/UIState";

export interface KeyMeta {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export type VimAction =
  | {
      type: "move";
      direction: "up" | "down" | "left" | "right";
      count?: number;
    }
  | {
      type: "moveTo";
      target: "firstColumn" | "lastColumn" | "firstRow" | "lastRow";
      count?: number;
    }
  | {
      type: "moveWord";
      direction: "forward" | "backward" | "end";
      count?: number;
    }
  | {
      type: "startEditing";
      editVariant?: "i" | "a" | "A" | "I" | "o" | "O" | "replace";
      initialChar?: string;
    }
  | {
      type: "exitEditing";
    }
  | {
      type: "enterVisual";
      visualType: "character" | "line" | "block";
    }
  | {
      type: "exitVisual";
    }
  | {
      type: "enterCommand";
    }
  | {
      type: "enterResize";
      target: "column" | "row";
      index: number;
    }
  | {
      type: "exitMode";
    }
  | { type: "delete"; motion?: string }
  | { type: "change"; motion?: string }
  | { type: "yank"; motion?: string }
  | { type: "paste"; before?: boolean }
  | {
      type: "scroll";
      direction: "up" | "down" | "pageUp" | "pageDown" | "halfUp" | "halfDown";
    }
  | { type: "center"; position: "center" | "top" | "bottom" }
  | { type: "resize"; delta: number }
  | { type: "resizeAutoFit" }
  | { type: "setAnchor"; address?: CellAddress }
  | { type: "none" };

// Cell-level vim actions (when editing a cell)
export type CellVimAction =
  | {
      type: "moveCursor";
      direction:
        | "left"
        | "right"
        | "start"
        | "end"
        | "wordForward"
        | "wordBackward";
      count?: number;
    }
  | {
      type: "insertText";
      text: string;
      position?: number;
    }
  | {
      type: "deleteText";
      range: { start: number; end: number };
    }
  | {
      type: "enterInsertMode";
      variant?: "i" | "a" | "A" | "I";
    }
  | {
      type: "exitInsertMode";
    }
  | {
      type: "enterVisualMode";
      visualType: "character" | "line";
    }
  | {
      type: "exitVisualMode";
    }
  | {
      type: "exitEditing";
    }
  | { type: "none" };

interface VimInternalState {
  numberBuffer: string;
  commandBuffer: string;
  commandTimeout?: ReturnType<typeof setTimeout>;
  operator?: string;
  operatorPending: boolean;
  clipboard?: {
    content: string;
    type: "cell" | "row" | "block" | "text";
  };
}

export class VimBehavior {
  private internalState: VimInternalState;
  private readonly COMMAND_TIMEOUT = 500;

  constructor() {
    this.internalState = {
      numberBuffer: "",
      commandBuffer: "",
      operatorPending: false,
    };
  }

  handleKeyPress(key: string, meta: KeyMeta, state: UIState): VimAction {
    // Escape is universal
    if (meta.key === "escape") {
      return this.handleEscape(state);
    }

    // Route to appropriate handler based on state
    if (isNavigationMode(state)) {
      return this.handleNavigationMode(key, meta, state);
    } else if (isEditingMode(state)) {
      // When in editing mode, we're at the cell level
      // This should be handled by CellVimBehavior, not here
      // But we can handle escape to exit editing
      return { type: "exitEditing" };
    } else if (isResizeMode(state)) {
      return this.handleResizeMode(key, meta, state);
    }

    return { type: "none" };
  }

  private handleEscape(state: UIState): VimAction {
    this.clearBuffers();

    if (isEditingMode(state)) {
      return { type: "exitEditing" };
    } else if (isResizeMode(state)) {
      return { type: "exitMode" };
    }

    // Already in navigation
    return { type: "none" };
  }

  private handleNavigationMode(
    key: string,
    meta: KeyMeta,
    _state: UIState,
  ): VimAction {
    // Handle number accumulation (only for pure digits)
    if (/^\d$/.test(key) && (this.internalState.numberBuffer || key !== "0")) {
      this.internalState.numberBuffer += key;
      return { type: "none" };
    }

    const count = this.getCount();

    // Handle command buffer (for multi-key commands)
    if (this.internalState.commandBuffer) {
      this.internalState.commandBuffer += key;
      const action = this.processCommand(
        this.internalState.commandBuffer,
        count,
      );
      if (action.type !== "none") {
        this.clearBuffers();
        return action;
      }
      // If we're in operator pending state and didn't match a command,
      // this might be a motion after the operator
      if (this.internalState.operatorPending) {
        return this.handleOperatorPending(key);
      }
      return action;
    }

    // Handle Ctrl combinations
    if (meta.ctrl) {
      return this.handleControlKey(key, meta);
    }

    // Handle operator pending
    if (this.internalState.operatorPending) {
      return this.handleOperatorPending(key);
    }

    // Single key commands
    switch (key) {
      // Movement (vim keys and arrow keys)
      case "h":
      case "ArrowLeft":
        this.clearBuffers();
        return { type: "move", direction: "left", count };
      case "j":
      case "ArrowDown":
        this.clearBuffers();
        return { type: "move", direction: "down", count };
      case "k":
      case "ArrowUp":
        this.clearBuffers();
        return { type: "move", direction: "up", count };
      case "l":
      case "ArrowRight":
        this.clearBuffers();
        return { type: "move", direction: "right", count };

      case "0":
        this.clearBuffers();
        return { type: "moveTo", target: "firstColumn" };
      case "$":
        this.clearBuffers();
        return { type: "moveTo", target: "lastColumn" };

      // Edit modes
      case "i":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "i" };
      case "a":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "a" };
      case "A":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "A" };
      case "I":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "I" };
      case "o":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "o" };
      case "O":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "O" };

      // Visual modes - these should enter editing mode first, then visual mode
      case "v":
        this.clearBuffers();
        return { type: "enterVisual", visualType: "character" };
      case "V":
        this.clearBuffers();
        return { type: "enterVisual", visualType: "line" };

      // Commands that start multi-key sequences
      case "g":
      case "z":
        this.startCommandBuffer(key);
        return { type: "none" };

      // Operators
      case "d":
      case "c":
      case "y":
        this.clearBuffers();
        this.internalState.operator = key;
        this.internalState.operatorPending = true;
        return { type: "none" };

      case "G":
        this.clearBuffers();
        return { type: "moveTo", target: "lastRow", count };

      // Word movement
      case "w":
        this.clearBuffers();
        return { type: "moveWord", direction: "forward", count };
      case "b":
        this.clearBuffers();
        return { type: "moveWord", direction: "backward", count };
      case "e":
        this.clearBuffers();
        return { type: "moveWord", direction: "end", count };

      // Delete
      case "x":
        this.clearBuffers();
        return { type: "delete" };

      // Paste
      case "p":
        this.clearBuffers();
        return { type: "paste", before: false };
      case "P":
        this.clearBuffers();
        return { type: "paste", before: true };

      // Command mode
      case ":":
        this.clearBuffers();
        return { type: "enterCommand" };

      // Tab navigation
      case "Tab":
        this.clearBuffers();
        if (meta.shift) {
          return { type: "move", direction: "left", count };
        } else {
          return { type: "move", direction: "right", count };
        }

      // Enter key starts editing in replace mode
      case "Enter":
        this.clearBuffers();
        return { type: "startEditing", editVariant: "replace" };

      // Delete/Backspace clear cell content
      case "Delete":
      case "Backspace":
        this.clearBuffers();
        return { type: "delete" };

      default:
        // If it's a printable character (not a special key), start editing with that character
        if (
          key.length === 1 &&
          !meta.ctrl &&
          !meta.alt &&
          /^[^\x00-\x1F\x7F]$/.test(key)
        ) {
          this.clearBuffers();
          return { type: "startEditing", editVariant: "i", initialChar: key };
        }
        this.clearBuffers();
        return { type: "none" };
    }
  }

  private handleResizeMode(
    key: string,
    _meta: KeyMeta,
    state: UIState,
  ): VimAction {
    if (!isResizeMode(state)) return { type: "none" };

    // Handle number accumulation for resize
    if (/\d/.test(key)) {
      this.internalState.numberBuffer += key;
      return { type: "none" };
    }

    const multiplier = this.getCount();
    this.clearBuffers();

    switch (key) {
      case "+":
      case ">":
        return { type: "resize", delta: 5 * multiplier };
      case "-":
      case "<":
        return { type: "resize", delta: -5 * multiplier };
      case "=":
        return { type: "resizeAutoFit" };
      case "h":
      case "l":
        if (state.resizeTarget === "column") {
          return { type: "move", direction: key === "h" ? "left" : "right" };
        }
        return { type: "none" };
      case "j":
      case "k":
        if (state.resizeTarget === "row") {
          return { type: "move", direction: key === "j" ? "down" : "up" };
        }
        return { type: "none" };
      default:
        return { type: "none" };
    }
  }

  private handleControlKey(key: string, meta: KeyMeta): VimAction {
    if (!meta.ctrl) return { type: "none" };

    this.clearBuffers();

    switch (key) {
      case "d":
        return { type: "scroll", direction: "halfDown" };
      case "u":
        return { type: "scroll", direction: "halfUp" };
      case "f":
        return { type: "scroll", direction: "pageDown" };
      case "b":
        return { type: "scroll", direction: "pageUp" };
      case "e":
        return { type: "scroll", direction: "down" };
      case "y":
        return { type: "scroll", direction: "up" };
      case "v":
        return { type: "enterVisual", visualType: "block" };
      default:
        return { type: "none" };
    }
  }

  private handleOperatorPending(key: string): VimAction {
    const operator = this.internalState.operator;
    if (!operator) {
      this.internalState.operatorPending = false;
      return { type: "none" };
    }

    // Handle double operators (dd, cc, yy)
    if (key === operator) {
      this.clearBuffers();
      this.internalState.operatorPending = false;

      switch (operator) {
        case "d":
          return { type: "delete", motion: "line" };
        case "c":
          return { type: "change", motion: "line" };
        case "y":
          return { type: "yank", motion: "line" };
      }
    }

    // Handle motion after operator
    const motion = key;
    this.clearBuffers();
    this.internalState.operatorPending = false;

    switch (operator) {
      case "d":
        return { type: "delete", motion };
      case "c":
        return { type: "change", motion };
      case "y":
        return { type: "yank", motion };
      default:
        return { type: "none" };
    }
  }

  private processCommand(command: string, count: number): VimAction {
    switch (command) {
      case "gg":
        return { type: "moveTo", target: "firstRow", count };
      case "dd":
        return { type: "delete", motion: "line" };
      case "cc":
        return { type: "change", motion: "line" };
      case "yy":
        return { type: "yank", motion: "line" };
      case "zz":
        return { type: "center", position: "center" };
      case "zt":
        return { type: "center", position: "top" };
      case "zb":
        return { type: "center", position: "bottom" };
      case "gr":
        // For resize mode, we need to determine column or row
        // This would be handled by the controller based on cursor position
        return { type: "enterResize", target: "column", index: 0 };
      default:
        // If we have an operator pending and this isn't a recognized command,
        // don't clear the state yet
        if (this.internalState.operatorPending) {
          return { type: "none" };
        }
        return { type: "none" };
    }
  }

  private startCommandBuffer(key: string): void {
    this.internalState.commandBuffer = key;
    if (this.internalState.commandTimeout) {
      clearTimeout(this.internalState.commandTimeout);
    }
    this.internalState.commandTimeout = setTimeout(() => {
      const action = this.processCommand(
        this.internalState.commandBuffer,
        this.getCount(),
      );
      if (action.type === "none" && this.internalState.operatorPending) {
        // Operator is already being handled
      } else {
        this.clearBuffers();
      }
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
    if (this.internalState.commandTimeout) {
      clearTimeout(this.internalState.commandTimeout);
      this.internalState.commandTimeout = undefined;
    }
  }

  setClipboard(content: string, type: "cell" | "row" | "block" | "text"): void {
    this.internalState.clipboard = { content, type };
  }

  getClipboard():
    | { content: string; type: "cell" | "row" | "block" | "text" }
    | undefined {
    return this.internalState.clipboard;
  }

  reset(): void {
    this.clearBuffers();
    this.internalState.operatorPending = false;
    this.internalState.operator = undefined;
  }
}
