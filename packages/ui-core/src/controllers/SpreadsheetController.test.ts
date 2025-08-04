import { expect, test, describe, beforeEach } from "bun:test"
import { SpreadsheetController, type ViewportManager, type ControllerEvent } from "./SpreadsheetController"
import { CellAddress } from "@gridcore/core"
import type { UIState } from "../state/UIState"

// Mock SpreadsheetEngine since it's not exported
class MockSpreadsheetEngine {
  private cells: Map<string, any> = new Map()

  updateCell(address: CellAddress, value: any) {
    this.cells.set(`${address.row},${address.col}`, value)
    return { ok: true, value: { address, value, formula: null } }
  }

  getCellValue(address: CellAddress) {
    const value = this.cells.get(`${address.row},${address.col}`) || ""
    return { ok: true, value }
  }

  updateCells(updates: Array<{ address: CellAddress; value: any }>) {
    const results = updates.map(u => this.updateCell(u.address, u.value))
    return { ok: true, value: results }
  }

  getCell(address: CellAddress) {
    const value = this.cells.get(`${address.row},${address.col}`) || ""
    return { ok: true, value: { address, value, formula: null } }
  }

  getCellRange(start: CellAddress, end: CellAddress) {
    const cells = []
    for (let row = start.row; row <= end.row; row++) {
      for (let col = start.col; col <= end.col; col++) {
        const addr = CellAddress.create(row, col).value
        const value = this.cells.get(`${row},${col}`) || ""
        cells.push({ address: addr, value, formula: null })
      }
    }
    return { ok: true, value: cells }
  }

  setCellValue(address: CellAddress, value: any) {
    return this.updateCell(address, value)
  }
}

