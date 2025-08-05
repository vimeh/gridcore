import { CellAddress, Sheet, type SpreadsheetFacade } from "@gridcore/core";
import { beforeEach, describe, expect, it } from "vitest";
import { createNavigationState } from "../state/UIState";
import { type ControllerEvent, SpreadsheetController } from "./SpreadsheetController";

// Mock ViewportManager
class MockViewportManager {
  private columnWidths = new Map<number, number>();
  private rowHeights = new Map<number, number>();

  getColumnWidth(index: number): number {
    return this.columnWidths.get(index) || 100;
  }

  setColumnWidth(index: number, width: number): void {
    this.columnWidths.set(index, width);
  }

  getRowHeight(index: number): number {
    return this.rowHeights.get(index) || 25;
  }

  setRowHeight(index: number, height: number): void {
    this.rowHeights.set(index, height);
  }

  getTotalRows(): number {
    return 1000;
  }

  getTotalCols(): number {
    return 100;
  }

  scrollTo(_row: number, _col: number): void {
    // Mock implementation
  }
}

describe("SpreadsheetController Undo/Redo System", () => {
  let controller: SpreadsheetController;
  let sheet: Sheet;
  let facade: SpreadsheetFacade;
  let viewportManager: MockViewportManager;

  beforeEach(async () => {
    sheet = new Sheet("test");
    facade = sheet.getFacade();
    viewportManager = new MockViewportManager();

    const defaultCursor = CellAddress.create(0, 0);
    if (!defaultCursor.ok) throw new Error("Failed to create default cursor");

    const initialState = createNavigationState(defaultCursor.value, {
      startRow: 0,
      startCol: 0,
      rows: 20,
      cols: 10,
    });

    controller = new SpreadsheetController({
      facade,
      viewportManager,
      initialState,
    });

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  describe("Basic Undo/Redo Functionality", () => {
    it("should have no undo/redo available initially", () => {
      expect(controller.canUndo()).toBe(false);
      expect(controller.canRedo()).toBe(false);
    });

    it("should track undo/redo state changes", async () => {
      const events: ControllerEvent[] = [];
      controller.subscribe((event) => {
        if (event.type === "undoRedoStateChanged") {
          events.push(event);
        }
      });

      // Perform an operation
      await controller.insertRows(0, 1);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: "undoRedoStateChanged",
        canUndo: true,
        canRedo: false,
      });
    });

    it("should get undo/redo statistics", async () => {
      let stats = controller.getUndoRedoStats();
      expect(stats.undoStackSize).toBe(0);
      expect(stats.redoStackSize).toBe(0);

      await controller.insertRows(0, 1);

      stats = controller.getUndoRedoStats();
      expect(stats.undoStackSize).toBe(1);
      expect(stats.redoStackSize).toBe(0);
    });
  });

  describe("Insert Rows Undo/Redo", () => {
    it("should undo and redo insert rows operation", async () => {
      // Set initial cell value
      const cellAddr = CellAddress.create(0, 0);
      if (cellAddr.ok) {
        facade.setCellValue(cellAddr.value, "Test Cell");
      }

      // Insert row before row 0
      await controller.insertRows(0, 2);

      expect(controller.canUndo()).toBe(true);
      expect(controller.canRedo()).toBe(false);

      // Undo the insert
      await controller.undo();

      expect(controller.canUndo()).toBe(false);
      expect(controller.canRedo()).toBe(true);

      // Redo the insert
      await controller.redo();

      expect(controller.canUndo()).toBe(true);
      expect(controller.canRedo()).toBe(false);
    });

    it("should maintain correct cursor position after undo", async () => {
      const initialState = controller.getState();
      const initialCursor = initialState.cursor;

      await controller.insertRows(0, 1);

      // Cursor should move down due to insertion
      const afterInsertState = controller.getState();
      expect(afterInsertState.cursor.row).toBe(initialCursor.row + 1);

      await controller.undo();

      // Cursor should be restored to original position
      const afterUndoState = controller.getState();
      expect(afterUndoState.cursor.row).toBe(initialCursor.row);
      expect(afterUndoState.cursor.col).toBe(initialCursor.col);
    });
  });

  describe("Insert Columns Undo/Redo", () => {
    it("should undo and redo insert columns operation", async () => {
      await controller.insertColumns(1, 3);

      expect(controller.canUndo()).toBe(true);

      await controller.undo();
      expect(controller.canRedo()).toBe(true);

      await controller.redo();
      expect(controller.canUndo()).toBe(true);
    });

    it("should handle viewport changes correctly", async () => {
      const initialState = controller.getState();

      // Insert columns before current viewport
      await controller.insertColumns(0, 2);

      const afterInsertState = controller.getState();
      expect(afterInsertState.viewport.startCol).toBe(
        initialState.viewport.startCol + 2,
      );

      await controller.undo();

      const afterUndoState = controller.getState();
      expect(afterUndoState.viewport.startCol).toBe(
        initialState.viewport.startCol,
      );
    });
  });

  describe("Delete Rows Undo/Redo", () => {
    it("should undo and redo delete rows operation", async () => {
      // Add some data to rows that will be deleted
      const addr1 = CellAddress.create(2, 0);
      const addr2 = CellAddress.create(3, 0);
      if (addr1.ok && addr2.ok) {
        facade.setCellValue(addr1.value, "Row 2");
        facade.setCellValue(addr2.value, "Row 3");
      }

      await controller.deleteRows(2, 2);

      expect(controller.canUndo()).toBe(true);

      await controller.undo();

      // Check that data was restored
      if (addr1.ok && addr2.ok) {
        const cell1 = facade.getCell(addr1.value);
        const cell2 = facade.getCell(addr2.value);

        if (cell1.ok && cell1.value && cell2.ok && cell2.value) {
          expect(cell1.value.rawValue).toBe("Row 2");
          expect(cell2.value.rawValue).toBe("Row 3");
        }
      }
    });
  });

  describe("Delete Columns Undo/Redo", () => {
    it("should undo and redo delete columns operation", async () => {
      // Add some data to columns that will be deleted
      const addr1 = CellAddress.create(0, 2);
      const addr2 = CellAddress.create(0, 3);
      if (addr1.ok && addr2.ok) {
        facade.setCellValue(addr1.value, "Col 2");
        facade.setCellValue(addr2.value, "Col 3");
      }

      await controller.deleteColumns(2, 2);

      expect(controller.canUndo()).toBe(true);

      await controller.undo();

      // Check that data was restored
      if (addr1.ok && addr2.ok) {
        const cell1 = facade.getCell(addr1.value);
        const cell2 = facade.getCell(addr2.value);

        if (cell1.ok && cell1.value && cell2.ok && cell2.value) {
          expect(cell1.value.rawValue).toBe("Col 2");
          expect(cell2.value.rawValue).toBe("Col 3");
        }
      }
    });
  });

  describe("Multiple Operations", () => {
    it("should handle multiple operations in sequence", async () => {
      await controller.insertRows(0, 1);
      await controller.insertColumns(0, 1);
      await controller.deleteRows(2, 1);

      expect(controller.canUndo()).toBe(true);
      const stats = controller.getUndoRedoStats();
      expect(stats.undoStackSize).toBe(3);

      // Undo all operations
      await controller.undo(); // Undo delete rows
      await controller.undo(); // Undo insert columns
      await controller.undo(); // Undo insert rows

      expect(controller.canUndo()).toBe(false);
      expect(controller.canRedo()).toBe(true);

      const finalStats = controller.getUndoRedoStats();
      expect(finalStats.redoStackSize).toBe(3);
    });

    it("should clear redo stack when new operation is performed", async () => {
      await controller.insertRows(0, 1);
      await controller.undo();

      expect(controller.canRedo()).toBe(true);

      // Perform new operation - should clear redo stack
      await controller.insertColumns(0, 1);

      expect(controller.canRedo()).toBe(false);
      const stats = controller.getUndoRedoStats();
      expect(stats.redoStackSize).toBe(0);
    });
  });

  describe("Transaction Grouping", () => {
    it("should group operations in transactions", async () => {
      const _txnId = controller.startTransaction("Bulk operations");

      await controller.insertRows(0, 1);
      await controller.insertColumns(0, 1);

      controller.endTransaction();

      // Should have only one item in undo stack (the transaction)
      const stats = controller.getUndoRedoStats();
      expect(stats.undoStackSize).toBe(1);

      // Undo should revert both operations
      await controller.undo();

      expect(controller.canUndo()).toBe(false);
      expect(controller.canRedo()).toBe(true);
    });

    it("should handle transaction cancellation", async () => {
      controller.startTransaction("Test transaction");

      await controller.insertRows(0, 1);

      controller.cancelTransaction();

      // Transaction should not be recorded
      const stats = controller.getUndoRedoStats();
      expect(stats.undoStackSize).toBe(0);
    });
  });

  describe("Command Integration", () => {
    it("should handle vim undo commands", async () => {
      await controller.insertRows(0, 1);
      expect(controller.canUndo()).toBe(true);

      // Simulate vim undo command
      const result = controller.handleKeyPress(":", { key: "colon" });
      if (result.ok) {
        // Enter command mode and execute undo
        const cmdResult = controller.handleKeyPress("u", {});
        if (cmdResult.ok) {
          const enterResult = controller.handleKeyPress("\n", { key: "enter" });
          expect(enterResult.ok).toBe(true);
        }
      }
    });

    it("should handle menu events", async () => {
      await controller.insertRows(0, 1);
      expect(controller.canUndo()).toBe(true);

      await controller.handleMenuEvent("menu:undo");
      expect(controller.canRedo()).toBe(true);

      await controller.handleMenuEvent("menu:redo");
      expect(controller.canUndo()).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle undo when nothing to undo", async () => {
      expect(controller.canUndo()).toBe(false);

      // Should not throw error
      await controller.undo();

      expect(controller.canUndo()).toBe(false);
    });

    it("should handle redo when nothing to redo", async () => {
      expect(controller.canRedo()).toBe(false);

      // Should not throw error
      await controller.redo();

      expect(controller.canRedo()).toBe(false);
    });
  });

  describe("History Management", () => {
    it("should clear undo history", async () => {
      await controller.insertRows(0, 1);
      await controller.insertColumns(0, 1);

      expect(controller.canUndo()).toBe(true);

      controller.clearUndoHistory();

      expect(controller.canUndo()).toBe(false);
      expect(controller.canRedo()).toBe(false);

      const stats = controller.getUndoRedoStats();
      expect(stats.undoStackSize).toBe(0);
      expect(stats.redoStackSize).toBe(0);
    });
  });

  describe("Event Emission", () => {
    it("should emit events for completed undo operations", async () => {
      const events: ControllerEvent[] = [];
      controller.subscribe((event) => {
        if (event.type === "undoCompleted") {
          events.push(event);
        }
      });

      await controller.insertRows(0, 1);
      await controller.undo();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("undoCompleted");
      expect(events[0].description).toBe("Structural operation undone");
      expect(events[0].snapshot).toBeDefined();
    });

    it("should emit events for completed redo operations", async () => {
      const events: ControllerEvent[] = [];
      controller.subscribe((event) => {
        if (event.type === "redoCompleted") {
          events.push(event);
        }
      });

      await controller.insertRows(0, 1);
      await controller.undo();
      await controller.redo();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("redoCompleted");
      expect(events[0].description).toBe("Structural operation redone");
      expect(events[0].snapshot).toBeDefined();
    });
  });
});
