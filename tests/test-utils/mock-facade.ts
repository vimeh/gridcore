import { CellAddress, type SpreadsheetFacade, type Cell } from "@gridcore/core"
import { ok, err, type Result } from "@gridcore/ui-core"

export function createMockFacade(): SpreadsheetFacade {
  const cells = new Map<string, Cell>()
  
  return {
    setCellValue(address: CellAddress, value: string): Result<void> {
      const cell: Cell = {
        address,
        value,
        computedValue: value,
        dependencies: [],
        dependents: [],
      }
      cells.set(address.toString(), cell)
      return ok(undefined)
    },
    
    getCellValue(address: CellAddress): Result<string | number | boolean | null> {
      const cell = cells.get(address.toString())
      return ok(cell?.value ?? null)
    },
    
    getCell(address: CellAddress): Result<Cell> {
      const cell = cells.get(address.toString())
      if (cell) {
        return ok(cell)
      }
      // Return an empty cell if not found
      return ok({
        address,
        value: null,
        computedValue: null,
        dependencies: [],
        dependents: [],
      })
    },
    
    clearCell(address: CellAddress): Result<void> {
      cells.delete(address.toString())
      return ok(undefined)
    },
    
    // Add other required methods with basic implementations
    setCellFormula(address: CellAddress, formula: string): Result<void> {
      const cell: Cell = {
        address,
        value: null,
        formula: { text: formula, normalizedText: formula },
        computedValue: null,
        dependencies: [],
        dependents: [],
      }
      cells.set(address.toString(), cell)
      return ok(undefined)
    },
    
    getCellFormula(address: CellAddress): Result<string | null> {
      const cell = cells.get(address.toString())
      return ok(cell?.formula?.text ?? null)
    },
    
    clearRange(start: CellAddress, end: CellAddress): Result<void> {
      for (let row = start.row; row <= end.row; row++) {
        for (let col = start.col; col <= end.col; col++) {
          const addr = CellAddress.create(row, col)
          if (addr.ok) {
            cells.delete(addr.value.toString())
          }
        }
      }
      return ok(undefined)
    },
    
    copyRange(sourceStart: CellAddress, sourceEnd: CellAddress, destStart: CellAddress): Result<void> {
      const rowDiff = destStart.row - sourceStart.row
      const colDiff = destStart.col - sourceStart.col
      
      for (let row = sourceStart.row; row <= sourceEnd.row; row++) {
        for (let col = sourceStart.col; col <= sourceEnd.col; col++) {
          const sourceAddr = CellAddress.create(row, col)
          const destAddr = CellAddress.create(row + rowDiff, col + colDiff)
          
          if (sourceAddr.ok && destAddr.ok) {
            const sourceCell = cells.get(sourceAddr.value.toString())
            if (sourceCell) {
              cells.set(destAddr.value.toString(), {
                ...sourceCell,
                address: destAddr.value,
              })
            }
          }
        }
      }
      return ok(undefined)
    },
    
    // Stub out graph-related methods
    getGraph() {
      return {
        getNodeDependencies: () => [],
        getNodeDependents: () => [],
        getAllNodes: () => [],
      }
    },
    
    // Stub out calculation
    calculate(): Result<void> {
      return ok(undefined)
    },
    
    // Stub out undo/redo
    undo(): Result<void> {
      return ok(undefined)
    },
    
    redo(): Result<void> {
      return ok(undefined)
    },
    
    canUndo(): boolean {
      return false
    },
    
    canRedo(): boolean {
      return false
    },
  } as unknown as SpreadsheetFacade
}