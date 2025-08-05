// Simple performance validation test for Phase 6 optimizations
// This validates our performance targets without complex test framework dependencies

import { Cell } from "./packages/core/src/domain/models/Cell";
import {
  OptimizedSparseGrid,
  OptimizedStructuralEngine,
  PerformanceMonitor,
} from "./packages/core/src/structure";

console.log("🚀 Phase 6 Performance Validation Test");
console.log("=====================================");

// Create performance monitoring components
const monitor = new PerformanceMonitor();
const grid = new OptimizedSparseGrid();
const engine = new OptimizedStructuralEngine(grid, monitor);

// Helper to create test cells
function createTestCell(value: string): any {
  const cellResult = Cell.create(value);
  if (!cellResult.ok) throw new Error("Failed to create cell");
  return cellResult.value;
}

// Helper to populate grid with test data
function populateGrid(rows: number, cols: number, density: number = 0.1): void {
  console.log(
    `  📊 Populating grid with ${rows}x${cols} cells (${density * 100}% density)...`,
  );
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() < density) {
        const address = { row, col };
        const cell = createTestCell(`Data_${row}_${col}`);
        grid.setCell(address, cell);
      }
    }
  }
  console.log(`  ✅ Grid populated with ${grid.size()} cells`);
}

async function runPerformanceTests() {
  console.log("\n📈 Running Performance Target Tests...");

  // Test 1: 1000 rows insertion < 200ms
  console.log("\n🔧 Test 1: Insert 1000 rows (target: <200ms)");
  populateGrid(500, 20, 0.2);

  const start1 = performance.now();
  const result1 = engine.insertRows(250, 1000);
  const duration1 = performance.now() - start1;

  const passed1 = result1.ok && duration1 < 200;
  console.log(`  ⏱️  Duration: ${duration1.toFixed(2)}ms`);
  console.log(`  ${passed1 ? "✅ PASS" : "❌ FAIL"}: 1000 rows insertion`);

  // Test 2: 1000 rows deletion < 200ms
  console.log("\n🔧 Test 2: Delete 1000 rows (target: <200ms)");
  grid.clear();
  populateGrid(2000, 20, 0.2);

  const start2 = performance.now();
  const result2 = engine.deleteRows(500, 1000);
  const duration2 = performance.now() - start2;

  const passed2 = result2.ok && duration2 < 200;
  console.log(`  ⏱️  Duration: ${duration2.toFixed(2)}ms`);
  console.log(`  ${passed2 ? "✅ PASS" : "❌ FAIL"}: 1000 rows deletion`);

  // Test 3: Large operation < 2s
  console.log("\n🔧 Test 3: Insert 5000 rows (target: <2000ms)");
  grid.clear();
  populateGrid(100, 50, 0.1);

  const start3 = performance.now();
  const result3 = engine.insertRows(50, 5000);
  const duration3 = performance.now() - start3;

  const passed3 = result3.ok && duration3 < 2000;
  console.log(`  ⏱️  Duration: ${duration3.toFixed(2)}ms`);
  console.log(`  ${passed3 ? "✅ PASS" : "❌ FAIL"}: 5000 rows insertion`);

  // Test 4: Batch operations optimization
  console.log("\n🔧 Test 4: Batch operations performance");
  grid.clear();
  populateGrid(500, 10, 0.15);

  const startBatch = performance.now();
  engine.startBatch();
  engine.insertRows(100, 200);
  engine.deleteRows(200, 50);
  engine.insertColumns(10, 100);
  const batchResult = engine.executeBatch();
  const batchDuration = performance.now() - startBatch;

  const passed4 = batchResult.ok && batchDuration < 500;
  console.log(`  ⏱️  Duration: ${batchDuration.toFixed(2)}ms`);
  console.log(
    `  📊 Batch result: ${batchResult.ok ? "Success" : `Failed - ${(batchResult as any).error}`}`,
  );
  console.log(`  ${passed4 ? "✅ PASS" : "❌ FAIL"}: Batch operations`);

  // Test 5: Memory efficiency
  console.log("\n🔧 Test 5: Memory efficiency");
  grid.clear();
  populateGrid(1000, 100, 0.05);

  const initialMemory = grid.getMemoryStats();
  engine.insertRows(500, 2000);
  const finalMemory = grid.getMemoryStats();

  const memoryGrowthMB =
    (finalMemory.estimatedBytes - initialMemory.estimatedBytes) / 1024 / 1024;
  const passed5 = memoryGrowthMB < 50; // Less than 50MB growth
  console.log(`  📊 Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
  console.log(`  ${passed5 ? "✅ PASS" : "❌ FAIL"}: Memory efficiency`);

  // Test 6: Edge cases
  console.log("\n🔧 Test 6: Edge cases handling");

  // Empty grid test
  grid.clear();
  const startEmpty = performance.now();
  const emptyResult = engine.insertRows(0, 1000);
  const emptyDuration = performance.now() - startEmpty;

  // Sparse grid test
  grid.clear();
  for (let i = 0; i < 10; i++) {
    const address = { row: i * 100, col: i * 50 };
    grid.setCell(address, createTestCell(`Sparse_${i}`));
  }
  const startSparse = performance.now();
  const sparseResult = engine.insertRows(500, 1000);
  const sparseDuration = performance.now() - startSparse;

  const passed6 =
    emptyResult.ok &&
    sparseResult.ok &&
    emptyDuration < 10 &&
    sparseDuration < 50;
  console.log(
    `  ⏱️  Empty grid: ${emptyDuration.toFixed(2)}ms, Sparse grid: ${sparseDuration.toFixed(2)}ms`,
  );
  console.log(`  ${passed6 ? "✅ PASS" : "❌ FAIL"}: Edge cases`);

  // Performance monitoring validation
  console.log("\n📊 Performance Monitoring Results:");
  const report = monitor.getPerformanceReport();
  const gridMetrics = grid.getPerformanceMetrics();

  console.log(`  🎯 Performance Grade: ${report.performanceGrade}`);
  console.log(`  📈 Total Operations: ${report.totalOperations}`);
  console.log(`  ⏱️  Average Duration: ${report.averageDuration.toFixed(2)}ms`);
  console.log(`  📊 Grid Cell Count: ${gridMetrics.cellCount}`);
  console.log(
    `  💾 Current Memory: ${(gridMetrics.currentMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
  );

  // Overall results
  const allPassed =
    passed1 && passed2 && passed3 && passed4 && passed5 && passed6;
  console.log("\n🏆 PHASE 6 PERFORMANCE RESULTS:");
  console.log("=================================");
  console.log(
    `✅ 1000 rows insert/delete < 200ms: ${passed1 && passed2 ? "PASS" : "FAIL"}`,
  );
  console.log(`✅ Large operations < 2s: ${passed3 ? "PASS" : "FAIL"}`);
  console.log(`✅ Batch optimization: ${passed4 ? "PASS" : "FAIL"}`);
  console.log(`✅ Memory efficiency: ${passed5 ? "PASS" : "FAIL"}`);
  console.log(`✅ Edge cases handling: ${passed6 ? "PASS" : "FAIL"}`);
  console.log(
    `\n🎯 OVERALL: ${allPassed ? "🎉 ALL TESTS PASSED" : "⚠️  SOME TESTS FAILED"}`,
  );
  console.log(`📊 Performance Grade: ${report.performanceGrade}`);

  return allPassed;
}

// Run the tests
runPerformanceTests()
  .then((success) => {
    if (success) {
      console.log("\n🎉 Phase 6 performance optimization COMPLETE!");
      console.log("All performance targets met. Ready for production use.");
    } else {
      console.log("\n⚠️  Phase 6 needs additional optimization.");
      console.log("Some performance targets not met. Review and optimize.");
    }
  })
  .catch((error) => {
    console.error("\n❌ Performance test failed:", error);
    process.exit(1);
  });
