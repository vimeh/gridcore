import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { createSpreadsheetFacade, SpreadsheetFacade } from '../src/rust-adapter/facade'
import { CellAddress } from '../src/domain/models/CellAddress'

describe('Structural Operations', () => {
  let facade: SpreadsheetFacade

  beforeAll(async () => {
    facade = await createSpreadsheetFacade()
  })

  afterEach(() => {
    facade.clear()
  })

  describe('Row Operations', () => {
    test('should insert row and adjust references', () => {
      // Set up initial cells
      const a1 = CellAddress.create(0, 0).value
      const a2 = CellAddress.create(0, 1).value
      const a3 = CellAddress.create(0, 2).value
      const b3 = CellAddress.create(1, 2).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(a2, 20)
      facade.setCellValue(a3, 30)
      facade.setCellValue(b3, '=A3*2')
      
      expect(facade.getCellValue(b3).value).toBe(60)
      
      // Insert a row at index 1 (between row 1 and 2)
      const result = facade.insertRow(1)
      expect(result.ok).toBe(true)
      
      // A2 should still have value 20 (it's now at the same location)
      expect(facade.getCellValue(a2).value).toBe(20)
      
      // A3 should now be empty (old A2 moved here)
      const a3New = CellAddress.create(0, 3).value
      expect(facade.getCellValue(a3New).value).toBe(30)
      
      // B3's formula should now reference A4 (adjusted)
      const b4 = CellAddress.create(1, 3).value
      expect(facade.getCellValue(b4).value).toBe(60)
    })

    test('should delete row and adjust references', () => {
      const a1 = CellAddress.create(0, 0).value
      const a2 = CellAddress.create(0, 1).value
      const a3 = CellAddress.create(0, 2).value
      const b3 = CellAddress.create(1, 2).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(a2, 20)
      facade.setCellValue(a3, 30)
      facade.setCellValue(b3, '=A3*2')
      
      // Delete row 2 (index 1)
      const result = facade.deleteRow(1)
      expect(result.ok).toBe(true)
      
      // A2 should now have value 30 (old A3 moved up)
      expect(facade.getCellValue(a2).value).toBe(30)
      
      // B2's formula should now reference A2 (adjusted)
      const b2 = CellAddress.create(1, 1).value
      expect(facade.getCellValue(b2).value).toBe(60)
    })

    test('should handle #REF! errors when deleting referenced row', () => {
      const a1 = CellAddress.create(0, 0).value
      const a2 = CellAddress.create(0, 1).value
      const b1 = CellAddress.create(1, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(a2, 20)
      facade.setCellValue(b1, '=A2*2')
      
      expect(facade.getCellValue(b1).value).toBe(40)
      
      // Delete row 2 (which contains A2)
      facade.deleteRow(1)
      
      // B1 should now have #REF! error
      const result = facade.getCellValue(b1)
      expect(result.ok).toBe(true)
      expect(String(result.value)).toContain('#REF!')
    })
  })

  describe('Column Operations', () => {
    test('should insert column and adjust references', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      const d1 = CellAddress.create(3, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, 20)
      facade.setCellValue(c1, 30)
      facade.setCellValue(d1, '=C1*2')
      
      expect(facade.getCellValue(d1).value).toBe(60)
      
      // Insert a column at index 1 (between A and B)
      const result = facade.insertColumn(1)
      expect(result.ok).toBe(true)
      
      // B1 should now be empty (new column)
      expect(facade.getCellValue(b1).value).toBeNull()
      
      // C1 should have value 20 (old B1 moved right)
      const c1New = CellAddress.create(2, 0).value
      expect(facade.getCellValue(c1New).value).toBe(20)
      
      // D1 should have value 30 (old C1 moved right)
      const d1New = CellAddress.create(3, 0).value
      expect(facade.getCellValue(d1New).value).toBe(30)
      
      // E1's formula should now reference D1 (adjusted)
      const e1 = CellAddress.create(4, 0).value
      expect(facade.getCellValue(e1).value).toBe(60)
    })

    test('should delete column and adjust references', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      const d1 = CellAddress.create(3, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, 20)
      facade.setCellValue(c1, 30)
      facade.setCellValue(d1, '=C1*2')
      
      // Delete column B (index 1)
      const result = facade.deleteColumn(1)
      expect(result.ok).toBe(true)
      
      // B1 should now have value 30 (old C1 moved left)
      expect(facade.getCellValue(b1).value).toBe(30)
      
      // C1's formula should now reference B1 (adjusted)
      const c1New = CellAddress.create(2, 0).value
      expect(facade.getCellValue(c1New).value).toBe(60)
    })

    test('should handle #REF! errors when deleting referenced column', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, 20)
      facade.setCellValue(c1, '=B1*2')
      
      expect(facade.getCellValue(c1).value).toBe(40)
      
      // Delete column B
      facade.deleteColumn(1)
      
      // B1 (old C1) should now have #REF! error
      const b1New = CellAddress.create(1, 0).value
      const result = facade.getCellValue(b1New)
      expect(result.ok).toBe(true)
      expect(String(result.value)).toContain('#REF!')
    })
  })

  describe('Complex Scenarios', () => {
    test('should handle formulas with ranges during row insertion', () => {
      const a1 = CellAddress.create(0, 0).value
      const a2 = CellAddress.create(0, 1).value
      const a3 = CellAddress.create(0, 2).value
      const b4 = CellAddress.create(1, 3).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(a2, 20)
      facade.setCellValue(a3, 30)
      facade.setCellValue(b4, '=SUM(A1:A3)')
      
      expect(facade.getCellValue(b4).value).toBe(60)
      
      // Insert row at index 2
      facade.insertRow(2)
      
      // B5 should now have the adjusted formula SUM(A1:A4)
      const b5 = CellAddress.create(1, 4).value
      expect(facade.getCellValue(b5).value).toBe(60) // Still 60 as the new row is empty
    })

    test('should handle multiple operations in sequence', () => {
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      const a2 = CellAddress.create(0, 1).value
      const b2 = CellAddress.create(1, 1).value
      const c2 = CellAddress.create(2, 1).value
      
      // Set up a 3x2 grid
      facade.setCellValue(a1, 1)
      facade.setCellValue(b1, 2)
      facade.setCellValue(c1, 3)
      facade.setCellValue(a2, 4)
      facade.setCellValue(b2, 5)
      facade.setCellValue(c2, '=A2+B2')
      
      expect(facade.getCellValue(c2).value).toBe(9)
      
      // Insert column at B
      facade.insertColumn(1)
      
      // C2 should have value 5 (old B2), D2 should have value 3 (old C2)
      const d2 = CellAddress.create(3, 1).value
      expect(facade.getCellValue(d2).value).toBe(9) // Formula should still work
      
      // Now delete row 1
      facade.deleteRow(0)
      
      // D1 should have the formula result
      const d1 = CellAddress.create(3, 0).value
      expect(facade.getCellValue(d1).value).toBe(9)
    })

    test('should handle batch structural operations', () => {
      const batchId = facade.beginBatch()
      
      const a1 = CellAddress.create(0, 0).value
      const b1 = CellAddress.create(1, 0).value
      const c1 = CellAddress.create(2, 0).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(b1, 20)
      facade.setCellValue(c1, '=A1+B1')
      
      // Perform multiple structural operations in batch
      facade.insertRow(1)
      facade.insertColumn(2)
      
      const result = facade.commitBatch(batchId)
      expect(result.ok).toBe(true)
      
      // Check that formulas are still correct after batch operations
      // C1 should now be at D1 due to column insertion
      const d1 = CellAddress.create(3, 0).value
      expect(facade.getCellValue(d1).value).toBe(30)
    })
  })

  describe('Edge Cases', () => {
    test('should handle inserting row at boundary', () => {
      const a1 = CellAddress.create(0, 0).value
      facade.setCellValue(a1, 100)
      
      // Insert at row 0
      const result = facade.insertRow(0)
      expect(result.ok).toBe(true)
      
      // Value should now be at A2
      const a2 = CellAddress.create(0, 1).value
      expect(facade.getCellValue(a2).value).toBe(100)
      expect(facade.getCellValue(a1).value).toBeNull()
    })

    test('should handle deleting last row with data', () => {
      const a1 = CellAddress.create(0, 0).value
      const a2 = CellAddress.create(0, 1).value
      
      facade.setCellValue(a1, 10)
      facade.setCellValue(a2, 20)
      
      // Delete row 2
      const result = facade.deleteRow(1)
      expect(result.ok).toBe(true)
      
      // Only A1 should have data now
      expect(facade.getCellValue(a1).value).toBe(10)
      expect(facade.getCellValue(a2).value).toBeNull()
    })

    test('should handle empty sheet operations', () => {
      // Insert row on empty sheet
      let result = facade.insertRow(5)
      expect(result.ok).toBe(true)
      
      // Delete row on empty sheet
      result = facade.deleteRow(3)
      expect(result.ok).toBe(true)
      
      // Insert column on empty sheet
      result = facade.insertColumn(10)
      expect(result.ok).toBe(true)
      
      // Delete column on empty sheet
      result = facade.deleteColumn(5)
      expect(result.ok).toBe(true)
      
      // Should still be empty
      expect(facade.getCellCount()).toBe(0)
    })
  })
})