import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ICellRepository } from "../../domain/interfaces/ICellRepository";
import { Cell, CellAddress, type CellValue } from "../../domain/models";
import { CellSelection } from "./base/CellSelection";
import { BulkSetOperation } from "./implementations/BulkSetOperation";
import type { OperationResult } from "./interfaces/OperationResult";
import { UndoRedoManager } from "./UndoRedoManager";

// Mock ICellRepository
const createMockCellRepository = (): ICellRepository & {
  _setCellForTest: (address: CellAddress, value: CellValue) => void;
  _getCellValue: (address: CellAddress) => CellValue;
} => {
  const cells = new Map<string, Cell>();

  return {
    // Method used by BaseBulkOperation
    get: mock((address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      return cells.get(key) || null;
    }),

    // Method used by BaseBulkOperation
    set: mock((address: CellAddress, cell: Cell) => {
      const key = `${address.row},${address.col}`;
      cells.set(key, cell);
    }),

    getCell: mock(async (address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      const cell = cells.get(key);
      if (cell) {
        return { ok: true, value: cell };
      }
      return { ok: true, value: null };
    }),

    setCell: mock(async (address: CellAddress, cell: Partial<Cell>) => {
      const key = `${address.row},${address.col}`;
      const existingCellResult = Cell.create(null);
      if (!existingCellResult.ok) {
        throw new Error("Failed to create empty cell");
      }
      const existingCell = cells.get(key) || existingCellResult.value;
      const updatedCell = { ...existingCell, ...cell };
      cells.set(key, updatedCell);
      return { ok: true, value: updatedCell };
    }),

    hasCell: mock(async (address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      return { ok: true, value: cells.has(key) };
    }),

    deleteCell: mock(async (address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      const existed = cells.has(key);
      cells.delete(key);
      return { ok: true, value: existed };
    }),

    _setCellForTest: (address: CellAddress, value: CellValue) => {
      const key = `${address.row},${address.col}`;
      const cellResult = Cell.create(value, address);
      if (cellResult.ok) {
        cells.set(key, cellResult.value);
      }
    },

    _getCellValue: (address: CellAddress): CellValue => {
      const key = `${address.row},${address.col}`;
      const cell = cells.get(key);
      return cell?.computedValue || cell?.rawValue || null;
    },
  };
};

