import { CellAddress, CellRange } from "@gridcore/core"
import type {
  Selection,
  SelectionManager as CoreSelectionManager,
  SpreadsheetVisualMode,
  UIState,
} from "@gridcore/ui-core"
import { isSpreadsheetVisualMode } from "@gridcore/ui-core"

/**
 * Adapter to bridge UIState's Selection with ui-web's rendering needs
 */
export class SelectionAdapter {
  constructor(private coreSelectionManager: CoreSelectionManager) {}

  /**
   * Convert UIState's Selection to a Set of cell address strings
   */
  getSelectedCells(selection: Selection): Set<string> {
    const cells = new Set<string>()
    
    // Use the core SelectionManager to get all cells in the selection
    for (const address of this.coreSelectionManager.getCellsInSelection(selection)) {
      cells.add(address.toString())
    }
    
    return cells
  }

  /**
   * Extract CellRange from Selection if it's a range type
   */
  getSelectionRange(selection: Selection): CellRange | null {
    if (selection.type.type === "range") {
      const result = CellRange.create(selection.type.start, selection.type.end)
      return result.ok ? result.value : null
    }
    
    // For other selection types, calculate bounds and create a range
    const bounds = this.coreSelectionManager.getSelectionBounds(selection)
    const startResult = CellAddress.create(bounds.minRow, bounds.minCol)
    const endResult = CellAddress.create(bounds.maxRow, bounds.maxCol)
    
    if (startResult.ok && endResult.ok) {
      const rangeResult = CellRange.create(startResult.value, endResult.value)
      return rangeResult.ok ? rangeResult.value : null
    }
    
    return null
  }

  /**
   * Convert SpreadsheetVisualMode to renderer's expected format
   */
  getVisualModeForRenderer(
    visualMode?: SpreadsheetVisualMode
  ): "character" | "line" | "block" | null {
    if (!visualMode) return null
    
    switch (visualMode) {
      case "char":
        return "character"
      case "line":
      case "row":
        return "line"
      case "column":
        return "line"
      case "block":
        return "block"
      default:
        return null
    }
  }

  /**
   * Extract selection data from UIState
   */
  getSelectionFromState(state: UIState): {
    selection: Selection | null
    visualMode: "character" | "line" | "block" | null
  } {
    // Check if we're in visual mode
    if (isSpreadsheetVisualMode(state)) {
      return {
        selection: state.selection,
        visualMode: this.getVisualModeForRenderer(state.visualMode),
      }
    }
    
    // Check if navigation mode has a selection
    if (state.spreadsheetMode === "navigation" && state.selection) {
      return {
        selection: state.selection,
        visualMode: null,
      }
    }
    
    // No selection, just the cursor
    return {
      selection: {
        type: { type: "cell", address: state.cursor },
        anchor: state.cursor,
      },
      visualMode: null,
    }
  }

  /**
   * Check if a cell is selected in the given selection
   */
  isCellSelected(address: CellAddress, selection: Selection): boolean {
    return this.coreSelectionManager.isCellSelected(address, selection)
  }
}