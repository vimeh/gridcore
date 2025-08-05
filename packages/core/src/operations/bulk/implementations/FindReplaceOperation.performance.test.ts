import { beforeEach, describe, expect, it } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import { Cell, CellAddress, CellValue } from "../../../domain/models";
import { CellSelection } from "../base/CellSelection";
import {
  FindReplaceOperation,
  type FindReplaceOptions,
} from "./FindReplaceOperation";

describe("FindReplaceOperation Performance", () => {
  let cellRepository: ICellRepository;
  let selection: CellSelection;

  beforeEach(() => {
    // Create an in-memory repository for performance testing
    const cells = new Map<string, Cell>();

    cellRepository = {
      async getCell(address: CellAddress) {
        const key = `${address.row},${address.col}`;
        const cell = cells.get(key);
        return { ok: true, value: cell || null };
      },

      async setCell(address: CellAddress, cellData: Partial<Cell>) {
        const key = `${address.row},${address.col}`;
        const existingCell = cells.get(key);

        if (existingCell) {
          const updatedCell = { ...existingCell, ...cellData };
          cells.set(key, updatedCell);
          return { ok: true, value: updatedCell };
        } else {
          const cellResult = Cell.create(cellData.value);
          if (cellResult.ok) {
            cells.set(key, cellResult.value);
            return { ok: true, value: cellResult.value };
          }
          return { ok: false, error: "Failed to create cell" };
        }
      },

      async hasCell(address: CellAddress) {
        const key = `${address.row},${address.col}`;
        return { ok: true, value: cells.has(key) };
      },

      async deleteCell(address: CellAddress) {
        const key = `${address.row},${address.col}`;
        const existed = cells.has(key);
        cells.delete(key);
        return { ok: true, value: existed };
      },
    };

    selection = new CellSelection();
  });

  const createLargeDataset = (count: number): void => {
    console.log(`Creating ${count} cells for performance test...`);
    const startTime = Date.now();

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 1000);
      const col = i % 1000;

      const addressResult = CellAddress.create(row, col);
      if (addressResult.ok) {
        const address = addressResult.value;
        const value = `test_${i}_value`;

        // Set cell in repository
        cellRepository.set(address, { value });
        selection.addCell(address);
      }
    }

    const setupTime = Date.now() - startTime;
    console.log(`Dataset creation took ${setupTime}ms`);
  };

  describe("Large Scale Performance", () => {
    it("should handle 10,000 cells efficiently", async () => {
      const cellCount = 10000;
      createLargeDataset(cellCount);

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "TEST",
        useRegex: false,
        global: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );

      // Test preview performance
      const previewStartTime = Date.now();
      const preview = await operation.preview(100); // Limit preview for performance
      const previewTime = Date.now() - previewStartTime;

      expect(preview.affectedCells).toBe(cellCount);
      expect(previewTime).toBeLessThan(1000); // Should preview in under 1 second

      console.log(`Preview of ${cellCount} cells took ${previewTime}ms`);

      // Test execution performance
      const executionStartTime = Date.now();
      const result = await operation.execute();
      const executionTime = Date.now() - executionStartTime;

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(cellCount);
      expect(executionTime).toBeLessThan(2000); // Should execute in under 2 seconds

      console.log(`Execution of ${cellCount} cells took ${executionTime}ms`);
      console.log(
        `Performance: ${Math.round(cellCount / (executionTime / 1000))} cells/second`,
      );
    });

    it("should handle 50,000 cells within performance target", async () => {
      const cellCount = 50000;
      createLargeDataset(cellCount);

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "REPLACED",
        useRegex: false,
        global: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );

      // Test execution performance
      const executionStartTime = Date.now();
      const result = await operation.execute();
      const executionTime = Date.now() - executionStartTime;

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(cellCount);
      expect(executionTime).toBeLessThan(5000); // Should execute in under 5 seconds

      const cellsPerSecond = Math.round(cellCount / (executionTime / 1000));
      console.log(`Performance test: ${cellCount} cells in ${executionTime}ms`);
      console.log(`Performance: ${cellsPerSecond} cells/second`);

      // Target: Should be able to process at least 10,000 cells per second
      expect(cellsPerSecond).toBeGreaterThan(10000);
    });

    it.skip("should handle 100,000 cells within 1 second target", async () => {
      // Skip by default as this is a heavy test
      const cellCount = 100000;
      createLargeDataset(cellCount);

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "REPLACED",
        useRegex: false,
        global: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );

      // Test execution performance
      const executionStartTime = Date.now();
      const result = await operation.execute();
      const executionTime = Date.now() - executionStartTime;

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(cellCount);
      expect(executionTime).toBeLessThan(1000); // Target: under 1 second

      const cellsPerSecond = Math.round(cellCount / (executionTime / 1000));
      console.log(
        `PERFORMANCE TARGET TEST: ${cellCount} cells in ${executionTime}ms`,
      );
      console.log(`Performance: ${cellsPerSecond} cells/second`);

      // Target: 100,000 cells per second
      expect(cellsPerSecond).toBeGreaterThan(100000);
    });
  });

  describe("Complex Operations Performance", () => {
    it("should handle regex operations efficiently", async () => {
      const cellCount = 10000;
      createLargeDataset(cellCount);

      const options: FindReplaceOptions = {
        findPattern: "test_\\d+_value",
        replaceWith: "REGEX_MATCH",
        useRegex: true,
        global: true,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );

      const executionStartTime = Date.now();
      const result = await operation.execute();
      const executionTime = Date.now() - executionStartTime;

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(cellCount);

      const cellsPerSecond = Math.round(cellCount / (executionTime / 1000));
      console.log(
        `Regex performance: ${cellCount} cells in ${executionTime}ms`,
      );
      console.log(`Regex performance: ${cellsPerSecond} cells/second`);

      // Regex should be slower but still reasonable
      expect(cellsPerSecond).toBeGreaterThan(5000);
    });

    it("should handle global replacements efficiently", async () => {
      const cellCount = 5000;

      // Create cells with multiple matches
      for (let i = 0; i < cellCount; i++) {
        const row = Math.floor(i / 100);
        const col = i % 100;

        const addressResult = CellAddress.create(row, col);
        if (addressResult.ok) {
          const address = addressResult.value;
          const value = `test test test test`; // Multiple matches per cell

          cellRepository.set(address, { value });
          selection.addCell(address);
        }
      }

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "REPLACED",
        useRegex: false,
        global: true, // Replace all occurrences
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );

      const executionStartTime = Date.now();
      const result = await operation.execute();
      const executionTime = Date.now() - executionStartTime;

      expect(result.success).toBe(true);
      expect(result.cellsModified).toBe(cellCount);

      const cellsPerSecond = Math.round(cellCount / (executionTime / 1000));
      console.log(
        `Global replace performance: ${cellCount} cells in ${executionTime}ms`,
      );
      console.log(`Global replace performance: ${cellsPerSecond} cells/second`);

      // Global replacement should handle multiple matches efficiently
      expect(cellsPerSecond).toBeGreaterThan(3000);
    });
  });

  describe("Memory Efficiency", () => {
    it("should handle large selections without excessive memory usage", async () => {
      const cellCount = 20000;
      createLargeDataset(cellCount);

      const options: FindReplaceOptions = {
        findPattern: "test",
        replaceWith: "REPLACED",
        useRegex: false,
      };

      const operation = new FindReplaceOperation(
        selection,
        options,
        cellRepository,
      );

      // Monitor memory usage during preview
      const previewStartMem = process.memoryUsage().heapUsed;
      const preview = await operation.preview(1000); // Limit preview
      const previewEndMem = process.memoryUsage().heapUsed;
      const previewMemDelta = previewEndMem - previewStartMem;

      // Memory usage should be reasonable (less than 50MB for 20k cells)
      expect(previewMemDelta).toBeLessThan(50 * 1024 * 1024);

      console.log(
        `Preview memory usage: ${Math.round(previewMemDelta / 1024 / 1024)}MB`,
      );

      // Execute operation
      const execStartMem = process.memoryUsage().heapUsed;
      const result = await operation.execute();
      const execEndMem = process.memoryUsage().heapUsed;
      const execMemDelta = execEndMem - execStartMem;

      expect(result.success).toBe(true);

      // Execution memory should also be reasonable
      expect(execMemDelta).toBeLessThan(100 * 1024 * 1024);

      console.log(
        `Execution memory usage: ${Math.round(execMemDelta / 1024 / 1024)}MB`,
      );
    });
  });
});
