import type { SpreadsheetChangeEvent, SpreadsheetChangeListener } from "../SpreadsheetEngine"
import type { Cell as LegacyCell, CellAddress as LegacyCellAddress, CellValueType, GridDimensions } from "../types"
import type { SpreadsheetState, SpreadsheetStateOptions } from "../types/SpreadsheetState"
import { SpreadsheetFacade } from "../application/SpreadsheetFacade"
import { InMemoryCellRepository } from "../infrastructure/repositories/InMemoryCellRepository"
import { InMemoryDependencyRepository } from "../infrastructure/repositories/InMemoryDependencyRepository"
import { CalculationService } from "../application/services/CalculationService"
import { FormulaService } from "../application/services/FormulaService"
import { FormulaParser } from "../infrastructure/parsers/FormulaParser"
import { FormulaEvaluator } from "../infrastructure/evaluators/FormulaEvaluator"
import { EventStore } from "../infrastructure/stores/EventStore"
import { CellAddress } from "../domain/models/CellAddress"
import { CellRange } from "../domain/models/CellRange"
import { Cell } from "../domain/models/Cell"
import type { CellValueChangedEvent, BatchUpdateCompletedEvent, CellsDeletedEvent } from "../domain/interfaces/IEventService"
import { parseCellAddress, cellAddressToString } from "../utils/cellAddress"

/**
 * Adapter that provides backward compatibility with the old SpreadsheetEngine API
 * while using the new modular architecture underneath
 */
export class SpreadsheetEngineAdapter {
  private facade: SpreadsheetFacade
  private cellRepository: InMemoryCellRepository
  private dependencyRepository: InMemoryDependencyRepository
  private eventStore: EventStore
  private listeners: Set<SpreadsheetChangeListener>
  private rows: number
  private cols: number
  private isCalculating: boolean = false
  private calculationQueue: Set<string> = new Set()

  constructor(rows: number = 1000, cols: number = 26) {
    this.rows = rows
    this.cols = cols
    this.listeners = new Set()
    
    // Initialize infrastructure
    this.cellRepository = new InMemoryCellRepository()
    this.dependencyRepository = new InMemoryDependencyRepository()
    this.eventStore = new EventStore()
    
    // Initialize services
    const parser = new FormulaParser()
    const evaluator = new FormulaEvaluator()
    const formulaService = new FormulaService(parser, evaluator)
    const calculationService = new CalculationService(
      this.cellRepository,
      this.dependencyRepository,
      formulaService,
      this.eventStore
    )
    
    // Initialize facade
    this.facade = new SpreadsheetFacade(
      this.cellRepository,
      this.dependencyRepository,
      calculationService,
      formulaService,
      this.eventStore
    )
    
    // Subscribe to events to adapt them to legacy format
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.eventStore.on("CellValueChanged", (event: CellValueChangedEvent) => {
      const legacyAddress = this.toLegacyAddress(event.address)
      const oldValue = event.oldValue ? this.toLegacyCell(event.oldValue) : undefined
      const newValue = event.newValue ? this.toLegacyCell(event.newValue) : undefined
      
      this.notifyListeners({
        type: "cell-change",
        cells: [{ address: legacyAddress, oldValue, newValue }]
      })
    })
    
    this.eventStore.on("BatchUpdateCompleted", (event: BatchUpdateCompletedEvent) => {
      // Get all cells that were set during the batch
      const batchCells: Array<{ address: LegacyCellAddress; oldValue?: LegacyCell; newValue?: LegacyCell }> = []
      
      // We need to track which cells were actually modified in the batch
      // For now, we'll emit changes for all affected cells plus any cells we know about
      const allCells = this.cellRepository.getAll()
      for (const [key, cell] of allCells) {
        const address = CellAddress.fromString(key)
        if (address.ok) {
          batchCells.push({
            address: this.toLegacyAddress(address.value),
            oldValue: undefined,
            newValue: this.toLegacyCell(cell)
          })
        }
      }
      
      if (batchCells.length > 0) {
        this.notifyListeners({
          type: "batch-change",
          cells: batchCells
        })
      }
    })
    
    this.eventStore.on("CellsDeleted", (event: CellsDeletedEvent) => {
      const changes = event.addresses.map(address => ({
        address: this.toLegacyAddress(address),
        oldValue: undefined,
        newValue: undefined
      }))
      
      this.notifyListeners({
        type: "batch-change",
        cells: changes
      })
    })
  }

