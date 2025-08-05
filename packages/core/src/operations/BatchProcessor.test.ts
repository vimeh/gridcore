import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ICellRepository } from "../domain/interfaces/ICellRepository";
import { Cell, CellAddress, type CellValue } from "../domain/models";
import { type BatchContext, BatchProcessor } from "./BatchProcessor";
import { CellSelection } from "./bulk/base/CellSelection";
import { BulkSetOperation } from "./bulk/implementations/BulkSetOperation";

// Mock ICellRepository
const createMockCellRepository = (): ICellRepository & {
  _setCellForTest: (address: CellAddress, value: CellValue) => void;
  _getCellsMap: () => Map<string, Cell>;
} => {
  const cells = new Map<string, Cell>();

  return {
    get: mock((address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      return cells.get(key);
    }),

    set: mock((address: CellAddress, cell: Cell) => {
      const key = `${address.row},${address.col}`;
      cells.set(key, cell);
    }),

    delete: mock((address: CellAddress) => {
      const key = `${address.row},${address.col}`;
      cells.delete(key);
    }),

    clear: mock(() => {
      cells.clear();
    }),

    getAllInRange: mock(() => {
      // Not implemented for tests
      return new Map();
    }),

    getAll: mock(() => {
      return new Map(cells);
    }),

    count: mock(() => {
      return cells.size;
    }),

    _setCellForTest: (address: CellAddress, value: CellValue) => {
      const key = `${address.row},${address.col}`;
      const cellResult = Cell.create(value);
      if (cellResult.ok) {
        cells.set(key, cellResult.value);
      }
    },

    _getCellsMap: () => cells,
  };
};

