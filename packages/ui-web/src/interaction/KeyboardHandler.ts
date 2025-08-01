import { parseCellAddress, type SpreadsheetEngine } from "@gridcore/core";
import type { CellEditor } from "../components/CellEditor";
import { KEY_CODES } from "../constants";
import type { SelectionManager } from "./SelectionManager";

export class KeyboardHandler {
  constructor(
    private container: HTMLElement,
    private selectionManager: SelectionManager,
    private cellEditor: CellEditor,
    private grid: SpreadsheetEngine,
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
    // Don't handle if editing
    if (this.cellEditor.isCurrentlyEditing()) {
      return;
    }

    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    switch (event.key) {
      // Vim navigation keys
      case KEY_CODES.H:
        event.preventDefault();
        this.selectionManager.moveActiveCell("left");
        break;

      case KEY_CODES.J:
        event.preventDefault();
        this.selectionManager.moveActiveCell("down");
        break;

      case KEY_CODES.K:
        event.preventDefault();
        this.selectionManager.moveActiveCell("up");
        break;

      case KEY_CODES.L:
        event.preventDefault();
        this.selectionManager.moveActiveCell("right");
        break;

      // Vim edit mode
      case KEY_CODES.I:
        event.preventDefault();
        this.startEditingActiveCell();
        break;

      // Keep arrow keys as secondary option
      case KEY_CODES.ARROW_UP:
        event.preventDefault();
        this.selectionManager.moveActiveCell("up");
        break;

      case KEY_CODES.ARROW_DOWN:
        event.preventDefault();
        this.selectionManager.moveActiveCell("down");
        break;

      case KEY_CODES.ARROW_LEFT:
        event.preventDefault();
        this.selectionManager.moveActiveCell("left");
        break;

      case KEY_CODES.ARROW_RIGHT:
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
      }
    }
  }

  private startEditingActiveCell(initialChar?: string): void {
    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    const cellData = this.grid.getCell(activeCell);
    let initialValue = "";

    if (initialChar) {
      initialValue = initialChar;
    } else {
      initialValue = cellData?.formula || String(cellData?.rawValue || "");
    }

    this.cellEditor.startEditing(activeCell, initialValue);
  }

  private deleteSelectedCells(): void {
    for (const cellKey of this.selectionManager.getSelectedCells()) {
      const address = parseCellAddress(cellKey);
      if (address) {
        this.grid.clearCell(address);
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

  destroy(): void {
    this.container.removeEventListener("keydown", this.handleKeyDown);
  }
}
