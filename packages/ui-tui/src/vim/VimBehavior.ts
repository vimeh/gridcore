import type { CellAddress } from "@gridcore/core";
import type { KeyMeta } from "../framework";
import type { Mode, TUIState } from "../SpreadsheetTUI";

export type VimMode = Mode | "operator-pending" | "resize";

export interface VimState {
  mode: VimMode;
  numberBuffer: string;
  commandBuffer: string;
  commandTimeout?: NodeJS.Timeout;
  operator?: string;
  anchor?: CellAddress;
  visualType?: "character" | "line" | "block";
  clipboard?: {
    content: string;
    type: "cell" | "row" | "block";
  };
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
      type: "changeMode";
      mode: VimMode;
      editVariant?: "i" | "a" | "A" | "I" | "o" | "O";
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
  | { type: "resize"; direction: "increase" | "decrease" | "autoFit" }
  | { type: "setAnchor" }
  | { type: "none" };

export class VimBehavior {
  private vimState: VimState;
  private readonly COMMAND_TIMEOUT = 500;

  constructor() {
    this.vimState = {
      mode: "normal",
      numberBuffer: "",
      commandBuffer: "",
    };
  }

  handleKeyPress(key: string, meta: KeyMeta, _tuiState: TUIState): VimAction {
    if (meta.key === "escape") {
      return this.handleEscape();
    }

    switch (this.vimState.mode) {
      case "normal":
        return this.handleNormalMode(key, meta);
      case "visual":
        return this.handleVisualMode(key, meta);
      case "operator-pending":
        return this.handleOperatorPending(key, meta);
      case "resize":
        return this.handleResizeMode(key, meta);
      default:
        return { type: "none" };
    }
  }

  private handleEscape(): VimAction {
    this.clearBuffers();
    this.vimState.mode = "normal";
    this.vimState.operator = undefined;
    this.vimState.anchor = undefined;
    this.vimState.visualType = undefined;
    return { type: "changeMode", mode: "normal" };
  }

  private handleNormalMode(key: string, meta: KeyMeta): VimAction {
    if (/\d/.test(key) && (this.vimState.numberBuffer || key !== "0")) {
      this.vimState.numberBuffer += key;
      return { type: "none" };
    }

    const count = this.getCount();

    if (this.vimState.commandBuffer) {
      this.vimState.commandBuffer += key;
      const action = this.processCommand(this.vimState.commandBuffer, count);
      if (action.type !== "none") {
        this.clearBuffers();
      }
      return action;
    }

    // Handle Ctrl combinations first
    if (meta.ctrl) {
      return this.handleControlKey(key, meta);
    }

    switch (key) {
      case "h":
        this.clearBuffers();
        return { type: "move", direction: "left", count };
      case "j":
        this.clearBuffers();
        return { type: "move", direction: "down", count };
      case "k":
        this.clearBuffers();
        return { type: "move", direction: "up", count };
      case "l":
        this.clearBuffers();
        return { type: "move", direction: "right", count };

      case "0":
        this.clearBuffers();
        return { type: "moveTo", target: "firstColumn" };
      case "$":
        this.clearBuffers();
        return { type: "moveTo", target: "lastColumn" };

      case "i":
        this.clearBuffers();
        return { type: "changeMode", mode: "edit", editVariant: "i" };
      case "a":
        this.clearBuffers();
        return { type: "changeMode", mode: "edit", editVariant: "a" };
      case "A":
        this.clearBuffers();
        return { type: "changeMode", mode: "edit", editVariant: "A" };
      case "I":
        this.clearBuffers();
        return { type: "changeMode", mode: "edit", editVariant: "I" };
      case "o":
        this.clearBuffers();
        return { type: "changeMode", mode: "edit", editVariant: "o" };
      case "O":
        this.clearBuffers();
        return { type: "changeMode", mode: "edit", editVariant: "O" };

      case "v":
        this.clearBuffers();
        this.vimState.mode = "visual";
        this.vimState.visualType = "character";
        return { type: "setAnchor" };
      case "V":
        this.clearBuffers();
        this.vimState.mode = "visual";
        this.vimState.visualType = "line";
        return { type: "setAnchor" };

      case "g":
      case "z":
        this.startCommandBuffer(key);
        return { type: "none" };

      case "d":
      case "c":
      case "y":
        this.startCommandBuffer(key);
        // Immediately set operator-pending mode for single operators
        this.vimState.operator = key;
        this.vimState.mode = "operator-pending";
        return { type: "none" };

      case "G":
        this.clearBuffers();
        return { type: "moveTo", target: "lastRow", count };

      case "w":
        this.clearBuffers();
        return { type: "moveWord", direction: "forward", count };
      case "b":
        this.clearBuffers();
        return { type: "moveWord", direction: "backward", count };
      case "e":
        this.clearBuffers();
        return { type: "moveWord", direction: "end", count };

      case "x":
        this.clearBuffers();
        return { type: "delete" };

      case "p":
        this.clearBuffers();
        return { type: "paste", before: false };
      case "P":
        this.clearBuffers();
        return { type: "paste", before: true };

      default:
        this.clearBuffers();
        return { type: "none" };
    }
  }

