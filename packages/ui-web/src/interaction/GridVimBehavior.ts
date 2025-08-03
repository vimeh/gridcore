import type { CellAddress } from "@gridcore/core";
import type { Viewport } from "../components/Viewport";
// CellMode is no longer needed - we'll use string mode names directly
import type { SelectionManager } from "./SelectionManager";

export interface GridVimCallbacks {
  onModeChangeRequest: (mode: string, editMode?: string) => void;
  onRangeSelectionRequest: (anchor: CellAddress, cursor: CellAddress) => void;
  onResizeRequest: (
    type: "column" | "row",
    index: number,
    delta: number,
  ) => void;
  onScrollRequest: (
    direction: "up" | "down" | "left" | "right",
    amount: number,
  ) => void;
  onCellNavigate: (
    direction: "up" | "down" | "left" | "right",
    count: number,
  ) => void;
  onTextChange?: (text: string, cursor: number) => void;
  onCursorMove?: (position: number) => void;
}

export class GridVimBehavior {
  private resizeAccumulator: string = ""; // For number prefixes in resize mode
  private numberBuffer: string = ""; // For count prefixes
  private lastCommand: string = ""; // For command sequences like 'gg', 'zz'
  private commandTimeout: ReturnType<typeof setTimeout> | null = null;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: visualAnchor is reset in reset() method and will be used for visual mode selection anchoring
  private visualAnchor: CellAddress | null = null;

  constructor(
    private callbacks: GridVimCallbacks,
    private getCurrentMode: () => string,
    private selectionManager: SelectionManager,
    private viewport: Viewport,
  ) {}

  handleKey(
    key: string,
    ctrl: boolean = false,
    shift: boolean = false,
  ): boolean {
    const mode = this.getCurrentMode();

    // Clear command timeout if exists
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = null;
    }

    // In resize mode, handle special keys
    if (mode === "resize") {
      return this.handleResizeMode(key, ctrl, shift);
    }

    // In visual modes, handle grid navigation
    if (
      mode === "visual" ||
      mode === "visual-line" ||
      mode === "visual-block"
    ) {
      return this.handleVisualMode(key, ctrl, shift);
    }

    // In normal mode, add grid-specific commands
    if (mode === "normal") {
      return this.handleNormalMode(key, ctrl, shift);
    }

