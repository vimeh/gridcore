import { Cell } from "../domain/models/Cell";
import { CellAddress } from "../domain/models/CellAddress";
import { err, ok, type Result } from "../shared/types/Result";

/**
 * Sparse grid data structure optimized for insert/delete operations.
 * Maintains a map of cells and efficiently handles structural changes.
 */
export class SparseGrid {
  private cells: Map<string, Cell> = new Map();
  private maxRow: number = 0;
  private maxCol: number = 0;

  constructor() {}

  /**
   * Get a cell at the specified address
   */
  getCell(address: CellAddress): Cell | undefined {
    const key = this.addressToKey(address);
    return this.cells.get(key);
  }

  /**
   * Set a cell at the specified address
   */
  setCell(address: CellAddress, cell: Cell): void {
    const key = this.addressToKey(address);
    this.cells.set(key, cell);

    // Update bounds
    this.maxRow = Math.max(this.maxRow, address.row);
    this.maxCol = Math.max(this.maxCol, address.col);
  }

  /**
   * Remove a cell at the specified address
   */
  removeCell(address: CellAddress): boolean {
    const key = this.addressToKey(address);
    return this.cells.delete(key);
  }

  /**
   * Insert rows at the specified index, shifting existing rows down
   */
  insertRows(beforeRow: number, count: number): Result<void, string> {
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      // Find all cells that need to be moved
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        if (address.row >= beforeRow) {
          // This cell needs to move down
          const newAddressResult = CellAddress.create(
            address.row + count,
            address.col,
          );
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);

          // Create new cell with updated address
          const cellCopy = Cell.create(cell.rawValue, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
          }
          toDelete.push(key);
        }
      }

      // Remove old cells
      for (const key of toDelete) {
        this.cells.delete(key);
      }

      // Add updated cells
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      // Update max bounds
      this.maxRow += count;

      return ok(undefined);
    } catch (error) {
      return err(`Failed to insert rows: ${error}`);
    }
  }

  /**
   * Delete rows at the specified index, shifting remaining rows up
   */
  deleteRows(startRow: number, count: number): Result<void, string> {
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      // Find all cells that are affected
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);

        if (address.row >= startRow && address.row < startRow + count) {
          // This cell is in the deleted range - remove it
          toDelete.push(key);
        } else if (address.row >= startRow + count) {
          // This cell needs to move up
          const newAddressResult = CellAddress.create(
            address.row - count,
            address.col,
          );
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);

          // Create new cell with updated address
          const cellCopy = Cell.create(cell.rawValue, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
          }
          toDelete.push(key);
        }
      }

      // Remove old/deleted cells
      for (const key of toDelete) {
        this.cells.delete(key);
      }

      // Add updated cells
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      // Update max bounds
      this.maxRow = Math.max(0, this.maxRow - count);

      return ok(undefined);
    } catch (error) {
      return err(`Failed to delete rows: ${error}`);
    }
  }

  /**
   * Insert columns at the specified index, shifting existing columns right
   */
  insertColumns(beforeCol: number, count: number): Result<void, string> {
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      // Find all cells that need to be moved
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        if (address.col >= beforeCol) {
          // This cell needs to move right
          const newAddressResult = CellAddress.create(
            address.row,
            address.col + count,
          );
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);

          // Create new cell with updated address
          const cellCopy = Cell.create(cell.rawValue, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
          }
          toDelete.push(key);
        }
      }

      // Remove old cells
      for (const key of toDelete) {
        this.cells.delete(key);
      }

      // Add updated cells
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      // Update max bounds
      this.maxCol += count;

      return ok(undefined);
    } catch (error) {
      return err(`Failed to insert columns: ${error}`);
    }
  }

  /**
   * Delete columns at the specified index, shifting remaining columns left
   */
  deleteColumns(startCol: number, count: number): Result<void, string> {
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      // Find all cells that are affected
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);

        if (address.col >= startCol && address.col < startCol + count) {
          // This cell is in the deleted range - remove it
          toDelete.push(key);
        } else if (address.col >= startCol + count) {
          // This cell needs to move left
          const newAddressResult = CellAddress.create(
            address.row,
            address.col - count,
          );
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);

          // Create new cell with updated address
          const cellCopy = Cell.create(cell.rawValue, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
          }
          toDelete.push(key);
        }
      }

      // Remove old/deleted cells
      for (const key of toDelete) {
        this.cells.delete(key);
      }

      // Add updated cells
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      // Update max bounds
      this.maxCol = Math.max(0, this.maxCol - count);

      return ok(undefined);
    } catch (error) {
      return err(`Failed to delete columns: ${error}`);
    }
  }

  /**
   * Get all cells in the grid
   */
  getAllCells(): Map<CellAddress, Cell> {
    const result = new Map<CellAddress, Cell>();

    for (const [key, cell] of this.cells.entries()) {
      const address = this.keyToAddress(key);
      result.set(address, cell);
    }

    return result;
  }

  /**
   * Get cells in a specific row
   */
  getCellsInRow(row: number): Map<number, Cell> {
    const result = new Map<number, Cell>();

    for (const [key, cell] of this.cells.entries()) {
      const address = this.keyToAddress(key);
      if (address.row === row) {
        result.set(address.col, cell);
      }
    }

    return result;
  }

  /**
   * Get cells in a specific column
   */
  getCellsInColumn(col: number): Map<number, Cell> {
    const result = new Map<number, Cell>();

    for (const [key, cell] of this.cells.entries()) {
      const address = this.keyToAddress(key);
      if (address.col === col) {
        result.set(address.row, cell);
      }
    }

    return result;
  }

  /**
   * Get the current bounds of the grid
   */
  getBounds(): { maxRow: number; maxCol: number } {
    return { maxRow: this.maxRow, maxCol: this.maxCol };
  }

  /**
   * Clear all cells
   */
  clear(): void {
    this.cells.clear();
    this.maxRow = 0;
    this.maxCol = 0;
  }

  /**
   * Get the number of cells in the grid
   */
  size(): number {
    return this.cells.size;
  }

  /**
   * Convert cell address to string key
   */
  private addressToKey(address: CellAddress): string {
    return `${address.row},${address.col}`;
  }

  /**
   * Convert string key to cell address
   */
  private keyToAddress(key: string): CellAddress {
    const [row, col] = key.split(",").map(Number);
    const result = CellAddress.create(row, col);
    if (!result.ok) {
      throw new Error(`Invalid cell address from key: ${key}`);
    }
    return result.value;
  }
}