  // Event handling
  addEventListener(listener: SpreadsheetChangeListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(listener: SpreadsheetChangeListener): void {
    this.listeners.delete(listener)
  }

  private notifyListeners(event: SpreadsheetChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  // Cell operations
  getCell(address: LegacyCellAddress): LegacyCell | undefined {
    const cellAddress = this.fromLegacyAddress(address)
    if (!cellAddress) return undefined
    
    // Use the facade's getCell method which ensures formulas are calculated
    const result = this.facade.getCell(cellAddress)
    if (result.ok) {
      return this.toLegacyCell(result.value)
    }
    
    // If getCell fails (cell not found), return undefined
    return undefined
  }

  getCellByReference(reference: string): LegacyCell | undefined {
    const address = parseCellAddress(reference)
    if (!address) return undefined
    return this.getCell(address)
  }

  setCell(address: LegacyCellAddress, value: CellValueType, formula?: string): void {
    const cellAddress = this.fromLegacyAddress(address)
    if (!cellAddress) return
    
    // Use the appropriate value - formula takes precedence
    const cellValue = formula ? formula : value
    const result = this.facade.setCellValue(cellAddress, cellValue)
    
    // If setting a formula cell failed due to circular dependency, 
    // we need to ensure the error is captured in the cell
    if (!result.ok && result.error.includes("Circular dependency")) {
      // The cell should already have the error set by the facade
      // Just ensure we don't throw
      return
    }
  }

  setCellByReference(
    reference: string,
    value: CellValueType,
    formula?: string
  ): void {
    const address = parseCellAddress(reference)
    if (!address) {
      throw new Error(`Invalid cell reference: ${reference}`)
    }
    this.setCell(address, value, formula)
  }

  // Batch operations
  setCells(
    updates: Array<{
      address: LegacyCellAddress
      value: CellValueType
      formula?: string
    }>
  ): void {
    const batchId = this.facade.beginBatch()
    
    for (const update of updates) {
      const cellAddress = this.fromLegacyAddress(update.address)
      if (cellAddress) {
        const cellValue = update.formula ? update.formula : update.value
        this.facade.setCellValue(cellAddress, cellValue)
      }
    }
    
    this.facade.commitBatch(batchId)
  }

  // Grid operations
  clearCell(address: LegacyCellAddress): void {
    const cellAddress = this.fromLegacyAddress(address)
    if (!cellAddress) return
    
    this.facade.deleteCell(cellAddress)
  }

  clear(): void {
    this.facade.clear()
  }

  // Getters
  getDimensions(): GridDimensions {
    return { rows: this.rows, cols: this.cols }
  }

  getNonEmptyCells(): Array<{ address: LegacyCellAddress; cell: LegacyCell }> {
    const allCells = this.cellRepository.getAll()
    const result: Array<{ address: LegacyCellAddress; cell: LegacyCell }> = []
    
    for (const [key, cell] of allCells) {
      const address = CellAddress.fromString(key)
      if (address.ok) {
        result.push({
          address: this.toLegacyAddress(address.value),
          cell: this.toLegacyCell(cell)
        })
      }
    }
    
    return result
  }

  getUsedRange(): { start: LegacyCellAddress; end: LegacyCellAddress } | null {
    const cells = this.getNonEmptyCells()
    if (cells.length === 0) return null
    
    let minRow = Infinity, maxRow = -Infinity
    let minCol = Infinity, maxCol = -Infinity
    
    for (const { address } of cells) {
      minRow = Math.min(minRow, address.row)
      maxRow = Math.max(maxRow, address.row)
      minCol = Math.min(minCol, address.col)
      maxCol = Math.max(maxCol, address.col)
    }
    
    return {
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol }
    }
  }

  getAllCells(): Map<string, LegacyCell> {
    const allCells = this.cellRepository.getAll()
    const result = new Map<string, LegacyCell>()
    
    for (const [key, cell] of allCells) {
      result.set(key, this.toLegacyCell(cell))
    }
    
    return result
  }

  getCellCount(): number {
    return this.facade.getCellCount()
  }

  // Serialization
  toJSON(): {
    grid: { dimensions: GridDimensions; cells: Array<{ address: LegacyCellAddress; cell: LegacyCell }> }
    dependencies: Array<{ from: LegacyCellAddress; to: LegacyCellAddress[] }>
  } {
    const cells = this.getNonEmptyCells()
    const dependencies: Array<{ from: LegacyCellAddress; to: LegacyCellAddress[] }> = []
    
    // Get all dependencies
    const allCells = this.cellRepository.getAll()
    for (const [key, cell] of allCells) {
      if (cell.hasFormula()) {
        const address = CellAddress.fromString(key)
        if (address.ok) {
          const deps = this.dependencyRepository.getDependencies(address.value)
          if (deps.length > 0) {
            dependencies.push({
              from: this.toLegacyAddress(address.value),
              to: deps.map(dep => this.toLegacyAddress(dep))
            })
          }
        }
      }
    }
    
    return {
      grid: {
        dimensions: this.getDimensions(),
        cells
      },
      dependencies
    }
  }

  toState(options: SpreadsheetStateOptions = {}): SpreadsheetState {
    const json = this.toJSON()
    const state: SpreadsheetState = {
      version: "1.0",
      dimensions: json.grid.dimensions,
      cells: json.grid.cells,
      dependencies: json.dependencies
    }
    
    if (options.includeMetadata) {
      state.metadata = {
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }
    }
    
    return state
  }

  static fromJSON(data: {
    grid: { dimensions: GridDimensions; cells: Array<{ address: LegacyCellAddress; cell: LegacyCell }> }
    dependencies: Array<{ from: LegacyCellAddress; to: LegacyCellAddress[] }>
  }): SpreadsheetEngineAdapter {
    const engine = new SpreadsheetEngineAdapter(data.grid.dimensions.rows, data.grid.dimensions.cols)
    
    // Restore cells
    const batchId = engine.facade.beginBatch()
    for (const { address, cell } of data.grid.cells) {
      if (cell.formula) {
        engine.setCell(address, cell.rawValue, cell.formula)
      } else {
        engine.setCell(address, cell.rawValue)
      }
    }
    engine.facade.commitBatch(batchId)
    
    return engine
  }

  static fromState(state: SpreadsheetState): SpreadsheetEngineAdapter {
    return SpreadsheetEngineAdapter.fromJSON({
      grid: {
        dimensions: state.dimensions,
        cells: state.cells
      },
      dependencies: state.dependencies
    })
  }

  // Utility methods
  parseCellKey(key: string): LegacyCellAddress {
    const match = key.match(/^(\d+),(\d+)$/)
    if (!match) {
      throw new Error(`Invalid cell key: ${key}`)
    }
    return {
      row: parseInt(match[1], 10),
      col: parseInt(match[2], 10)
    }
  }

  updateCellStyle(address: LegacyCellAddress, style: Partial<LegacyCell["style"]>): void {
    const cellAddress = this.fromLegacyAddress(address)
    if (!cellAddress) return
    
    const cell = this.cellRepository.get(cellAddress)
    if (cell) {
      // Note: The new Cell model doesn't have style support yet
      // This would need to be added if style support is required
      console.warn("Style updates are not supported in the new architecture yet")
    }
  }

  // Conversion helpers
  private fromLegacyAddress(address: LegacyCellAddress): CellAddress | null {
    const result = CellAddress.create(address.row, address.col)
    return result.ok ? result.value : null
  }

  private toLegacyAddress(address: CellAddress): LegacyCellAddress {
    return { row: address.row, col: address.col }
  }

  private toLegacyCell(cell: Cell): LegacyCell {
    return {
      rawValue: cell.rawValue,
      computedValue: cell.computedValue ?? cell.rawValue,
      formula: cell.formula?.expression,
      error: cell.error,
      style: {} // Style not supported in new architecture yet
    }
  }

  // Methods not implemented (pivot tables)
  addPivotTable(): never {
    throw new Error("Pivot tables not implemented in the new architecture yet")
  }

  removePivotTable(): never {
    throw new Error("Pivot tables not implemented in the new architecture yet")
  }

  getPivotTable(): never {
    throw new Error("Pivot tables not implemented in the new architecture yet")
  }

  refreshPivotTable(): never {
    throw new Error("Pivot tables not implemented in the new architecture yet")
  }

  refreshAllPivotTables(): never {
    throw new Error("Pivot tables not implemented in the new architecture yet")
  }

  getAllPivotTables(): never {
    throw new Error("Pivot tables not implemented in the new architecture yet")
  }

  // Private method adaptations
  private recalculateDependents(changedCell: LegacyCellAddress): void {
    if (this.isCalculating) {
      this.calculationQueue.add(cellAddressToString(changedCell))
      return
    }

    const cellAddress = this.fromLegacyAddress(changedCell)
    if (!cellAddress) return

    this.isCalculating = true
    try {
      // The facade handles recalculation automatically
      // We don't need to do anything here
    } finally {
      this.isCalculating = false

      if (this.calculationQueue.size > 0) {
        const queue = Array.from(this.calculationQueue)
        this.calculationQueue.clear()

        for (const cellKey of queue) {
          const address = parseCellAddress(cellKey)
          if (address) {
            this.recalculateDependents(address)
          }
        }
      }
    }
  }
}