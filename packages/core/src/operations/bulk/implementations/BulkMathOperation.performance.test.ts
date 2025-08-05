import { beforeEach, describe, expect, it } from "bun:test";
import type { ICellRepository } from "../../../domain/interfaces/ICellRepository";
import type { Cell } from "../../../domain/models";
import { CellAddress } from "../../../domain/models";
import type { Result } from "../../../shared/types/Result";
import { CellSelection } from "../base/CellSelection";
import { BulkMathOperation, type BulkMathOptions } from "./BulkMathOperation";

// High-performance mock cell repository for performance testing
class PerformanceMockCellRepository implements ICellRepository {
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

  // Batch initialize cells for performance testing
  initializeCells(cellCount: number): void {
    this.cells.clear();
    for (let i = 0; i < cellCount; i++) {
      const row = Math.floor(i / 1000) + 1;
      const col = (i % 1000) + 1;
      const key = `${row},${col}`;

      // Mix of different value types for realistic testing
      let value: any;
      const type = i % 4;
      switch (type) {
        case 0:
          value = Math.random() * 1000;
          break; // Numbers
        case 1:
          value = (Math.random() * 1000).toString();
          break; // Numeric strings
        case 2:
          value = `$${Math.random() * 1000}`;
          break; // Formatted strings
        case 3:
          value = Math.random() > 0.9 ? "text" : Math.random() * 100;
          break; // Mostly numeric
      }

      this.cells.set(key, { value });
    }
  }

  getCellCount(): number {
    return this.cells.size;
  }
}

/**
 * Create a large selection for performance testing
 */
function createLargeSelection(cellCount: number): CellSelection {
  const selection = new CellSelection();

  for (let i = 0; i < cellCount; i++) {
    const row = Math.floor(i / 1000) + 1;
    const col = (i % 1000) + 1;
    selection.addCell(new CellAddress(row, col));
  }

  return selection;
}

/**
 * Measure operation performance and return cells per second
 */
async function measurePerformance(
  operation: BulkMathOperation,
  cellCount: number,
  description: string,
): Promise<number> {
  const startTime = Date.now();
  const result = await operation.execute();
  const endTime = Date.now();

  const executionTime = endTime - startTime;
  const cellsPerSecond = cellCount / (executionTime / 1000);

  console.log(`${description}:`);
  console.log(`  Processed ${cellCount} cells in ${executionTime}ms`);
  console.log(
    `  Performance: ${Math.round(cellsPerSecond).toLocaleString()} cells/second`,
  );
  console.log(`  Modified: ${result.cellsModified} cells`);
  console.log(`  Success: ${result.success}`);
  console.log("");

  expect(result.success).toBe(true);
  return cellsPerSecond;
}

