import { describe, expect, test } from "bun:test";
import { CellAddress } from "@gridcore/core";
import { createSpreadsheetVisualState, createNavigationState } from "../state/UIState";
import type { Selection } from "../state/UIState";
import { DefaultSelectionManager } from "./SelectionManager";

// Mock SpreadsheetFacade for testing
const mockFacade = {} as any;

describe("SelectionManager", () => {
  const manager = new DefaultSelectionManager(mockFacade);
  const defaultViewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };

  // Helper function to create cell addresses
  const cell = (row: number, col: number) => CellAddress.create(row, col).value;

  describe("createSelection", () => {
    test("creates char selection for single cell", () => {
      const anchor = cell(1, 1);
      const cursor = cell(1, 1);
      
      const selection = manager.createSelection("char", anchor, cursor);
      
      expect(selection.type.type).toBe("cell");
      expect(selection.type.address).toEqual(anchor);
      expect(selection.anchor).toEqual(anchor);
    });

    test("creates range selection for char mode with different cells", () => {
      const anchor = cell(1, 1);
      const cursor = cell(3, 4);
      
      const selection = manager.createSelection("char", anchor, cursor);
      
      expect(selection.type.type).toBe("range");
      expect(selection.type.start).toEqual(cell(1, 1));
      expect(selection.type.end).toEqual(cell(3, 4));
    });

    test("creates row selection", () => {
      const anchor = cell(1, 2);
      const cursor = cell(3, 5);
      
      const selection = manager.createSelection("row", anchor, cursor);
      
      expect(selection.type.type).toBe("row");
      expect(selection.type.rows).toEqual([1, 2, 3]);
      expect(selection.anchor).toEqual(anchor);
    });

    test("creates column selection", () => {
      const anchor = cell(2, 1);
      const cursor = cell(5, 3);
      
      const selection = manager.createSelection("column", anchor, cursor);
      
      expect(selection.type.type).toBe("column");
      expect(selection.type.columns).toEqual([1, 2, 3]);
      expect(selection.anchor).toEqual(anchor);
    });

    test("creates block selection", () => {
      const anchor = cell(1, 1);
      const cursor = cell(3, 4);
      
      const selection = manager.createSelection("block", anchor, cursor);
      
      expect(selection.type.type).toBe("range");
      expect(selection.type.start).toEqual(cell(1, 1));
      expect(selection.type.end).toEqual(cell(3, 4));
    });

    test("handles reversed anchor and cursor", () => {
      const anchor = cell(3, 4);
      const cursor = cell(1, 1);
      
      const selection = manager.createSelection("char", anchor, cursor);
      
      expect(selection.type.type).toBe("range");
      expect(selection.type.start).toEqual(cell(1, 1));
      expect(selection.type.end).toEqual(cell(3, 4));
    });
  });

  describe("extendSelection", () => {
    test("extends row selection", () => {
      const anchor = cell(1, 1);
      const originalSelection: Selection = {
        type: { type: "row", rows: [1, 2] },
        anchor,
      };
      
      const newCursor = cell(4, 5);
      const extended = manager.extendSelection(originalSelection, newCursor, "row");
      
      expect(extended.type.type).toBe("row");
      expect(extended.type.rows).toEqual([1, 2, 3, 4]);
    });

    test("extends column selection", () => {
      const anchor = cell(1, 1);
      const originalSelection: Selection = {
        type: { type: "column", columns: [1, 2] },
        anchor,
      };
      
      const newCursor = cell(5, 4);
      const extended = manager.extendSelection(originalSelection, newCursor, "column");
      
      expect(extended.type.type).toBe("column");
      expect(extended.type.columns).toEqual([1, 2, 3, 4]);
    });

    test("handles selection without anchor", () => {
      const originalSelection: Selection = {
        type: { type: "cell", address: cell(1, 1) },
      };
      
      const newCursor = cell(2, 2);
      const extended = manager.extendSelection(originalSelection, newCursor, "char");
      
      expect(extended.type.type).toBe("cell"); // Single cell since newCursor becomes both anchor and cursor
    });
  });

  describe("getSelectionBounds", () => {
    test("gets bounds for cell selection", () => {
      const selection: Selection = {
        type: { type: "cell", address: cell(5, 3) },
      };
      
      const bounds = manager.getSelectionBounds(selection);
      
      expect(bounds).toEqual({
        minRow: 5,
        maxRow: 5,
        minCol: 3,
        maxCol: 3,
      });
    });

    test("gets bounds for range selection", () => {
      const selection: Selection = {
        type: { type: "range", start: cell(1, 2), end: cell(4, 6) },
      };
      
      const bounds = manager.getSelectionBounds(selection);
      
      expect(bounds).toEqual({
        minRow: 1,
        maxRow: 4,
        minCol: 2,
        maxCol: 6,
      });
    });

    test("gets bounds for column selection", () => {
      const selection: Selection = {
        type: { type: "column", columns: [2, 5, 3] },
      };
      
      const bounds = manager.getSelectionBounds(selection);
      
      expect(bounds.minRow).toBe(0);
      expect(bounds.maxRow).toBeGreaterThan(1000); // Should be max row
      expect(bounds.minCol).toBe(2);
      expect(bounds.maxCol).toBe(5);
    });

    test("gets bounds for row selection", () => {
      const selection: Selection = {
        type: { type: "row", rows: [3, 1, 5] },
      };
      
      const bounds = manager.getSelectionBounds(selection);
      
      expect(bounds.minRow).toBe(1);
      expect(bounds.maxRow).toBe(5);
      expect(bounds.minCol).toBe(0);
      expect(bounds.maxCol).toBeGreaterThan(1000); // Should be max col
    });

    test("gets bounds for multi selection", () => {
      const subSelection1: Selection = {
        type: { type: "cell", address: cell(1, 1) },
      };
      const subSelection2: Selection = {
        type: { type: "range", start: cell(3, 4), end: cell(5, 7) },
      };
      
      const multiSelection: Selection = {
        type: { type: "multi", selections: [subSelection1, subSelection2] },
      };
      
      const bounds = manager.getSelectionBounds(multiSelection);
      
      expect(bounds).toEqual({
        minRow: 1,
        maxRow: 5,
        minCol: 1,
        maxCol: 7,
      });
    });
  });

  describe("isCellSelected", () => {
    test("checks cell selection", () => {
      const address = cell(2, 3);
      const selection: Selection = {
        type: { type: "cell", address },
      };
      
      expect(manager.isCellSelected(address, selection)).toBe(true);
      expect(manager.isCellSelected(cell(2, 4), selection)).toBe(false);
    });

    test("checks range selection", () => {
      const selection: Selection = {
        type: { type: "range", start: cell(1, 1), end: cell(3, 3) },
      };
      
      expect(manager.isCellSelected(cell(2, 2), selection)).toBe(true);
      expect(manager.isCellSelected(cell(1, 1), selection)).toBe(true);
      expect(manager.isCellSelected(cell(3, 3), selection)).toBe(true);
      expect(manager.isCellSelected(cell(0, 1), selection)).toBe(false);
      expect(manager.isCellSelected(cell(2, 4), selection)).toBe(false);
    });

    test("checks column selection", () => {
      const selection: Selection = {
        type: { type: "column", columns: [1, 3, 5] },
      };
      
      expect(manager.isCellSelected(cell(0, 1), selection)).toBe(true);
      expect(manager.isCellSelected(cell(100, 3), selection)).toBe(true);
      expect(manager.isCellSelected(cell(50, 5), selection)).toBe(true);
      expect(manager.isCellSelected(cell(10, 2), selection)).toBe(false);
      expect(manager.isCellSelected(cell(10, 4), selection)).toBe(false);
    });

    test("checks row selection", () => {
      const selection: Selection = {
        type: { type: "row", rows: [2, 4, 6] },
      };
      
      expect(manager.isCellSelected(cell(2, 0), selection)).toBe(true);
      expect(manager.isCellSelected(cell(4, 100), selection)).toBe(true);
      expect(manager.isCellSelected(cell(6, 50), selection)).toBe(true);
      expect(manager.isCellSelected(cell(1, 10), selection)).toBe(false);
      expect(manager.isCellSelected(cell(3, 10), selection)).toBe(false);
    });
  });

  describe("getCellsInSelection", () => {
    test("iterates cell selection", () => {
      const address = cell(2, 3);
      const selection: Selection = {
        type: { type: "cell", address },
      };
      
      const cells = Array.from(manager.getCellsInSelection(selection));
      
      expect(cells).toHaveLength(1);
      expect(cells[0]).toEqual(address);
    });

    test("iterates range selection", () => {
      const selection: Selection = {
        type: { type: "range", start: cell(1, 1), end: cell(2, 2) },
      };
      
      const cells = Array.from(manager.getCellsInSelection(selection));
      
      expect(cells).toHaveLength(4);
      expect(cells).toContainEqual(cell(1, 1));
      expect(cells).toContainEqual(cell(1, 2));
      expect(cells).toContainEqual(cell(2, 1));
      expect(cells).toContainEqual(cell(2, 2));
    });

    test("iterates column selection efficiently", () => {
      const selection: Selection = {
        type: { type: "column", columns: [1, 2] },
      };
      
      // Get first few cells to test the iterator
      const iterator = manager.getCellsInSelection(selection);
      const firstFew = [];
      let count = 0;
      for (const cell of iterator) {
        firstFew.push(cell);
        count++;
        if (count >= 10) break; // Don't iterate through millions of cells
      }
      
      expect(firstFew).toContainEqual(cell(0, 1));
      expect(firstFew).toContainEqual(cell(0, 2));
      expect(firstFew).toContainEqual(cell(1, 1));
      expect(firstFew).toContainEqual(cell(1, 2));
    });
  });

  describe("getCurrentSelection", () => {
    test("gets selection from visual mode state", () => {
      const anchor = cell(1, 1);
      const selection: Selection = {
        type: { type: "row", rows: [1, 2] },
        anchor,
      };
      
      const state = createSpreadsheetVisualState(
        cell(2, 3),
        defaultViewport,
        "row",
        anchor,
        selection,
      );
      
      const result = manager.getCurrentSelection(state);
      expect(result).toEqual(selection);
    });

    test("gets selection from navigation mode state", () => {
      const selection: Selection = {
        type: { type: "cell", address: cell(1, 1) },
      };
      
      const state = createNavigationState(cell(1, 1), defaultViewport, selection);
      
      const result = manager.getCurrentSelection(state);
      expect(result).toEqual(selection);
    });

    test("returns undefined for states without selection", () => {
      const state = createNavigationState(cell(1, 1), defaultViewport);
      
      const result = manager.getCurrentSelection(state);
      expect(result).toBeUndefined();
    });
  });
});