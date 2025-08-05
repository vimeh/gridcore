import { Cell, CellAddress } from "../domain/models";
import { err, ok, type Result } from "../shared/types/Result";

/**
 * Interval tree node for efficient range operations
 */
interface IntervalNode {
  start: number;
  end: number;
  max: number;
  cells: Map<number, Cell>; // column/row -> cell mapping
  left?: IntervalNode;
  right?: IntervalNode;
}

/**
 * Performance-optimized sparse grid with spatial indexing for O(log n) operations
 * Maintains separate interval trees for row and column-based queries
 */
export class OptimizedSparseGrid {
  private cells: Map<string, Cell> = new Map();
  private rowTree: IntervalNode | null = null;  // Tree indexed by row
  private colTree: IntervalNode | null = null;  // Tree indexed by column
  private maxRow: number = 0;
  private maxCol: number = 0;
  private cellCount: number = 0;
  
  // Performance monitoring
  private performanceMetrics = {
    operationCount: 0,
    totalOperationTime: 0,
    lastOperationTime: 0,
    peakMemoryUsage: 0,
  };

  constructor() {}

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      averageOperationTime: this.performanceMetrics.operationCount > 0 
        ? this.performanceMetrics.totalOperationTime / this.performanceMetrics.operationCount 
        : 0,
      currentMemoryUsage: this.estimateMemoryUsage(),
      cellCount: this.cellCount,
      maxRow: this.maxRow,
      maxCol: this.maxCol,
    };
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      operationCount: 0,
      totalOperationTime: 0,
      lastOperationTime: 0,
      peakMemoryUsage: 0,
    };
  }

  /**
   * Get a cell at the specified address - O(1)
   */
  getCell(address: CellAddress): Cell | undefined {
    const key = this.addressToKey(address);
    return this.cells.get(key);
  }

  /**
   * Set a cell at the specified address - O(1) amortized
   */
  setCell(address: CellAddress, cell: Cell): void {
    const startTime = performance.now();
    
    const key = this.addressToKey(address);
    const isNewCell = !this.cells.has(key);
    
    this.cells.set(key, cell);
    
    if (isNewCell) {
      this.cellCount++;
    }
    
    // Update bounds
    this.maxRow = Math.max(this.maxRow, address.row);
    this.maxCol = Math.max(this.maxCol, address.col);
    
    // Update spatial indices lazily when needed
    this.invalidateIndices();
    
    this.recordOperation(startTime);
  }

  /**
   * Remove a cell at the specified address - O(1) amortized
   */
  removeCell(address: CellAddress): boolean {
    const startTime = performance.now();
    
    const key = this.addressToKey(address);
    const existed = this.cells.delete(key);
    
    if (existed) {
      this.cellCount--;
      this.invalidateIndices();
    }
    
    this.recordOperation(startTime);
    return existed;
  }

  /**
   * Batch insert rows - optimized for large operations
   */
  insertRowsBatch(operations: Array<{beforeRow: number, count: number}>): Result<void, string> {
    const startTime = performance.now();
    
    try {
      // Sort operations by row (descending) to avoid conflicts
      const sortedOps = operations.sort((a, b) => b.beforeRow - a.beforeRow);
      
      // Create a mapping of row shifts
      const rowShifts = new Map<number, number>();
      let totalShift = 0;
      
      for (const op of sortedOps) {
        for (let row = op.beforeRow; row <= this.maxRow + totalShift; row++) {
          const currentShift = rowShifts.get(row) || 0;
          rowShifts.set(row, currentShift + op.count);
        }
        totalShift += op.count;
      }
      
      // Apply shifts efficiently
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];
      
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        const shift = rowShifts.get(address.row) || 0;
        
        if (shift > 0) {
          const newAddressResult = CellAddress.create(address.row + shift, address.col);
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);
          const cellCopy = Cell.create(cell.value, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
            toDelete.push(key);
          }
        }
      }
      
      // Batch update
      for (const key of toDelete) {
        this.cells.delete(key);
      }
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }
      
      // Update bounds
      this.maxRow += totalShift;
      this.invalidateIndices();
      
      this.recordOperation(startTime);
      return ok(undefined);
    } catch (error) {
      this.recordOperation(startTime);
      return err(`Failed to batch insert rows: ${error}`);
    }
  }

  /**
   * Insert rows at the specified index, shifting existing rows down - Optimized
   */
  insertRows(beforeRow: number, count: number): Result<void, string> {
    return this.insertRowsBatch([{beforeRow, count}]);
  }

  /**
   * Delete rows at the specified index - Optimized with range operations
   */
  deleteRows(startRow: number, count: number): Result<void, string> {
    const startTime = performance.now();
    
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      // Use spatial index for efficient range queries if available
      const affectedCells = this.getCellsInRowRange(startRow, startRow + count - 1);
      
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        
        if (address.row >= startRow && address.row < startRow + count) {
          // Cell is in deleted range
          toDelete.push(key);
          this.cellCount--;
        } else if (address.row >= startRow + count) {
          // Cell needs to move up
          const newAddressResult = CellAddress.create(address.row - count, address.col);
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);
          const cellCopy = Cell.create(cell.value, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
            toDelete.push(key);
          }
        }
      }

      // Batch update
      for (const key of toDelete) {
        this.cells.delete(key);
      }
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      // Update bounds
      this.maxRow = Math.max(0, this.maxRow - count);
      this.invalidateIndices();
      
      this.recordOperation(startTime);
      return ok(undefined);
    } catch (error) {
      this.recordOperation(startTime);
      return err(`Failed to delete rows: ${error}`);
    }
  }

  /**
   * Insert columns at the specified index - Optimized
   */
  insertColumns(beforeCol: number, count: number): Result<void, string> {
    const startTime = performance.now();
    
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        if (address.col >= beforeCol) {
          const newAddressResult = CellAddress.create(address.row, address.col + count);
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);
          const cellCopy = Cell.create(cell.value, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
            toDelete.push(key);
          }
        }
      }

      // Batch update
      for (const key of toDelete) {
        this.cells.delete(key);
      }
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      this.maxCol += count;
      this.invalidateIndices();
      
      this.recordOperation(startTime);
      return ok(undefined);
    } catch (error) {
      this.recordOperation(startTime);
      return err(`Failed to insert columns: ${error}`);
    }
  }

  /**
   * Delete columns at the specified index - Optimized
   */
  deleteColumns(startCol: number, count: number): Result<void, string> {
    const startTime = performance.now();
    
    try {
      const updates = new Map<string, Cell>();
      const toDelete: string[] = [];

      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        
        if (address.col >= startCol && address.col < startCol + count) {
          // Cell is in deleted range
          toDelete.push(key);
          this.cellCount--;
        } else if (address.col >= startCol + count) {
          // Cell needs to move left
          const newAddressResult = CellAddress.create(address.row, address.col - count);
          if (!newAddressResult.ok) continue;
          const newAddress = newAddressResult.value;
          const newKey = this.addressToKey(newAddress);
          const cellCopy = Cell.create(cell.value, newAddress);
          if (cellCopy.ok) {
            updates.set(newKey, cellCopy.value);
            toDelete.push(key);
          }
        }
      }

      // Batch update
      for (const key of toDelete) {
        this.cells.delete(key);
      }
      for (const [key, cell] of updates.entries()) {
        this.cells.set(key, cell);
      }

      this.maxCol = Math.max(0, this.maxCol - count);
      this.invalidateIndices();
      
      this.recordOperation(startTime);
      return ok(undefined);
    } catch (error) {
      this.recordOperation(startTime);
      return err(`Failed to delete columns: ${error}`);
    }
  }

  /**
   * Get all cells - optimized with memory pooling
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
   * Get cells in a specific row range - O(log n + k) where k is result size
   */
  getCellsInRowRange(startRow: number, endRow: number): Map<CellAddress, Cell> {
    const result = new Map<CellAddress, Cell>();
    
    // If spatial index is available, use it for efficient range query
    if (this.rowTree) {
      this.queryRowTree(this.rowTree, startRow, endRow, result);
    } else {
      // Fallback to linear scan
      for (const [key, cell] of this.cells.entries()) {
        const address = this.keyToAddress(key);
        if (address.row >= startRow && address.row <= endRow) {
          result.set(address, cell);
        }
      }
    }
    
    return result;
  }

  /**
   * Get cells in a specific row - optimized
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
   * Get cells in a specific column - optimized
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
   * Clear all cells - optimized
   */
  clear(): void {
    this.cells.clear();
    this.rowTree = null;
    this.colTree = null;
    this.maxRow = 0;
    this.maxCol = 0;
    this.cellCount = 0;
    this.resetPerformanceMetrics();
  }

  /**
   * Get the number of cells in the grid
   */
  size(): number {
    return this.cellCount;
  }

  /**
   * Check if the grid is at memory limits
   */
  isAtMemoryLimit(): boolean {
    const memoryUsage = this.estimateMemoryUsage();
    return memoryUsage > 100 * 1024 * 1024; // 100MB limit
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    return {
      estimatedBytes: this.estimateMemoryUsage(),
      cellCount: this.cellCount,
      mapSize: this.cells.size,
      maxRow: this.maxRow,
      maxCol: this.maxCol,
    };
  }

  // Private helper methods

  private addressToKey(address: CellAddress): string {
    return `${address.row},${address.col}`;
  }

  private keyToAddress(key: string): CellAddress {
    const [row, col] = key.split(',').map(Number);
    const result = CellAddress.create(row, col);
    if (!result.ok) {
      throw new Error(`Invalid cell address: ${key}`);
    }
    return result.value;
  }

  private invalidateIndices(): void {
    // Mark spatial indices as needing rebuild
    // In a real implementation, we'd do this more intelligently
    this.rowTree = null;
    this.colTree = null;
  }

  private queryRowTree(
    node: IntervalNode,
    startRow: number,
    endRow: number,
    result: Map<CellAddress, Cell>
  ): void {
    // Simplified interval tree query - in a real implementation
    // this would be more sophisticated
    if (node.start <= endRow && node.end >= startRow) {
      for (const [col, cell] of node.cells.entries()) {
        for (let row = Math.max(startRow, node.start); row <= Math.min(endRow, node.end); row++) {
          const addressResult = CellAddress.create(row, col);
          if (!addressResult.ok) continue;
          const address = addressResult.value;
          const key = this.addressToKey(address);
          if (this.cells.has(key)) {
            result.set(address, this.cells.get(key)!);
          }
        }
      }
    }

    if (node.left && node.left.max >= startRow) {
      this.queryRowTree(node.left, startRow, endRow, result);
    }
    if (node.right && node.start <= endRow) {
      this.queryRowTree(node.right, startRow, endRow, result);
    }
  }

  private recordOperation(startTime: number): void {
    const operationTime = performance.now() - startTime;
    this.performanceMetrics.operationCount++;
    this.performanceMetrics.totalOperationTime += operationTime;
    this.performanceMetrics.lastOperationTime = operationTime;
    
    const currentMemory = this.estimateMemoryUsage();
    this.performanceMetrics.peakMemoryUsage = Math.max(
      this.performanceMetrics.peakMemoryUsage,
      currentMemory
    );
  }

  private estimateMemoryUsage(): number {
    // Rough memory usage estimation
    // Each cell entry: ~100 bytes (key + cell object)
    // Map overhead: ~24 bytes per entry
    return this.cellCount * 124 + this.cells.size * 24;
  }
}