import { parseCellAddress, type SpreadsheetEngine } from "@gridcore/core";
import type { CanvasGrid } from "../components/CanvasGrid";
import type { CellEditor } from "../components/CellEditor";
import { KEY_CODES } from "../constants";
import type { SpreadsheetStateMachine } from "../state/SpreadsheetStateMachine";
import { GridVimBehavior, type GridVimCallbacks } from "./GridVimBehavior";
import { ResizeBehavior } from "./ResizeBehavior";
import type { SelectionManager } from "./SelectionManager";

export class KeyboardHandler {
  private gridVimBehavior?: GridVimBehavior;
  private resizeBehavior?: ResizeBehavior;
  private lastKey: string = "";

  constructor(
    private container: HTMLElement,
    private selectionManager: SelectionManager,
    private cellEditor: CellEditor,
    private grid: SpreadsheetEngine,
    private canvasGrid?: CanvasGrid,
    private modeStateMachine?: SpreadsheetStateMachine,
  ) {
    this.setupEventListeners();
    this.initializeVimBehaviors();
  }

  private setupEventListeners(): void {
    // Make container focusable
    this.container.tabIndex = 0;
    this.container.style.outline = "none";

    this.container.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  private initializeVimBehaviors(): void {
    // Initialize GridVimBehavior if we have mode state machine
    if (this.modeStateMachine && this.canvasGrid) {
      const callbacks: GridVimCallbacks = {
        onModeChangeRequest: (mode, _editMode) => {
          // Handle mode transitions
          if (mode === "visual") {
            const activeCell = this.selectionManager.getActiveCell();
            if (activeCell) {
              this.modeStateMachine?.transition({
                type: "ENTER_VISUAL_MODE",
                visualType: "character",
              });
              this.selectionManager.startVisualSelection(
                activeCell,
                "character",
              );
            }
          } else if (mode === "visual-line") {
            const activeCell = this.selectionManager.getActiveCell();
            if (activeCell) {
              this.modeStateMachine?.transition({
                type: "ENTER_VISUAL_MODE",
                visualType: "line",
              });
              this.selectionManager.startVisualSelection(activeCell, "line");
            }
          } else if (mode === "visual-block") {
            const activeCell = this.selectionManager.getActiveCell();
            if (activeCell) {
              this.modeStateMachine?.transition({
                type: "ENTER_VISUAL_BLOCK_MODE",
              });
              this.selectionManager.startVisualSelection(activeCell, "block");
            }
          } else if (mode === "resize") {
            const activeCell = this.selectionManager.getActiveCell();
            if (activeCell) {
              this.modeStateMachine?.transition({
                type: "ENTER_RESIZE_MODE",
                target: { type: "column", index: activeCell.col },
              });
              this.resizeBehavior?.setTarget("column", activeCell.col);
            }
          } else if (mode === "normal") {
            // Exit visual or resize mode
            if (this.modeStateMachine?.isInVisualMode()) {
              this.modeStateMachine?.transition({ type: "EXIT_VISUAL_MODE" });
              this.selectionManager.endVisualSelection();
            } else if (this.modeStateMachine?.isInResizeMode()) {
              this.modeStateMachine?.transition({ type: "EXIT_RESIZE_MODE" });
              this.resizeBehavior?.clear();
            }
          }
        },
        onRangeSelectionRequest: (_anchor, cursor) => {
          this.selectionManager.updateVisualSelection(cursor);
        },
        onResizeRequest: (type, index, delta) => {
          if (delta === 0) {
            // Auto-fit request
            // This would need implementation in ResizeBehavior
          } else {
            if (type === "column") {
              const viewport = this.canvasGrid?.getViewport();
              if (viewport) {
                const current = viewport.getColumnWidth(index);
                viewport.setColumnWidth(index, current + delta);
              }
            } else {
              const viewport = this.canvasGrid?.getViewport();
              if (viewport) {
                const current = viewport.getRowHeight(index);
                viewport.setRowHeight(index, current + delta);
              }
            }
          }
          this.canvasGrid?.render();
        },
        onScrollRequest: (direction, amount) => {
          const viewport = this.canvasGrid?.getViewport();
          if (!viewport) return;

          const pageSize = viewport.getPageSize();
          const scrollAmount =
            amount === 0.5
              ? Math.floor((pageSize?.rows || 10) / 2)
              : amount === 1
                ? pageSize?.rows || 10
                : Math.floor((pageSize?.rows || 10) * amount);

          switch (direction) {
            case "up":
              viewport.scrollBy(0, -scrollAmount * 25);
              break;
            case "down":
              viewport.scrollBy(0, scrollAmount * 25);
              break;
            case "left":
              viewport.scrollBy(-scrollAmount * 100, 0);
              break;
            case "right":
              viewport.scrollBy(scrollAmount * 100, 0);
              break;
          }
          this.canvasGrid?.render();
        },
        onCellNavigate: (direction, count) => {
          for (let i = 0; i < count; i++) {
            this.selectionManager.moveActiveCell(direction);
          }
        },
      };

      // Set viewport on selection manager
      this.selectionManager.setViewport(this.canvasGrid.getViewport());

      this.gridVimBehavior = new GridVimBehavior(
        callbacks,
        () => {
          const state = this.modeStateMachine?.getState();
          if (!state || state.type === "navigation") return "normal";
          return state.substate.type;
        },
        this.selectionManager,
        this.canvasGrid.getViewport(),
      );

      this.resizeBehavior = new ResizeBehavior(
        this.canvasGrid.getViewport(),
        this.grid,
      );
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Check if we're in navigation mode
    const isNavigationMode =
      !this.modeStateMachine || this.modeStateMachine.isNavigating();
    const isResizeMode = this.modeStateMachine?.isInResizeMode();

    // Handle resize mode
    if (isResizeMode && this.resizeBehavior) {
      const result = this.resizeBehavior.handleKey(event.key);
      if (result.handled) {
        event.preventDefault();
        if (result.exitMode) {
          this.modeStateMachine?.transition({ type: "EXIT_RESIZE_MODE" });
        }
        return;
      }
    }

    // Handle vim commands in editing mode
    if (
      !isNavigationMode &&
      this.gridVimBehavior &&
      !this.cellEditor.isCurrentlyEditing()
    ) {
      const handled = this.gridVimBehavior.handleKey(
        event.key,
        event.ctrlKey,
        event.shiftKey,
      );
      if (handled) {
        event.preventDefault();
        return;
      }
    }

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

      // Visual mode triggers
      case "v":
        if (isNavigationMode) {
          event.preventDefault();
          const activeCell = this.selectionManager.getActiveCell();
          if (activeCell) {
            this.modeStateMachine?.transition({ type: "START_EDITING" });
            this.modeStateMachine?.transition({
              type: "ENTER_VISUAL_MODE",
              visualType: "character",
            });
            this.selectionManager.startVisualSelection(activeCell, "character");
          }
        }
        break;

      case "V":
        if (isNavigationMode) {
          event.preventDefault();
          const cell = this.selectionManager.getActiveCell();
          if (cell) {
            this.modeStateMachine?.transition({ type: "START_EDITING" });
            this.modeStateMachine?.transition({
              type: "ENTER_VISUAL_MODE",
              visualType: "line",
            });
            this.selectionManager.startVisualSelection(cell, "line");
          }
        }
        break;

      // Special navigation
      case "G":
        if (isNavigationMode) {
          event.preventDefault();
          // G goes to last row
          const currentCell = this.selectionManager.getActiveCell();
          if (currentCell) {
            this.selectionManager.setActiveCell({
              row: Number.MAX_SAFE_INTEGER,
              col: currentCell.col,
            });
          }
        }
        break;

      case "$":
        if (isNavigationMode) {
          event.preventDefault();
          // $ goes to last column
          const cell = this.selectionManager.getActiveCell();
          if (cell) {
            this.selectionManager.setActiveCell({
              row: cell.row,
              col: Number.MAX_SAFE_INTEGER,
            });
          }
        }
        break;

      case "0":
        if (isNavigationMode) {
          event.preventDefault();
          // 0 goes to first column
          const cell = this.selectionManager.getActiveCell();
          if (cell) {
            this.selectionManager.setActiveCell({ row: cell.row, col: 0 });
          }
        }
        break;

      // Command sequences
      case "g":
        if (isNavigationMode) {
          if (this.lastKey === "g") {
            // gg - go to first row
            event.preventDefault();
            this.lastKey = "";
            const cell = this.selectionManager.getActiveCell();
            if (cell) {
              this.selectionManager.setActiveCell({ row: 0, col: cell.col });
            }
          } else {
            event.preventDefault();
            this.lastKey = "g";
            setTimeout(() => {
              this.lastKey = "";
            }, 1000);
          }
        }
        break;

      case "r":
        if (isNavigationMode && this.lastKey === "g") {
          // gr - enter resize mode
          event.preventDefault();
          this.lastKey = "";
          const active = this.selectionManager.getActiveCell();
          if (active) {
            this.modeStateMachine?.transition({ type: "START_EDITING" });
            this.modeStateMachine?.transition({
              type: "ENTER_RESIZE_MODE",
              target: { type: "column", index: active.col },
            });
            this.resizeBehavior?.setTarget("column", active.col);
          }
        }
        break;

      case "z":
        if (isNavigationMode) {
          event.preventDefault();
          if (this.lastKey === "z") {
            // zz - center current cell
            this.lastKey = "";
            const activeCell = this.selectionManager.getActiveCell();
            if (activeCell && this.canvasGrid) {
              const viewport = this.canvasGrid.getViewport();
              viewport.scrollToCell(activeCell, "center");
              this.canvasGrid.render();
            }
          } else {
            this.lastKey = "z";
            setTimeout(() => {
              this.lastKey = "";
            }, 1000);
          }
        }
        break;

      case "t":
      case "b":
        if (isNavigationMode && this.lastKey === "z") {
          event.preventDefault();
          this.lastKey = "";
          const activeCell = this.selectionManager.getActiveCell();
          if (activeCell && this.canvasGrid) {
            const viewport = this.canvasGrid.getViewport();
            if (event.key === "t") {
              viewport.scrollToCell(activeCell, "top");
            } else if (event.key === "b") {
              viewport.scrollToCell(activeCell, "bottom");
            }
            this.canvasGrid.render();
          }
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
          // In navigation mode, Ctrl+V enters visual block mode
          if (isNavigationMode) {
            const activeCell = this.selectionManager.getActiveCell();
            if (activeCell) {
              this.modeStateMachine?.transition({ type: "START_EDITING" });
              this.modeStateMachine?.transition({
                type: "ENTER_VISUAL_BLOCK_MODE",
              });
              this.selectionManager.startVisualSelection(activeCell, "block");
            }
          } else {
            this.pasteToSelection();
          }
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

  private startEditingActiveCell(
    initialChar?: string,
    mode: boolean | "replace" = false,
  ): void {
    const activeCell = this.selectionManager.getActiveCell();
    if (!activeCell) return;

    // Determine the edit mode based on the parameters
    let editMode: "insert" | "append" | "replace" = "insert";
    if (mode === "replace") {
      editMode = "replace";
    } else if (mode === true) {
      editMode = "append";
    } else if (initialChar && mode === false) {
      editMode = "replace"; // When typing to start, replace content
    }

    const cellData = this.grid.getCell(activeCell);
    let initialValue = "";

    if (mode === "replace") {
      initialValue = cellData?.formula || String(cellData?.rawValue || "");
    } else if (initialChar && mode === false) {
      initialValue = initialChar;
    } else {
      initialValue = cellData?.formula || String(cellData?.rawValue || "");
    }

    // CellEditor.startEditing will handle the state machine transition
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
