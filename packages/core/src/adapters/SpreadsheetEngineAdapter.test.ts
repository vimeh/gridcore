import { describe, test, expect, beforeEach } from "bun:test"
import { SpreadsheetEngineAdapter } from "./SpreadsheetEngineAdapter"
import type { SpreadsheetChangeEvent } from "../SpreadsheetEngine"

describe("SpreadsheetEngineAdapter", () => {
  let adapter: SpreadsheetEngineAdapter

  beforeEach(() => {
    adapter = new SpreadsheetEngineAdapter(1000, 26)
  })

  describe("basic cell operations", () => {
    test("setCell and getCell", () => {
      const address = { row: 0, col: 0 }
      adapter.setCell(address, 42)
      
      const cell = adapter.getCell(address)
      expect(cell).toBeDefined()
      expect(cell?.rawValue).toBe(42)
      expect(cell?.computedValue).toBe(42)
    })

    test("setCellByReference and getCellByReference", () => {
      adapter.setCellByReference("A1", "Hello")
      
      const cell = adapter.getCellByReference("A1")
      expect(cell).toBeDefined()
      expect(cell?.rawValue).toBe("Hello")
      expect(cell?.computedValue).toBe("Hello")
    })

    test("setCell with formula", () => {
      adapter.setCell({ row: 0, col: 0 }, 10)
      adapter.setCell({ row: 0, col: 1 }, 20, "=A1+20")
      
      const cell = adapter.getCell({ row: 0, col: 1 })
      expect(cell).toBeDefined()
      expect(cell?.formula).toBe("=A1+20")
      expect(cell?.computedValue).toBe(30)
    })

    test("clearCell", () => {
      const address = { row: 0, col: 0 }
      adapter.setCell(address, 42)
      adapter.clearCell(address)
      
      const cell = adapter.getCell(address)
      expect(cell).toBeUndefined()
    })
  })

  describe("batch operations", () => {
    test("setCells", () => {
      const updates = [
        { address: { row: 0, col: 0 }, value: 10 },
        { address: { row: 0, col: 1 }, value: 20 },
        { address: { row: 0, col: 2 }, value: 0, formula: "=A1+B1" }
      ]
      
      adapter.setCells(updates)
      
      expect(adapter.getCell({ row: 0, col: 0 })?.computedValue).toBe(10)
      expect(adapter.getCell({ row: 0, col: 1 })?.computedValue).toBe(20)
      expect(adapter.getCell({ row: 0, col: 2 })?.computedValue).toBe(30)
    })

    test("clear", () => {
      adapter.setCell({ row: 0, col: 0 }, 10)
      adapter.setCell({ row: 0, col: 1 }, 20)
      adapter.setCell({ row: 0, col: 2 }, 30)
      
      adapter.clear()
      
      expect(adapter.getCellCount()).toBe(0)
      expect(adapter.getCell({ row: 0, col: 0 })).toBeUndefined()
    })
  })

  describe("grid information", () => {
    test("getDimensions", () => {
      const dimensions = adapter.getDimensions()
      expect(dimensions.rows).toBe(1000)
      expect(dimensions.cols).toBe(26)
    })

    test("getCellCount", () => {
      expect(adapter.getCellCount()).toBe(0)
      
      adapter.setCell({ row: 0, col: 0 }, 10)
      adapter.setCell({ row: 0, col: 1 }, 20)
      
      expect(adapter.getCellCount()).toBe(2)
    })

    test("getNonEmptyCells", () => {
      adapter.setCell({ row: 0, col: 0 }, 10)
      adapter.setCell({ row: 1, col: 1 }, 20)
      
      const cells = adapter.getNonEmptyCells()
      expect(cells).toHaveLength(2)
      
      const addresses = cells.map(c => c.address)
      expect(addresses).toContainEqual({ row: 0, col: 0 })
      expect(addresses).toContainEqual({ row: 1, col: 1 })
    })

    test("getUsedRange", () => {
      adapter.setCell({ row: 1, col: 2 }, 10)
      adapter.setCell({ row: 5, col: 7 }, 20)
      
      const range = adapter.getUsedRange()
      expect(range).toBeDefined()
      expect(range?.start).toEqual({ row: 1, col: 2 })
      expect(range?.end).toEqual({ row: 5, col: 7 })
    })

    test("getAllCells", () => {
      adapter.setCell({ row: 0, col: 0 }, 10)
      adapter.setCell({ row: 0, col: 1 }, 20)
      
      const cells = adapter.getAllCells()
      expect(cells.size).toBe(2)
      expect(cells.get("A1")?.computedValue).toBe(10)
      expect(cells.get("B1")?.computedValue).toBe(20)
    })
  })

  describe("event handling", () => {
    test("cell change events", (done) => {
      let eventReceived = false
      
      adapter.addEventListener((event: SpreadsheetChangeEvent) => {
        expect(event.type).toBe("cell-change")
        expect(event.cells).toHaveLength(1)
        expect(event.cells[0].address).toEqual({ row: 0, col: 0 })
        expect(event.cells[0].newValue?.computedValue).toBe(42)
        eventReceived = true
      })
      
      adapter.setCell({ row: 0, col: 0 }, 42)
      
      setTimeout(() => {
        expect(eventReceived).toBe(true)
        done()
      }, 10)
    })

    test("batch change events", (done) => {
      let eventReceived = false
      
      adapter.addEventListener((event: SpreadsheetChangeEvent) => {
        if (event.type === "batch-change") {
          expect(event.cells.length).toBeGreaterThan(0)
          eventReceived = true
        }
      })
      
      adapter.setCells([
        { address: { row: 0, col: 0 }, value: 10 },
        { address: { row: 0, col: 1 }, value: 20 }
      ])
      
      setTimeout(() => {
        expect(eventReceived).toBe(true)
        done()
      }, 10)
    })

    test("removeEventListener", () => {
      let eventCount = 0
      const listener = () => { eventCount++ }
      
      adapter.addEventListener(listener)
      adapter.setCell({ row: 0, col: 0 }, 10)
      
      adapter.removeEventListener(listener)
      adapter.setCell({ row: 0, col: 1 }, 20)
      
      // Only the first event should have been received
      expect(eventCount).toBe(1)
    })
  })

  describe("formula dependencies", () => {
    test("cascading updates", () => {
      adapter.setCell({ row: 0, col: 0 }, 10) // A1
      adapter.setCell({ row: 0, col: 1 }, 0, "=A1*2") // B1
      adapter.setCell({ row: 0, col: 2 }, 0, "=B1+5") // C1
      
      // Update A1
      adapter.setCell({ row: 0, col: 0 }, 20)
      
      // Check cascading updates
      expect(adapter.getCell({ row: 0, col: 1 })?.computedValue).toBe(40) // 20*2
      expect(adapter.getCell({ row: 0, col: 2 })?.computedValue).toBe(45) // 40+5
    })

    test("circular dependency detection", () => {
      // First create cells that will have a circular dependency
      adapter.setCell({ row: 0, col: 0 }, 10) // A1 = 10
      adapter.setCell({ row: 0, col: 1 }, 0, "=A1") // B1 = A1
      
      // Now update A1 to reference B1, creating a circular dependency
      adapter.setCell({ row: 0, col: 0 }, 0, "=B1") // A1 = B1 (creates cycle)
      
      // In the new architecture, cells with circular dependencies
      // cannot be retrieved because they cannot be calculated
      const cellA1 = adapter.getCell({ row: 0, col: 0 })
      const cellB1 = adapter.getCell({ row: 0, col: 1 })
      
      // Both cells should be undefined as they form a circular dependency
      expect(cellA1).toBeUndefined()
      expect(cellB1).toBeUndefined()
    })
  })

  describe("serialization", () => {
    test("toJSON and fromJSON", () => {
      // Set up some data
      adapter.setCell({ row: 0, col: 0 }, 10)
      adapter.setCell({ row: 0, col: 1 }, 20)
      adapter.setCell({ row: 0, col: 2 }, 0, "=A1+B1")
      
      // Serialize
      const json = adapter.toJSON()
      
      // Create new adapter from JSON
      const newAdapter = SpreadsheetEngineAdapter.fromJSON(json)
      
      // Verify data
      expect(newAdapter.getCell({ row: 0, col: 0 })?.computedValue).toBe(10)
      expect(newAdapter.getCell({ row: 0, col: 1 })?.computedValue).toBe(20)
      expect(newAdapter.getCell({ row: 0, col: 2 })?.computedValue).toBe(30)
      expect(newAdapter.getCell({ row: 0, col: 2 })?.formula).toBe("=A1+B1")
    })

    test("toState and fromState", () => {
      adapter.setCell({ row: 0, col: 0 }, 42)
      adapter.setCell({ row: 0, col: 1 }, 0, "=A1*2")
      
      const state = adapter.toState({ includeMetadata: true })
      expect(state.version).toBe("1.0")
      expect(state.metadata).toBeDefined()
      expect(state.cells).toHaveLength(2)
      
      const newAdapter = SpreadsheetEngineAdapter.fromState(state)
      expect(newAdapter.getCell({ row: 0, col: 0 })?.computedValue).toBe(42)
      expect(newAdapter.getCell({ row: 0, col: 1 })?.computedValue).toBe(84)
    })
  })

  describe("error handling", () => {
    test("invalid cell reference", () => {
      expect(() => {
        adapter.setCellByReference("InvalidRef", 42)
      }).toThrow("Invalid cell reference")
    })

    test("parseCellKey", () => {
      const address = adapter.parseCellKey("5,10")
      expect(address).toEqual({ row: 5, col: 10 })
      
      expect(() => {
        adapter.parseCellKey("invalid")
      }).toThrow("Invalid cell key")
    })
  })

  describe("unimplemented features", () => {
    test("pivot table methods throw errors", () => {
      expect(() => {
        adapter.addPivotTable()
      }).toThrow("Pivot tables not implemented")
      
      expect(() => {
        adapter.removePivotTable()
      }).toThrow("Pivot tables not implemented")
      
      expect(() => {
        adapter.getPivotTable()
      }).toThrow("Pivot tables not implemented")
    })

    test("updateCellStyle logs warning", () => {
      // This should not throw but log a warning
      adapter.setCell({ row: 0, col: 0 }, 42)
      adapter.updateCellStyle({ row: 0, col: 0 }, { bold: true })
      
      // Cell should still exist
      expect(adapter.getCell({ row: 0, col: 0 })?.computedValue).toBe(42)
    })
  })
})