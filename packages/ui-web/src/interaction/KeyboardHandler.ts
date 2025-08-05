import type { SpreadsheetFacade } from "@gridcore/core";
import type { SpreadsheetController } from "@gridcore/ui-core";
import type { CanvasGrid } from "../components/CanvasGrid";
import type { CellEditor } from "../components/CellEditor";
import { KEY_CODES } from "../constants";
import type { SelectionManager } from "./SelectionManager";

export interface SheetNavigationCallbacks {
  onNextSheet?: () => void;
  onPreviousSheet?: () => void;
  onNewSheet?: () => void;
}

export class KeyboardHandler {
  private sheetNavigationCallbacks?: SheetNavigationCallbacks;
  private boundHandleKeyDown: (event: KeyboardEvent) => void;

  constructor(
    private container: HTMLElement,
    private selectionManager: SelectionManager,
    private cellEditor: CellEditor,
    private facade: SpreadsheetFacade,
    private canvasGrid?: CanvasGrid,
    private controller?: SpreadsheetController,
  ) {
    // Bind the event handler once so we can remove it later
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.setupEventListeners();
  }

  setSheetNavigationCallbacks(callbacks: SheetNavigationCallbacks): void {
    this.sheetNavigationCallbacks = callbacks;
  }

  private setupEventListeners(): void {
    // Make container focusable
    this.container.tabIndex = 0;
    this.container.style.outline = "none";

    this.container.addEventListener("keydown", this.boundHandleKeyDown);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Handle sheet navigation shortcuts
    if (this.sheetNavigationCallbacks) {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "PageDown") {
          event.preventDefault();
          this.sheetNavigationCallbacks.onNextSheet?.();
          return;
        } else if (event.key === "PageUp") {
          event.preventDefault();
          this.sheetNavigationCallbacks.onPreviousSheet?.();
          return;
        }
      }

      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        this.sheetNavigationCallbacks.onNewSheet?.();
        return;
      }
    }

    // Handle Delete/Backspace in navigation mode to clear cells
    if (this.controller && !this.cellEditor.isCurrentlyEditing()) {
      const state = this.controller.getState();
      if (state.spreadsheetMode === "navigation" && 
          (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        console.log("KeyboardHandler: Clearing cell with", event.key);
        this.deleteSelectedCells();
        return;
      }
    }

    // If controller is available, delegate key handling to it
    if (this.controller) {
      const result = this.controller.handleKeyPress(event.key, {
        key: event.key,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
      });

      if (result.ok) {
        event.preventDefault();

        // Update UI based on state changes
        const newState = result.value;

        // Update selection based on cursor position
        this.selectionManager.setActiveCell(newState.cursor);

        // Handle mode changes
        if (newState.spreadsheetMode === "editing") {
          // Start editing if not already editing, or update editing state
          if (!this.cellEditor.isCurrentlyEditing()) {
            console.log("KeyboardHandler: Starting editing", {
              cursor: newState.cursor,
              editingValue: newState.editingValue,
              cursorPosition: newState.cursorPosition,
            });
            this.cellEditor.startEditing(
              newState.cursor,
              newState.editingValue,
              newState.cursorPosition,
            );
          } else {
            // Update editor content if already editing
            this.cellEditor.updateContent(
              newState.editingValue,
              newState.cursorPosition,
            );
          }
        } else if (this.cellEditor.isCurrentlyEditing()) {
          // Stop editing
          this.cellEditor.cancelEdit();
        }

        return;
      }
    }

    // Fall back to basic keyboard handling if no controller
    console.log("KeyboardHandler fallback check:", {
      hasController: !!this.controller,
      isEditing: this.cellEditor.isCurrentlyEditing(),
    });

    if (!this.controller && !this.cellEditor.isCurrentlyEditing()) {
      switch (event.key) {
        // Basic navigation
        case KEY_CODES.ARROW_UP:
        case KEY_CODES.K:
          event.preventDefault();
          this.selectionManager.moveActiveCell("up");
          break;

        case KEY_CODES.ARROW_DOWN:
        case KEY_CODES.J:
          event.preventDefault();
          this.selectionManager.moveActiveCell("down");
          break;

        case KEY_CODES.ARROW_LEFT:
        case KEY_CODES.H:
          event.preventDefault();
          this.selectionManager.moveActiveCell("left");
          break;

        case KEY_CODES.ARROW_RIGHT:
        case KEY_CODES.L:
          event.preventDefault();
          this.selectionManager.moveActiveCell("right");
          break;

        case KEY_CODES.ENTER:
          event.preventDefault();
          if (event.shiftKey) {
            this.selectionManager.moveActiveCell("up");
          } else {
            this.startEditingActiveCell();
          }
          break;

        case KEY_CODES.I:
        case KEY_CODES.A:
          event.preventDefault();
          this.startEditingActiveCell();
          break;

        case KEY_CODES.DELETE:
        case KEY_CODES.BACKSPACE:
          event.preventDefault();
          this.deleteSelectedCells();
          break;

        case KEY_CODES.TAB:
          event.preventDefault();
          if (event.shiftKey) {
            this.selectionManager.moveActiveCell("left");
          } else {
            this.selectionManager.moveActiveCell("right");
          }
          break;
      }
    }
  }

  private startEditingActiveCell(initialChar?: string): void {
    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    let initialValue = initialChar || "";
    if (!initialChar) {
      const cellResult = this.facade.getCell(activeCell);
      if (cellResult.ok && cellResult.value) {
        initialValue = cellResult.value.rawValue?.toString() || "";
      }
    }

    this.cellEditor.startEditing(activeCell, initialValue);
  }

  private deleteSelectedCells(): void {
    const activeCell = this.selectionManager.getActiveCell();
    if (activeCell) {
      this.facade.setCellValue(activeCell, "");
      this.canvasGrid?.render();
      
      // Update formula bar directly after clearing cell
      // Get the formula bar element and update its content
      const formulaBar = document.querySelector('.formula-bar-input') as HTMLElement;
      if (formulaBar) {
        formulaBar.textContent = "";
      }
    }
  }

  destroy(): void {
    this.container.removeEventListener("keydown", this.boundHandleKeyDown);
  }
}
