import { beforeEach, describe, expect, it } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Cell } from "../../../domain/models";
import { CellAddress } from "../../../domain/models/CellAddress";
import type { Result } from "../../../shared/types/Result";
import { CellSelection } from "../base/CellSelection";
import {
  BulkTransformOperation,
  type BulkTransformOptions,
} from "./BulkTransformOperation";

// Mock cell repository for testing
class MockCellRepository implements ICellRepository {
  private cells: Map<string, Cell> = new Map();

  setCell(address: CellAddress, cell: Cell): Promise<Result<void>> {
    const key = `${address.row},${address.col}`;
    this.cells.set(key, cell);
    return Promise.resolve({ ok: true, value: undefined });
  }

  getCell(address: CellAddress): Promise<Result<Cell | null>> {
    const key = `${address.row},${address.col}`;
    const cell = this.cells.get(key) || null;
    return Promise.resolve({ ok: true, value: cell });
  }

  deleteCell(address: CellAddress): Promise<Result<void>> {
    const key = `${address.row},${address.col}`;
    this.cells.delete(key);
    return Promise.resolve({ ok: true, value: undefined });
  }

  getCells(): Promise<Result<Cell[]>> {
    return Promise.resolve({
      ok: true,
      value: Array.from(this.cells.values()),
    });
  }

  clear(): Promise<Result<void>> {
    this.cells.clear();
    return Promise.resolve({ ok: true, value: undefined });
  }
}

// Performance test utilities
function generateTestData(
  repository: MockCellRepository,
  count: number,
  dataType: "text" | "mixed" = "text",
) {
  const addresses: CellAddress[] = [];

  for (let i = 0; i < count; i++) {
    const address = new CellAddress(Math.floor(i / 1000), i % 1000);
    addresses.push(address);

    let value: any;
    if (dataType === "mixed") {
      // Mix of text, numbers, and booleans
      switch (i % 4) {
        case 0:
          value = `text value ${i}`;
          break;
        case 1:
          value = i * 3.14;
          break;
        case 2:
          value = i % 2 === 0;
          break;
        case 3:
          value = `  spaced text ${i}  `;
          break;
      }
    } else {
      // Pure text data with various cases
      switch (i % 5) {
        case 0:
          value = `lowercase text ${i}`;
          break;
        case 1:
          value = `UPPERCASE TEXT ${i}`;
          break;
        case 2:
          value = `  Trimmed Text ${i}  `;
          break;
        case 3:
          value = `Mixed\nCase\tText\r${i}`;
          break;
        case 4:
          value = `multiple   spaces   text   ${i}`;
          break;
      }
    }

    repository.set(address, { value });
  }

  return addresses;
}

function measurePerformance<T>(operation: () => Promise<T>): Promise<{
  result: T;
  timeMs: number;
  cellsPerSecond: number;
  cellCount: number;
}> {
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    const timeMs = endTime - startTime;

    // Extract cell count from result if it's an operation result
    let cellCount = 0;
    if (
      typeof result === "object" &&
      result !== null &&
      "cellsProcessed" in result
    ) {
      cellCount = (result as any).cellsProcessed;
    }

    const cellsPerSecond =
      cellCount > 0 ? Math.round(cellCount / (timeMs / 1000)) : 0;

    resolve({ result, timeMs, cellsPerSecond, cellCount });
  });
}