    // Insert mode is handled by text vim behavior
    return false;
  }

  private handleNormalMode(
    key: string,
    ctrl: boolean,
    _shift: boolean,
  ): boolean {
    // Handle number accumulation for counts
    if (
      key >= "0" &&
      key <= "9" &&
      !(key === "0" && this.numberBuffer === "")
    ) {
      this.numberBuffer += key;
      return true;
    }

    const count = this.numberBuffer ? parseInt(this.numberBuffer) : 1;

    // Handle Ctrl+key combinations first
    if (ctrl) {
      this.numberBuffer = "";
      switch (key) {
        case "d":
          this.callbacks.onScrollRequest("down", 0.5);
          return true;
        case "u":
          this.callbacks.onScrollRequest("up", 0.5);
          return true;
        case "f":
          this.callbacks.onScrollRequest("down", 1);
          return true;
        case "b":
          this.callbacks.onScrollRequest("up", 1);
          return true;
        case "e":
          this.callbacks.onScrollRequest("down", 0.1);
          return true;
        case "y":
          this.callbacks.onScrollRequest("up", 0.1);
          return true;
        case "v":
          // Ctrl+v enters visual block mode
          this.callbacks.onModeChangeRequest("visual-block");
          return true;
      }
      return false;
    }

    // Handle command sequences
    switch (key) {
      // Movement commands
      case "h":
        this.numberBuffer = "";
        this.callbacks.onCellNavigate("left", count);
        return true;
      case "j":
        this.numberBuffer = "";
        this.callbacks.onCellNavigate("down", count);
        return true;
      case "k":
        this.numberBuffer = "";
        this.callbacks.onCellNavigate("up", count);
        return true;
      case "l":
        this.numberBuffer = "";
        this.callbacks.onCellNavigate("right", count);
        return true;

      // Visual mode commands
      case "v":
        this.numberBuffer = "";
        this.callbacks.onModeChangeRequest("visual");
        return true;
      case "V":
        this.numberBuffer = "";
        this.callbacks.onModeChangeRequest("visual-line");
        return true;

      // Special navigation
      case "G": {
        this.numberBuffer = "";
        // G goes to last row
        const targetRow = count === 1 ? Number.MAX_SAFE_INTEGER : count - 1;
        const currentCell = this.selectionManager.getActiveCell();
        if (currentCell) {
          this.selectionManager.setActiveCell({
            row: targetRow,
            col: currentCell.col,
          });
        }
        return true;
      }

      case "$": {
        this.numberBuffer = "";
        // $ goes to last column
        const cell = this.selectionManager.getActiveCell();
        if (cell) {
          this.selectionManager.setActiveCell({
            row: cell.row,
            col: Number.MAX_SAFE_INTEGER,
          });
        }
        return true;
      }

      case "0":
        if (this.numberBuffer === "") {
          // 0 goes to first column
          const cell = this.selectionManager.getActiveCell();
          if (cell) {
            this.selectionManager.setActiveCell({ row: cell.row, col: 0 });
          }
          return true;
        }
        return false;

      // Command sequences
      case "g":
        if (this.lastCommand === "g") {
          // gg - go to first row
          this.numberBuffer = "";
          this.lastCommand = "";
          const cell = this.selectionManager.getActiveCell();
          if (cell) {
            this.selectionManager.setActiveCell({ row: 0, col: cell.col });
          }
          return true;
        } else {
          this.lastCommand = "g";
          this.commandTimeout = setTimeout(() => {
            this.lastCommand = "";
          }, 1000);
          return true;
        }

      case "z":
        this.lastCommand = "z";
        this.commandTimeout = setTimeout(() => {
          this.lastCommand = "";
        }, 1000);
        return true;

      case "r":
        if (this.lastCommand === "g") {
          // gr - enter resize mode
          this.numberBuffer = "";
          this.lastCommand = "";
          this.callbacks.onModeChangeRequest("resize");
          return true;
        }
        break;

      // Handle z combinations
      default:
        if (this.lastCommand === "z") {
          this.numberBuffer = "";
          this.lastCommand = "";
          const activeCell = this.selectionManager.getActiveCell();
          if (activeCell) {
            switch (key) {
              case "z":
                this.viewport.scrollToCell(activeCell, "center");
                return true;
              case "t":
                this.viewport.scrollToCell(activeCell, "top");
                return true;
              case "b":
                this.viewport.scrollToCell(activeCell, "bottom");
                return true;
            }
          }
        }
        break;
    }

    this.numberBuffer = "";
    return false;
  }

  private handleVisualMode(
    key: string,
    ctrl: boolean,
    _shift: boolean,
  ): boolean {
    const _mode = this.getCurrentMode();
    const activeCell = this.selectionManager.getActiveCell();

    if (!activeCell) return false;

    // Handle number accumulation
    if (
      key >= "0" &&
      key <= "9" &&
      !(key === "0" && this.numberBuffer === "")
    ) {
      this.numberBuffer += key;
      return true;
    }

    const count = this.numberBuffer ? parseInt(this.numberBuffer) : 1;

    // Exit visual mode
    if (key === "Escape" || (ctrl && key === "[")) {
      this.numberBuffer = "";
      this.callbacks.onModeChangeRequest("normal");
      return true;
    }

    // Movement updates selection
    switch (key) {
      case "h":
        this.numberBuffer = "";
        for (let i = 0; i < count; i++) {
          const newCell = {
            ...activeCell,
            col: Math.max(0, activeCell.col - 1),
          };
          this.selectionManager.updateVisualSelection(newCell);
          this.selectionManager.setActiveCell(newCell);
        }
        return true;

      case "j":
        this.numberBuffer = "";
        for (let i = 0; i < count; i++) {
          const newCell = { ...activeCell, row: activeCell.row + 1 };
          this.selectionManager.updateVisualSelection(newCell);
          this.selectionManager.setActiveCell(newCell);
        }
        return true;

      case "k":
        this.numberBuffer = "";
        for (let i = 0; i < count; i++) {
          const newCell = {
            ...activeCell,
            row: Math.max(0, activeCell.row - 1),
          };
          this.selectionManager.updateVisualSelection(newCell);
          this.selectionManager.setActiveCell(newCell);
        }
        return true;

      case "l":
        this.numberBuffer = "";
        for (let i = 0; i < count; i++) {
          const newCell = { ...activeCell, col: activeCell.col + 1 };
          this.selectionManager.updateVisualSelection(newCell);
          this.selectionManager.setActiveCell(newCell);
        }
        return true;

      case "G": {
        this.numberBuffer = "";
        const targetRow = count === 1 ? Number.MAX_SAFE_INTEGER : count - 1;
        const newCell = { ...activeCell, row: targetRow };
        this.selectionManager.updateVisualSelection(newCell);
        this.selectionManager.setActiveCell(newCell);
        return true;
      }

      case "$": {
        this.numberBuffer = "";
        const endCell = { ...activeCell, col: Number.MAX_SAFE_INTEGER };
        this.selectionManager.updateVisualSelection(endCell);
        this.selectionManager.setActiveCell(endCell);
        return true;
      }

      case "0":
        if (this.numberBuffer === "") {
          const startCell = { ...activeCell, col: 0 };
          this.selectionManager.updateVisualSelection(startCell);
          this.selectionManager.setActiveCell(startCell);
          return true;
        }
        return false;
    }

    this.numberBuffer = "";
    return false;
  }

  private handleResizeMode(
    key: string,
    ctrl: boolean,
    _shift: boolean,
  ): boolean {
    if (key === "Escape" || (ctrl && key === "[")) {
      this.resizeAccumulator = "";
      this.callbacks.onModeChangeRequest("normal");
      return true;
    }

    // Number accumulation
    if (key >= "0" && key <= "9") {
      this.resizeAccumulator += key;
      return true;
    }

    const multiplier = this.resizeAccumulator
      ? parseInt(this.resizeAccumulator)
      : 1;
    this.resizeAccumulator = "";

    const resizeTarget = this.selectionManager.getActiveCell();
    if (!resizeTarget) return false;

    switch (key) {
      case "+":
      case ">":
        this.callbacks.onResizeRequest(
          "column",
          resizeTarget.col,
          5 * multiplier,
        );
        return true;

      case "-":
      case "<":
        this.callbacks.onResizeRequest(
          "column",
          resizeTarget.col,
          -5 * multiplier,
        );
        return true;

      case "=":
        // Auto-fit column
        this.callbacks.onResizeRequest("column", resizeTarget.col, 0); // 0 means auto-fit
        return true;

      case "h":
        // Move to previous column
        if (resizeTarget.col > 0) {
          this.selectionManager.setActiveCell({
            ...resizeTarget,
            col: resizeTarget.col - 1,
          });
        }
        return true;

      case "l":
        // Move to next column
        this.selectionManager.setActiveCell({
          ...resizeTarget,
          col: resizeTarget.col + 1,
        });
        return true;

      case "j":
      case "k":
        // Switch to row resize mode
        if (key === "j") {
          this.callbacks.onResizeRequest(
            "row",
            resizeTarget.row,
            5 * multiplier,
          );
        } else {
          this.callbacks.onResizeRequest(
            "row",
            resizeTarget.row,
            -5 * multiplier,
          );
        }
        return true;
    }

    return false;
  }

  reset(): void {
    this.visualAnchor = null;
    this.resizeAccumulator = "";
    this.numberBuffer = "";
    this.lastCommand = "";
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
      this.commandTimeout = null;
    }
  }
}
