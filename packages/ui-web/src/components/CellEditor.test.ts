import { expect, test, describe, beforeEach, afterEach } from "bun:test"
import { CellEditor } from "./CellEditor"
import { Workbook, CellAddress } from "@gridcore/core"
import { SpreadsheetController } from "@gridcore/ui-core"
import type { ViewportManager } from "@gridcore/ui-core"
import { Window } from "happy-dom"

// Set up DOM environment
const happyWindow = new Window()

// Override globals without type conflicts
Object.assign(global, {
  window: happyWindow,
  document: happyWindow.document,
  KeyboardEvent: happyWindow.KeyboardEvent,
})

// Use the document from the global object
const document = happyWindow.document

// Mock ViewportManager
class MockViewportManager implements ViewportManager {
  getColumnWidth(index: number): number {
    return 100
  }
  setColumnWidth(index: number, width: number): void {}
  getRowHeight(index: number): number {
    return 25
  }
  setRowHeight(index: number, height: number): void {}
  getTotalRows(): number {
    return 1000
  }
  getTotalCols(): number {
    return 26
  }
  scrollTo(row: number, col: number): void {}
}

// Mock Viewport
class MockViewport {
  getCellPosition(address: CellAddress) {
    return {
      x: address.col * 100,
      y: address.row * 25,
      width: 100,
      height: 25,
    }
  }
}

describe("CellEditor", () => {
  let cellEditor: CellEditor
  let container: ReturnType<typeof document.createElement>
  let workbook: Workbook
  let controller: SpreadsheetController
  let viewportManager: ViewportManager
  let viewport: MockViewport
  let committedValue: string | null
  let cancelCalled: boolean
  let committedAddress: CellAddress | null

  beforeEach(() => {
    // Reset test state
    committedValue = null
    cancelCalled = false
    committedAddress = null
    
    // Create container
    container = document.createElement("div")
    document.body.appendChild(container)
    
    // Create mocks
    workbook = new Workbook()
    const sheet = workbook.getActiveSheet()
    if (!sheet) throw new Error("No active sheet")
    
    viewportManager = new MockViewportManager()
    viewport = new MockViewport()
    
    controller = new SpreadsheetController({
      facade: sheet.getFacade(),
      viewportManager,
    })
    
    // Create CellEditor
    cellEditor = new CellEditor(container as unknown as HTMLElement, viewport as any, {
      onCommit: (address: CellAddress, value: string) => {
        committedAddress = address
        committedValue = value
      },
      onCancel: () => {
        cancelCalled = true
      },
      controller,
    })
  })

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container)
    }
  })

  test("double escape should save text in insert mode", () => {
    // Start editing in insert mode
    const addressResult = CellAddress.create(0, 0)
    if (!addressResult.ok) throw new Error("Failed to create address")
    
    // First enter edit mode by pressing 'i' in the controller
    controller.handleKeyPress("i", {
      key: "i",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    // Now start the cell editor
    cellEditor.startEditing(addressResult.value, "")
    
    // Get the editor element
    const editorDiv = container.querySelector(".cell-editor") as unknown as HTMLDivElement
    expect(editorDiv).toBeDefined()
    
    // Type some text by simulating key presses
    const text = "Hello World"
    for (const char of text) {
      const keyEvent = new KeyboardEvent("keydown", {
        key: char,
        bubbles: true,
      })
      editorDiv.dispatchEvent(keyEvent)
      // Also update the content to simulate the browser's behavior
      editorDiv.textContent = editorDiv.textContent + char
    }
    
    // Simulate first escape key press
    const firstEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
    })
    editorDiv.dispatchEvent(firstEscape)
    
    // Check that we're still editing but in normal mode
    expect(cellEditor.isCurrentlyEditing()).toBe(true)
    expect(committedValue).toBe(null)
    expect(cancelCalled).toBe(false)
    
    // Check controller state transitioned to normal mode
    const state1 = controller.getState()
    expect(state1.spreadsheetMode).toBe("editing")
    if (state1.spreadsheetMode === "editing") {
      expect(state1.cellMode).toBe("normal")
    }
    
    // Simulate second escape key press
    const secondEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
    })
    editorDiv.dispatchEvent(secondEscape)
    
    // Check that editing stopped and value was saved
    expect(cellEditor.isCurrentlyEditing()).toBe(false)
    expect(committedValue).toBe("Hello World")
    expect(cancelCalled).toBe(false)
  })


  test("escape transitions from insert to normal mode", () => {
    // Start editing in insert mode
    const addressResult = CellAddress.create(0, 0)
    if (!addressResult.ok) throw new Error("Failed to create address")
    
    // Enter insert mode
    controller.handleKeyPress("i", {
      key: "i",
      ctrl: false,
      shift: false,
      alt: false,
    })
    
    cellEditor.startEditing(addressResult.value, "")
    
    // Get initial controller state
    const initialState = controller.getState()
    expect(initialState.spreadsheetMode).toBe("editing")
    if (initialState.spreadsheetMode === "editing") {
      expect(initialState.cellMode).toBe("insert")
    }
    
    // Get the editor element
    const editorDiv = container.querySelector(".cell-editor") as unknown as HTMLDivElement
    
    // Simulate escape key press
    const escape = new KeyboardEvent("keydown", {
      key: "Escape",
      keyCode: 27,
      bubbles: true,
    })
    editorDiv.dispatchEvent(escape)
    
    // Check controller state transitioned to normal mode
    const newState = controller.getState()
    expect(newState.spreadsheetMode).toBe("editing")
    if (newState.spreadsheetMode === "editing") {
      expect(newState.cellMode).toBe("normal")
    }
    
    // Should still be editing
    expect(cellEditor.isCurrentlyEditing()).toBe(true)
  })
  
})