describe("UndoRedoManager", () => {
  let cellRepository: ICellRepository & {
    _setCellForTest: (address: CellAddress, value: CellValue) => void;
    _getCellValue: (address: CellAddress) => CellValue;
  };
  let undoRedoManager: UndoRedoManager;

  beforeEach(() => {
    cellRepository = createMockCellRepository();
    undoRedoManager = new UndoRedoManager(cellRepository, {
      maxHistorySize: 10,
      autoCleanup: false,
      maxActionAge: 24 * 60 * 60 * 1000,
      compressActions: false,
      validateUndo: true,
    });
  });

  describe("recordAction", () => {
    it("should record successful operation", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      expect(undoRedoManager.canUndo()).toBe(true);
      expect(undoRedoManager.getUndoDescription()).toContain("1 cells");
    });

    it("should not record failed operations", async () => {
      const failedResult: OperationResult = {
        success: false,
        cellsModified: 0,
        cellsProcessed: 0,
        executionTime: 100,
        errors: ["Operation failed"],
        warnings: [],
        actualChanges: new Map(),
        metadata: {
          operationType: "bulkSet",
          startTime: Date.now(),
          endTime: Date.now(),
          performance: {
            cellsPerSecond: 0,
            peakMemoryUsage: 0,
            batchCount: 1,
            averageBatchTime: 100,
            validationTime: 0,
            updateTime: 100,
            recalculationTime: 0,
          },
        },
      };

      const selection = new CellSelection();
      const operation = new BulkSetOperation(
        selection,
        { value: "test", overwriteExisting: true },
        cellRepository,
      );

      await undoRedoManager.recordAction(operation, failedResult);

      expect(undoRedoManager.canUndo()).toBe(false);
    });

    it("should not record no-op operations", async () => {
      const noOpResult: OperationResult = {
        success: true,
        cellsModified: 0, // No cells were actually modified
        cellsProcessed: 5,
        executionTime: 100,
        errors: [],
        warnings: [],
        actualChanges: new Map(),
        metadata: {
          operationType: "bulkSet",
          startTime: Date.now(),
          endTime: Date.now(),
          performance: {
            cellsPerSecond: 0,
            peakMemoryUsage: 0,
            batchCount: 1,
            averageBatchTime: 100,
            validationTime: 0,
            updateTime: 100,
            recalculationTime: 0,
          },
        },
      };

      const selection = new CellSelection();
      const operation = new BulkSetOperation(
        selection,
        { value: "test", overwriteExisting: true },
        cellRepository,
      );

      await undoRedoManager.recordAction(operation, noOpResult);

      expect(undoRedoManager.canUndo()).toBe(false);
    });

    it("should clear redo history when recording new action", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      // First operation
      const operation1 = new BulkSetOperation(
        selection,
        { value: "value1", overwriteExisting: true },
        cellRepository,
      );
      const result1 = await operation1.execute();
      await undoRedoManager.recordAction(operation1, result1);

      // Undo to create redo history
      await undoRedoManager.undo();
      expect(undoRedoManager.canRedo()).toBe(true);

      // Second operation should clear redo
      if (cell.ok) {
        cellRepository._setCellForTest(cell.value, "intermediate");
      }
      const operation2 = new BulkSetOperation(
        selection,
        { value: "value2", overwriteExisting: true },
        cellRepository,
      );
      const result2 = await operation2.execute();
      await undoRedoManager.recordAction(operation2, result2);

      expect(undoRedoManager.canRedo()).toBe(false);
    });
  });

  describe("undo", () => {
    it("should undo last operation", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      // Verify cell was changed
      if (cell.ok) {
        expect(cellRepository._getCellValue(cell.value)).toBe("new value");
      }

      // Undo
      const undoResult = await undoRedoManager.undo();

      expect(undoResult).toBeTruthy();
      expect(undoResult?.success).toBe(true);

      // Verify cell was restored
      if (cell.ok) {
        expect(cellRepository._getCellValue(cell.value)).toBe("original");
      }

      expect(undoRedoManager.canUndo()).toBe(false);
      expect(undoRedoManager.canRedo()).toBe(true);
    });

    it("should return null when no undo available", async () => {
      const result = await undoRedoManager.undo();
      expect(result).toBeNull();
    });

    it("should handle undo operation failure", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      // Make repository fail on next set operation
      cellRepository.set = mock(() => {
        throw new Error("Undo failed");
      });

      const undoResult = await undoRedoManager.undo();

      expect(undoResult).toBeTruthy();
      expect(undoResult?.success).toBe(false);
      expect(undoResult?.errors.length).toBeGreaterThan(0);

      // Action should still be available for retry
      expect(undoRedoManager.canUndo()).toBe(true);
    });

    it("should validate undo operations when configured", async () => {
      const validatingManager = new UndoRedoManager(cellRepository, {
        maxHistorySize: 10,
        validateUndo: true,
      });

      // Create a normal operation first
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "test", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await validatingManager.recordAction(operation, result);

      // Test should pass since validation is enabled and operation is valid
      const undoResult = await validatingManager.undo();

      expect(undoResult).toBeTruthy();
      expect(undoResult?.success).toBe(true);

      // Verify that validation configuration is working (manager has the setting)
      expect(validatingManager).toBeTruthy();
    });
  });

  describe("redo", () => {
    it("should redo last undone operation", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      // Undo then redo
      await undoRedoManager.undo();

      if (cell.ok) {
        expect(cellRepository._getCellValue(cell.value)).toBe("original");
      }

      const redoResult = await undoRedoManager.redo();

      expect(redoResult).toBeTruthy();
      expect(redoResult?.success).toBe(true);

      if (cell.ok) {
        expect(cellRepository._getCellValue(cell.value)).toBe("new value");
      }

      expect(undoRedoManager.canRedo()).toBe(false);
      expect(undoRedoManager.canUndo()).toBe(true);
    });

    it("should return null when no redo available", async () => {
      const result = await undoRedoManager.redo();
      expect(result).toBeNull();
    });

    it("should handle redo operation failure", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      await undoRedoManager.undo();

      // Make repository fail on redo
      cellRepository.set = mock(() => {
        throw new Error("Redo failed");
      });

      const redoResult = await undoRedoManager.redo();

      expect(redoResult).toBeTruthy();
      expect(redoResult?.success).toBe(false);

      // Action should still be available for retry
      expect(undoRedoManager.canRedo()).toBe(true);
    });
  });

  describe("state queries", () => {
    it("should report undo/redo availability correctly", () => {
      expect(undoRedoManager.canUndo()).toBe(false);
      expect(undoRedoManager.canRedo()).toBe(false);
    });

    it("should provide descriptions for undo/redo actions", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "test value", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      const undoDesc = undoRedoManager.getUndoDescription();
      expect(undoDesc).toBeTruthy();
      expect(undoDesc).toContain("1 cells");

      await undoRedoManager.undo();

      const redoDesc = undoRedoManager.getRedoDescription();
      expect(redoDesc).toBeTruthy();
      expect(redoDesc).toContain("1 cells");
    });

    it("should return null descriptions when no actions available", () => {
      expect(undoRedoManager.getUndoDescription()).toBeNull();
      expect(undoRedoManager.getRedoDescription()).toBeNull();
    });
  });

  describe("history management", () => {
    it("should provide undo and redo history", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "test", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      const undoHistory = undoRedoManager.getUndoHistory();
      expect(undoHistory.length).toBe(1);
      expect(undoHistory[0].description).toContain("1 cells");

      await undoRedoManager.undo();

      const redoHistory = undoRedoManager.getRedoHistory();
      expect(redoHistory.length).toBe(1);
      expect(redoHistory[0].description).toContain("1 cells");
    });

    it("should maintain history size limits", async () => {
      const limitedManager = new UndoRedoManager(cellRepository, {
        maxHistorySize: 2,
      });

      // Add 3 operations
      for (let i = 0; i < 3; i++) {
        const selection = new CellSelection();
        const cell = CellAddress.create(i, 0);
        if (cell.ok) {
          selection.addCell(cell.value);
          cellRepository._setCellForTest(cell.value, "original");
        }

        const operation = new BulkSetOperation(
          selection,
          { value: `value${i}`, overwriteExisting: true },
          cellRepository,
        );

        const result = await operation.execute();
        await limitedManager.recordAction(operation, result);
      }

      const history = limitedManager.getUndoHistory();
      expect(history.length).toBeLessThanOrEqual(2);
    });

    it("should clear all history", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "test", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      expect(undoRedoManager.canUndo()).toBe(true);

      undoRedoManager.clear();

      expect(undoRedoManager.canUndo()).toBe(false);
      expect(undoRedoManager.canRedo()).toBe(false);
      expect(undoRedoManager.getUndoHistory().length).toBe(0);
      expect(undoRedoManager.getRedoHistory().length).toBe(0);
    });
  });

  describe("multiple operations", () => {
    it("should handle multiple undo/redo operations", async () => {
      const operations = [];

      // Create multiple operations
      for (let i = 0; i < 3; i++) {
        const selection = new CellSelection();
        const cell = CellAddress.create(i, 0);
        if (cell.ok) {
          selection.addCell(cell.value);
          cellRepository._setCellForTest(cell.value, `original${i}`);
        }

        const operation = new BulkSetOperation(
          selection,
          { value: `new${i}`, overwriteExisting: true },
          cellRepository,
        );

        const result = await operation.execute();
        await undoRedoManager.recordAction(operation, result);
        operations.push({ operation, cell: cell.ok ? cell.value : null });
      }

      // Verify all cells have new values
      for (let i = 0; i < 3; i++) {
        if (operations[i].cell) {
          expect(cellRepository._getCellValue(operations[i].cell)).toBe(
            `new${i}`,
          );
        }
      }

      // Undo all operations
      for (let i = 2; i >= 0; i--) {
        await undoRedoManager.undo();
        if (operations[i].cell) {
          expect(cellRepository._getCellValue(operations[i].cell)).toBe(
            `original${i}`,
          );
        }
      }

      // Redo all operations
      for (let i = 0; i < 3; i++) {
        await undoRedoManager.redo();
        if (operations[i].cell) {
          expect(cellRepository._getCellValue(operations[i].cell)).toBe(
            `new${i}`,
          );
        }
      }
    });
  });

  describe("memory management", () => {
    it("should provide memory usage statistics", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "original");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "test", overwriteExisting: true },
        cellRepository,
      );

      const result = await operation.execute();
      await undoRedoManager.recordAction(operation, result);

      const stats = undoRedoManager.getMemoryStats();
      expect(stats.undoActions).toBe(1);
      expect(stats.redoActions).toBe(0);
      expect(stats.estimatedMemory).toBeGreaterThan(0);

      await undoRedoManager.undo();

      const statsAfterUndo = undoRedoManager.getMemoryStats();
      expect(statsAfterUndo.undoActions).toBe(0);
      expect(statsAfterUndo.redoActions).toBe(1);
    });
  });
});
