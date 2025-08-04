import type { UIState } from "../state/UIState";
import { isResizeMode } from "../state/UIState";

export type ResizeAction =
  | {
      type: "resize";
      delta: number;
    }
  | {
      type: "autoFit";
    }
  | {
      type: "moveTarget";
      direction: "prev" | "next";
    }
  | {
      type: "cancel";
    }
  | {
      type: "confirm";
    }
  | {
      type: "none";
    };

export class ResizeBehavior {
  private numberBuffer: string = "";

  handleKey(key: string, state: UIState): ResizeAction {
    if (!isResizeMode(state)) {
      return { type: "none" };
    }

    // Handle number accumulation
    if (key >= "0" && key <= "9") {
      this.numberBuffer += key;
      return { type: "none" };
    }

    const multiplier = this.getMultiplier();
    this.clearNumberBuffer();

    switch (key) {
      // Increase size
      case "+":
      case ">":
        return { type: "resize", delta: 5 * multiplier };

      // Decrease size
      case "-":
      case "<":
        return { type: "resize", delta: -5 * multiplier };

      // Auto-fit to content
      case "=":
        return { type: "autoFit" };

      // Navigate to different column/row
      case "h":
      case "l":
        if (state.resizeTarget === "column") {
          return {
            type: "moveTarget",
            direction: key === "h" ? "prev" : "next",
          };
        }
        return { type: "none" };

      case "j":
      case "k":
        if (state.resizeTarget === "row") {
          return {
            type: "moveTarget",
            direction: key === "j" ? "next" : "prev",
          };
        }
        return { type: "none" };

      // Confirm resize
      case "Enter":
        return { type: "confirm" };

      // Cancel resize
      case "Escape":
        return { type: "cancel" };

      default:
        return { type: "none" };
    }
  }

  private getMultiplier(): number {
    const num = parseInt(this.numberBuffer, 10);
    return Number.isNaN(num) || num === 0 ? 1 : num;
  }

  private clearNumberBuffer(): void {
    this.numberBuffer = "";
  }

  reset(): void {
    this.clearNumberBuffer();
  }

  // Get current resize state for display
  getResizeInfo(
    state: UIState,
  ): { target: string; size: number; originalSize: number } | null {
    if (!isResizeMode(state)) {
      return null;
    }

    return {
      target: `${state.resizeTarget} ${state.resizeIndex}`,
      size: state.currentSize,
      originalSize: state.originalSize,
    };
  }
}
