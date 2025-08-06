import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { createSpreadsheetFacade, SpreadsheetFacade } from '../src/rust-adapter/facade'
import { CellAddress } from '../src/domain/models/CellAddress'

describe('SpreadsheetFacade Integration Tests', () => {
  let facade: SpreadsheetFacade

  beforeAll(async () => {
    facade = await createSpreadsheetFacade()
  })

  afterEach(() => {
    facade.clear()
  })

  describe('Basic Cell Operations', () => {
    test('should set and get cell value', () => {
      const addr = CellAddress.create(0, 0).value // A1
      
      const setResult = facade.setCellValue(addr, 42)
      expect(setResult.ok).toBe(true)
      
      const getResult = facade.getCellValue(addr)
      expect(getResult.ok).toBe(true)
      expect(getResult.value).toBe(42)
    })

    test('should handle string values', () => {
      const addr = CellAddress.create(1, 0).value // B1
      
      facade.setCellValue(addr, 'Hello, World!')
      
      const result = facade.getCellValue(addr)
      expect(result.ok).toBe(true)
      expect(result.value).toBe('Hello, World!')
    })

    test('should handle boolean values', () => {
      const addr = CellAddress.create(2, 0).value // C1
      
      facade.setCellValue(addr, true)
      
      const result = facade.getCellValue(addr)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(true)
    })

    test('should delete cell', () => {
      const addr = CellAddress.create(0, 0).value
      
      facade.setCellValue(addr, 100)
      expect(facade.getCellCount()).toBe(1)
      
      const deleteResult = facade.deleteCell(addr)
      expect(deleteResult.ok).toBe(true)
      expect(facade.getCellCount()).toBe(0)
    })
  })

  describe('Formula Evaluation', () => {
    test('should evaluate simple addition formula', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, 20)
      facade.setCellValue(c1, '=A1+B1')
      
      const result = facade.getCellValue(c1)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(30)
    })

    test('should evaluate multiplication formula', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      
      facade.setCellValue(a1, 5)
      facade.setCellValue(b1, '=A1*3')
      
      const result = facade.getCellValue(b1)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(15)
    })

    test('should handle formula with multiple operations', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      const d1 = CellAddress.create(3, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, 5)
      facade.setCellValue(c1, 2)
      facade.setCellValue(d1, '=(A1+B1)*C1')
      
      const result = facade.getCellValue(d1)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(30)
    })
  })

  describe('Dependency Management', () => {
    test('should update dependent cells when source changes', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, '=A1*2')
      
      expect(facade.getCellValue(b1).value).toBe(20)
      
      // Update source cell
      facade.setCellValue(a1, 15)
      
      // Dependent should be recalculated
      expect(facade.getCellValue(b1).value).toBe(30)
    })

    test('should handle chain of dependencies', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      
      facade.setCellValue(a1, 5)
      facade.setCellValue(b1, '=A1*2')
      facade.setCellValue(c1, '=B1+10')
      
      expect(facade.getCellValue(c1).value).toBe(20)
      
      // Update root cell
      facade.setCellValue(a1, 10)
      
      // All dependents should update
      expect(facade.getCellValue(b1).value).toBe(20)
      expect(facade.getCellValue(c1).value).toBe(30)
    })

    test('should detect circular dependencies', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      
      facade.setCellValue(a1, '=B1')
      const result = facade.setCellValue(b1, '=A1')
      
      expect(result.ok).toBe(false)
      expect(result.error).toContain('Circular')
    })
  })

  describe('Batch Operations', () => {
    test('should batch multiple operations', () => {
      const batchId = facade.beginBatch()
      
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      
      facade.setCellValue(a1, 100)
      facade.setCellValue(b1, 200)
      facade.setCellValue(c1, 300)
      
      const commitResult = facade.commitBatch(batchId)
      expect(commitResult.ok).toBe(true)
      
      expect(facade.getCellValue(a1).value).toBe(100)
      expect(facade.getCellValue(b1).value).toBe(200)
      expect(facade.getCellValue(c1).value).toBe(300)
    })

    test('should rollback batch on error', () => {
      const batchId = facade.beginBatch()
      
      const a1 = CellAddress.create(0, 0).value
      facade.setCellValue(a1, 42)
      
      const rollbackResult = facade.rollbackBatch(batchId)
      expect(rollbackResult.ok).toBe(true)
      
      // Cell should not exist after rollback
      const result = facade.getCell(a1)
      expect(result.ok).toBe(true)
      expect(result.value).toBeUndefined()
    })

    test('should set multiple values at once', () => {
      const updates = new Map<CellAddress, unknown>()
      updates.set(CellAddress.create(0, 0).value, 10)
      updates.set(CellAddress.create(1, 0).value, 20)
      updates.set(CellAddress.create(2, 0).value, 30)
      
      const result = facade.setCellValues(updates)
      expect(result.ok).toBe(true)
      
      expect(facade.getCellValue(CellAddress.create(0, 0).value).value).toBe(10)
      expect(facade.getCellValue(CellAddress.create(1, 0).value).value).toBe(20)
      expect(facade.getCellValue(CellAddress.create(2, 0).value).value).toBe(30)
    })
  })

  describe('Event Handling', () => {
    test('should emit cell update events', (done) => {
      const addr = CellAddress.create(0, 0).value
      
      facade.once('cell:update', (event) => {
        expect(event).toBeDefined()
        expect(event.event_type).toBe('cell_updated')
        expect(event.data.address).toBe('A1')
        done()
      })
      
      facade.setCellValue(addr, 42)
    })

    test('should emit batch complete events', (done) => {
      facade.once('batch:complete', (event) => {
        expect(event).toBeDefined()
        expect(event.event_type).toBe('batch_completed')
        expect(event.data.operation_count).toBeGreaterThan(0)
        done()
      })
      
      const batchId = facade.beginBatch()
      facade.setCellValue(CellAddress.create(0, 0).value, 100)
      facade.commitBatch(batchId)
    })
  })

  describe('Recalculation', () => {
    test('should recalculate all cells', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, '=A1*2')
      facade.setCellValue(c1, '=B1+5')
      
      const result = facade.recalculate()
      expect(result.ok).toBe(true)
      
      expect(facade.getCellValue(b1).value).toBe(20)
      expect(facade.getCellValue(c1).value).toBe(25)
    })

    test('should recalculate specific cell', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      
      facade.setCellValue(a1, 15)
      facade.setCellValue(b1, '=A1*3')
      
      const result = facade.recalculateCell(b1)
      expect(result.ok).toBe(true)
      expect(result.value?.value).toBe(45)
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty cells', () => {
      const addr = CellAddress.create(0, 0).value
      const result = facade.getCellValue(addr)
      
      expect(result.ok).toBe(true)
      expect(result.value).toBeNull()
    })

    test('should handle invalid formulas', () => {
      const addr = CellAddress.create(0, 0).value
      const result = facade.setCellValue(addr, '=INVALID()')
      
      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('should handle division by zero', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      
      facade.setCellValue(a1, 0)
      const result = facade.setCellValue(b1, '=10/A1')
      
      // Should either return error or handle gracefully
      if (result.ok) {
        const value = facade.getCellValue(b1)
        expect(value.value).toMatch(/#DIV/)
      } else {
        expect(result.error).toContain('DIV')
      }
    })
  })

  describe('Cleanup', () => {
    test('should clear all cells', () => {
      // Add some cells
      facade.setCellValue(CellAddress.create(0, 0).value, 1)
      facade.setCellValue(CellAddress.create(1, 0).value, 2)
      facade.setCellValue(CellAddress.create(2, 0).value, 3)
      
      expect(facade.getCellCount()).toBe(3)
      
      facade.clear()
      expect(facade.getCellCount()).toBe(0)
    })

    test('should dispose resources', () => {
      const testFacade = new SpreadsheetFacade()
      
      // Should not be initialized
      expect(() => testFacade.getCellCount()).toThrow()
      
      testFacade.dispose()
      
      // Should still throw after dispose
      expect(() => testFacade.getCellCount()).toThrow()
    })
  })
})