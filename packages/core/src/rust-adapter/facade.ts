import type { CellAddress } from '../domain/models/CellAddress'
import type { CellValue } from '../domain/models/CellValue'
import type { Cell } from '../domain/models/Cell'
import { ok, err, type Result } from '../shared/types/Result'
import { EventEmitter } from 'events'

// Type definitions for WASM module
interface WasmModule {
  WasmSpreadsheetFacade: {
    new(): WasmSpreadsheetFacade
  }
  WasmCellAddress: {
    new(col: number, row: number): WasmCellAddress
    fromString(address: string): WasmCellAddress
  }
  WasmCellValue: {
    fromJS(value: any): WasmCellValue
  }
}

interface WasmSpreadsheetFacade {
  setCellValue(address: WasmCellAddress, value: string): WasmCell
  getCellValue(address: WasmCellAddress): any
  getCell(address: WasmCellAddress): WasmCell | undefined
  deleteCell(address: WasmCellAddress): void
  recalculate(): void
  recalculateCell(address: WasmCellAddress): WasmCell
  beginBatch(batchId?: string): string
  commitBatch(batchId: string): void
  rollbackBatch(batchId: string): void
  clear(): void
  getCellCount(): number
  setCellValues(updates: Record<string, string>): void
  onCellUpdate(callback: (event: any) => void): void
  onBatchComplete(callback: (event: any) => void): void
  onCalculationComplete(callback: (event: any) => void): void
  free(): void
}

interface WasmCellAddress {
  col: number
  row: number
  toString(): string
  free(): void
}

interface WasmCell {
  toJS(): any
  toString(): string
  free(): void
}

interface WasmCellValue {
  toJS(): any
  toString(): string
  isNull(): boolean
  isNumber(): boolean
  isString(): boolean
  isBoolean(): boolean
  isError(): boolean
  free(): void
}

/**
 * TypeScript adapter for the Rust SpreadsheetFacade
 */
export class SpreadsheetFacade extends EventEmitter {
  private wasmFacade?: WasmSpreadsheetFacade
  private wasmModule?: WasmModule
  private initialized = false

  /**
   * Initialize the WASM module and facade
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Dynamic import to handle WASM loading
    const wasmModule = await import('../../../gridcore-rs/gridcore-wasm/pkg/gridcore_wasm')
    await wasmModule.default() // Initialize WASM

    this.wasmModule = wasmModule as any
    this.wasmFacade = new this.wasmModule.WasmSpreadsheetFacade()

    // Set up event callbacks
    this.wasmFacade.onCellUpdate((event: any) => {
      this.emit('cell:update', event)
    })

    this.wasmFacade.onBatchComplete((event: any) => {
      this.emit('batch:complete', event)
    })

    this.wasmFacade.onCalculationComplete((event: any) => {
      this.emit('calculation:complete', event)
    })

    this.initialized = true
  }

  /**
   * Ensure the facade is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.wasmFacade || !this.wasmModule) {
      throw new Error('SpreadsheetFacade not initialized. Call init() first.')
    }
  }

  /**
   * Convert TypeScript CellAddress to WASM CellAddress
   */
  private toWasmAddress(address: CellAddress): WasmCellAddress {
    this.ensureInitialized()
    return new this.wasmModule!.WasmCellAddress(address.col, address.row)
  }

