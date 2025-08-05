import { beforeEach, describe, expect, it } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Cell } from "../../../domain/models";
import { CellAddress } from "../../../domain/models/CellAddress";
import type { Result } from "../../../shared/types/Result";
import { CellSelection } from "../base/CellSelection";
import type { OperationResult } from "../interfaces/OperationResult";
import {
  BulkFormatOperation,
  type BulkFormatOptions,
  type FormatType,
} from "./BulkFormatOperation";

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
  dataType: "numeric" | "mixed" | "dates" = "numeric",
) {
  const addresses: CellAddress[] = [];

  for (let i = 0; i < count; i++) {
    const address = new CellAddress(Math.floor(i / 1000), i % 1000);
    addresses.push(address);

    let value: string | number | boolean | Date;
    if (dataType === "mixed") {
      // Mix of numbers, strings, dates, and other types
      switch (i % 6) {
        case 0:
          value = (i + 1) * 123.45;
          break;
        case 1:
          value = i * 0.01;
          break; // Percentages
        case 2:
          value = `${(i + 1) * 100}.50`;
          break; // String numbers
        case 3:
          value = new Date(2024, i % 12, (i % 28) + 1);
          break;
        case 4:
          value = i % 2 === 0;
          break;
        case 5:
          value = `text value ${i}`;
          break;
      }
    } else if (dataType === "dates") {
      // Pure date data
      switch (i % 4) {
        case 0:
          value = new Date(2024, i % 12, (i % 28) + 1);
          break;
        case 1:
          value = new Date(2024, i % 12, (i % 28) + 1, 14, 30, 0);
          break;
        case 2:
          value = `2024-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
          break;
        case 3:
          value = 44927 + i;
          break; // Excel date serial numbers
      }
    } else {
      // Pure numeric data
      switch (i % 5) {
        case 0:
          value = (i + 1) * 1234.56;
          break;
        case 1:
          value = (i + 1) * 0.1234;
          break; // Decimal percentages
        case 2:
          value = Math.floor((i + 1) * 100);
          break; // Integers
        case 3:
          value = -((i + 1) * 567.89);
          break; // Negative numbers
        case 4:
          value = (i + 1) / 10000;
          break; // Small decimals
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
  return new Promise((resolve) => {
    const startTime = Date.now();
    operation().then((result) => {
      const endTime = Date.now();
      const timeMs = endTime - startTime;

      // Extract cell count from result if it's an operation result
      let cellCount = 0;
      if (
        typeof result === "object" &&
        result !== null &&
        "cellsProcessed" in result
      ) {
        cellCount = (result as unknown as OperationResult).cellsProcessed;
      }

      const cellsPerSecond =
        cellCount > 0 ? Math.round(cellCount / (timeMs / 1000)) : 0;

      resolve({ result, timeMs, cellsPerSecond, cellCount });
    });
  });
}

describe("BulkFormatOperation Performance Tests", () => {
  let repository: MockCellRepository;

  beforeEach(() => {
    repository = new MockCellRepository();
  });

  describe("Currency Formatting Performance", () => {
    it("should process 10k cells in under 1 second", async () => {
      const cellCount = 10000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "currency",
        batchSize: 1000,
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(1000);
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second

      console.log(
        `Currency 10k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should process 50k cells with excellent performance", async () => {
      const cellCount = 50000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "currency",
        batchSize: 2500,
        currencyOptions: {
          currency: "USD",
          decimals: 2,
        },
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000);
      expect(cellsPerSecond).toBeGreaterThan(15000); // Target: > 15k cells/second

      console.log(
        `Currency 50k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should handle 100k cells efficiently", async () => {
      const cellCount = 100000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "currency",
        batchSize: 5000,
        currencyOptions: {
          symbol: "$",
          decimals: 2,
          useThousandsSeparator: true,
        },
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(10000);
      expect(cellsPerSecond).toBeGreaterThan(12000); // Target: > 12k cells/second

      console.log(
        `Currency 100k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Percentage Formatting Performance", () => {
    it("should process 25k cells with high performance", async () => {
      const cellCount = 25000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "percent",
        batchSize: 2000,
        percentOptions: {
          decimals: 2,
          multiplyBy100: true,
        },
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(3000);
      expect(cellsPerSecond).toBeGreaterThan(12000); // Target: > 12k cells/second

      console.log(
        `Percent 25k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should handle complex percentage formatting", async () => {
      const cellCount = 40000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "percent",
        batchSize: 3000,
        percentOptions: {
          decimals: 3,
          multiplyBy100: false,
        },
        locale: "de-DE",
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(6000);
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second

      console.log(
        `Complex percent 40k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Number Formatting Performance", () => {
    it("should process 35k cells with excellent performance", async () => {
      const cellCount = 35000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "number",
        batchSize: 2500,
        numberOptions: {
          decimals: 2,
          useThousandsSeparator: true,
        },
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(4000);
      expect(cellsPerSecond).toBeGreaterThan(15000); // Target: > 15k cells/second

      console.log(`Number 35k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`);
    });

    it("should handle advanced number formatting", async () => {
      const cellCount = 30000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "number",
        batchSize: 2000,
        numberOptions: {
          decimals: 4,
          useThousandsSeparator: false,
          showPositiveSign: true,
        },
        locale: "en-GB",
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(4000);
      expect(cellsPerSecond).toBeGreaterThan(12000); // Target: > 12k cells/second

      console.log(
        `Advanced number 30k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Date Formatting Performance", () => {
    it("should process 15k date cells efficiently", async () => {
      const cellCount = 15000;
      const addresses = generateTestData(repository, cellCount, "dates");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "date",
        batchSize: 1500,
        dateOptions: {
          format: "MM/DD/YYYY",
          includeTime: false,
        },
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(3000);
      expect(cellsPerSecond).toBeGreaterThan(8000); // Target: > 8k cells/second (dates are more complex)

      console.log(`Date 15k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`);
    });

    it("should handle complex date formatting with time", async () => {
      const cellCount = 12000;
      const addresses = generateTestData(repository, cellCount, "dates");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "date",
        batchSize: 1000,
        dateOptions: {
          format: "YYYY-MM-DD",
          includeTime: true,
          timeFormat: "24h",
        },
        locale: "en-GB",
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(4000);
      expect(cellsPerSecond).toBeGreaterThan(6000); // Target: > 6k cells/second (complex date formatting)

      console.log(
        `Complex date 12k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should handle locale-specific date formatting", async () => {
      const cellCount = 20000;
      const addresses = generateTestData(repository, cellCount, "dates");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "date",
        batchSize: 1500,
        dateOptions: {
          format: "locale",
          includeTime: false,
        },
        locale: "de-DE",
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000);
      expect(cellsPerSecond).toBeGreaterThan(6000); // Target: > 6k cells/second

      console.log(
        `Locale date 20k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Text Formatting Performance", () => {
    it("should process 80k cells very quickly", async () => {
      const cellCount = 80000;
      const addresses = generateTestData(repository, cellCount, "mixed");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "text",
        batchSize: 5000,
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(3000);
      expect(cellsPerSecond).toBeGreaterThan(25000); // Target: > 25k cells/second (text is very fast)

      console.log(`Text 80k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`);
    });
  });

  describe("Mixed Data Type Performance", () => {
    it("should handle mixed data types efficiently", async () => {
      const cellCount = 45000;
      const addresses = generateTestData(repository, cellCount, "mixed");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "currency",
        batchSize: 3000,
        skipNonNumeric: true,
        convertStrings: true,
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(6000);
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second

      console.log(
        `Mixed data 45k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should handle type conversion efficiently", async () => {
      const cellCount = 30000;
      const addresses = generateTestData(repository, cellCount, "mixed");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "number",
        batchSize: 2500,
        skipNonNumeric: false,
        convertStrings: true,
        preserveOnError: true,
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000);
      expect(cellsPerSecond).toBeGreaterThan(8000); // Target: > 8k cells/second

      console.log(
        `Type conversion 30k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });
  });

  describe("Preview Performance", () => {
    it("should generate previews quickly for large selections", async () => {
      const cellCount = 60000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = { formatType: "currency" };
      const operation = new BulkFormatOperation(selection, options, repository);

      const startTime = Date.now();
      const preview = await operation.preview(1000);
      const endTime = Date.now();
      const previewTime = endTime - startTime;

      expect(preview.affectedCells).toBe(cellCount);
      expect(preview.changes.length).toBeLessThanOrEqual(1000);
      expect(previewTime).toBeLessThan(800); // Should generate preview in under 800ms

      console.log(`Preview 60k cells (1k limit): ${previewTime}ms`);
    });

    it("should handle large preview limits efficiently", async () => {
      const cellCount = 25000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = { formatType: "percent" };
      const operation = new BulkFormatOperation(selection, options, repository);

      const startTime = Date.now();
      const preview = await operation.preview(5000);
      const endTime = Date.now();
      const previewTime = endTime - startTime;

      expect(preview.affectedCells).toBe(cellCount);
      expect(preview.changes.length).toBeLessThanOrEqual(5000);
      expect(previewTime).toBeLessThan(1500); // Should generate preview in under 1.5 seconds

      console.log(`Large preview 25k cells (5k limit): ${previewTime}ms`);
    });
  });

  describe("Locale Performance", () => {
    it("should maintain performance with different locales", async () => {
      const cellCount = 20000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const locales = ["en-US", "de-DE", "fr-FR", "ja-JP"];
      const results: {
        locale: string;
        timeMs: number;
        cellsPerSecond: number;
      }[] = [];

      for (const locale of locales) {
        // Reset repository state
        const freshRepo = new MockCellRepository();
        generateTestData(freshRepo, cellCount, "numeric");

        const options: BulkFormatOptions = {
          formatType: "currency",
          locale,
          batchSize: 2000,
          currencyOptions: {
            currency:
              locale === "de-DE" ? "EUR" : locale === "ja-JP" ? "JPY" : "USD",
          },
        };
        const operation = new BulkFormatOperation(
          selection,
          options,
          freshRepo,
        );

        const { timeMs, cellsPerSecond } = await measurePerformance(() =>
          operation.execute(),
        );
        results.push({ locale, timeMs, cellsPerSecond });

        expect(cellsPerSecond).toBeGreaterThan(8000); // Should maintain good performance
        console.log(
          `Locale ${locale}: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
        );
      }

      // Performance should be consistent across locales
      const avgPerformance =
        results.reduce((sum, r) => sum + r.cellsPerSecond, 0) / results.length;
      expect(avgPerformance).toBeGreaterThan(10000);
    });
  });

  describe("Memory Efficiency", () => {
    it("should maintain reasonable memory usage for large operations", async () => {
      const cellCount = 60000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "currency",
        batchSize: 4000,
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      // Measure memory before operation
      const memBefore = process.memoryUsage().heapUsed;

      const { result } = await measurePerformance(() => operation.execute());

      // Measure memory after operation
      const memAfter = process.memoryUsage().heapUsed;
      const memDelta = memAfter - memBefore;
      const memPerCell = memDelta / cellCount;

      expect(result.success).toBe(true);
      expect(memPerCell).toBeLessThan(800); // Should use less than 800 bytes per cell

      console.log(
        `Memory usage 60k cells: ${Math.round(memDelta / 1024 / 1024)}MB total, ${Math.round(memPerCell)}B per cell`,
      );
    });
  });

  describe("Batch Size Optimization", () => {
    it("should find optimal batch size for currency formatting", async () => {
      const cellCount = 25000;
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const batchSizes = [500, 1000, 2500, 5000, 7500];
      const results: {
        batchSize: number;
        timeMs: number;
        cellsPerSecond: number;
      }[] = [];

      for (const batchSize of batchSizes) {
        // Reset repository state
        const freshRepo = new MockCellRepository();
        generateTestData(freshRepo, cellCount, "numeric");

        const options: BulkFormatOptions = {
          formatType: "currency",
          batchSize,
        };
        const operation = new BulkFormatOperation(
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

      expect(bestResult.cellsPerSecond).toBeGreaterThan(12000);
      console.log(
        `Best batch size: ${bestResult.batchSize} (${bestResult.cellsPerSecond} cells/sec)`,
      );
    });
  });

  describe("Stress Testing", () => {
    it("should handle maximum size selection", async () => {
      const cellCount = 200000; // Large but manageable test size
      const addresses = generateTestData(repository, cellCount, "numeric");
      const selection = CellSelection.fromCells(addresses);

      const options: BulkFormatOptions = {
        formatType: "number",
        batchSize: 8000,
        numberOptions: {
          decimals: 2,
          useThousandsSeparator: true,
        },
      };
      const operation = new BulkFormatOperation(selection, options, repository);

      const { result, timeMs, cellsPerSecond } = await measurePerformance(() =>
        operation.execute(),
      );

      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(20000); // Should complete in under 20 seconds
      expect(cellsPerSecond).toBeGreaterThan(10000); // Target: > 10k cells/second

      console.log(
        `Stress test 200k cells: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
      );
    });

    it("should maintain performance under concurrent operations", async () => {
      const cellCount = 15000;
      const numOperations = 3;
      const promises: Promise<OperationResult>[] = [];

      for (let i = 0; i < numOperations; i++) {
        const freshRepo = new MockCellRepository();
        const addresses = generateTestData(freshRepo, cellCount, "numeric");
        const selection = CellSelection.fromCells(addresses);

        const formatTypes: FormatType[] = ["currency", "percent", "number"];
        const options: BulkFormatOptions = {
          formatType: formatTypes[i],
          batchSize: 1500,
        };
        const operation = new BulkFormatOperation(
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
        expect(cellsPerSecond).toBeGreaterThan(6000); // Should maintain good performance
        console.log(
          `Concurrent operation ${i + 1}: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
        );
      }
    });
  });

  describe("Format-Specific Performance", () => {
    it("should compare performance across different format types", async () => {
      const cellCount = 20000;
      const addresses = generateTestData(repository, cellCount, "mixed");
      const selection = CellSelection.fromCells(addresses);

      const formatTypes: FormatType[] = [
        "text",
        "number",
        "currency",
        "percent",
      ];
      const results: {
        formatType: string;
        timeMs: number;
        cellsPerSecond: number;
      }[] = [];

      for (const formatType of formatTypes) {
        // Reset repository state
        const freshRepo = new MockCellRepository();
        generateTestData(freshRepo, cellCount, "mixed");

        const options: BulkFormatOptions = {
          formatType,
          batchSize: 2000,
        };
        const operation = new BulkFormatOperation(
          selection,
          options,
          freshRepo,
        );

        const { timeMs, cellsPerSecond } = await measurePerformance(() =>
          operation.execute(),
        );
        results.push({ formatType, timeMs, cellsPerSecond });

        console.log(
          `Format ${formatType}: ${timeMs}ms, ${cellsPerSecond} cells/sec`,
        );
      }

      // Text should be fastest, currency/percent should be slowest
      const textResult = results.find((r) => r.formatType === "text");
      const currencyResult = results.find((r) => r.formatType === "currency");

      expect(textResult?.cellsPerSecond).toBeGreaterThan(15000);
      expect(currencyResult?.cellsPerSecond).toBeGreaterThan(8000);
    });
  });
});
