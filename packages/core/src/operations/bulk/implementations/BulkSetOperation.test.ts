import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CellAddress, CellValue, Cell } from "../../../domain/models";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import { CellSelection } from "../base/CellSelection";
import { BulkSetOperation } from "./BulkSetOperation";

// Mock ICellRepository
const createMockCellRepository = (): ICellRepository => {
  const cells = new Map<string, Cell>();
  
  return {
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
      const existingCell = cells.get(key) || Cell.create(null).value!;
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
    
    // Add helper method to set initial cell values
    _setCellForTest: (address: CellAddress, value: CellValue, formula?: string) => {
      const key = `${address.row},${address.col}`;
      const cellResult = Cell.create(value, formula);
      if (cellResult.ok) {
        cells.set(key, cellResult.value);
      }
    }
  } as ICellRepository & { _setCellForTest: (address: CellAddress, value: CellValue, formula?: string) => void };
};

describe("BulkSetOperation", () => {
  let cellRepository: ICellRepository & { _setCellForTest: (address: CellAddress, value: CellValue, formula?: string) => void };
  let selection: CellSelection;
  let operation: BulkSetOperation;

  beforeEach(() => {
    cellRepository = createMockCellRepository();
    selection = new CellSelection();
    
    // Add some cells to selection
    const cell1 = CellAddress.create(0, 0);
    const cell2 = CellAddress.create(1, 1);
    const cell3 = CellAddress.create(2, 2);
    
    if (cell1.ok && cell2.ok && cell3.ok) {
      selection.addCell(cell1.value);
      selection.addCell(cell2.value);
      selection.addCell(cell3.value);
    }
  });

  describe("constructor", () => {
    it("should create operation with value", () => {
      operation = new BulkSetOperation(
        selection,
        { value: "test value" },
        cellRepository
      );
      
      expect(operation.type).toBe("bulkSet");
      expect(operation.selection).toBe(selection);
    });
  });

  describe("validate", () => {
    it("should pass validation for valid operation", () => {
      operation = new BulkSetOperation(
        selection,
        { value: "test value" },
        cellRepository
      );
      
      expect(operation.validate()).toBeNull();
    });

    it("should fail validation for null value", () => {
      operation = new BulkSetOperation(
        selection,
        { value: null },
        cellRepository
      );
      
      const error = operation.validate();
      expect(error).toBeTruthy();
      expect(error).toContain("cannot be null");
    });

    it("should fail validation for undefined value", () => {
      operation = new BulkSetOperation(
        selection,
        { value: undefined as any },
        cellRepository
      );
      
      const error = operation.validate();
      expect(error).toBeTruthy();
      expect(error).toContain("cannot be null");
    });

    it("should fail validation for empty selection", () => {
      const emptySelection = new CellSelection();
      operation = new BulkSetOperation(
        emptySelection,
        { value: "test" },
        cellRepository
      );
      
      const error = operation.validate();
      expect(error).toBeTruthy();
      expect(error).toContain("empty");
    });
  });

  describe("getDescription", () => {
    it("should return descriptive text", () => {
      operation = new BulkSetOperation(
        selection,
        { value: "hello world" },
        cellRepository
      );
      
      const description = operation.getDescription();
      expect(description).toContain("3 cells");
      expect(description).toContain("hello world");
    });
  });

  describe("estimateTime", () => {
    it("should estimate time based on cell count", () => {
      operation = new BulkSetOperation(
        selection,
        { value: "test" },
        cellRepository
      );
      
      const time = operation.estimateTime();
      expect(time).toBeGreaterThan(0);
      expect(time).toBeGreaterThanOrEqual(100); // Minimum 100ms
    });

    it("should scale with selection size", () => {
      const smallSelection = new CellSelection();
      const largeSelection = new CellSelection();
      
      // Add fewer cells to small selection (still 1 cell, which gets minimum time)
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        smallSelection.addCell(cell1.value);
      }
      
      // Add many more cells to large selection to exceed the minimum threshold
      for (let i = 0; i < 10000; i++) {
        const cell = CellAddress.create(i, 0);
        if (cell.ok) {
          largeSelection.addCell(cell.value);
        }
      }
      
      const smallOp = new BulkSetOperation(
        smallSelection,
        { value: "test" },
        cellRepository
      );
      
      const largeOp = new BulkSetOperation(
        largeSelection,
        { value: "test" },
        cellRepository
      );
      
      expect(largeOp.estimateTime()).toBeGreaterThan(smallOp.estimateTime());
    });
  });

  describe("preview", () => {
    beforeEach(() => {
      operation = new BulkSetOperation(
        selection,
        { value: "new value" },
        cellRepository
      );
    });

    it("should generate preview for all cells", async () => {
      const preview = await operation.preview();
      
      expect(preview.affectedCells).toBe(3);
      expect(preview.summary.totalCells).toBe(3);
      expect(preview.summary.modifiedCells).toBe(3);
      expect(preview.errors.length).toBe(0);
    });

    it("should limit preview results", async () => {
      const preview = await operation.preview(2);
      
      expect(preview.affectedCells).toBe(3);
      expect(preview.changes.size).toBeLessThanOrEqual(2);
      if (preview.changes.size === 2) {
        expect(preview.isTruncated).toBe(true);
      }
    });

    it("should show correct change details", async () => {
      // Set up existing cell values first
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        cellRepository._setCellForTest(cell1.value, "old value");
      }
      
      // Create a new operation that knows about the setup
      const testOperation = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: true },
        cellRepository
      );
      
      const preview = await testOperation.preview();
      
      // Find the change for cell (0,0)
      const change = preview.changes.get("0,0");
      expect(change).toBeTruthy();
      if (change) {
        expect(change.before).toBe("old value");
        expect(change.after).toBe("new value");
        expect(change.changeType).toBe("value");
      }
    });

    it("should handle overwriteExisting option", async () => {
      // Set up existing values
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        cellRepository._setCellForTest(cell1.value, "existing");
      }
      
      // Operation that doesn't overwrite
      const nonOverwriteOp = new BulkSetOperation(
        selection,
        { value: "new value", overwriteExisting: false },
        cellRepository
      );
      
      const preview = await nonOverwriteOp.preview();
      
      // Should skip the cell with existing value
      expect(preview.summary.modifiedCells).toBeLessThan(3);
      expect(preview.summary.skippedCells).toBeGreaterThan(0);
    });

    it("should handle preserveFormulas option", async () => {
      // Set up formula cell
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        cellRepository._setCellForTest(cell1.value, 42, "=SUM(A1:A10)");
      }
      
      const preserveFormulaOp = new BulkSetOperation(
        selection,
        { value: "new value", preserveFormulas: true },
        cellRepository
      );
      
      const preview = await preserveFormulaOp.preview();
      
      // Should skip the formula cell
      expect(preview.summary.modifiedCells).toBeLessThan(3);
    });
  });

  describe("execute", () => {
    beforeEach(() => {
      operation = new BulkSetOperation(
        selection,
        { value: "executed value" },
        cellRepository
      );
    });

    it("should execute successfully", async () => {
      const result = await operation.execute();
      
      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(3);
      expect(result.cellsProcessed).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it("should actually update cells", async () => {
      await operation.execute();
      
      // Verify cells were updated
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        const cellResult = await cellRepository.get(cell1.value);
        expect(cellResult.ok).toBe(true);
        if (cellResult.ok && cellResult.value) {
          expect(cellResult.value.value).toBe("executed value");
        }
      }
    });

    it("should record changes for undo", async () => {
      // Set up existing value first
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        cellRepository._setCellForTest(cell1.value, "original");
      }
      
      // Create a new operation for this test
      const testOperation = new BulkSetOperation(
        selection,
        { value: "executed value", overwriteExisting: true },
        cellRepository
      );
      
      const result = await testOperation.execute();
      
      expect(result.actualChanges.size).toBeGreaterThan(0);
      
      const change = result.actualChanges.get("0,0");
      expect(change).toBeTruthy();
      if (change) {
        expect(change.before).toBe("original");
        expect(change.after).toBe("executed value");
      }
    });

    it("should handle repository errors gracefully", async () => {
      // Create a repository that fails on setCell
      const failingRepository = {
        ...cellRepository,
        setCell: mock(async () => ({ ok: false, error: "Repository error" }))
      };
      
      const failingOp = new BulkSetOperation(
        selection,
        { value: "test" },
        failingRepository
      );
      
      const result = await failingOp.execute();
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should respect skipEmpty option", async () => {
      // Set some cells as empty and some with values
      const cell1 = CellAddress.create(0, 0);
      const cell2 = CellAddress.create(1, 1);
      if (cell1.ok && cell2.ok) {
        cellRepository._setCellForTest(cell1.value, null); // Empty
        cellRepository._setCellForTest(cell2.value, "existing"); // Has value
      }
      
      const skipEmptyOp = new BulkSetOperation(
        selection,
        { value: "new", skipEmpty: true },
        cellRepository
      );
      
      const result = await skipEmptyOp.execute();
      
      // Should have processed all but modified fewer (skipping empty)
      expect(result.cellsProcessed).toBe(3);
      expect(result.cellsModified).toBeLessThan(3);
    });
  });

  describe("performance", () => {
    it("should handle large selections efficiently", async () => {
      // Create large selection
      const largeSelection = new CellSelection();
      for (let i = 0; i < 1000; i++) {
        const cell = CellAddress.create(i, 0);
        if (cell.ok) {
          largeSelection.addCell(cell.value);
        }
      }
      
      const largeOp = new BulkSetOperation(
        largeSelection,
        { value: "bulk test" },
        cellRepository
      );
      
      const startTime = Date.now();
      const result = await largeOp.execute();
      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(1000);
      
      // Should complete in reasonable time (less than 5 seconds for 1000 cells)
      expect(executionTime).toBeLessThan(5000);
      
      // Performance should be better than 200 cells per second
      const cellsPerSecond = result.cellsModified / (result.executionTime / 1000);
      expect(cellsPerSecond).toBeGreaterThan(200);
    });
  });
});