// Debug batch operation issue
import { OptimizedSparseGrid, OptimizedStructuralEngine, PerformanceMonitor } from "./packages/core/src/structure";
import { Cell } from "./packages/core/src/domain/models/Cell";

const monitor = new PerformanceMonitor();
const grid = new OptimizedSparseGrid();
const engine = new OptimizedStructuralEngine(grid, monitor);

// Create test cell
function createTestCell(value: string): any {
  const cellResult = Cell.create(value);
  if (!cellResult.ok) throw new Error("Failed to create cell");
  return cellResult.value;
}

// Add some test data
for (let i = 0; i < 10; i++) {
  grid.setCell({ row: i, col: i }, createTestCell(`Test_${i}`));
}

console.log("Starting batch operations debug...");

try {
  console.log("1. Starting batch...");
  engine.startBatch();
  
  console.log("2. Adding batch operations...");
  engine.insertRows(100, 200);
  engine.deleteRows(200, 50);
  engine.insertColumns(10, 100);
  
  console.log("3. Executing batch...");
  const batchResult = engine.executeBatch();
  
  console.log("4. Batch result:", batchResult);
  if (!batchResult.ok) {
    console.error("Batch failed with error:", batchResult.error);
  } else {
    console.log("Batch succeeded!");
  }
  
} catch (error) {
  console.error("Exception during batch operations:", error);
}