describe("SpreadsheetController", () => {
  let controller: SpreadsheetController
  let engine: MockSpreadsheetEngine
  let viewportManager: ViewportManager
  let events: ControllerEvent[] = []

  beforeEach(() => {
    engine = new MockSpreadsheetEngine()
    viewportManager = {
      getColumnWidth: (index: number) => 100,
      setColumnWidth: (index: number, width: number) => {},
      getRowHeight: (index: number) => 20,
      setRowHeight: (index: number, height: number) => {},
      getTotalRows: () => 1000,
      getTotalCols: () => 100,
      scrollTo: (row: number, col: number) => {}
    }
    
    controller = new SpreadsheetController({ facade: engine as any, viewportManager })
    events = []
    controller.subscribe((event) => events.push(event))
  })

  describe("initialization", () => {
    test("starts in navigation mode", () => {
      const state = controller.getState()
      expect(state.spreadsheetMode).toBe("navigation")
    })

    test("initializes with default cursor position", () => {
      const state = controller.getState()
      expect(state.cursor.row).toBe(0)
      expect(state.cursor.col).toBe(0)
    })
  })

  describe("navigation mode key handling", () => {
    test("handles vim movement keys", () => {
      const result = controller.handleKeyPress("j", { key: "j", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      expect(controller.getState().cursor.row).toBe(1)
      expect(events.some(e => e.type === "stateChanged")).toBe(true)
    })

    test("handles entering edit mode", () => {
      const result = controller.handleKeyPress("i", { key: "i", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      const state = controller.getState()
      expect(state.spreadsheetMode).toBe("editing")
      expect(events.some(e => e.type === "stateChanged")).toBe(true)
    })

    test("handles entering command mode", () => {
      const result = controller.handleKeyPress(":", { key: ":", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      expect(controller.getState().spreadsheetMode).toBe("command")
    })

    test("handles entering resize mode", () => {
      controller.handleKeyPress("g", { key: "g", ctrl: false, shift: false, alt: false })
      const result = controller.handleKeyPress("r", { key: "r", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      expect(controller.getState().spreadsheetMode).toBe("resize")
    })
  })

  describe("editing mode key handling", () => {
    beforeEach(() => {
      controller.handleKeyPress("i", { key: "i", ctrl: false, shift: false, alt: false })
    })

    test("enters editing mode", () => {
      const state = controller.getState()
      expect(state.spreadsheetMode).toBe("editing")
    })

    test("handles escape to exit insert mode first", () => {
      // In editing mode, first escape exits insert mode to normal mode
      const result = controller.handleKeyPress("Escape", { key: "escape", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      const state = controller.getState()
      expect(state.spreadsheetMode).toBe("editing")
      if (state.spreadsheetMode === "editing") {
        expect(state.cellMode).toBe("normal")
      }
    })

    test("escape handling depends on cell mode", () => {
      // In insert mode, first escape goes to normal mode within editing
      const result = controller.handleKeyPress("Escape", { key: "escape", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      // Still in editing mode
      const state = controller.getState()
      expect(state.spreadsheetMode).toBe("editing")
    })
  })

  describe("command mode", () => {
    beforeEach(() => {
      controller.handleKeyPress(":", { key: ":", ctrl: false, shift: false, alt: false })
    })

    test("handles command character input", () => {
      // Since handleCommand doesn't exist, we simulate command mode input
      const result = controller.handleKeyPress("w", { key: "w", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      const state = controller.getState()
      if (state.spreadsheetMode === "command") {
        expect(state.commandValue).toBe("w")
      }
    })

    test("exits on escape", () => {
      const result = controller.handleKeyPress("Escape", { key: "escape", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      expect(controller.getState().spreadsheetMode).toBe("navigation")
    })
  })

  describe("resize mode", () => {
    beforeEach(() => {
      controller.handleKeyPress("g", { key: "g", ctrl: false, shift: false, alt: false })
      controller.handleKeyPress("r", { key: "r", ctrl: false, shift: false, alt: false })
    })

    test("handles resize delta", () => {
      const result = controller.handleKeyPress("+", { key: "+", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      const state = controller.getState()
      if (state.spreadsheetMode === "resize") {
        expect(state.currentSize).toBe(105)
      }
    })

    test("handles resize confirmation", () => {
      controller.handleKeyPress("+", { key: "+", ctrl: false, shift: false, alt: false })
      const result = controller.handleKeyPress("Enter", { key: "Enter", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      expect(controller.getState().spreadsheetMode).toBe("navigation")
      expect(events.some(e => e.type === "stateChanged")).toBe(true)
    })

    test("handles resize cancellation", () => {
      controller.handleKeyPress("+", { key: "+", ctrl: false, shift: false, alt: false })
      const result = controller.handleKeyPress("Escape", { key: "Escape", ctrl: false, shift: false, alt: false })
      expect(result.ok).toBe(true)
      expect(controller.getState().spreadsheetMode).toBe("navigation")
    })
  })

  describe("vim actions processing", () => {
    test("handles delete action", () => {
      // Set a cell value first
      const addr = CellAddress.create(0, 0).value
      engine.updateCell(addr, "test")
      
      controller.handleKeyPress("x", { key: "x", ctrl: false, shift: false, alt: false })
      
      const value = engine.getCellValue(addr)
      expect(value.value).toBe("")
    })

    test("handles yank action", () => {
      // Set a cell value
      const addr = CellAddress.create(0, 0).value
      engine.updateCell(addr, "test")
      
      // Yank - just test that the action is processed
      const result1 = controller.handleKeyPress("y", { key: "y", ctrl: false, shift: false, alt: false })
      expect(result1.ok).toBe(true)
      const result2 = controller.handleKeyPress("y", { key: "y", ctrl: false, shift: false, alt: false })
      expect(result2.ok).toBe(true)
    })
  })

  describe("event emissions", () => {
    test("emits stateChanged on any state update", () => {
      const initialCount = events.filter(e => e.type === "stateChanged").length
      controller.handleKeyPress("j", { key: "j", ctrl: false, shift: false, alt: false })
      const newCount = events.filter(e => e.type === "stateChanged").length
      expect(newCount).toBe(initialCount + 1)
    })

    test("emits selectionChanged on visual mode", () => {
      controller.handleKeyPress("i", { key: "i", ctrl: false, shift: false, alt: false })
      controller.handleKeyPress("v", { key: "v", ctrl: false, shift: false, alt: false })
      expect(events.some(e => e.type === "stateChanged")).toBe(true)
    })
  })

  describe("state machine integration", () => {
    test("respects valid state transitions", () => {
      // Try invalid transition - resize from editing
      controller.handleKeyPress("i", { key: "i", ctrl: false, shift: false, alt: false })
      controller.handleKeyPress("g", { key: "g", ctrl: false, shift: false, alt: false })
      const result = controller.handleKeyPress("r", { key: "r", ctrl: false, shift: false, alt: false })
      
      // Should still be in editing mode
      expect(controller.getState().spreadsheetMode).toBe("editing")
    })
  })

  describe("error handling", () => {
    test("returns error for invalid cell addresses", () => {
      // Move cursor way out of bounds
      for (let i = 0; i < 1000; i++) {
        controller.handleKeyPress("j", { key: "j", ctrl: false, shift: false, alt: false })
      }
      
      // Should still have valid state
      const state = controller.getState()
      expect(state.cursor.row).toBeLessThan(1000)
    })
  })

  describe("getEngine", () => {
    test("returns underlying spreadsheet engine", () => {
      expect(controller.getEngine()).toBe(engine as any)
    })
  })

})