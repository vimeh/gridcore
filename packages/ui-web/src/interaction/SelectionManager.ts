import {
  type CellAddress,
  type CellRange,
  cellAddressToString,
} from "@gridcore/core";

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

  setActiveCell(cell: CellAddress): void {
    this.clearSelection();
    this.state.activeCell = cell;
    this.state.selectedCells.add(cellAddressToString(cell));
    this.state.selectionRange = null;
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
}
