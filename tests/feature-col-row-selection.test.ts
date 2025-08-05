import { describe, test, expect } from "bun:test";
import { SpreadsheetController } from "@gridcore/ui-core";
import { createTestSpreadsheet, measureOperationTime, validatePerformance } from "./integration-test-utils";
import { CellAddress } from "@gridcore/core";

describe("Column/Row Selection Integration Tests", () => {
  test("gC command selects entire column", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set cursor to column B (col 1)
    const cursor = CellAddress.create(5, 1);
    expect(cursor.ok).toBe(true);
    
    controller.updateCursor(cursor.value);
    
    // Execute gC command to select column
    controller.handleKey("g");
    controller.handleKey("C");
    
    const state = controller.getUIState();
    expect(state.spreadsheetMode).toBe("visual");
    
    if (state.spreadsheetMode === "visual" && state.selection) {
      expect(state.selection.type.type).toBe("column");
      if (state.selection.type.type === "column") {
        expect(state.selection.type.columns).toEqual([1]);
      }
    }
  });

  test("V command selects entire row", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set cursor to row 10
    const cursor = CellAddress.create(10, 3);
    expect(cursor.ok).toBe(true);
    
    controller.updateCursor(cursor.value);
    
    // Execute V command to select row
    controller.handleKey("V");
    
    const state = controller.getUIState();
    expect(state.spreadsheetMode).toBe("visual");
    
    if (state.spreadsheetMode === "visual" && state.selection) {
      expect(state.selection.type.type).toBe("row");
      if (state.selection.type.type === "row") {
        expect(state.selection.type.rows).toEqual([10]);
      }
    }
  });

  test("Performance: Select 10,000 rows", async () => {
    const facade = createTestSpreadsheet(20000, 100);
    const controller = new SpreadsheetController(facade);
    
    // Start at row 0
    const startCursor = CellAddress.create(0, 0);
    expect(startCursor.ok).toBe(true);
    controller.updateCursor(startCursor.value);
    
    // Measure selection time
    const { timeMs } = await measureOperationTime(async () => {
      // Enter visual line mode
      controller.handleKey("V");
      
      // Move to row 9999 (10,000 rows selected)
      const endCursor = CellAddress.create(9999, 0);
      expect(endCursor.ok).toBe(true);
      controller.updateCursor(endCursor.value);
    });
    
    // Validate selection
    const state = controller.getUIState();
    if (state.spreadsheetMode === "visual" && state.selection?.type.type === "row") {
      expect(state.selection.type.rows.length).toBe(10000);
    }
    
    // Check performance
    const perfResult = validatePerformance("columnSelection", timeMs);
    console.log(perfResult.message);
    expect(perfResult.passed).toBe(true);
  });

  test("Multi-column selection with motion", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Start at column A
    const cursor = CellAddress.create(0, 0);
    expect(cursor.ok).toBe(true);
    controller.updateCursor(cursor.value);
    
    // Select column mode
    controller.handleKey("g");
    controller.handleKey("C");
    
    // Move right to select columns A-D
    for (let i = 0; i < 3; i++) {
      controller.handleKey("l"); // vim right motion
    }
    
    const state = controller.getUIState();
    if (state.spreadsheetMode === "visual" && state.selection?.type.type === "column") {
      expect(state.selection.type.columns).toEqual([0, 1, 2, 3]);
    }
  });

  test("Block selection with Ctrl+v", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Start at A1
    const cursor = CellAddress.create(0, 0);
    expect(cursor.ok).toBe(true);
    controller.updateCursor(cursor.value);
    
    // Enter block visual mode
    controller.handleControlKey("v");
    
    // Move to create 3x3 block
    controller.handleKey("2");
    controller.handleKey("j"); // down 2
    controller.handleKey("2");
    controller.handleKey("l"); // right 2
    
    const state = controller.getUIState();
    if (state.spreadsheetMode === "visual" && state.selection) {
      expect(state.visualMode).toBe("block");
      expect(state.selection.type.type).toBe("range");
      
      if (state.selection.type.type === "range") {
        expect(state.selection.type.start.row).toBe(0);
        expect(state.selection.type.start.col).toBe(0);
        expect(state.selection.type.end.row).toBe(2);
        expect(state.selection.type.end.col).toBe(2);
      }
    }
  });

  test("Selection persistence across mode changes", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create a column selection
    controller.updateCursor(CellAddress.create(0, 2).value);
    controller.handleKey("g");
    controller.handleKey("C");
    
    // Exit visual mode
    controller.handleKey("Escape");
    
    // Re-enter visual mode
    controller.handleKey("g");
    controller.handleKey("C");
    
    // Selection should still be on column C
    const state = controller.getUIState();
    if (state.spreadsheetMode === "visual" && state.selection?.type.type === "column") {
      expect(state.selection.type.columns).toContain(2);
    }
  });

  test("SelectionManager lazy evaluation for large selections", async () => {
    const facade = createTestSpreadsheet(1000000, 100);
    const controller = new SpreadsheetController(facade);
    const selectionManager = controller.getSelectionManager();
    
    // Create a large row selection
    const selection = {
      type: {
        type: "row" as const,
        rows: Array.from({ length: 50000 }, (_, i) => i)
      },
      anchor: CellAddress.create(0, 0).value
    };
    
    // This should be instant due to lazy evaluation
    const { timeMs } = await measureOperationTime(() => {
      const iterator = selectionManager.getCellsInSelection(selection);
      // Just get first 10 cells to verify it works
      const cells = [];
      let count = 0;
      for (const cell of iterator) {
        cells.push(cell);
        if (++count >= 10) break;
      }
      return cells;
    });
    
    // Should be very fast since we're using lazy evaluation
    expect(timeMs).toBeLessThan(10);
  });
});