import { test, expect, describe, beforeEach } from "bun:test"
import { Sheet } from "./Sheet"
import type { CellAddress } from "./types"

describe("Sheet", () => {
  let sheet: Sheet

  beforeEach(() => {
    sheet = new Sheet("Test Sheet")
  })

  describe("constructor", () => {
    test("creates sheet with default dimensions", () => {
      const dimensions = sheet.getDimensions()
      expect(dimensions.rows).toBe(1000)
      expect(dimensions.cols).toBe(26)
    })

    test("creates sheet with custom dimensions", () => {
      const customSheet = new Sheet("Custom", 500, 50)
      const dimensions = customSheet.getDimensions()
      expect(dimensions.rows).toBe(500)
      expect(dimensions.cols).toBe(50)
    })

    test("generates unique ID", () => {
      const sheet2 = new Sheet("Sheet2")
      expect(sheet.getId()).not.toBe(sheet2.getId())
      expect(sheet.getId()).toMatch(/^sheet_\d+_[a-z0-9]+$/)
    })

    test("sets initial metadata", () => {
      const metadata = sheet.getMetadata()
      expect(metadata.index).toBe(0)
      expect(metadata.hidden).toBeUndefined()
      expect(metadata.protected).toBeUndefined()
      expect(metadata.createdAt).toBeInstanceOf(Date)
      expect(metadata.modifiedAt).toBeInstanceOf(Date)
    })
  })

  describe("name operations", () => {
    test("gets sheet name", () => {
      expect(sheet.getName()).toBe("Test Sheet")
    })

    test("sets sheet name", () => {
      const originalModifiedAt = sheet.getMetadata().modifiedAt
      
      // Wait a bit to ensure modifiedAt changes
      setTimeout(() => {
        sheet.setName("Renamed Sheet")
        expect(sheet.getName()).toBe("Renamed Sheet")
        expect(sheet.getMetadata().modifiedAt.getTime()).toBeGreaterThan(
          originalModifiedAt.getTime()
        )
      }, 10)
    })
  })

  describe("index operations", () => {
    test("gets and sets index", () => {
      expect(sheet.getIndex()).toBe(0)
      sheet.setIndex(5)
      expect(sheet.getIndex()).toBe(5)
    })

    test("updates modifiedAt when setting index", (done) => {
      const originalModifiedAt = sheet.getMetadata().modifiedAt
      
      setTimeout(() => {
        sheet.setIndex(2)
        expect(sheet.getMetadata().modifiedAt.getTime()).toBeGreaterThan(
          originalModifiedAt.getTime()
        )
        done()
      }, 10)
    })
  })

  describe("visibility operations", () => {
    test("sheet is visible by default", () => {
      expect(sheet.isHidden()).toBe(false)
    })

    test("can hide and show sheet", () => {
      sheet.setHidden(true)
      expect(sheet.isHidden()).toBe(true)
      
      sheet.setHidden(false)
      expect(sheet.isHidden()).toBe(false)
    })
  })

  describe("protection operations", () => {
    test("sheet is unprotected by default", () => {
      expect(sheet.isProtected()).toBe(false)
    })

    test("can protect and unprotect sheet", () => {
      sheet.setProtected(true)
      expect(sheet.isProtected()).toBe(true)
      
      sheet.setProtected(false)
      expect(sheet.isProtected()).toBe(false)
    })
  })

  describe("engine operations", () => {
    test("can access spreadsheet engine", () => {
      const engine = sheet.getEngine()
      expect(engine).toBeDefined()
      
      // Test that engine works
      const address: CellAddress = { row: 0, col: 0 }
      engine.setCell(address, "Test Value")
      expect(engine.getCell(address)?.rawValue).toBe("Test Value")
    })

    test("engine operations persist", () => {
      const engine = sheet.getEngine()
      const address: CellAddress = { row: 5, col: 3 }
      
      engine.setCell(address, 42)
      expect(sheet.getEngine().getCell(address)?.rawValue).toBe(42)
    })
  })

  describe("clone operations", () => {
    test("clones sheet with new ID", () => {
      const address: CellAddress = { row: 1, col: 1 }
      sheet.getEngine().setCell(address, "Original")
      
      const cloned = sheet.clone()
      
      expect(cloned.getId()).not.toBe(sheet.getId())
      expect(cloned.getName()).toBe("Test Sheet (Copy)")
    })

    test("clones sheet data", () => {
      const address: CellAddress = { row: 1, col: 1 }
      sheet.getEngine().setCell(address, "Test Data")
      
      const cloned = sheet.clone()
      
      expect(cloned.getEngine().getCell(address)?.rawValue).toBe("Test Data")
    })

    test("cloned sheet has independent data", () => {
      const address: CellAddress = { row: 1, col: 1 }
      sheet.getEngine().setCell(address, "Original")
      
      const cloned = sheet.clone()
      
      // Modify original
      sheet.getEngine().setCell(address, "Modified")
      
      // Cloned should still have original value
      expect(cloned.getEngine().getCell(address)?.rawValue).toBe("Original")
    })

    test("clones metadata with new dates", () => {
      sheet.setIndex(5)
      sheet.setHidden(true)
      sheet.setProtected(true)
      
      const cloned = sheet.clone()
      
      expect(cloned.getIndex()).toBe(5)
      expect(cloned.isHidden()).toBe(true)
      expect(cloned.isProtected()).toBe(true)
      
      // Dates should be new
      expect(cloned.getMetadata().createdAt).not.toBe(sheet.getMetadata().createdAt)
      expect(cloned.getMetadata().modifiedAt).not.toBe(sheet.getMetadata().modifiedAt)
    })
  })

  describe("serialization", () => {
    test("serializes to JSON", () => {
      sheet.setIndex(3)
      sheet.setHidden(true)
      
      const address: CellAddress = { row: 0, col: 0 }
      sheet.getEngine().setCell(address, "Test Value")
      
      const json = sheet.toJSON()
      
      expect(json.id).toBe(sheet.getId())
      expect(json.name).toBe("Test Sheet")
      expect(json.metadata.index).toBe(3)
      expect(json.metadata.hidden).toBe(true)
      expect(json.engine).toBeDefined()
    })

    test("deserializes from JSON", () => {
      sheet.setIndex(2)
      sheet.setProtected(true)
      
      const address: CellAddress = { row: 1, col: 1 }
      sheet.getEngine().setCell(address, 42)
      
      const json = sheet.toJSON()
      const restored = Sheet.fromJSON(json)
      
      expect(restored.getId()).toBe(sheet.getId())
      expect(restored.getName()).toBe(sheet.getName())
      expect(restored.getIndex()).toBe(2)
      expect(restored.isProtected()).toBe(true)
      expect(restored.getEngine().getCell(address)?.rawValue).toBe(42)
    })

    test("preserves formulas during serialization", () => {
      const address: CellAddress = { row: 0, col: 0 }
      sheet.getEngine().setCell(address, "=A2+B2", "=A2+B2")
      
      const json = sheet.toJSON()
      const restored = Sheet.fromJSON(json)
      
      const cell = restored.getEngine().getCell(address)
      expect(cell?.formula).toBe("=A2+B2")
    })

    test("preserves metadata dates as ISO strings", () => {
      const json = sheet.toJSON()
      
      expect(typeof json.metadata.createdAt).toBe("string")
      expect(typeof json.metadata.modifiedAt).toBe("string")
      expect(json.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(json.metadata.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe("metadata immutability", () => {
    test("getMetadata returns a copy", () => {
      const metadata1 = sheet.getMetadata()
      const metadata2 = sheet.getMetadata()
      
      expect(metadata1).not.toBe(metadata2)
      expect(metadata1).toEqual(metadata2)
      
      // Modifying returned metadata doesn't affect sheet
      metadata1.index = 999
      expect(sheet.getIndex()).toBe(0)
    })
  })
})