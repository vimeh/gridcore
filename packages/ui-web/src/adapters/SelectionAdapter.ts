import { CellAddress, CellRange, SpreadsheetVisualMode } from "../wasm"
import type {
  Selection,
  UIState,
} from "../wasm"
import { isSpreadsheetVisualMode } from "../wasm"

// Temporary interface for core selection manager
interface CoreSelectionManager {
  setSelection(selection: Selection): void
  getCellsInSelection(): CellAddress[]
  getSelectionBounds(): { start: CellAddress; end: CellAddress } | null
  isCellSelected(address: CellAddress): boolean
}

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
    
    // Check if selection is valid
    if (!selection) {
      return cells
    }
    
    // Use the core SelectionManager to get all cells in the selection
    try {
      // Set the selection first, then get cells
      this.coreSelectionManager.setSelection(selection)
      for (const address of this.coreSelectionManager.getCellsInSelection()) {
        cells.add(address.toString())
      }
    } catch (error) {
      console.warn("Error getting cells in selection:", error)
    }
    
    return cells
  }

  /**
   * Extract CellRange from Selection if it's a range type
   */
  getSelectionRange(selection: Selection): CellRange | null {
    // Check if selection is valid
    if (!selection) {
      return null
    }
    
    // If selection has ranges, use the first one
    if (selection.ranges && selection.ranges.length > 0) {
      return selection.ranges[0]
    }
    
    // For other selection types, calculate bounds and create a range
    try {
      this.coreSelectionManager.setSelection(selection)
      const bounds = this.coreSelectionManager.getSelectionBounds()
      if (bounds) {
        return (CellRange as any).create(bounds.start, bounds.end)
      }
    } catch (error) {
      console.warn("Error getting selection range:", error)
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
    
    switch (visualMode as any) {
      case "char":
      case SpreadsheetVisualMode.CharacterWise:
        return "character"
      case "line":
      case "row":
      case SpreadsheetVisualMode.LineWise:
        return "line"
      case "column":
        return "line"
      case "block":
      case SpreadsheetVisualMode.BlockWise:
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
    if (state.visualMode && isSpreadsheetVisualMode(state.visualMode)) {
      return {
        selection: state.selection,
        visualMode: this.getVisualModeForRenderer(state.visualMode as SpreadsheetVisualMode),
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
        anchor: state.cursor,
        focus: state.cursor,
        primary: state.cursor,
        ranges: [{
          start: state.cursor,
          end: state.cursor
        }],
        type: "single"
      },
      visualMode: null,
    }
  }

  /**
   * Check if a cell is selected in the given selection
   */
  isCellSelected(address: CellAddress, selection: Selection): boolean {
    this.coreSelectionManager.setSelection(selection)
    return this.coreSelectionManager.isCellSelected(address)
  }
}