describe("BulkTransformOperation Performance Tests", () => {
  let repository: MockCellRepository;

  beforeEach(() => {
    repository = new MockCellRepository();
  });

  describe("Uppercase Transformation Performance", () => {
    it("should process 10k cells in under 1 second", async () => {
      const cellCount = 10000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "upper",
        batchSize: 1000,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(1000);
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second

      console.log(
        `Uppercase 10k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should process 50k cells with excellent performance", async () => {
      const cellCount = 50000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "upper",
        batchSize: 2500,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000);
      expect(cellsPerSecond).toBeGreaterThan(20000); // Target: > 20k cells/second

      console.log(
        `Uppercase 50k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should handle 100k cells efficiently", async () => {
      const cellCount = 100000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "upper",
        batchSize: 5000,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(10000);
      expect(cellsPerSecond).toBeGreaterThan(15000); // Target: > 15k cells/second

      console.log(
        `Uppercase 100k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Lowercase Transformation Performance", () => {
    it("should process 25k cells with high performance", async () => {
      const cellCount = 25000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "lower",
        batchSize: 2000,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(3000);
      expect(cellsPerSecond).toBeGreaterThan(15000); // Target: > 15k cells/second

      console.log(
        `Lowercase 25k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Trim Transformation Performance", () => {
    it("should process 30k cells with excellent performance", async () => {
      const cellCount = 30000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "trim",
        batchSize: 2500,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(4000);
      expect(cellsPerSecond).toBeGreaterThan(15000); // Target: > 15k cells/second

      console.log(`Trim 30k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`);
    });
  });

  describe("Clean Transformation Performance", () => {
    it("should process 20k cells with good performance", async () => {
      const cellCount = 20000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "clean",
        batchSize: 1500,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(3000);
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second (clean is more complex)

      console.log(`Clean 20k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`);
    });

    it("should handle complex clean operations efficiently", async () => {
      const cellCount = 15000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "clean",
        batchSize: 1000,
        cleanOptions: {
          normalizeSpaces: true,
          removeLineBreaks: true,
          removeTabs: true,
          removeOtherWhitespace: true,
        },
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(3000);
      expect(cellsPerSecond).toBeGreaterThan(8000); // Target: > 8k cells/second (more complex operations)

      console.log(
        `Complex clean 15k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Mixed Data Type Performance", () => {
    it("should handle mixed data types efficiently", async () => {
      const cellCount = 40000;
      const addresses = generateTestData(repository, cellCount, "mixed");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "upper",
        batchSize: 3000,
        skipNonText: true,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000);
      expect(cellsPerSecond).toBeGreaterThan(12000); // Target: > 12k cells/second

      console.log(
        `Mixed data 40k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should handle type conversion efficiently", async () => {
      const cellCount = 25000;
      const addresses = generateTestData(repository, cellCount, "mixed");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "lower",
        batchSize: 2000,
        skipNonText: false,
        convertNumbers: true,
        preserveType: false,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(4000);
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second

      console.log(
        `Type conversion 25k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Preview Performance", () => {
    it("should generate previews quickly for large selections", async () => {
      const cellCount = 50000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = { transformation: "upper" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const startTime = Date.now();
      const preview = await operation.preview(1000);
      const endTime = Date.now();
      const previewTime = endTime - startTime;

      expect(preview.affectedCells).toBe(cellCount);
      expect(preview.changes.length).toBeLessThanOrEqual(1000);
      expect(previewTime).toBeLessThan(500); // Should generate preview in under 500ms

      console.log(`Preview 50k cells (1k limit): ${previewTime}ms`);
    });

    it("should handle large preview limits efficiently", async () => {
      const cellCount = 20000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = { transformation: "clean" };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const startTime = Date.now();
      const preview = await operation.preview(5000);
      const endTime = Date.now();
      const previewTime = endTime - startTime;

      expect(preview.affectedCells).toBe(cellCount);
      expect(preview.changes.length).toBeLessThanOrEqual(5000);
      expect(previewTime).toBeLessThan(1000); // Should generate preview in under 1 second

      console.log(`Large preview 20k cells (5k limit): ${previewTime}ms`);
    });
  });

  describe("Memory Efficiency", () => {
    it("should maintain reasonable memory usage for large operations", async () => {
      const cellCount = 75000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "upper",
        batchSize: 5000,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      // Measure memory before operation
      const memBefore = process.memoryUsage().heapUsed;

      const { result, timeMs } = await measurePerformance(() =>
        operation.execute(),
      );

      // Measure memory after operation
      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;
      const memPerCell = memDelta / cellCount;

      expect(result.success).toBe(true);
      expect(memPerCell).toBeLessThan(500); // Should use less than 500 bytes per cell

      console.log(
        `Memory usage 75k cells: ${Math.round(memDelta / 1024 / 1024)}MB total, ${Math.round(memPerCell)}B per cell`,
      );
    });
  });

  describe("Batch Size Optimization", () => {
    it("should find optimal batch size for performance", async () => {
      const cellCount = 30000;
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const batchSizes = [500, 1000, 2500, 5000, 10000];
      const results: {
        batchSize: number;
        timeMs: number;
        cellsPerSecond: number;
      }[] = [];

      for (const batchSize of batchSizes) {
        // Reset repository state
        const freshRepo = new MockCellRepository();
        generateTestData(freshRepo, cellCount, "text");

        const options: BulkTransformOptions = {
          transformation: "upper",
          batchSize,
        };
        const operation = new BulkTransformOperation(
          selection,
          options,
          freshRepo,
        );

        const { timeMs, cellsPerSecond } = await measurePerformance(() =>
          operation.execute(),
        );
        results.push({ batchSize, timeMs, cellsPerSecond });

        console.log(
          `Batch size ${batchSize}: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
        );
      }

      // Find the best performing batch size
      const bestResult = results.reduce((best, current) =>
        current.cellsPerSecond > best.cellsPerSecond ? current : best,
      );

      expect(bestResult.cellsPerSecond).toBeGreaterThan(15000);
      console.log(
        `Best batch size: ${bestResult.batchSize} (${bestResult.cellsPerSecond} cells/sec)`,
      );
    });
  });

  describe("Stress Testing", () => {
    it("should handle maximum size selection", async () => {
      const cellCount = 250000; // Large but manageable test size
      const addresses = generateTestData(repository, cellCount, "text");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkTransformOptions = {
        transformation: "trim",
        batchSize: 10000,
      };
      const operation = new BulkTransformOperation(
        selection,
        options,
        repository,
      );

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(20000); // Should complete in under 20 seconds
      expect(cellsPerSecond).toBeGreaterThan(12000); // Target: > 12k cells/second

      console.log(
        `Stress test 250k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should maintain performance under concurrent operations", async () => {
      const cellCount = 15000;
      const numOperations = 3;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < numOperations; i++) {
        const freshRepo = new MockCellRepository();
        const addresses = generateTestData(freshRepo, cellCount, "text");
        const selection = CellSelection.fromCells(addresses);

        const options: BulkTransformOptions = {
          transformation: i % 2 === 0 ? "upper" : "lower",
          batchSize: 1500,
        };
        const operation = new BulkTransformOperation(
          selection,
          options,
          freshRepo,
        );

        promises.push(measurePerformance(() => operation.execute()));
      }

      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        const { result, timeMs, cellsPerSecond } = results[i];
        expect(result.success).toBe(true);
        expect(cellsPerSecond).toBeGreaterThan(8000); // Should maintain good performance
        console.log(
          `Concurrent operation ${i + 1}: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
        );
      }
    });
  });
});