  private handleVisualMode(key: string, _meta: KeyMeta): VimAction {
    const count = this.getCount();

    switch (key) {
      case "h":
      case "j":
      case "k":
      case "l": {
        const direction =
          key === "h"
            ? "left"
            : key === "j"
              ? "down"
              : key === "k"
                ? "up"
                : "right";
        this.clearNumberBuffer();
        return { type: "move", direction, count };
      }

      case "d":
      case "x":
        this.clearBuffers();
        this.vimState.mode = "normal";
        return { type: "delete" };

      case "y":
        this.clearBuffers();
        this.vimState.mode = "normal";
        return { type: "yank" };

      case "c":
        this.clearBuffers();
        this.vimState.mode = "edit";
        return { type: "change" };

      default:
        if (/\d/.test(key)) {
          this.vimState.numberBuffer += key;
          return { type: "none" };
        }
        return { type: "none" };
    }
  }

  private handleOperatorPending(key: string, _meta: KeyMeta): VimAction {
    const operator = this.vimState.operator;
    if (!operator) {
      this.vimState.mode = "normal";
      return { type: "none" };
    }

    // Handle double operators (dd, cc, yy)
    if (key === operator) {
      this.vimState.mode = "normal";
      this.vimState.operator = undefined;
      this.clearBuffers();

      switch (operator) {
        case "d":
          return { type: "delete", motion: "line" };
        case "c":
          this.vimState.mode = "edit";
          return { type: "change", motion: "line" };
        case "y":
          return { type: "yank", motion: "line" };
      }
    }

    const motion = key;
    this.vimState.mode = "normal";
    this.vimState.operator = undefined;

    switch (operator) {
      case "d":
        return { type: "delete", motion };
      case "c":
        this.vimState.mode = "edit";
        return { type: "change", motion };
      case "y":
        return { type: "yank", motion };
      default:
        return { type: "none" };
    }
  }

  private handleResizeMode(key: string, _meta: KeyMeta): VimAction {
    switch (key) {
      case "+":
      case ">":
        return { type: "resize", direction: "increase" };
      case "-":
      case "<":
        return { type: "resize", direction: "decrease" };
      case "=":
        return { type: "resize", direction: "autoFit" };
      case "h":
      case "l":
        return { type: "move", direction: key === "h" ? "left" : "right" };
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
        this.vimState.mode = "visual";
        this.vimState.visualType = "block";
        return { type: "setAnchor" };
      default:
        return { type: "none" };
    }
  }

  private processCommand(command: string, _count: number): VimAction {
    switch (command) {
      case "gg":
        return { type: "moveTo", target: "firstRow" };
      case "dd":
        this.vimState.mode = "normal";
        this.vimState.operator = undefined;
        return { type: "delete", motion: "line" };
      case "cc":
        this.vimState.mode = "edit";
        this.vimState.operator = undefined;
        return { type: "change", motion: "line" };
      case "yy":
        this.vimState.mode = "normal";
        this.vimState.operator = undefined;
        return { type: "yank", motion: "line" };
      case "zz":
        return { type: "center", position: "center" };
      case "zt":
        return { type: "center", position: "top" };
      case "zb":
        return { type: "center", position: "bottom" };
      case "gr":
        this.vimState.mode = "resize";
        return { type: "changeMode", mode: "resize" };
      default:
        // Single operators are already handled in handleNormalMode
        return { type: "none" };
    }
  }

  private startCommandBuffer(key: string): void {
    this.vimState.commandBuffer = key;
    if (this.vimState.commandTimeout) {
      clearTimeout(this.vimState.commandTimeout);
    }
    this.vimState.commandTimeout = setTimeout(() => {
      const action = this.processCommand(
        this.vimState.commandBuffer,
        this.getCount(),
      );
      if (action.type === "none" && this.vimState.mode === "operator-pending") {
        // Already handled by processCommand
      } else {
        this.clearBuffers();
      }
    }, this.COMMAND_TIMEOUT);
  }

  private getCount(): number {
    const count = parseInt(this.vimState.numberBuffer, 10);
    return Number.isNaN(count) || count === 0 ? 1 : count;
  }

  private clearBuffers(): void {
    this.clearNumberBuffer();
    this.clearCommandBuffer();
  }

  private clearNumberBuffer(): void {
    this.vimState.numberBuffer = "";
  }

  private clearCommandBuffer(): void {
    this.vimState.commandBuffer = "";
    if (this.vimState.commandTimeout) {
      clearTimeout(this.vimState.commandTimeout);
      this.vimState.commandTimeout = undefined;
    }
  }

  getMode(): VimMode {
    return this.vimState.mode;
  }

  getVimState(): VimState {
    return this.vimState;
  }

  setClipboard(content: string, type: "cell" | "row" | "block"): void {
    this.vimState.clipboard = { content, type };
  }

  getClipboard():
    | { content: string; type: "cell" | "row" | "block" }
    | undefined {
    return this.vimState.clipboard;
  }

  setAnchor(address: CellAddress): void {
    this.vimState.anchor = { ...address };
  }

  getAnchor(): CellAddress | undefined {
    return this.vimState.anchor;
  }

  getVisualType(): "character" | "line" | "block" | undefined {
    return this.vimState.visualType;
  }
}
