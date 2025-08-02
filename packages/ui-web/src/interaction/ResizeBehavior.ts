import type { SpreadsheetEngine } from "@gridcore/core";
import type { Viewport } from "../components/Viewport";

export class ResizeBehavior {
  private resizeTarget: { type: "column" | "row"; index: number } | null = null;
  private numberBuffer: string = "";

  constructor(
    private viewport: Viewport,
    private engine: SpreadsheetEngine,
  ) {}

  setTarget(type: "column" | "row", index: number): void {
    this.resizeTarget = { type, index };
    this.numberBuffer = "";
  }

  handleKey(key: string): { handled: boolean; exitMode?: boolean } {
    if (!this.resizeTarget) return { handled: false };

    // Number accumulation
    if (key >= "0" && key <= "9") {
      this.numberBuffer += key;
      return { handled: true };
    }

    const multiplier = this.numberBuffer ? parseInt(this.numberBuffer) : 1;
    this.numberBuffer = "";

    switch (key) {
      case "+":
      case ">":
        this.resize(5 * multiplier);
        return { handled: true };

      case "-":
      case "<":
        this.resize(-5 * multiplier);
        return { handled: true };

      case "=":
        this.autoFit();
        return { handled: true };

      case "Escape":
        return { handled: true, exitMode: true };

      case "h":
      case "l":
        if (this.resizeTarget.type === "column") {
          const delta = key === "h" ? -1 : 1;
          this.resizeTarget.index = Math.max(
            0,
            Math.min(
              this.viewport.getTotalCols() - 1,
              this.resizeTarget.index + delta,
            ),
          );
        }
        return { handled: true };

      case "j":
      case "k":
        if (this.resizeTarget.type === "row") {
          const delta = key === "j" ? 1 : -1;
          this.resizeTarget.index = Math.max(
            0,
            Math.min(
              this.viewport.getTotalRows() - 1,
              this.resizeTarget.index + delta,
            ),
          );
        }
        return { handled: true };

      default:
        return { handled: false };
    }
  }

  private resize(delta: number): void {
    if (!this.resizeTarget) return;

    if (this.resizeTarget.type === "column") {
      const current = this.viewport.getColumnWidth(this.resizeTarget.index);
      this.viewport.setColumnWidth(this.resizeTarget.index, current + delta);
    } else {
      const current = this.viewport.getRowHeight(this.resizeTarget.index);
      this.viewport.setRowHeight(this.resizeTarget.index, current + delta);
    }
  }

  private autoFit(): void {
    if (!this.resizeTarget) return;

    // Calculate content size
    if (this.resizeTarget.type === "column") {
      let maxWidth = 50; // minimum

      // Check all cells in this column
      for (let row = 0; row < this.viewport.getTotalRows(); row++) {
        const cell = this.engine.getCell({ row, col: this.resizeTarget.index });
        if (cell) {
          // Estimate width based on content length
          const content =
            cell.formattedValue || cell.rawValue?.toString() || "";
          const estimatedWidth = content.length * 8 + 20; // rough estimate
          maxWidth = Math.max(maxWidth, estimatedWidth);
        }
      }

      this.viewport.setColumnWidth(
        this.resizeTarget.index,
        Math.min(maxWidth, 300),
      );
    } else {
      // For rows, use a standard height for now
      this.viewport.setRowHeight(this.resizeTarget.index, 25);
    }
  }

  getTarget(): { type: "column" | "row"; index: number } | null {
    return this.resizeTarget;
  }

  clear(): void {
    this.resizeTarget = null;
    this.numberBuffer = "";
  }
}
