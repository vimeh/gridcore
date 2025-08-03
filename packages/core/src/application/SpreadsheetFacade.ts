import type { ICellRepository } from "../domain/interfaces/ICellRepository"
import type { IDependencyRepository } from "../domain/interfaces/IDependencyRepository"
import type { IEventService } from "../domain/interfaces/IEventService"
import type { ICalculationService } from "./services/CalculationService"
import type { IFormulaService } from "./services/FormulaService"
import { CellAddress } from "../domain/models/CellAddress"
import { CellRange } from "../domain/models/CellRange"
import { Cell } from "../domain/models/Cell"
import { Result, ok, err } from "../shared/types/Result"
import type { CellValue } from "../domain/models/CellValue"

export interface ISpreadsheetFacade {
  // Cell operations
  setCellValue(address: CellAddress, value: unknown): Result<Cell>
  getCellValue(address: CellAddress): Result<CellValue>
  getCell(address: CellAddress): Result<Cell>
  deleteCell(address: CellAddress): Result<void>
  
  // Range operations
  getCellsInRange(range: CellRange): Result<Map<string, Cell>>
  setCellsInRange(range: CellRange, values: unknown[][]): Result<Map<string, Cell>>
  deleteCellsInRange(range: CellRange): Result<void>
  
  // Calculation
  recalculate(): Result<void>
  recalculateCell(address: CellAddress): Result<Cell>
  
  // Batch operations
  beginBatch(batchId?: string): string
  commitBatch(batchId: string): Result<void>
  rollbackBatch(batchId: string): Result<void>
  
  // Utility
  clear(): void
  getCellCount(): number
}

export class SpreadsheetFacade implements ISpreadsheetFacade {
  private batchOperations = new Map<string, Array<() => Result<void>>>()
  private activeBatches = new Set<string>()
  private batchCounter = 0

  constructor(
    private readonly cellRepository: ICellRepository,
    private readonly dependencyRepository: IDependencyRepository,
    private readonly calculationService: ICalculationService,
    private readonly formulaService: IFormulaService,
    private readonly eventService: IEventService
  ) {}

  setCellValue(address: CellAddress, value: unknown): Result<Cell> {
    try {
      // Create the new cell
      const cellResult = Cell.create(value, address)
      if (!cellResult.ok) {
        return err(cellResult.error)
      }

      const newCell = cellResult.value
      const oldCell = this.cellRepository.get(address)

      // If we're in a batch, queue the operation
      if (this.activeBatches.size > 0) {
        const batchId = Array.from(this.activeBatches)[0]
        this.queueBatchOperation(batchId, () => {
          this.performSetCell(address, newCell, oldCell)
          // Calculate the cell
          const calcResult = this.calculationService.calculateCell(address)
          if (calcResult.ok) {
            this.cellRepository.set(address, calcResult.value)
          }
          return ok(undefined)
        })
        return ok(newCell)
      }

      // Perform the operation immediately
      this.performSetCell(address, newCell, oldCell)

      // Calculate the cell
      const calcResult = this.calculationService.calculateCell(address)
      if (!calcResult.ok) {
        return err(calcResult.error)
      }

      // Update with calculated value
      this.cellRepository.set(address, calcResult.value)

      // Recalculate dependents
      this.calculationService.recalculateDependents(address)

      return ok(calcResult.value)
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown error setting cell value")
    }
  }

  private performSetCell(address: CellAddress, newCell: Cell, oldCell: Cell | undefined): void {
    // Update repository
    this.cellRepository.set(address, newCell)

    // Update dependencies if it's a formula
    if (oldCell?.hasFormula()) {
      this.dependencyRepository.clearDependencies(address)
    }

    if (newCell.hasFormula() && newCell.formula) {
      const deps = this.formulaService.getDependencies(newCell.formula)
      for (const depStr of deps) {
        const depAddr = CellAddress.fromString(depStr)
        if (depAddr.ok) {
          this.dependencyRepository.addDependency(address, depAddr.value)
        }
      }
    }

    // Emit event
    this.eventService.emit({
      type: "CellValueChanged",
      timestamp: new Date(),
      address,
      oldValue: oldCell,
      newValue: newCell,
    })

    // Invalidate calculation cache
    this.calculationService.invalidateCache(address)
  }

