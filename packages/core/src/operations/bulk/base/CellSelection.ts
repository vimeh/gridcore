import { CellAddress, type CellRange } from "../../../domain/models";
import type { Selection } from "../interfaces/BulkOperation";

/**
 * Implementation of Selection interface for cell ranges and sets
 */
export class CellSelection implements Selection {
  private cells: Set<string> = new Set();
  private _count: number = 0;

  constructor(cells?: Iterable<CellAddress> | CellRange | Set<string>) {
    if (cells) {
      this.addCells(cells);
    }
  }

  /**
   * Add cells to the selection
   */
  addCells(cells: Iterable<CellAddress> | CellRange | Set<string>): void {
    if (cells instanceof Set) {
      // Direct string set
      for (const cellKey of cells) {
        this.cells.add(cellKey);
      }
      this._count = this.cells.size;
    } else if ("cells" in cells && typeof cells.cells === "function") {
      // CellRange
      for (const cell of cells.cells()) {
        const key = `${cell.row},${cell.col}`;
        this.cells.add(key);
      }
      this._count = this.cells.size;
    } else {
      // Iterable<CellAddress>
      for (const cell of cells) {
        const key = `${cell.row},${cell.col}`;
        this.cells.add(key);
      }
      this._count = this.cells.size;
    }
  }

  /**
   * Add a single cell to the selection
   */
  addCell(cell: CellAddress): void {
    const key = `${cell.row},${cell.col}`;
    if (!this.cells.has(key)) {
      this.cells.add(key);
      this._count++;
    }
  }

  /**
   * Remove a cell from the selection
   */
  removeCell(cell: CellAddress): void {
    const key = `${cell.row},${cell.col}`;
    if (this.cells.has(key)) {
      this.cells.delete(key);
      this._count--;
    }
  }

  /**
   * Get all cell addresses in the selection
   */
  *getCells(): Iterable<CellAddress> {
    for (const cellKey of this.cells) {
      const [row, col] = cellKey.split(",").map(Number);
      // Note: We assume CellAddress.create always succeeds for valid row/col
      // In a real implementation, you'd want error handling here
      const result = CellAddress.create(row, col);
      if (result.ok) {
        yield result.value;
      }
    }
  }

  /**
   * Check if a specific cell is in the selection
   */
  contains(address: CellAddress): boolean {
    const key = `${address.row},${address.col}`;
    return this.cells.has(key);
  }

  /**
   * Get the count of cells in the selection
   */
  count(): number {
    return this._count;
  }

  /**
   * Check if the selection is empty
   */
  isEmpty(): boolean {
    return this._count === 0;
  }

  /**
   * Clear all cells from the selection
   */
  clear(): void {
    this.cells.clear();
    this._count = 0;
  }

  /**
   * Create a selection from a CellRange
   */
  static fromRange(range: CellRange): CellSelection {
    return new CellSelection(range);
  }

  /**
   * Create a selection from a set of cell addresses
   */
  static fromCells(cells: Iterable<CellAddress>): CellSelection {
    return new CellSelection(cells);
  }

  /**
   * Create a selection from cell coordinates
   */
  static fromCoordinates(
    coordinates: Array<{ row: number; col: number }>,
  ): CellSelection {
    const selection = new CellSelection();
    for (const coord of coordinates) {
      const result = CellAddress.create(coord.row, coord.col);
      if (result.ok) {
        selection.addCell(result.value);
      }
    }
    return selection;
  }

  /**
   * Create a selection from string keys (row,col format)
   */
  static fromKeys(keys: Set<string>): CellSelection {
    return new CellSelection(keys);
  }

  /**
   * Get the selection as a set of string keys
   */
  toKeys(): Set<string> {
    return new Set(this.cells);
  }

  /**
   * Get the bounding box of the selection (if applicable)
   */
  getBounds(): {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  } | null {
    if (this.isEmpty()) {
      return null;
    }

    let minRow = Number.MAX_SAFE_INTEGER;
    let maxRow = Number.MIN_SAFE_INTEGER;
    let minCol = Number.MAX_SAFE_INTEGER;
    let maxCol = Number.MIN_SAFE_INTEGER;

    for (const cellKey of this.cells) {
      const [row, col] = cellKey.split(",").map(Number);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }

    return { minRow, maxRow, minCol, maxCol };
  }

  /**
   * Check if this selection intersects with another selection
   */
  intersects(other: Selection): boolean {
    for (const cell of other.getCells()) {
      if (this.contains(cell)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a new selection that is the union of this and another selection
   */
  union(other: Selection): CellSelection {
    const result = new CellSelection(this.getCells());
    for (const cell of other.getCells()) {
      result.addCell(cell);
    }
    return result;
  }

  /**
   * Create a new selection that is the intersection of this and another selection
   */
  intersection(other: Selection): CellSelection {
    const result = new CellSelection();
    for (const cell of this.getCells()) {
      if (other.contains(cell)) {
        result.addCell(cell);
      }
    }
    return result;
  }
}
