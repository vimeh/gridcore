import {
  type CellAddress,
  type CellRange,
  cellAddressToString,
} from "@gridcore/core";
import type { Viewport } from "../components/Viewport";

export interface SelectionState {
  activeCell: CellAddress | null;
  selectedCells: Set<string>;
  selectionRange: CellRange | null;
}

export class SelectionManager {
  private state: SelectionState = {
    activeCell: null,
    selectedCells: new Set(),
    selectionRange: null,
  };

  private selectionStart: CellAddress | null = null;
  private isSelecting: boolean = false;
  private visualAnchor: CellAddress | null = null;
  private visualMode: "character" | "line" | "block" | null = null;
  private viewport: Viewport | null = null; // Will be injected

  setActiveCell(cell: CellAddress): void {
    // Don't clear selection if in visual mode
    if (!this.visualMode) {
      this.clearSelection();
      this.state.selectedCells.add(cellAddressToString(cell));
      this.state.selectionRange = null;
    }
    this.state.activeCell = cell;
  }

  getActiveCell(): CellAddress | null {
    return this.state.activeCell;
  }

  startRangeSelection(cell: CellAddress): void {
    this.selectionStart = cell;
    this.isSelecting = true;
    this.setActiveCell(cell);
  }

  updateRangeSelection(cell: CellAddress): void {
    if (!this.isSelecting || !this.selectionStart) return;

    this.state.selectedCells.clear();

    const range: CellRange = {
      start: {
        row: Math.min(this.selectionStart.row, cell.row),
        col: Math.min(this.selectionStart.col, cell.col),
      },
      end: {
        row: Math.max(this.selectionStart.row, cell.row),
        col: Math.max(this.selectionStart.col, cell.col),
      },
    };

    this.state.selectionRange = range;

    // Add all cells in range to selection
    for (let row = range.start.row; row <= range.end.row; row++) {
      for (let col = range.start.col; col <= range.end.col; col++) {
        this.state.selectedCells.add(cellAddressToString({ row, col }));
      }
    }
  }

  endRangeSelection(): void {
    this.isSelecting = false;
  }

  clearSelection(): void {
    this.state.selectedCells.clear();
    this.state.selectionRange = null;
  }

  getSelectedCells(): Set<string> {
    return new Set(this.state.selectedCells);
  }

  getSelectionRange(): CellRange | null {
    return this.state.selectionRange;
  }

  isSelected(cell: CellAddress): boolean {
    return this.state.selectedCells.has(cellAddressToString(cell));
  }

  moveActiveCell(direction: "up" | "down" | "left" | "right"): void {
    if (!this.state.activeCell) {
      this.setActiveCell({ row: 0, col: 0 });
      return;
    }

    const newCell = { ...this.state.activeCell };

    switch (direction) {
      case "up":
        if (newCell.row > 0) newCell.row--;
        break;
      case "down":
        newCell.row++;
        break;
      case "left":
        if (newCell.col > 0) newCell.col--;
        break;
      case "right":
        newCell.col++;
        break;
    }

    this.setActiveCell(newCell);

    // Notify listeners of the change
    this.onActiveCellChange?.(newCell);
  }

  // Callback for when active cell changes
  public onActiveCellChange?: (cell: CellAddress) => void;

  // Visual mode methods
  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  startVisualSelection(
    anchor: CellAddress,
    mode: "character" | "line" | "block",
  ): void {
    this.visualAnchor = anchor;
    this.visualMode = mode;
    this.state.activeCell = anchor;
    this.updateVisualSelection(anchor);
  }

  updateVisualSelection(cursor: CellAddress): void {
    if (!this.visualAnchor || !this.visualMode) return;

    this.state.selectedCells.clear();

    if (this.visualMode === "line") {
      // Select entire rows from anchor to cursor
      const startRow = Math.min(this.visualAnchor.row, cursor.row);
      const endRow = Math.max(this.visualAnchor.row, cursor.row);

      // Use a reasonable max column count if viewport is not available
      const totalCols = this.viewport?.getTotalCols?.() || 100;

      for (let row = startRow; row <= endRow; row++) {
        for (let col = 0; col < totalCols; col++) {
          this.state.selectedCells.add(cellAddressToString({ row, col }));
        }
      }
    } else if (this.visualMode === "block") {
      // Select rectangular block
      const startRow = Math.min(this.visualAnchor.row, cursor.row);
      const endRow = Math.max(this.visualAnchor.row, cursor.row);
      const startCol = Math.min(this.visualAnchor.col, cursor.col);
      const endCol = Math.max(this.visualAnchor.col, cursor.col);

      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          this.state.selectedCells.add(cellAddressToString({ row, col }));
        }
      }
    } else {
      // Character mode - normal range selection
      const range: CellRange = {
        start: {
          row: Math.min(this.visualAnchor.row, cursor.row),
          col: Math.min(this.visualAnchor.col, cursor.col),
        },
        end: {
          row: Math.max(this.visualAnchor.row, cursor.row),
          col: Math.max(this.visualAnchor.col, cursor.col),
        },
      };

      this.state.selectionRange = range;

      for (let row = range.start.row; row <= range.end.row; row++) {
        for (let col = range.start.col; col <= range.end.col; col++) {
          this.state.selectedCells.add(cellAddressToString({ row, col }));
        }
      }
    }

    this.state.activeCell = cursor;
  }

  endVisualSelection(): void {
    this.visualAnchor = null;
    this.visualMode = null;
  }

  getVisualMode(): "character" | "line" | "block" | null {
    return this.visualMode;
  }

  getVisualAnchor(): CellAddress | null {
    return this.visualAnchor;
  }
}
