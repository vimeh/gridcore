import type { CellAddress } from "@gridcore/core";
import type {
  Action,
  ControllerEvent,
  Result,
  SpreadsheetController,
  UIState,
  ViewportInfo,
  ViewportManager,
} from "@gridcore/ui-core";

// Web-specific state extensions
export type InteractionMode = "normal" | "keyboard-only";

// Web UI state that extends the core UIState with Web-specific features
export interface WebUIState {
  coreState: UIState;
  interactionMode: InteractionMode;
  // Additional Web UI specific state can be added here
  isMouseDragging?: boolean;
  contextMenuOpen?: boolean;
}

// Mouse action types for Web UI
export type MouseAction =
  | { type: "click"; address: CellAddress }
  | { type: "doubleClick"; address: CellAddress }
  | { type: "dragStart"; address: CellAddress }
  | { type: "dragMove"; address: CellAddress }
  | { type: "dragEnd"; address: CellAddress }
  | { type: "resizeColumn"; index: number; width: number }
  | { type: "resizeRow"; index: number; height: number }
  | { type: "contextMenu"; address: CellAddress };

/**
 * Adapter that bridges ui-core state with Web UI specific needs
 */
export class WebStateAdapter {
  private controller: SpreadsheetController;
  private interactionMode: InteractionMode = "normal";
  private listeners: Array<(state: WebUIState) => void> = [];

  constructor(controller: SpreadsheetController) {
    this.controller = controller;

    // Subscribe to controller state changes
    this.controller.subscribe((event: ControllerEvent) => {
      if (event.type === "stateChanged") {
        this.notifyListeners();
      }
    });
  }

  /**
   * Get the current adapted state
   */
  getState(): WebUIState {
    return {
      coreState: this.controller.getState(),
      interactionMode: this.interactionMode,
    };
  }

  /**
   * Get just the core UIState
   */
  getCoreState(): UIState {
    return this.controller.getState();
  }

  /**
   * Toggle interaction mode between normal and keyboard-only
   */
  toggleInteractionMode(): void {
    this.interactionMode =
      this.interactionMode === "normal" ? "keyboard-only" : "normal";
    this.notifyListeners();
  }

  /**
   * Set interaction mode explicitly
   */
  setInteractionMode(mode: InteractionMode): void {
    this.interactionMode = mode;
    this.notifyListeners();
  }

  /**
   * Handle mouse actions by converting them to controller actions
   */
  handleMouseAction(action: MouseAction): Result<UIState> {
    // In keyboard-only mode, ignore most mouse actions
    if (this.interactionMode === "keyboard-only") {
      switch (action.type) {
        case "resizeColumn":
        case "resizeRow":
          // Allow resize even in keyboard-only mode
          break;
        default:
          return { ok: true, value: this.controller.getState() };
      }
    }

    const currentState = this.controller.getState();

    switch (action.type) {
      case "click": {
        // Calculate relative movement from current cursor to target
        const deltaRow = action.address.row - currentState.cursor.row;
        const deltaCol = action.address.col - currentState.cursor.col;

        // Use keyboard navigation to move to the clicked cell
        // This maintains all the vim state and behavior
        if (deltaRow !== 0 || deltaCol !== 0) {
          return this.navigateToCell(deltaRow, deltaCol);
        }
        return { ok: true, value: currentState };
      }

      case "doubleClick": {
        // First move to the cell
        const deltaRow = action.address.row - currentState.cursor.row;
        const deltaCol = action.address.col - currentState.cursor.col;

        if (deltaRow !== 0 || deltaCol !== 0) {
          const moveResult = this.navigateToCell(deltaRow, deltaCol);
          if (!moveResult.ok) return moveResult;
        }

        // Then start editing (simulate 'i' key)
        return this.controller.handleKeyPress("i", {
          key: "i",
          ctrl: false,
          shift: false,
          alt: false,
        });
      }

      case "dragStart": {
        // Move to start position and enter visual mode
        const deltaRow = action.address.row - currentState.cursor.row;
        const deltaCol = action.address.col - currentState.cursor.col;

        if (deltaRow !== 0 || deltaCol !== 0) {
          const moveResult = this.navigateToCell(deltaRow, deltaCol);
          if (!moveResult.ok) return moveResult;
        }

        // Enter visual mode (simulate 'v' key)
        return this.controller.handleKeyPress("v", {
          key: "v",
          ctrl: false,
          shift: false,
          alt: false,
        });
      }

      case "dragMove": {
        // In visual mode, navigate to extend selection
        if (currentState.spreadsheetMode === "navigation") {
          const deltaRow = action.address.row - currentState.cursor.row;
          const deltaCol = action.address.col - currentState.cursor.col;

          if (deltaRow !== 0 || deltaCol !== 0) {
            return this.navigateToCell(deltaRow, deltaCol);
          }
        }
        return { ok: true, value: currentState };
      }

      case "dragEnd":
        // Nothing special needed on drag end
        return { ok: true, value: currentState };

      case "resizeColumn":
      case "resizeRow":
        // These need to be handled by the Web UI directly since they're not vim operations
        // The Web UI should update the viewport manager directly
        return { ok: true, value: currentState };

      case "contextMenu":
        // Context menu is handled separately by Web UI
        return { ok: true, value: currentState };
    }
  }

  /**
   * Navigate to a cell using relative movement
   */
  private navigateToCell(deltaRow: number, deltaCol: number): Result<UIState> {
    let result: Result<UIState> = {
      ok: true,
      value: this.controller.getState(),
    };

    // Handle vertical movement
    if (deltaRow > 0) {
      for (let i = 0; i < deltaRow; i++) {
        result = this.controller.handleKeyPress("j", {
          key: "j",
          ctrl: false,
          shift: false,
          alt: false,
        });
        if (!result.ok) return result;
      }
    } else if (deltaRow < 0) {
      for (let i = 0; i < Math.abs(deltaRow); i++) {
        result = this.controller.handleKeyPress("k", {
          key: "k",
          ctrl: false,
          shift: false,
          alt: false,
        });
        if (!result.ok) return result;
      }
    }

    // Handle horizontal movement
    if (deltaCol > 0) {
      for (let i = 0; i < deltaCol; i++) {
        result = this.controller.handleKeyPress("l", {
          key: "l",
          ctrl: false,
          shift: false,
          alt: false,
        });
        if (!result.ok) return result;
      }
    } else if (deltaCol < 0) {
      for (let i = 0; i < Math.abs(deltaCol); i++) {
        result = this.controller.handleKeyPress("h", {
          key: "h",
          ctrl: false,
          shift: false,
          alt: false,
        });
        if (!result.ok) return result;
      }
    }

    return result;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: WebUIState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get the underlying controller for direct access when needed
   */
  getController(): SpreadsheetController {
    return this.controller;
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