  getCellValue(address: CellAddress): Result<CellValue> {
    const cell = this.cellRepository.get(address)
    if (!cell) {
      return ok(null)
    }
    
    // If it has a formula, ensure it's calculated
    if (cell.hasFormula()) {
      const calcResult = this.calculationService.calculateCell(address)
      if (!calcResult.ok) {
        return err(calcResult.error)
      }
      return ok(calcResult.value.computedValue ?? null)
    }
    
    return ok(cell.computedValue ?? null)
  }

  getCell(address: CellAddress): Result<Cell> {
    const cell = this.cellRepository.get(address)
    if (!cell) {
      return err(`Cell not found at ${address.toString()}`)
    }
    
    // If it has a formula, ensure it's calculated
    if (cell.hasFormula()) {
      return this.calculationService.calculateCell(address)
    }
    
    return ok(cell)
  }

  deleteCell(address: CellAddress): Result<void> {
    const cell = this.cellRepository.get(address)
    if (!cell) {
      return ok(undefined)
    }

    // If we're in a batch, queue the operation
    if (this.activeBatches.size > 0) {
      const batchId = Array.from(this.activeBatches)[0]
      this.queueBatchOperation(batchId, () => {
        this.performDeleteCell(address)
        return ok(undefined)
      })
      return ok(undefined)
    }

    this.performDeleteCell(address)

    // Recalculate dependents
    this.calculationService.recalculateDependents(address)

    return ok(undefined)
  }

  private performDeleteCell(address: CellAddress): void {
    // Clear dependencies
    this.dependencyRepository.clearDependencies(address)

    // Delete from repository
    this.cellRepository.delete(address)

    // Emit event
    this.eventService.emit({
      type: "CellsDeleted",
      timestamp: new Date(),
      addresses: [address],
    })

    // Invalidate cache
    this.calculationService.invalidateCache(address)
  }

  getCellsInRange(range: CellRange): Result<Map<string, Cell>> {
    try {
      const cells = this.cellRepository.getAllInRange(range)
      
      // Calculate any formula cells
      const calculatedCells = new Map<string, Cell>()
      for (const [key, cell] of cells) {
        if (cell.hasFormula()) {
          const addr = CellAddress.fromString(key)
          if (addr.ok) {
            const calcResult = this.calculationService.calculateCell(addr.value)
            if (calcResult.ok) {
              calculatedCells.set(key, calcResult.value)
            } else {
              calculatedCells.set(key, cell)
            }
          }
        } else {
          calculatedCells.set(key, cell)
        }
      }
      
      return ok(calculatedCells)
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown error getting cells in range")
    }
  }

  setCellsInRange(range: CellRange, values: unknown[][]): Result<Map<string, Cell>> {
    if (values.length === 0) {
      return ok(new Map())
    }

    const batchId = this.beginBatch()
    const addresses: CellAddress[] = []

    try {
      let row = 0
      for (const rowValues of values) {
        let col = 0
        for (const value of rowValues) {
          const addressResult = range.start.offset(row, col)
          if (!addressResult.ok) {
            continue
          }
          const address = addressResult.value
          if (address.row <= range.end.row && address.col <= range.end.col) {
            const result = this.setCellValue(address, value)
            if (result.ok) {
              addresses.push(address)
            }
          }
          col++
        }
        row++
      }

      const commitResult = this.commitBatch(batchId)
      if (!commitResult.ok) {
        return err(commitResult.error)
      }

      // Get the actual calculated cells after commit
      const finalResults = new Map<string, Cell>()
      for (const address of addresses) {
        const cell = this.cellRepository.get(address)
        if (cell) {
          finalResults.set(address.toString(), cell)
        }
      }

      return ok(finalResults)
    } catch (error) {
      this.rollbackBatch(batchId)
      return err(error instanceof Error ? error.message : "Unknown error setting cells in range")
    }
  }