describe("BatchProcessor", () => {
  let cellRepository: ICellRepository & {
    _setCellForTest: (address: CellAddress, value: CellValue) => void;
    _getCellsMap: () => Map<string, Cell>;
  };
  let processor: BatchProcessor;

  beforeEach(() => {
    cellRepository = createMockCellRepository();
    processor = new BatchProcessor(cellRepository, {
      maxOperationsPerBatch: 10,
      maxCellsPerBatch: 1000,
      autoRollbackOnError: true,
      validateBeforeExecution: true,
    });
  });

  describe("beginBatch", () => {
    it("should create new batch context", () => {
      const context = processor.beginBatch({ testMetadata: "value" });

      expect(context.batchId).toBeTruthy();
      expect(context.operations.length).toBe(0);
      expect(context.isActive).toBe(true);
      expect(context.metadata.testMetadata).toBe("value");
    });

    it("should generate unique batch IDs", () => {
      const context1 = processor.beginBatch();
      const context2 = processor.beginBatch();

      expect(context1.batchId).not.toBe(context2.batchId);
    });
  });

  describe("addOperation", () => {
    let context: BatchContext;
    let operation: BulkSetOperation;

    beforeEach(() => {
      context = processor.beginBatch();

      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
      }

      operation = new BulkSetOperation(
        selection,
        { value: "test" },
        cellRepository,
      );
    });

    it("should add operation to batch", () => {
      processor.addOperation(context, operation);

      expect(context.operations.length).toBe(1);
      expect(context.operations[0]).toBe(operation);
      expect(context.affectedCells.size).toBe(1);
      expect(context.affectedCells.has("0,0")).toBe(true);
    });

    it("should detect cell conflicts", () => {
      processor.addOperation(context, operation);

      // Try to add another operation affecting the same cell
      const conflictingOp = new BulkSetOperation(
        operation.selection,
        { value: "conflict" },
        cellRepository,
      );

      expect(() => processor.addOperation(context, conflictingOp)).toThrow(
        /conflict/i,
      );
    });

    it("should enforce batch size limits", () => {
      const smallProcessor = new BatchProcessor(cellRepository, {
        maxOperationsPerBatch: 1,
      });

      const smallContext = smallProcessor.beginBatch();
      smallProcessor.addOperation(smallContext, operation);

      const operation2 = new BulkSetOperation(
        new CellSelection(),
        { value: "test2" },
        cellRepository,
      );

      expect(() =>
        smallProcessor.addOperation(smallContext, operation2),
      ).toThrow(/size limit/i);
    });

    it("should enforce cell count limits", () => {
      const limitedProcessor = new BatchProcessor(cellRepository, {
        maxCellsPerBatch: 1,
      });

      const limitedContext = limitedProcessor.beginBatch();
      limitedProcessor.addOperation(limitedContext, operation);

      // Add another operation with different cells
      const selection2 = new CellSelection();
      const cell2 = CellAddress.create(1, 1);
      if (cell2.ok) {
        selection2.addCell(cell2.value);
      }

      const operation2 = new BulkSetOperation(
        selection2,
        { value: "test2" },
        cellRepository,
      );

      expect(() =>
        limitedProcessor.addOperation(limitedContext, operation2),
      ).toThrow(/cell limit/i);
    });

    it("should reject operations on inactive batch", () => {
      context.isActive = false;

      expect(() => processor.addOperation(context, operation)).toThrow(
        /inactive/i,
      );
    });
  });

  describe("validateBatch", () => {
    let context: BatchContext;

    beforeEach(() => {
      context = processor.beginBatch();
    });

    it("should validate active batch with operations", () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(0, 0);
      if (cell.ok) {
        selection.addCell(cell.value);
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "test" },
        cellRepository,
      );

      processor.addOperation(context, operation);

      const errors = processor.validateBatch(context);
      expect(errors.length).toBe(0);
    });

    it("should reject inactive batch", () => {
      context.isActive = false;

      const errors = processor.validateBatch(context);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("not active");
    });

    it("should reject empty batch", () => {
      const errors = processor.validateBatch(context);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("no operations");
    });

    it("should validate individual operations", () => {
      // Add invalid operation (empty selection)
      const emptySelection = new CellSelection();
      const invalidOp = new BulkSetOperation(
        emptySelection,
        { value: "test" },
        cellRepository,
      );

      context.operations.push(invalidOp);

      const errors = processor.validateBatch(context);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("Operation 0");
    });
  });

  describe("commitBatch", () => {
    let context: BatchContext;
    let operation: BulkSetOperation;

    beforeEach(() => {
      context = processor.beginBatch();

      const selection = new CellSelection();
      const cells = [
        CellAddress.create(0, 0),
        CellAddress.create(1, 1),
        CellAddress.create(2, 2),
      ];

      for (const cell of cells) {
        if (cell.ok) {
          selection.addCell(cell.value);
          // Set initial values
          cellRepository._setCellForTest(cell.value, "initial");
        }
      }

      operation = new BulkSetOperation(
        selection,
        { value: "batch test", overwriteExisting: true },
        cellRepository,
      );

      processor.addOperation(context, operation);
    });

    it("should execute batch successfully", async () => {
      const result = await processor.commitBatch(context);

      expect(result.success).toBe(true);
      expect(result.operationCount).toBe(1);
      expect(result.totalCellsModified).toBe(3);
      expect(result.wasRolledBack).toBe(false);
      expect(result.batchErrors.length).toBe(0);
    });

    it("should consolidate changes", async () => {
      const result = await processor.commitBatch(context);

      expect(result.consolidatedChanges.size).toBe(3);

      const change = result.consolidatedChanges.get("0,0");
      expect(change).toBeTruthy();
      if (change) {
        expect(change.before).toBe("initial");
        expect(change.after).toBe("batch test");
      }
    });

    it("should mark batch as inactive after completion", async () => {
      await processor.commitBatch(context);

      expect(context.isActive).toBe(false);
    });

    it("should handle operation failures with rollback", async () => {
      // Create a failing repository
      const failingRepository = {
        ...cellRepository,
        set: mock(() => {
          throw new Error("Simulated failure");
        }),
      };

      const failingOp = new BulkSetOperation(
        operation.selection,
        { value: "failing", overwriteExisting: true },
        failingRepository,
      );

      const failingContext = processor.beginBatch();
      processor.addOperation(failingContext, failingOp);

      const result = await processor.commitBatch(failingContext);

      expect(result.success).toBe(false);
      expect(result.wasRolledBack).toBe(true);
      expect(result.batchErrors.length).toBeGreaterThan(0);
    });

    it("should capture and restore original values on rollback", async () => {
      // Create processor that will fail on second operation
      let callCount = 0;
      const conditionallyFailingRepo = {
        ...cellRepository,
        set: mock((address: CellAddress, cell: Cell) => {
          callCount++;
          if (callCount > 2) {
            throw new Error("Simulated failure after partial execution");
          }
          cellRepository.set(address, cell);
        }),
      };

      const failingOp = new BulkSetOperation(
        operation.selection,
        { value: "will fail" },
        conditionallyFailingRepo,
      );

      const failingContext = processor.beginBatch();
      processor.addOperation(failingContext, failingOp);

      await processor.commitBatch(failingContext);

      // Verify original values were restored
      const cell1 = CellAddress.create(0, 0);
      if (cell1.ok) {
        const cellValue = cellRepository.get(cell1.value);
        expect(cellValue).toBeTruthy();
        if (cellValue) {
          expect(cellValue.rawValue).toBe("initial");
        }
      }
    });
  });

  describe("rollbackBatch", () => {
    it("should restore original values", async () => {
      const context = processor.beginBatch();

      // Set up cells with initial values
      const cells = [CellAddress.create(0, 0), CellAddress.create(1, 1)];

      for (const cell of cells) {
        if (cell.ok) {
          cellRepository._setCellForTest(cell.value, "original");
        }
      }

      // Capture original values
      for (const cell of cells) {
        if (cell.ok) {
          const key = `${cell.value.row},${cell.value.col}`;
          context.affectedCells.add(key);
          context.originalValues.set(key, "original");
        }
      }

      // Modify cells
      for (const cell of cells) {
        if (cell.ok) {
          const cellResult = Cell.create("modified");
          if (cellResult.ok) {
            cellRepository.set(cell.value, cellResult.value);
          }
        }
      }

      // Rollback
      await processor.rollbackBatch(context);

      // Verify restoration
      for (const cell of cells) {
        if (cell.ok) {
          const result = cellRepository.get(cell.value);
          expect(result).toBeTruthy();
          if (result) {
            expect(result.rawValue).toBe("original");
          }
        }
      }

      expect(context.isActive).toBe(false);
    });
  });

  describe("executeSingle", () => {
    it("should execute single operation as batch", async () => {
      const selection = new CellSelection();
      const cell = CellAddress.create(5, 5);
      if (cell.ok) {
        selection.addCell(cell.value);
        cellRepository._setCellForTest(cell.value, "before");
      }

      const operation = new BulkSetOperation(
        selection,
        { value: "single test", overwriteExisting: true },
        cellRepository,
      );

      const result = await processor.executeSingle(operation);

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(1);

      // Verify cell was updated
      if (cell.ok) {
        const cellResult = cellRepository.get(cell.value);
        expect(cellResult).toBeTruthy();
        if (cellResult) {
          expect(cellResult.rawValue).toBe("single test");
        }
      }
    });
  });

  describe("batch management", () => {
    it("should track active batches", () => {
      const context1 = processor.beginBatch();
      const context2 = processor.beginBatch();

      const activeBatches = processor.getActiveBatches();
      expect(activeBatches.length).toBe(2);
      expect(activeBatches).toContain(context1);
      expect(activeBatches).toContain(context2);
    });

    it("should get batch status", () => {
      const context = processor.beginBatch();

      const status = processor.getBatchStatus(context.batchId);
      expect(status).toBe(context);

      const nonExistentStatus = processor.getBatchStatus("nonexistent");
      expect(nonExistentStatus).toBeNull();
    });

    it("should cancel batch", () => {
      const context = processor.beginBatch();

      processor.cancelBatch(context);

      expect(context.isActive).toBe(false);
      expect(processor.getBatchStatus(context.batchId)).toBeNull();
    });

    it("should cleanup completed batches", async () => {
      const context = processor.beginBatch();

      // Complete the batch
      context.isActive = false;

      processor.cleanup();

      expect(processor.getBatchStatus(context.batchId)).toBeNull();
    });
  });

  describe("performance", () => {
    it("should handle multiple operations efficiently", async () => {
      const context = processor.beginBatch();

      // Add multiple non-conflicting operations
      for (let i = 0; i < 5; i++) {
        const selection = new CellSelection();
        const cell = CellAddress.create(i, 0);
        if (cell.ok) {
          selection.addCell(cell.value);
          cellRepository._setCellForTest(cell.value, `initial${i}`);
        }

        const operation = new BulkSetOperation(
          selection,
          { value: `value${i}`, overwriteExisting: true },
          cellRepository,
        );

        processor.addOperation(context, operation);
      }

      const startTime = Date.now();
      const result = await processor.commitBatch(context);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.operationCount).toBe(5);
      expect(result.totalCellsModified).toBe(5);

      // Should complete in reasonable time
      expect(executionTime).toBeLessThan(1000);
    });
  });
});
