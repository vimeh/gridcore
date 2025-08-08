import type {
  CellAddress,
  Cell,
  FillOperation,
  FillResult,
  BatchOperation,
  BatchResult,
} from "../types"

// Import WASM functions from gridcore-core
import * as wasm from "gridcore-core"

/**
 * TypeScript wrapper for the WASM SpreadsheetFacade
 * Manages the lifecycle and provides type-safe access to facade functions
 */
export class FacadeWrapper {
  private facadeId: number
  private disposed: boolean = false

  constructor() {
    this.facadeId = wasm.createFacade()
  }

  /**
   * Destroy the facade and free its resources
   */
  dispose(): void {
    if (!this.disposed) {
      wasm.destroyFacade(this.facadeId)
      this.disposed = true
    }
  }

  /**
   * Set the callback for cell update events
   */
  onCellUpdate(callback: (event: any) => void): void {
    this.checkDisposed()
    wasm.facadeSetOnCellUpdate(this.facadeId, callback)
  }

  /**
   * Set the callback for batch complete events
   */
  onBatchComplete(callback: (event: any) => void): void {
    this.checkDisposed()
    wasm.facadeSetOnBatchComplete(this.facadeId, callback)
  }

  /**
   * Set the callback for calculation complete events
   */
  onCalculationComplete(callback: (event: any) => void): void {
    this.checkDisposed()
    wasm.facadeSetOnCalculationComplete(this.facadeId, callback)
  }

  /**
   * Set a cell value
   */
  setCellValue(address: CellAddress, value: string): Cell {
    this.checkDisposed()
    return wasm.facadeSetCellValue(this.facadeId, address, value)
  }

  /**
   * Get a cell value
   */
  getCellValue(address: CellAddress): any {
    this.checkDisposed()
    return wasm.facadeGetCellValue(this.facadeId, address)
  }

  /**
   * Get a cell
   */
  getCell(address: CellAddress): Cell | null {
    this.checkDisposed()
    return wasm.facadeGetCell(this.facadeId, address)
  }

  /**
   * Get a cell formula
   */
  getCellFormula(address: CellAddress): string | null {
    this.checkDisposed()
    return wasm.facadeGetCellFormula(this.facadeId, address)
  }

  /**
   * Delete a cell
   */
  deleteCell(address: CellAddress): void {
    this.checkDisposed()
    wasm.facadeDeleteCell(this.facadeId, address)
  }

  /**
   * Clear a cell
   */
  clearCell(address: CellAddress): void {
    this.checkDisposed()
    wasm.facadeClearCell(this.facadeId, address)
  }

  /**
   * Recalculate all cells
   */
  recalculate(): void {
    this.checkDisposed()
    wasm.facadeRecalculate(this.facadeId)
  }

  /**
   * Recalculate a specific cell
   */
  recalculateCell(address: CellAddress): Cell {
    this.checkDisposed()
    return wasm.facadeRecalculateCell(this.facadeId, address)
  }

  /**
   * Begin a batch operation
   */
  beginBatch(batchId?: string): string {
    this.checkDisposed()
    return wasm.facadeBeginBatch(this.facadeId, batchId || null)
  }

  /**
   * Commit a batch operation
   */
  commitBatch(batchId: string): void {
    this.checkDisposed()
    wasm.facadeCommitBatch(this.facadeId, batchId)
  }

  /**
   * Rollback a batch operation
   */
  rollbackBatch(batchId: string): void {
    this.checkDisposed()
    wasm.facadeRollbackBatch(this.facadeId, batchId)
  }

  /**
   * Clear all cells
   */
  clear(): void {
    this.checkDisposed()
    wasm.facadeClear(this.facadeId)
  }

  /**
   * Get the number of cells
   */
  getCellCount(): number {
    this.checkDisposed()
    return wasm.facadeGetCellCount(this.facadeId)
  }

  /**
   * Perform a fill operation
   */
  fill(operation: FillOperation): FillResult {
    this.checkDisposed()
    return wasm.facadeFill(this.facadeId, operation)
  }

  /**
   * Preview a fill operation
   */
  previewFill(operation: FillOperation): FillResult {
    this.checkDisposed()
    return wasm.facadePreviewFill(this.facadeId, operation)
  }

  /**
   * Execute batch operations
   */
  executeBatchOperations(operations: BatchOperation[]): BatchResult[] {
    this.checkDisposed()
    return wasm.facadeExecuteBatchOperations(this.facadeId, operations)
  }

  /**
   * Insert a row at the specified index
   */
  insertRow(rowIndex: number): void {
    this.checkDisposed()
    wasm.facadeInsertRow(this.facadeId, rowIndex)
  }

  /**
   * Delete a row at the specified index
   */
  deleteRow(rowIndex: number): void {
    this.checkDisposed()
    wasm.facadeDeleteRow(this.facadeId, rowIndex)
  }

  /**
   * Insert a column at the specified index
   */
  insertColumn(colIndex: number): void {
    this.checkDisposed()
    wasm.facadeInsertColumn(this.facadeId, colIndex)
  }

  /**
   * Delete a column at the specified index
   */
  deleteColumn(colIndex: number): void {
    this.checkDisposed()
    wasm.facadeDeleteColumn(this.facadeId, colIndex)
  }

  /**
   * Undo the last operation
   */
  undo(): void {
    this.checkDisposed()
    wasm.facadeUndo(this.facadeId)
  }

  /**
   * Redo the last undone operation
   */
  redo(): void {
    this.checkDisposed()
    wasm.facadeRedo(this.facadeId)
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    this.checkDisposed()
    return wasm.facadeCanUndo(this.facadeId)
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    this.checkDisposed()
    return wasm.facadeCanRedo(this.facadeId)
  }

  /**
   * Get undo history descriptions
   */
  getUndoHistory(): string[] {
    this.checkDisposed()
    return wasm.facadeGetUndoHistory(this.facadeId)
  }

  /**
   * Get redo history descriptions
   */
  getRedoHistory(): string[] {
    this.checkDisposed()
    return wasm.facadeGetRedoHistory(this.facadeId)
  }

  /**
   * Clear undo/redo history
   */
  clearHistory(): void {
    this.checkDisposed()
    wasm.facadeClearHistory(this.facadeId)
  }

  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error("FacadeWrapper has been disposed")
    }
  }
}

// Provide compatibility export for migration
export class WasmSpreadsheetFacade extends FacadeWrapper {
  constructor() {
    super()
    console.warn("WasmSpreadsheetFacade is deprecated, use FacadeWrapper instead")
  }
}