  /**
   * Set a cell value
   */
  setCellValue(address: CellAddress, value: unknown): Result<Cell> {
    try {
      this.ensureInitialized()
      
      const wasmAddr = this.toWasmAddress(address)
      const valueStr = this.valueToString(value)
      
      try {
        const wasmCell = this.wasmFacade!.setCellValue(wasmAddr, valueStr)
        const cellValue = wasmCell.toJS()
        wasmCell.free()
        
        // Create a TypeScript Cell object
        const cell: Cell = {
          address,
          value: cellValue,
          formula: valueStr.startsWith('=') ? valueStr : undefined,
          error: cellValue?.error,
        } as any // Type assertion for compatibility
        
        return ok(cell)
      } finally {
        wasmAddr.free()
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Get a cell value
   */
  getCellValue(address: CellAddress): Result<CellValue> {
    try {
      this.ensureInitialized()
      
      const wasmAddr = this.toWasmAddress(address)
      
      try {
        const value = this.wasmFacade!.getCellValue(wasmAddr)
        return ok(value as CellValue)
      } finally {
        wasmAddr.free()
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Get a cell
   */
  getCell(address: CellAddress): Result<Cell | undefined> {
    try {
      this.ensureInitialized()
      
      const wasmAddr = this.toWasmAddress(address)
      
      try {
        const wasmCell = this.wasmFacade!.getCell(wasmAddr)
        
        if (!wasmCell) {
          return ok(undefined)
        }
        
        const cellValue = wasmCell.toJS()
        wasmCell.free()
        
        const cell: Cell = {
          address,
          value: cellValue,
          formula: undefined, // Would need to track this separately
          error: cellValue?.error,
        } as any
        
        return ok(cell)
      } finally {
        wasmAddr.free()
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Delete a cell
   */
  deleteCell(address: CellAddress): Result<void> {
    try {
      this.ensureInitialized()
      
      const wasmAddr = this.toWasmAddress(address)
      
      try {
        this.wasmFacade!.deleteCell(wasmAddr)
        return ok(undefined)
      } finally {
        wasmAddr.free()
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Recalculate all cells
   */
  recalculate(): Result<void> {
    try {
      this.ensureInitialized()
      this.wasmFacade!.recalculate()
      return ok(undefined)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Recalculate a specific cell
   */
  recalculateCell(address: CellAddress): Result<Cell> {
    try {
      this.ensureInitialized()
      
      const wasmAddr = this.toWasmAddress(address)
      
      try {
        const wasmCell = this.wasmFacade!.recalculateCell(wasmAddr)
        const cellValue = wasmCell.toJS()
        wasmCell.free()
        
        const cell: Cell = {
          address,
          value: cellValue,
          formula: undefined,
          error: cellValue?.error,
        } as any
        
        return ok(cell)
      } finally {
        wasmAddr.free()
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Begin a batch operation
   */
  beginBatch(batchId?: string): string {
    this.ensureInitialized()
    return this.wasmFacade!.beginBatch(batchId)
  }

  /**
   * Commit a batch operation
   */
  commitBatch(batchId: string): Result<void> {
    try {
      this.ensureInitialized()
      this.wasmFacade!.commitBatch(batchId)
      return ok(undefined)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Rollback a batch operation
   */
  rollbackBatch(batchId: string): Result<void> {
    try {
      this.ensureInitialized()
      this.wasmFacade!.rollbackBatch(batchId)
      return ok(undefined)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Set multiple cell values at once
   */
  setCellValues(updates: Map<CellAddress, unknown>): Result<void> {
    try {
      this.ensureInitialized()
      
      // Convert to object format expected by WASM
      const updateObj: Record<string, string> = {}
      for (const [address, value] of updates) {
        const key = `${String.fromCharCode(65 + address.col)}${address.row + 1}`
        updateObj[key] = this.valueToString(value)
      }
      
      this.wasmFacade!.setCellValues(updateObj)
      return ok(undefined)
    } catch (error) {
      return err(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Clear all cells
   */
  clear(): void {
    this.ensureInitialized()
    this.wasmFacade!.clear()
  }

  /**
   * Get the number of cells
   */
  getCellCount(): number {
    this.ensureInitialized()
    return this.wasmFacade!.getCellCount()
  }

  /**
   * Clean up WASM resources
   */
  dispose(): void {
    if (this.wasmFacade) {
      this.wasmFacade.free()
      this.wasmFacade = undefined
    }
    this.initialized = false
    this.removeAllListeners()
  }

  /**
   * Convert a value to string for WASM
   */
  private valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }
    
    if (typeof value === 'string') {
      return value
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    
    if (typeof value === 'object' && 'formula' in value) {
      return (value as any).formula
    }
    
    return JSON.stringify(value)
  }
}

/**
 * Create and initialize a SpreadsheetFacade
 */
export async function createSpreadsheetFacade(): Promise<SpreadsheetFacade> {
  const facade = new SpreadsheetFacade()
  await facade.init()
  return facade
}