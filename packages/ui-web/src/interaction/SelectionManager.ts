import { CellAddress, CellRange } from "@gridcore/core";
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
      this.state.selectedCells.add(cell.toString());
      this.state.selectionRange = null;
    }
    
    // Check if the cell actually changed
    const previousCell = this.state.activeCell;
    const cellChanged = !previousCell || 
                       previousCell.row !== cell.row || 
                       previousCell.col !== cell.col;
    
    this.state.activeCell = cell;
    
    // Notify listeners if the cell changed
    if (cellChanged) {
      this.onActiveCellChange?.(cell);
    }
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

    // Create start and end addresses for the range
    const startResult = CellAddress.create(
      Math.min(this.selectionStart.row, cell.row),
      Math.min(this.selectionStart.col, cell.col),
    );
    const endResult = CellAddress.create(
      Math.max(this.selectionStart.row, cell.row),
      Math.max(this.selectionStart.col, cell.col),
    );

    if (!startResult.ok || !endResult.ok) return;

    const rangeResult = CellRange.create(startResult.value, endResult.value);
    if (!rangeResult.ok) return;

    this.state.selectionRange = rangeResult.value;

    // Add all cells in range to selection
    const cells = Array.from(rangeResult.value.cells());
    for (const cellAddress of cells) {
      this.state.selectedCells.add(cellAddress.toString());
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
    return this.state.selectedCells.has(cell.toString());
  }

  moveActiveCell(direction: "up" | "down" | "left" | "right"): void {
    if (!this.state.activeCell) {
      const initialCellResult = CellAddress.create(0, 0);
      if (initialCellResult.ok) {
        this.setActiveCell(initialCellResult.value);
      }
      return;
    }

    let newRow = this.state.activeCell.row;
    let newCol = this.state.activeCell.col;

    switch (direction) {
      case "up":
        if (newRow > 0) newRow--;
        break;
      case "down":
        newRow++;
        break;
      case "left":
        if (newCol > 0) newCol--;
        break;
      case "right":
        newCol++;
        break;
    }

    const newCellResult = CellAddress.create(newRow, newCol);
    if (!newCellResult.ok) return;

    this.setActiveCell(newCellResult.value);

    // Notify listeners of the change
    this.onActiveCellChange?.(newCellResult.value);
  }

  // Callback for when active cell changes
  public onActiveCellChange?: (cell: CellAddress) => void;

  // Callback for when selection changes
  public onSelectionChange?: () => void;

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
          const cellResult = CellAddress.create(row, col);
          if (cellResult.ok) {
            this.state.selectedCells.add(cellResult.value.toString());
          }
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
          const cellResult = CellAddress.create(row, col);
          if (cellResult.ok) {
            this.state.selectedCells.add(cellResult.value.toString());
          }
        }
      }
    } else {
      // Character mode - normal range selection
      const startResult = CellAddress.create(
        Math.min(this.visualAnchor.row, cursor.row),
        Math.min(this.visualAnchor.col, cursor.col),
      );
      const endResult = CellAddress.create(
        Math.max(this.visualAnchor.row, cursor.row),
        Math.max(this.visualAnchor.col, cursor.col),
      );

      if (startResult.ok && endResult.ok) {
        const rangeResult = CellRange.create(
          startResult.value,
          endResult.value,
        );
        if (rangeResult.ok) {
          this.state.selectionRange = rangeResult.value;

          const cells = Array.from(rangeResult.value.cells());
          for (const cellAddress of cells) {
            this.state.selectedCells.add(cellAddress.toString());
          }
        }
      }
    }

    this.state.activeCell = cursor;

    // Notify listeners of selection change
    this.onSelectionChange?.();
  }

  endVisualSelection(): void {
    this.visualAnchor = null;
    this.visualMode = null;
    this.onSelectionChange?.();
  }

  getVisualMode(): "character" | "line" | "block" | null {
    return this.visualMode;
  }

  getVisualAnchor(): CellAddress | null {
    return this.visualAnchor;
  }

  // Helper method for migrating from plain objects to CellAddress
  // This can be used by other components during the migration
  static createCellAddress(row: number, col: number): CellAddress | null {
    const result = CellAddress.create(row, col);
    return result.ok ? result.value : null;
  }
}
