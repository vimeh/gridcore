import { CellAddress, type SpreadsheetFacade } from "@gridcore/core";
import type {
  Selection,
  SelectionType,
  SpreadsheetVisualMode,
  UIState,
} from "../state/UIState";
import { isSpreadsheetVisualMode } from "../state/UIState";

export interface SelectionBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface SelectionManager {
  /**
   * Creates a selection based on the current visual mode and cursor positions
   */
  createSelection(
    visualMode: SpreadsheetVisualMode,
    anchor: CellAddress,
    cursor: CellAddress,
  ): Selection;

  /**
   * Updates an existing selection by extending it to a new cursor position
   */
  extendSelection(
    selection: Selection,
    newCursor: CellAddress,
    visualMode: SpreadsheetVisualMode,
  ): Selection;

  /**
   * Gets the bounds of a selection (min/max row/col)
   */
  getSelectionBounds(selection: Selection): SelectionBounds;

  /**
   * Gets all cell addresses that are part of a selection
   * Uses lazy evaluation for performance with large selections
   */
  getCellsInSelection(selection: Selection): Iterable<CellAddress>;

  /**
   * Checks if a specific cell address is included in a selection
   */
  isCellSelected(address: CellAddress, selection: Selection): boolean;

  /**
   * Gets the current selection from UI state (if any)
   */
  getCurrentSelection(state: UIState): Selection | undefined;
}

export class DefaultSelectionManager implements SelectionManager {
  private facade: SpreadsheetFacade;

  constructor(facade: SpreadsheetFacade) {
    this.facade = facade;
  }

  createSelection(
    visualMode: SpreadsheetVisualMode,
    anchor: CellAddress,
    cursor: CellAddress,
  ): Selection {
    switch (visualMode) {
      case "char":
        return this.createCharSelection(anchor, cursor);
      case "line":
      case "row":
        return this.createRowSelection(anchor, cursor);
      case "column":
        return this.createColumnSelection(anchor, cursor);
      case "block":
        return this.createBlockSelection(anchor, cursor);
      default:
        // Fallback to char selection
        return this.createCharSelection(anchor, cursor);
    }
  }

  extendSelection(
    selection: Selection,
    newCursor: CellAddress,
    visualMode: SpreadsheetVisualMode,
  ): Selection {
    if (!selection.anchor) {
      // If no anchor, treat newCursor as both anchor and cursor
      return this.createSelection(visualMode, newCursor, newCursor);
    }

    return this.createSelection(visualMode, selection.anchor, newCursor);
  }

  getSelectionBounds(selection: Selection): SelectionBounds {
    switch (selection.type.type) {
      case "cell":
        return {
          minRow: selection.type.address.row,
          maxRow: selection.type.address.row,
          minCol: selection.type.address.col,
          maxCol: selection.type.address.col,
        };

      case "range":
        return {
          minRow: Math.min(selection.type.start.row, selection.type.end.row),
          maxRow: Math.max(selection.type.start.row, selection.type.end.row),
          minCol: Math.min(selection.type.start.col, selection.type.end.col),
          maxCol: Math.max(selection.type.start.col, selection.type.end.col),
        };

      case "column": {
        const minCol = Math.min(...selection.type.columns);
        const maxCol = Math.max(...selection.type.columns);
        return {
          minRow: 0,
          maxRow: this.getMaxRow(),
          minCol,
          maxCol,
        };
      }

      case "row": {
        const minRow = Math.min(...selection.type.rows);
        const maxRow = Math.max(...selection.type.rows);
        return {
          minRow,
          maxRow,
          minCol: 0,
          maxCol: this.getMaxCol(),
        };
      }

      case "multi": {
        // Calculate bounds across all selections
        let bounds: SelectionBounds | null = null;
        for (const subSelection of selection.type.selections) {
          const subBounds = this.getSelectionBounds(subSelection);
          if (!bounds) {
            bounds = subBounds;
          } else {
            bounds = {
              minRow: Math.min(bounds.minRow, subBounds.minRow),
              maxRow: Math.max(bounds.maxRow, subBounds.maxRow),
              minCol: Math.min(bounds.minCol, subBounds.minCol),
              maxCol: Math.max(bounds.maxCol, subBounds.maxCol),
            };
          }
        }
        return bounds || { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
      }

      default:
        return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    }
  }

  *getCellsInSelection(selection: Selection): Iterable<CellAddress> {
    const bounds = this.getSelectionBounds(selection);

    switch (selection.type.type) {
      case "cell":
        yield selection.type.address;
        break;

      case "range":
        for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
          for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
            const address = CellAddress.create(row, col);
            if (address.ok) {
              yield address.value;
            }
          }
        }
        break;

      case "column":
        // Iterate row by row for more natural ordering
        for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
          for (const colIndex of selection.type.columns) {
            const address = CellAddress.create(row, colIndex);
            if (address.ok) {
              yield address.value;
            }
          }
        }
        break;