  deleteCellsInRange(range: CellRange): Result<void> {
    const batchId = this.beginBatch()

    try {
      for (const address of range.cells()) {
        this.deleteCell(address)
      }

      return this.commitBatch(batchId)
    } catch (error) {
      this.rollbackBatch(batchId)
      return err(error instanceof Error ? error.message : "Unknown error deleting cells in range")
    }
  }

  recalculate(): Result<void> {
    try {
      // Clear calculation cache
      this.calculationService.clearCache()

      // Get all cells with formulas
      const allCells = this.cellRepository.getAll()
      const formulaCells: CellAddress[] = []

      for (const [key, cell] of allCells) {
        if (cell.hasFormula()) {
          const addr = CellAddress.fromString(key)
          if (addr.ok) {
            formulaCells.push(addr.value)
          }
        }
      }

      // Calculate all formula cells
      const result = this.calculationService.calculateRange(formulaCells)
      if (!result.ok) {
        return err(result.error)
      }

      // Update cells with calculated values
      for (const [key, cell] of result.value) {
        const addr = CellAddress.fromString(key)
        if (addr.ok) {
          this.cellRepository.set(addr.value, cell)
        }
      }

      return ok(undefined)
    } catch (error) {
      return err(error instanceof Error ? error.message : "Unknown error during recalculation")
    }
  }

  recalculateCell(address: CellAddress): Result<Cell> {
    this.calculationService.invalidateCache(address)
    return this.calculationService.calculateCell(address)
  }

  beginBatch(batchId?: string): string {
    const id = batchId || `batch-${++this.batchCounter}`
    this.batchOperations.set(id, [])
    this.activeBatches.add(id)

    this.eventService.emit({
      type: "BatchUpdateStarted",
      timestamp: new Date(),
      batchId: id,
    })

    return id
  }

  commitBatch(batchId: string): Result<void> {
    const operations = this.batchOperations.get(batchId)
    if (!operations) {
      return err(`Batch ${batchId} not found`)
    }

    this.activeBatches.delete(batchId)

    try {
      // Execute all operations
      for (const operation of operations) {
        const result = operation()
        if (!result.ok) {
          // Rollback on error
          this.rollbackBatch(batchId)
          return err(result.error)
        }
      }

      // Recalculate all affected cells
      const affectedCells = new Set<string>()
      const allCells = this.cellRepository.getAll()

      for (const [key, cell] of allCells) {
        if (cell.hasFormula()) {
          affectedCells.add(key)
        }
      }

      const affectedAddresses: CellAddress[] = []
      for (const key of affectedCells) {
        const addr = CellAddress.fromString(key)
        if (addr.ok) {
          affectedAddresses.push(addr.value)
        }
      }

      const calcResult = this.calculationService.calculateRange(affectedAddresses)
      if (!calcResult.ok) {
        return err(calcResult.error)
      }

      // Update cells
      for (const [key, cell] of calcResult.value) {
        const addr = CellAddress.fromString(key)
        if (addr.ok) {
          this.cellRepository.set(addr.value, cell)
        }
      }

      this.eventService.emit({
        type: "BatchUpdateCompleted",
        timestamp: new Date(),
        batchId,
        affectedCells: affectedAddresses,
      })

      this.batchOperations.delete(batchId)
      return ok(undefined)
    } catch (error) {
      this.rollbackBatch(batchId)
      return err(error instanceof Error ? error.message : "Unknown error committing batch")
    }
  }

  rollbackBatch(batchId: string): Result<void> {
    this.activeBatches.delete(batchId)
    this.batchOperations.delete(batchId)
    return ok(undefined)
  }

  private queueBatchOperation(batchId: string, operation: () => Result<void>): void {
    const operations = this.batchOperations.get(batchId)
    if (operations) {
      operations.push(operation)
    }
  }

  clear(): void {
    this.cellRepository.clear()
    this.dependencyRepository.clearAll()
    this.calculationService.clearCache()
    this.eventService.clear()
    this.batchOperations.clear()
    this.activeBatches.clear()
  }

  getCellCount(): number {
    return this.cellRepository.count()
  }
}