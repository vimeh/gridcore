import { beforeEach, describe, expect, test } from "bun:test"
import { CellAddress, SpreadsheetFacade } from "@gridcore/core"
import {
  SpreadsheetController,
  type ViewportManager,
} from "@gridcore/ui-core"
import { WebStateAdapter, type WebUIState } from "./WebStateAdapter"

// Mock ViewportManager
class MockViewportManager implements ViewportManager {
  private columnWidths = new Map<number, number>()
  private rowHeights = new Map<number, number>()

  getColumnWidth(index: number): number {
    return this.columnWidths.get(index) || 80
  }

  setColumnWidth(index: number, width: number): void {
    this.columnWidths.set(index, width)
  }

  getRowHeight(index: number): number {
    return this.rowHeights.get(index) || 25
  }

  setRowHeight(index: number, height: number): void {
    this.rowHeights.set(index, height)
  }

  getTotalRows(): number {
    return 1000
  }

  getTotalCols(): number {
    return 100
  }

  scrollTo(_row: number, _col: number): void {
    // Mock implementation
  }
}

describe("WebStateAdapter", () => {
  let facade: SpreadsheetFacade
  let viewportManager: ViewportManager
  let controller: SpreadsheetController
  let adapter: WebStateAdapter

  beforeEach(() => {
    // Create facade with empty data
    facade = new SpreadsheetFacade()
    viewportManager = new MockViewportManager()
    controller = new SpreadsheetController({
      facade,
      viewportManager,
    })
    adapter = new WebStateAdapter(controller)
  })

  test("initializes with default state", () => {
    const state = adapter.getState()
    expect(state.interactionMode).toBe("normal")
    expect(state.coreState.spreadsheetMode).toBe("navigation")
  })

  test("toggles interaction mode", () => {
    expect(adapter.getState().interactionMode).toBe("normal")
    
    adapter.toggleInteractionMode()
    expect(adapter.getState().interactionMode).toBe("keyboard-only")
    
    adapter.toggleInteractionMode()
    expect(adapter.getState().interactionMode).toBe("normal")
  })

  test("sets interaction mode explicitly", () => {
    adapter.setInteractionMode("keyboard-only")
    expect(adapter.getState().interactionMode).toBe("keyboard-only")
    
    adapter.setInteractionMode("normal")
    expect(adapter.getState().interactionMode).toBe("normal")
  })

  test("handles mouse click in normal mode", () => {
    const address = CellAddress.create(5, 3)
    if (!address.ok) throw new Error("Failed to create address")

    const result = adapter.handleMouseAction({
      type: "click",
      address: address.value,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.cursor.row).toBe(5)
      expect(result.value.cursor.col).toBe(3)
    }
  })

  test("ignores mouse click in keyboard-only mode", () => {
    adapter.setInteractionMode("keyboard-only")
    
    const originalCursor = adapter.getCoreState().cursor
    const newAddress = CellAddress.create(5, 3)
    if (!newAddress.ok) throw new Error("Failed to create address")

    const result = adapter.handleMouseAction({
      type: "click",
      address: newAddress.value,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Cursor should not have moved
      expect(result.value.cursor).toEqual(originalCursor)
    }
  })

  test("handles double click to start editing", () => {
    const address = CellAddress.create(2, 4)
    if (!address.ok) throw new Error("Failed to create address")

    const result = adapter.handleMouseAction({
      type: "doubleClick",
      address: address.value,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spreadsheetMode).toBe("editing")
      expect(result.value.cursor.row).toBe(2)
      expect(result.value.cursor.col).toBe(4)
    }
  })

  test("ignores double click in keyboard-only mode", () => {
    adapter.setInteractionMode("keyboard-only")
    
    const address = CellAddress.create(2, 4)
    if (!address.ok) throw new Error("Failed to create address")

    const result = adapter.handleMouseAction({
      type: "doubleClick",
      address: address.value,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      // Should still be in navigation mode
      expect(result.value.spreadsheetMode).toBe("navigation")
    }
  })

  test("handles column resize", () => {
    // Note: resize actions are handled by Web UI directly
    // The adapter just returns the current state
    const result = adapter.handleMouseAction({
      type: "resizeColumn",
      index: 3,
      width: 120,
    })

    expect(result.ok).toBe(true)
  })

  test("handles row resize", () => {
    // Note: resize actions are handled by Web UI directly
    // The adapter just returns the current state
    const result = adapter.handleMouseAction({
      type: "resizeRow",
      index: 5,
      height: 40,
    })

    expect(result.ok).toBe(true)
  })

  test("subscribes to state changes", () => {
    let notificationCount = 0
    let lastState: WebUIState | undefined

    const unsubscribe = adapter.subscribe((state) => {
      notificationCount++
      lastState = state
    })

    // Trigger a state change
    adapter.toggleInteractionMode()

    expect(notificationCount).toBe(1)
    expect(lastState?.interactionMode).toBe("keyboard-only")

    // Test unsubscribe
    unsubscribe()
    adapter.toggleInteractionMode()
    expect(notificationCount).toBe(1) // Should not increase
  })

  test("provides access to underlying controller", () => {
    const controllerRef = adapter.getController()
    expect(controllerRef).toBe(controller)
  })

  test("propagates controller state changes", () => {
    let notificationCount = 0

    adapter.subscribe(() => {
      notificationCount++
    })

    // Trigger a state change through the controller by simulating navigation
    // Move down 10 times (to row 10)
    for (let i = 0; i < 10; i++) {
      controller.handleKeyPress("j", {})
    }

    expect(notificationCount).toBeGreaterThan(0)
  })
})