      case "row":
        for (const rowIndex of selection.type.rows) {
          for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
            const address = CellAddress.create(rowIndex, col);
            if (address.ok) {
              yield address.value;
            }
          }
        }
        break;

      case "multi":
        for (const subSelection of selection.type.selections) {
          yield* this.getCellsInSelection(subSelection);
        }
        break;
    }
  }

  isCellSelected(address: CellAddress, selection: Selection): boolean {
    switch (selection.type.type) {
      case "cell":
        return address.equals(selection.type.address);

      case "range": {
        const bounds = this.getSelectionBounds(selection);
        return (
          address.row >= bounds.minRow &&
          address.row <= bounds.maxRow &&
          address.col >= bounds.minCol &&
          address.col <= bounds.maxCol
        );
      }

      case "column":
        return selection.type.columns.includes(address.col);

      case "row":
        return selection.type.rows.includes(address.row);

      case "multi":
        return selection.type.selections.some((subSelection) =>
          this.isCellSelected(address, subSelection),
        );

      default:
        return false;
    }
  }

  getCurrentSelection(state: UIState): Selection | undefined {
    if (isSpreadsheetVisualMode(state)) {
      return state.selection;
    }

    // Navigation mode might have a selection
    if (state.spreadsheetMode === "navigation") {
      return state.selection;
    }

    return undefined;
  }

  // Private helper methods for creating different selection types
  private createCharSelection(
    anchor: CellAddress,
    cursor: CellAddress,
  ): Selection {
    const startRow = Math.min(anchor.row, cursor.row);
    const endRow = Math.max(anchor.row, cursor.row);
    const startCol = Math.min(anchor.col, cursor.col);
    const endCol = Math.max(anchor.col, cursor.col);

    // If it's a single cell, use cell selection
    if (startRow === endRow && startCol === endCol) {
      return {
        type: { type: "cell", address: anchor },
        anchor,
      };
    }

    // Otherwise use range selection
    const start = CellAddress.create(startRow, startCol);
    const end = CellAddress.create(endRow, endCol);

    if (!start.ok || !end.ok) {
      // Fallback to cell selection
      return {
        type: { type: "cell", address: anchor },
        anchor,
      };
    }

    return {
      type: { type: "range", start: start.value, end: end.value },
      anchor,
    };
  }

  private createRowSelection(
    anchor: CellAddress,
    cursor: CellAddress,
  ): Selection {
    const startRow = Math.min(anchor.row, cursor.row);
    const endRow = Math.max(anchor.row, cursor.row);
    const rows: number[] = [];

    for (let row = startRow; row <= endRow; row++) {
      rows.push(row);
    }

    return {
      type: { type: "row", rows },
      anchor,
    };
  }

  private createColumnSelection(
    anchor: CellAddress,
    cursor: CellAddress,
  ): Selection {
    const startCol = Math.min(anchor.col, cursor.col);
    const endCol = Math.max(anchor.col, cursor.col);
    const columns: number[] = [];

    for (let col = startCol; col <= endCol; col++) {
      columns.push(col);
    }

    return {
      type: { type: "column", columns },
      anchor,
    };
  }

  private createBlockSelection(
    anchor: CellAddress,
    cursor: CellAddress,
  ): Selection {
    const start = CellAddress.create(
      Math.min(anchor.row, cursor.row),
      Math.min(anchor.col, cursor.col),
    );
    const end = CellAddress.create(
      Math.max(anchor.row, cursor.row),
      Math.max(anchor.col, cursor.col),
    );

    if (!start.ok || !end.ok) {
      // Fallback to cell selection
      return {
        type: { type: "cell", address: anchor },
        anchor,
      };
    }

    return {
      type: { type: "range", start: start.value, end: end.value },
      anchor,
    };
  }

  private getMaxRow(): number {
    // TODO: Get actual max row from spreadsheet facade
    // For now, use a reasonable default
    return 1000000;
  }

  private getMaxCol(): number {
    // TODO: Get actual max column from spreadsheet facade
    // For now, use a reasonable default (Excel has 16384 columns)
    return 16384;
  }
}
