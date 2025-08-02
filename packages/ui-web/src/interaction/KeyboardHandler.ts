import { parseCellAddress, type SpreadsheetEngine } from "@gridcore/core";
import type { CellEditor } from "../components/CellEditor";
import type { CanvasGrid } from "../components/CanvasGrid";
import { KEY_CODES } from "../constants";
import type { SelectionManager } from "./SelectionManager";
import type { SpreadsheetModeStateMachine } from "../state/SpreadsheetMode";

export class KeyboardHandler {
  constructor(
    private container: HTMLElement,
    private selectionManager: SelectionManager,
    private cellEditor: CellEditor,
    private grid: SpreadsheetEngine,
    private canvasGrid?: CanvasGrid,
    private modeStateMachine?: SpreadsheetModeStateMachine,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Make container focusable
    this.container.tabIndex = 0;
    this.container.style.outline = "none";

    this.container.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Check if we're in navigation mode
    const isNavigationMode = !this.modeStateMachine || this.modeStateMachine.isInNavigationMode();
    
    // Don't handle navigation keys if editing (unless we have no state machine)
    if (!isNavigationMode && this.cellEditor.isCurrentlyEditing()) {
      return;
    }

    switch (event.key) {
      // Vim navigation keys
      case KEY_CODES.H:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("left");
        }
        break;

      case KEY_CODES.J:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("down");
        }
        break;

      case KEY_CODES.K:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("up");
        }
        break;

      case KEY_CODES.L:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("right");
        }
        break;

      // Vim edit mode
      case KEY_CODES.I:
        event.preventDefault();
        this.startEditingActiveCell("", false); // insert mode
        break;

      case KEY_CODES.A:
        event.preventDefault();
        this.startEditingActiveCell("", true); // append mode
        break;

      // Keep arrow keys as secondary option
      case KEY_CODES.ARROW_UP:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("up");
        }
        break;

      case KEY_CODES.ARROW_DOWN:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("down");
        }
        break;

      case KEY_CODES.ARROW_LEFT:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("left");
        }
        break;

      case KEY_CODES.ARROW_RIGHT:
        event.preventDefault();
        if (this.selectionManager.getActiveCell()) {
          this.selectionManager.moveActiveCell("right");
        }
        break;

      case KEY_CODES.ENTER:
        event.preventDefault();
        if (event.shiftKey) {
          this.selectionManager.moveActiveCell("up");
        } else {
          this.startEditingActiveCell("", "replace"); // replace mode for Enter
        }
        break;

      case KEY_CODES.F2:
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

      default:
        // Start editing if it's a printable character (except vim nav keys)
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          ![
            KEY_CODES.H,
            KEY_CODES.J,
            KEY_CODES.K,
            KEY_CODES.L,
            KEY_CODES.I,
            KEY_CODES.A,
          ].includes(event.key)
        ) {
          this.startEditingActiveCell(event.key);
        }
        break;
    }

    // Handle Ctrl/Cmd shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case KEY_CODES.A:
        case KEY_CODES.CAPITAL_A:
          event.preventDefault();
          this.selectAll();
          break;

        case KEY_CODES.C:
        case KEY_CODES.CAPITAL_C:
          event.preventDefault();
          this.copySelection();
          break;

        case KEY_CODES.V:
        case KEY_CODES.CAPITAL_V:
          event.preventDefault();
          this.pasteToSelection();
          break;

        case KEY_CODES.X:
        case KEY_CODES.CAPITAL_X:
          event.preventDefault();
          this.cutSelection();
          break;

        case KEY_CODES.Z:
        case KEY_CODES.CAPITAL_Z:
          event.preventDefault();
          if (event.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
          break;

        case KEY_CODES.M:
        case KEY_CODES.CAPITAL_M:
          event.preventDefault();
          this.toggleInteractionMode();
          break;
      }
    }
  }

  private startEditingActiveCell(initialChar?: string, mode: boolean | "replace" = false): void {
    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    // Transition to editing mode
    this.modeStateMachine?.transition({ type: "START_EDITING" });

    const cellData = this.grid.getCell(activeCell);
    let initialValue = "";
    let editMode: "insert" | "append" | "replace" = "insert";

    if (mode === "replace") {
      editMode = "replace";
      initialValue = cellData?.formula || String(cellData?.rawValue || "");
    } else if (initialChar && mode !== true) {
      initialValue = initialChar;
      editMode = "replace"; // When typing to start, replace content
    } else {
      initialValue = cellData?.formula || String(cellData?.rawValue || "");
      editMode = mode === true ? "append" : "insert";
    }

    this.cellEditor.startEditing(activeCell, initialValue, editMode);
  }

  private deleteSelectedCells(): void {
    const selectedCells = this.selectionManager.getSelectedCells();
    
    // If only one cell is selected (the active cell) or no cells are selected
    const activeCell = this.selectionManager.getActiveCell();
    if (selectedCells.size <= 1 && activeCell) {
      this.grid.clearCell(activeCell);
      // Update the canvas grid to reflect the change
      this.canvasGrid?.render();
      // Trigger cell click callback to update formula bar
      this.canvasGrid?.onCellClick?.(activeCell);
    } else if (selectedCells.size > 1) {
      // Delete all selected cells
      for (const cellKey of selectedCells) {
        const address = parseCellAddress(cellKey);
        if (address) {
          this.grid.clearCell(address);
        }
      }
      this.canvasGrid?.render();
      // Update formula bar for active cell if it exists
      if (activeCell) {
        this.canvasGrid?.onCellClick?.(activeCell);
      }
    }
  }

  private selectAll(): void {
    // TODO: Implement select all
    console.log("Select all not yet implemented");
  }

  private copySelection(): void {
    // TODO: Implement copy
    console.log("Copy not yet implemented");
  }

  private pasteToSelection(): void {
    // TODO: Implement paste
    console.log("Paste not yet implemented");
  }

  private cutSelection(): void {
    // TODO: Implement cut
    console.log("Cut not yet implemented");
  }

  private undo(): void {
    // TODO: Implement undo
    console.log("Undo not yet implemented");
  }

  private redo(): void {
    // TODO: Implement redo
    console.log("Redo not yet implemented");
  }

  private toggleInteractionMode(): void {
    if (!this.canvasGrid) return;
    
    const currentMode = this.canvasGrid.getInteractionMode();
    const newMode = currentMode === "normal" ? "keyboard-only" : "normal";
    this.canvasGrid.setInteractionMode(newMode);
    
    // Log the mode change for user feedback
    console.log(`Interaction mode changed to: ${newMode}`);
  }

  destroy(): void {
    this.container.removeEventListener("keydown", this.handleKeyDown);
  }
}
