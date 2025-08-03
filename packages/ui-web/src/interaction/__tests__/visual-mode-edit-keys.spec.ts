import { expect, test, describe, beforeEach } from "bun:test"
import { GridVimBehavior } from "../GridVimBehavior"
import { SelectionManager } from "../SelectionManager"
import type { GridVimCallbacks } from "../GridVimBehavior"
import type { Viewport } from "../../components/Viewport"

describe("Visual Mode Edit Key Handling", () => {
  let selectionManager: SelectionManager
  let vimBehavior: GridVimBehavior
  let mockCallbacks: GridVimCallbacks
  let currentMode: string
  let modeChangeRequests: string[] = []

  // Mock viewport for testing
  const mockViewport = {
    getTotalCols: () => 100,
    getTotalRows: () => 100,
    getPageSize: () => ({ rows: 20, cols: 20 }),
  } as unknown as Viewport

  beforeEach(() => {
    selectionManager = new SelectionManager()
    selectionManager.setViewport(mockViewport)
    
    currentMode = "visual"
    modeChangeRequests = []
    
    mockCallbacks = {
      onModeChangeRequest: (mode: string) => {
        modeChangeRequests.push(mode)
        currentMode = mode
      },
      onRangeSelectionRequest: () => {},
      onResizeRequest: () => {},
      onScrollRequest: () => {},
      onCellNavigate: () => {},
    }

    vimBehavior = new GridVimBehavior(
      mockCallbacks,
      () => currentMode,
      selectionManager,
      mockViewport
    )

    // Start with active cell at (5, 5)
    selectionManager.setActiveCell({ row: 5, col: 5 })
    selectionManager.startVisualSelection({ row: 5, col: 5 }, "character")
  })

  describe("Edit keys in visual mode", () => {
    test("pressing 'i' in visual mode exits to normal mode", () => {
      // Press 'i' in visual mode
      const handled = vimBehavior.handleKey("i")
      
      // Should not be handled (returns false) to allow normal mode to handle it
      expect(handled).toBe(false)
      
      // Should request mode change to normal
      expect(modeChangeRequests).toEqual(["normal"])
      
      // Visual mode should still be active in SelectionManager
      // (it will be cleared by KeyboardHandler when mode changes)
      expect(selectionManager.getVisualMode()).toBe("character")
    })

    test("pressing 'a' in visual mode exits to normal mode", () => {
      const handled = vimBehavior.handleKey("a")
      
      expect(handled).toBe(false)
      expect(modeChangeRequests).toEqual(["normal"])
    })

    test("pressing 'I' in visual mode exits to normal mode", () => {
      const handled = vimBehavior.handleKey("I")
      
      expect(handled).toBe(false)
      expect(modeChangeRequests).toEqual(["normal"])
    })

    test("pressing 'A' in visual mode exits to normal mode", () => {
      const handled = vimBehavior.handleKey("A")
      
      expect(handled).toBe(false)
      expect(modeChangeRequests).toEqual(["normal"])
    })

    test("pressing 'o' in visual mode exits to normal mode", () => {
      const handled = vimBehavior.handleKey("o")
      
      expect(handled).toBe(false)
      expect(modeChangeRequests).toEqual(["normal"])
    })

    test("pressing 'O' in visual mode exits to normal mode", () => {
      const handled = vimBehavior.handleKey("O")
      
      expect(handled).toBe(false)
      expect(modeChangeRequests).toEqual(["normal"])
    })

    test("visual selection is maintained when pressing edit keys", () => {
      // Select some cells first
      selectionManager.updateVisualSelection({ row: 7, col: 7 })
      
      const selectedBefore = selectionManager.getSelectedCells()
      expect(selectedBefore.size).toBeGreaterThan(1)
      
      // Press 'i'
      vimBehavior.handleKey("i")
      
      // Selection should still exist (will be cleared by KeyboardHandler)
      const selectedAfter = selectionManager.getSelectedCells()
      expect(selectedAfter.size).toBe(selectedBefore.size)
    })

    test("number buffer is cleared when pressing edit keys", () => {
      // Type a number prefix
      vimBehavior.handleKey("3")
      
      // Press 'i'
      vimBehavior.handleKey("i")
      
      // Mode should change to normal
      expect(modeChangeRequests).toEqual(["normal"])
      
      // Next number should not be affected by previous buffer
      currentMode = "visual" // Reset to visual for testing
      vimBehavior.handleKey("2")
      vimBehavior.handleKey("l")
      
      // Should move 2 cells, not 32
      const activeCell = selectionManager.getActiveCell()
      expect(activeCell?.col).toBe(7) // 5 + 2
    })
  })

  describe("Visual mode navigation still works", () => {
    test("hjkl keys still navigate in visual mode", () => {
      const handled = vimBehavior.handleKey("l")
      expect(handled).toBe(true)
      expect(modeChangeRequests).toEqual([]) // No mode change
      
      const activeCell = selectionManager.getActiveCell()
      expect(activeCell?.col).toBe(6) // Moved right
    })

    test("escape still exits visual mode", () => {
      const handled = vimBehavior.handleKey("Escape")
      expect(handled).toBe(true)
      expect(modeChangeRequests).toEqual(["normal"])
    })
  })
})