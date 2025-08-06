import { expect, test, describe, beforeEach } from "bun:test"
import { CellAddress } from "@gridcore/core"
import { SpreadsheetController } from "@gridcore/ui-core"
import { createMockFacade } from "./test-utils/mock-facade"

describe("Visual Selection E2E Tests", () => {
  let controller: SpreadsheetController
  let facade: ReturnType<typeof createMockFacade>

  beforeEach(() => {
    facade = createMockFacade()
    controller = new SpreadsheetController(facade)
    // Controller initializes at A1 by default
  })

  test("entering visual mode with 'v' should start character selection", () => {
    // Press 'v' to enter visual mode
    const result = controller.handleKeyPress("v", {
      key: "v",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    expect(state.visualMode).toBe("char")
    expect(state.selection).toBeDefined()
    expect(state.anchor.row).toBe(0)
    expect(state.anchor.col).toBe(0)
  })

  test("visual mode should extend selection when moving cursor", () => {
    // Enter visual mode
    controller.handleKeyPress("v", {
      key: "v",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Move right to extend selection
    const result = controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    // Should have selected cells A1 and B1
    expect(state.cursor.row).toBe(0)
    expect(state.cursor.col).toBe(1)
    expect(state.anchor.row).toBe(0)
    expect(state.anchor.col).toBe(0)
    
    // Check that selection includes both cells
    expect(state.selection.type.type).toBe("range")
    if (state.selection.type.type === "range") {
      expect(state.selection.type.start.row).toBe(0)
      expect(state.selection.type.start.col).toBe(0)
      expect(state.selection.type.end.row).toBe(0)
      expect(state.selection.type.end.col).toBe(1)
    }
  })

  test("visual mode should select rectangular area when moving diagonally", () => {
    // Enter visual mode
    controller.handleKeyPress("v", {
      key: "v",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Move right
    controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Move down
    const result = controller.handleKeyPress("j", {
      key: "j",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    // Should have selected cells A1, B1, A2, B2
    expect(state.cursor.row).toBe(1)
    expect(state.cursor.col).toBe(1)
    expect(state.anchor.row).toBe(0)
    expect(state.anchor.col).toBe(0)
    
    // Check that selection is a 2x2 range
    expect(state.selection.type.type).toBe("range")
    if (state.selection.type.type === "range") {
      expect(state.selection.type.start.row).toBe(0)
      expect(state.selection.type.start.col).toBe(0)
      expect(state.selection.type.end.row).toBe(1)
      expect(state.selection.type.end.col).toBe(1)
    }
  })

  test("'V' should enter line visual mode and select entire rows", () => {
    // Press 'V' to enter line visual mode
    const result = controller.handleKeyPress("V", {
      key: "V",
      ctrl: false,
      shift: true, // Capital V
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    expect(state.visualMode).toBe("line")
    expect(state.selection.type.type).toBe("row")
    if (state.selection.type.type === "row") {
      expect(state.selection.type.rows).toEqual([0])
    }
  })

  test("line visual mode should select multiple rows when moving", () => {
    // Enter line visual mode
    controller.handleKeyPress("V", {
      key: "V",
      ctrl: false,
      shift: true,
      alt: false,
    })
    
    // Move down to select more rows
    const result = controller.handleKeyPress("j", {
      key: "j",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    expect(state.selection.type.type).toBe("row")
    if (state.selection.type.type === "row") {
      expect(state.selection.type.rows).toEqual([0, 1])
    }
  })

  test("Ctrl+V should enter block visual mode", () => {
    // Press Ctrl+V to enter block visual mode
    const result = controller.handleKeyPress("v", {
      key: "v",
      ctrl: true,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    expect(state.visualMode).toBe("block")
  })

  test("ESC should exit visual mode", () => {
    // Enter visual mode
    controller.handleKeyPress("v", {
      key: "v",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Move to select some cells
    controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Press ESC to exit visual mode
    const result = controller.handleKeyPress("Escape", {
      key: "Escape",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    const state = result.value
    expect(state.spreadsheetMode).toBe("navigation")
  })

  test("visual mode selection should be used for bulk operations", () => {
    // Set some values
    const cellA1 = CellAddress.create(0, 0)
    const cellB1 = CellAddress.create(0, 1)
    if (cellA1.ok && cellB1.ok) {
      facade.setCellValue(cellA1.value, "10")
      facade.setCellValue(cellB1.value, "20")
    }
    
    // Enter visual mode and select both cells
    controller.handleKeyPress("v", {
      key: "v",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Delete selected cells
    const result = controller.handleKeyPress("d", {
      key: "d",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    expect(result.ok).toBe(true)
    
    // Check that both cells were cleared
    if (cellA1.ok && cellB1.ok) {
      const valueA1 = facade.getCellValue(cellA1.value)
      const valueB1 = facade.getCellValue(cellB1.value)
      
      expect(valueA1.ok).toBe(true)
      expect(valueB1.ok).toBe(true)
      if (valueA1.ok) expect(valueA1.value).toBeNull()
      if (valueB1.ok) expect(valueB1.value).toBeNull()
    }
  })

  test("mouse drag should enter and extend visual selection", () => {
    // Simulate mouse drag start at A1
    const startCell = CellAddress.create(0, 0)
    if (!startCell.ok) return
    
    // Note: WebStateAdapter would handle this in real usage
    // Here we simulate the equivalent keyboard actions
    
    // Enter visual mode
    controller.handleKeyPress("v", {
      key: "v",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Simulate dragging to C3 by moving cursor
    controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    })
    controller.handleKeyPress("l", {
      key: "l",
      ctrl: false,
      shift: false,
      alt: false,
    })
    controller.handleKeyPress("j", {
      key: "j",
      ctrl: false,
      shift: false,
      alt: false,
    })
    controller.handleKeyPress("j", {
      key: "j",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    const state = controller.getState()
    expect(state.spreadsheetMode).toBe("visual")
    if (state.spreadsheetMode !== "visual") return
    
    // Should have selected a 3x3 area
    expect(state.selection.type.type).toBe("range")
    if (state.selection.type.type === "range") {
      expect(state.selection.type.start.row).toBe(0)
      expect(state.selection.type.start.col).toBe(0)
      expect(state.selection.type.end.row).toBe(2)
      expect(state.selection.type.end.col).toBe(2)
    }
  })
})