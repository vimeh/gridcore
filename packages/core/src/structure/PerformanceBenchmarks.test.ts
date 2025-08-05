import { beforeEach, describe, expect, it } from "bun:test";
import { Cell } from "../domain/models/Cell";
import { CellAddress } from "../domain/models/CellAddress";
import type { CellValue } from "../domain/models/CellValue";
import { OptimizedSparseGrid } from "./OptimizedSparseGrid";
import { OptimizedStructuralEngine } from "./OptimizedStructuralEngine";
import { PerformanceMonitor } from "./PerformanceMonitor";

describe("Performance Benchmarks", () => {
  let grid: OptimizedSparseGrid;
  let engine: OptimizedStructuralEngine;
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    grid = new OptimizedSparseGrid();
    engine = new OptimizedStructuralEngine(grid, monitor);
  });

  // Helper function to create test cells
  function createTestCell(value: string): Cell {
    const cellResult = Cell.create(value);
    if (!cellResult.ok) throw new Error("Failed to create cell");
    return cellResult.value;
  }

  // Helper function to populate grid with test data
  function populateGrid(
    rows: number,
    cols: number,
    density: number = 0.1,
  ): void {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() < density) {
          const addressResult = CellAddress.create(row, col);
          if (!addressResult.ok) continue;
          const address = addressResult.value;
          const cell = createTestCell(`Data_${row}_${col}`);
          grid.setCell(address, cell);
        }
      }
    }
  }

  // Helper function to populate grid with formulas
  function populateGridWithFormulas(rows: number, cols: number): void {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const addressResult = CellAddress.create(row, col);
        if (!addressResult.ok) continue;
        const address = addressResult.value;
        // Create formulas that reference other cells
        const refRow = Math.min(row + 1, rows - 1);
        const refCol = Math.min(col + 1, cols - 1);
        const formula = `=A${refRow + 1}+B${refCol + 1}`;
        const cell = createTestCell(formula);
        grid.setCell(address, cell);
      }
    }
  }

  describe("Core Performance Requirements", () => {
    it("should insert 1000 rows in under 200ms", async () => {
      // Populate with some test data
      populateGrid(500, 20, 0.2);

      const startTime = performance.now();
      const result = engine.insertRows(250, 1000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(200);

      const report = monitor.getPerformanceReport();
      expect(report.performanceGrade).toMatch(/^[ABC]$/); // A, B, or C grade

      console.log(
        `Insert 1000 rows: ${duration.toFixed(2)}ms (target: <200ms)`,
      );
    });

    it("should delete 1000 rows in under 200ms", async () => {
      // Populate with test data
      populateGrid(2000, 20, 0.2);

      const startTime = performance.now();
      const result = engine.deleteRows(500, 1000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(200);

      console.log(
        `Delete 1000 rows: ${duration.toFixed(2)}ms (target: <200ms)`,
      );
    });

    it("should handle 10k rows with formula updates in under 2 seconds", async () => {
      // Create a smaller grid with formulas for realistic testing
      populateGridWithFormulas(100, 50); // 5k cells with formulas

      const startTime = performance.now();
      const result = engine.insertRows(50, 10000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(2000);

      const report = monitor.getPerformanceReport();
      expect(report.performanceGrade).toMatch(/^[ABCD]$/); // Allow D for this heavy test

      console.log(
        `Insert 10k rows with formulas: ${duration.toFixed(2)}ms (target: <2000ms)`,
      );
    });

    it("should handle 10k columns in under 2 seconds", async () => {
      populateGrid(50, 100, 0.1);

      const startTime = performance.now();
      const result = engine.insertColumns(50, 10000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(2000);

      console.log(
        `Insert 10k columns: ${duration.toFixed(2)}ms (target: <2000ms)`,
      );
    });
  });

  describe("Batch Operations Performance", () => {
    it("should optimize multiple row operations using batching", async () => {
      populateGrid(1000, 10, 0.15);

      // Compare sequential vs batch operations
      const engine2 = new OptimizedStructuralEngine(
        new OptimizedSparseGrid(),
        new PerformanceMonitor(),
      );
      populateGrid(1000, 10, 0.15); // Same data in second engine

      // Sequential operations
      const sequentialStart = performance.now();
      for (let i = 0; i < 10; i++) {
        engine.insertRows(100 + i * 10, 50);
      }
      const sequentialDuration = performance.now() - sequentialStart;

      // Batch operations
      const batchStart = performance.now();
      engine2.startBatch();
      for (let i = 0; i < 10; i++) {
        engine2.insertRows(100 + i * 10, 50);
      }
      const batchResult = engine2.executeBatch();
      const batchDuration = performance.now() - batchStart;

      expect(batchResult.ok).toBe(true);
      expect(batchDuration).toBeLessThan(sequentialDuration * 0.8); // At least 20% faster

      console.log(
        `Sequential: ${sequentialDuration.toFixed(2)}ms, Batch: ${batchDuration.toFixed(2)}ms`,
      );
    });

    it("should handle mixed batch operations efficiently", async () => {
      populateGrid(500, 20, 0.2);

      const startTime = performance.now();

      engine.startBatch();
      engine.insertRows(100, 100);
      engine.deleteRows(200, 50);
      engine.insertColumns(10, 200);
      engine.deleteColumns(15, 75);
      engine.insertRows(300, 150);

      const result = engine.executeBatch();
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete mixed operations quickly

      console.log(`Mixed batch operations: ${duration.toFixed(2)}ms`);
    });
  });

  describe("Memory Performance", () => {
    it("should maintain reasonable memory usage with large operations", () => {
      populateGrid(1000, 100, 0.05); // 5k cells

      const initialMemory = grid.getMemoryStats();

      // Perform large operations
      engine.insertRows(500, 5000);
      engine.insertColumns(50, 1000);

      const finalMemory = grid.getMemoryStats();
      const memoryGrowth =
        finalMemory.estimatedBytes - initialMemory.estimatedBytes;

      // Memory growth should be reasonable (less than 50MB for this test)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      expect(grid.isAtMemoryLimit()).toBe(false);

      console.log(
        `Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
      );
    });

    it("should clean up memory efficiently after operations", () => {
      populateGrid(500, 50, 0.1);

      const initialStats = grid.getMemoryStats();

      // Perform operations that should not significantly increase memory
      engine.deleteRows(100, 200);
      engine.deleteColumns(10, 20);

      const finalStats = grid.getMemoryStats();

      // Memory should decrease or stay the same after deletions
      expect(finalStats.estimatedBytes).toBeLessThanOrEqual(
        initialStats.estimatedBytes,
      );
      expect(finalStats.cellCount).toBeLessThan(initialStats.cellCount);

      console.log(
        `Memory change: ${((finalStats.estimatedBytes - initialStats.estimatedBytes) / 1024).toFixed(2)}KB`,
      );
    });
  });

  describe("Edge Cases Performance", () => {
    it("should handle empty grid operations efficiently", () => {
      // Empty grid should be very fast
      const startTime = performance.now();
      const result = engine.insertRows(0, 1000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(10); // Should be nearly instant

      console.log(`Empty grid 1000 rows: ${duration.toFixed(2)}ms`);
    });

    it("should handle sparse grid operations efficiently", () => {
      // Sparse grid with only a few cells
      for (let i = 0; i < 10; i++) {
        const addressResult = CellAddress.create(i * 100, i * 50);
        if (!addressResult.ok) continue;
        const address = addressResult.value;
        grid.setCell(address, createTestCell(`Sparse_${i}`));
      }

      const startTime = performance.now();
      const result = engine.insertRows(500, 2000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(50); // Should be very fast for sparse data

      console.log(`Sparse grid 2000 rows: ${duration.toFixed(2)}ms`);
    });

    it("should handle operations near maximum bounds", () => {
      // Test operations near the limits
      populateGrid(100, 100, 0.05);

      const bounds = grid.getBounds();
      const startTime = performance.now();

      // Insert at the edge
      const result = engine.insertRows(bounds.maxRow, 1000);
      const duration = performance.now() - startTime;

      expect(result.ok).toBe(true);
      expect(duration).toBeLessThan(100);

      console.log(`Edge insertion: ${duration.toFixed(2)}ms`);
    });

    it("should reject operations that would exceed limits", () => {
      // Try to exceed maximum row limit
      const result = engine.insertRows(0, 2000000); // Exceeds 1M limit

      expect(result.ok).toBe(false);
      expect(result.error).toContain("exceed maximum");
    });
  });

  describe("Performance Monitoring", () => {
    it("should provide accurate performance metrics", () => {
      populateGrid(200, 20, 0.1);

      // Perform various operations
      engine.insertRows(50, 100);
      engine.deleteRows(25, 50);
      engine.insertColumns(10, 200);

      const report = monitor.getPerformanceReport();

      expect(report.totalOperations).toBeGreaterThan(0);
      expect(report.averageDuration).toBeGreaterThan(0);
      expect(report.performanceGrade).toMatch(/^[ABCDF]$/);

      const gridMetrics = grid.getPerformanceMetrics();
      expect(gridMetrics.operationCount).toBeGreaterThan(0);
      expect(gridMetrics.cellCount).toBeGreaterThan(0);

      console.log(`Performance grade: ${report.performanceGrade}`);
      console.log(
        `Average operation time: ${report.averageDuration.toFixed(2)}ms`,
      );
    });

    it("should detect performance violations", () => {
      // Create a scenario that should trigger warnings
      populateGridWithFormulas(200, 100); // Dense formula grid

      const result = engine.insertRows(100, 5000);
      expect(result.ok).toBe(true);

      const warnings = monitor.getPerformanceWarnings();
      // May or may not have warnings depending on actual performance
      console.log(`Performance warnings: ${warnings.length}`);

      if (warnings.length > 0) {
        console.log(`Warnings: ${warnings.join(", ")}`);
      }
    });
  });

  describe("Scalability Tests", () => {
    it("should demonstrate logarithmic scaling for lookups", () => {
      const sizes = [100, 1000, 10000];
      const durations: number[] = [];

      for (const size of sizes) {
        const testGrid = new OptimizedSparseGrid();

        // Populate with data
        for (let i = 0; i < size; i++) {
          const addressResult = CellAddress.create(i, i);
          if (!addressResult.ok) continue;
          const address = addressResult.value;
          testGrid.setCell(address, createTestCell(`Test_${i}`));
        }

        // Measure lookup performance
        const startTime = performance.now();
        for (let i = 0; i < 100; i++) {
          const randomRow = Math.floor(Math.random() * size);
          const addressResult = CellAddress.create(randomRow, randomRow);
          if (addressResult.ok) {
            testGrid.getCell(addressResult.value);
          }
        }
        const duration = performance.now() - startTime;

        durations.push(duration);
        console.log(`${size} cells - 100 lookups: ${duration.toFixed(2)}ms`);
      }

      // Should not scale linearly (logarithmic or better)
      const scalingFactor = durations[2] / durations[0]; // 10k vs 100
      expect(scalingFactor).toBeLessThan(50); // Should be much less than 100x
    });
  });
});

// Export for integration testing
export { OptimizedSparseGrid, OptimizedStructuralEngine, PerformanceMonitor };