describe("BulkMathOperation Performance Tests", () => {
  let cellRepository: PerformanceMockCellRepository;

  beforeEach(() => {
    cellRepository = new PerformanceMockCellRepository();
  });

  describe("Scale Performance Tests", () => {
    it("should handle 1,000 cells efficiently", async () => {
      const cellCount = 1000;
      cellRepository.initializeCells(cellCount);
      const selection = createLargeSelection(cellCount);

      const options: BulkMathOptions = {
        operation: "add",
        value: 10,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const cellsPerSecond = await measurePerformance(
        operation,
        cellCount,
        "1K cells - Add operation",
      );

      // Should be very fast for small scale
      expect(cellsPerSecond).toBeGreaterThan(10000);
    });

    it("should handle 10,000 cells efficiently", async () => {
      const cellCount = 10000;
      cellRepository.initializeCells(cellCount);
      const selection = createLargeSelection(cellCount);

      const options: BulkMathOptions = {
        operation: "multiply",
        value: 2,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const cellsPerSecond = await measurePerformance(
        operation,
        cellCount,
        "10K cells - Multiply operation",
      );

      // Should exceed minimum performance target
      expect(cellsPerSecond).toBeGreaterThan(50000);
    });

    it("should handle 50,000 cells efficiently", async () => {
      const cellCount = 50000;
      cellRepository.initializeCells(cellCount);
      const selection = createLargeSelection(cellCount);

      const options: BulkMathOptions = {
        operation: "divide",
        value: 3,
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const cellsPerSecond = await measurePerformance(
        operation,
        cellCount,
        "50K cells - Divide operation",
      );

      // Should meet high performance target
      expect(cellsPerSecond).toBeGreaterThan(75000);
    });

    it("should handle 100,000 cells efficiently", async () => {
      const cellCount = 100000;
      cellRepository.initializeCells(cellCount);
      const selection = createLargeSelection(cellCount);

      const options: BulkMathOptions = {
        operation: "add",
        value: 5,
        batchSize: 2000, // Optimize batch size for large operations
      };

      const operation = new BulkMathOperation(
        selection,
        options,
        cellRepository,
      );
      const cellsPerSecond = await measurePerformance(
        operation,
        cellCount,
        "100K cells - Add operation (target test)",
      );

      // Must meet the 100k cells/second performance requirement
      expect(cellsPerSecond).toBeGreaterThan(100000);
    });
  });

  describe("Operation Type Performance Comparison", () => {
    const cellCount = 25000; // Moderate size for comparison tests

    beforeEach(() => {
      cellRepository.initializeCells(cellCount);
    });

    it("should compare basic arithmetic operations performance", async () => {
      const selection = createLargeSelection(cellCount);
      const results: Record<string, number> = {};

      // Test addition
      const addOp = new BulkMathOperation(
        selection,
        { operation: "add", value: 10 },
        cellRepository,
      );
      results.add = await measurePerformance(
        addOp,
        cellCount,
        "25K cells - Addition",
      );

      // Test subtraction
      const subOp = new BulkMathOperation(
        selection,
        { operation: "subtract", value: 5 },
        cellRepository,
      );
      results.subtract = await measurePerformance(
        subOp,
        cellCount,
        "25K cells - Subtraction",
      );

      // Test multiplication
      const mulOp = new BulkMathOperation(
        selection,
        { operation: "multiply", value: 2 },
        cellRepository,
      );
      results.multiply = await measurePerformance(
        mulOp,
        cellCount,
        "25K cells - Multiplication",
      );

      // Test division
      const divOp = new BulkMathOperation(
        selection,
        { operation: "divide", value: 3 },
        cellRepository,
      );
      results.divide = await measurePerformance(
        divOp,
        cellCount,
        "25K cells - Division",
      );

      // All operations should meet performance targets
      Object.entries(results).forEach(([operation, performance]) => {
        expect(performance).toBeGreaterThan(75000); // Should all be high performance
      });

      console.log("Performance comparison (cells/second):");
      Object.entries(results).forEach(([op, perf]) => {
        console.log(`  ${op}: ${Math.round(perf).toLocaleString()}`);
      });
    });

    it("should compare complex operations performance", async () => {
      const selection = createLargeSelection(cellCount);
      const results: Record<string, number> = {};

      // Test modulo
      const modOp = new BulkMathOperation(
        selection,
        { operation: "modulo", value: 7 },
        cellRepository,
      );
      results.modulo = await measurePerformance(
        modOp,
        cellCount,
        "25K cells - Modulo",
      );

      // Test percentage increase
      const percentOp = new BulkMathOperation(
        selection,
        { operation: "percent", value: 25 },
        cellRepository,
      );
      results.percent = await measurePerformance(
        percentOp,
        cellCount,
        "25K cells - Percentage",
      );

      // Test rounding
      const roundOp = new BulkMathOperation(
        selection,
        { operation: "round", value: 0, decimalPlaces: 2 },
        cellRepository,
      );
      results.round = await measurePerformance(
        roundOp,
        cellCount,
        "25K cells - Rounding",
      );

      // Complex operations should still be high performance
      Object.entries(results).forEach(([operation, performance]) => {
        expect(performance).toBeGreaterThan(50000);
      });

      console.log("Complex operations performance (cells/second):");
      Object.entries(results).forEach(([op, perf]) => {
        console.log(`  ${op}: ${Math.round(perf).toLocaleString()}`);
      });
    });
  });

  describe("Configuration Impact on Performance", () => {
    const cellCount = 20000;

    beforeEach(() => {
      cellRepository.initializeCells(cellCount);
    });

    it("should measure impact of string conversion", async () => {
      const selection = createLargeSelection(cellCount);

      // Test with string conversion enabled (default)
      const withConversion = new BulkMathOperation(
        selection,
        {
          operation: "add",
          value: 10,
          convertStrings: true,
        },
        cellRepository,
      );
      const withConversionPerf = await measurePerformance(
        withConversion,
        cellCount,
        "20K cells - With string conversion",
      );

      // Test with string conversion disabled
      cellRepository.initializeCells(cellCount); // Reset
      const withoutConversion = new BulkMathOperation(
        selection,
        {
          operation: "add",
          value: 10,
          convertStrings: false,
        },
        cellRepository,
      );
      const withoutConversionPerf = await measurePerformance(
        withoutConversion,
        cellCount,
        "20K cells - Without string conversion",
      );

      // Both should be high performance, without conversion might be slightly faster
      expect(withConversionPerf).toBeGreaterThan(75000);
      expect(withoutConversionPerf).toBeGreaterThan(75000);

      console.log(
        `String conversion impact: ${((withConversionPerf / withoutConversionPerf - 1) * 100).toFixed(1)}%`,
      );
    });

    it("should measure impact of type preservation", async () => {
      const selection = createLargeSelection(cellCount);

      // Test with type preservation (default)
      const withPreservation = new BulkMathOperation(
        selection,
        {
          operation: "multiply",
          value: 2,
          preserveType: true,
        },
        cellRepository,
      );
      const withPreservationPerf = await measurePerformance(
        withPreservation,
        cellCount,
        "20K cells - With type preservation",
      );

      // Test without type preservation
      cellRepository.initializeCells(cellCount); // Reset
      const withoutPreservation = new BulkMathOperation(
        selection,
        {
          operation: "multiply",
          value: 2,
          preserveType: false,
        },
        cellRepository,
      );
      const withoutPreservationPerf = await measurePerformance(
        withoutPreservation,
        cellCount,
        "20K cells - Without type preservation",
      );

      // Both should be high performance
      expect(withPreservationPerf).toBeGreaterThan(75000);
      expect(withoutPreservationPerf).toBeGreaterThan(75000);

      console.log(
        `Type preservation impact: ${((withPreservationPerf / withoutPreservationPerf - 1) * 100).toFixed(1)}%`,
      );
    });

    it("should measure impact of batch size", async () => {
      const selection = createLargeSelection(cellCount);
      const results: Record<string, number> = {};

      // Test different batch sizes
      const batchSizes = [500, 1000, 2000, 5000];

      for (const batchSize of batchSizes) {
        cellRepository.initializeCells(cellCount); // Reset for each test
        const operation = new BulkMathOperation(
          selection,
          {
            operation: "add",
            value: 7,
            batchSize,
          },
          cellRepository,
        );

        results[`batch_${batchSize}`] = await measurePerformance(
          operation,
          cellCount,
          `20K cells - Batch size ${batchSize}`,
        );
      }

      // All batch sizes should maintain high performance
      Object.values(results).forEach((performance) => {
        expect(performance).toBeGreaterThan(60000);
      });

      console.log("Batch size performance comparison:");
      Object.entries(results).forEach(([config, perf]) => {
        console.log(
          `  ${config}: ${Math.round(perf).toLocaleString()} cells/sec`,
        );
      });
    });
  });

  describe("Memory Usage Estimation", () => {
    it("should provide reasonable memory estimates", () => {
      const cellCounts = [1000, 10000, 50000, 100000];

      cellCounts.forEach((cellCount) => {
        const selection = createLargeSelection(cellCount);
        const operation = new BulkMathOperation(
          selection,
          { operation: "add", value: 1 },
          cellRepository,
        );

        // Call the protected method through any to test it
        const memoryEstimate = (operation as any).estimateMemoryUsage(
          cellCount,
        );

        console.log(
          `${cellCount.toLocaleString()} cells - Memory estimate: ${(memoryEstimate / 1024).toFixed(1)}KB`,
        );

        // Should provide reasonable estimates (not too high or too low)
        expect(memoryEstimate).toBeGreaterThan(cellCount * 50); // At least 50 bytes per cell
        expect(memoryEstimate).toBeLessThan(cellCount * 1000); // Not more than 1KB per cell
      });
    });
  });

  describe("Preview Performance", () => {
    it("should generate previews quickly even for large selections", async () => {
      const cellCount = 100000;
      cellRepository.initializeCells(cellCount);
      const selection = createLargeSelection(cellCount);

      const operation = new BulkMathOperation(
        selection,
        {
          operation: "add",
          value: 10,
        },
        cellRepository,
      );

      const startTime = Date.now();
      const preview = await operation.preview(100); // Standard preview limit
      const endTime = Date.now();

      const previewTime = endTime - startTime;
      console.log(`Preview generation for 100K selection: ${previewTime}ms`);

      // Preview should be generated quickly (under 100ms for 100 samples)
      expect(previewTime).toBeLessThan(100);
      expect(preview.affectedCells).toBe(cellCount);
      expect(preview.changes.size).toBeLessThanOrEqual(100); // Limited by preview limit
      expect(preview.isTruncated).toBe(true); // Should be truncated for large selections
    });
  });

  describe("Stress Tests", () => {
    it("should handle very large selections without crashing", async () => {
      const cellCount = 250000; // Quarter million cells
      console.log(
        `\nStress test: Processing ${cellCount.toLocaleString()} cells...`,
      );

      cellRepository.initializeCells(cellCount);
      const selection = createLargeSelection(cellCount);

      const operation = new BulkMathOperation(
        selection,
        {
          operation: "multiply",
          value: 1.1,
          batchSize: 5000, // Large batches for efficiency
        },
        cellRepository,
      );

      const cellsPerSecond = await measurePerformance(
        operation,
        cellCount,
        "250K cells - Stress test",
      );

      // Should still maintain reasonable performance even at large scale
      expect(cellsPerSecond).toBeGreaterThan(50000);
    });

    it("should maintain performance consistency across multiple operations", async () => {
      const cellCount = 50000;
      const iterations = 5;
      const performances: number[] = [];

      console.log(
        `\nConsistency test: ${iterations} iterations of ${cellCount.toLocaleString()} cells each`,
      );

      for (let i = 0; i < iterations; i++) {
        cellRepository.initializeCells(cellCount);
        const selection = createLargeSelection(cellCount);

        const operation = new BulkMathOperation(
          selection,
          {
            operation: "add",
            value: i + 1, // Vary the operation slightly
          },
          cellRepository,
        );

        const startTime = Date.now();
        const result = await operation.execute();
        const endTime = Date.now();

        const cellsPerSecond = cellCount / ((endTime - startTime) / 1000);
        performances.push(cellsPerSecond);

        console.log(
          `  Iteration ${i + 1}: ${Math.round(cellsPerSecond).toLocaleString()} cells/sec`,
        );
        expect(result.success).toBe(true);
      }

      // Calculate performance statistics
      const avgPerformance =
        performances.reduce((a, b) => a + b) / performances.length;
      const minPerformance = Math.min(...performances);
      const maxPerformance = Math.max(...performances);
      const variationPercent =
        ((maxPerformance - minPerformance) / avgPerformance) * 100;

      console.log(
        `  Average: ${Math.round(avgPerformance).toLocaleString()} cells/sec`,
      );
      console.log(
        `  Range: ${Math.round(minPerformance).toLocaleString()} - ${Math.round(maxPerformance).toLocaleString()}`,
      );
      console.log(`  Variation: ${variationPercent.toFixed(1)}%`);

      // Performance should be consistent (all iterations meet target)
      performances.forEach((perf) => {
        expect(perf).toBeGreaterThan(75000);
      });

      // Variation should be reasonable (less than 50%)
      expect(variationPercent).toBeLessThan(50);
    });
  });
});
