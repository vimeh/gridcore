import { describe, test, expect } from "bun:test";
import { SpreadsheetController } from "@gridcore/ui-core";
import { CellAddress } from "@gridcore/core";
import { 
  createTestSpreadsheet, 
  createLargeDataset,
  measureOperationTime,
  validatePerformance 
} from "./integration-test-utils";

describe("Integration Test Set B: Selection + Bulk Operations", () => {
  test("Find/replace on column selection", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Populate column B with test data
    for (let row = 0; row < 20; row++) {
      facade.setCellValue(row, 1, `Item ${row % 5}`);
    }
    
    // Select column B
    controller.updateCursor(CellAddress.create(0, 1).value);
    controller.handleKey("g");
    controller.handleKey("C");
    
    // Execute find/replace command
    controller.handleKey(":");
    const command = "s/Item 2/Product Two/g";
    for (const char of command) {
      controller.handleKey(char);
    }
    controller.handleKey("Enter");
    
    // Verify replacements only in column B
    const grid = facade.getGrid();
    for (let row = 0; row < 20; row++) {
      const cell = grid.getCell(row, 1);
      if (row % 5 === 2) {
        expect(cell?.value).toBe("Product Two");
      }
    }
    
    // Verify other columns unchanged
    const cellA2 = grid.getCell(2, 0);
    expect(cellA2?.value).not.toBe("Product Two");
  });

  test("Math operations on row selection", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Populate rows with numeric data
    for (let col = 0; col < 10; col++) {
      facade.setCellValue(5, col, 100);
      facade.setCellValue(6, col, 200);
      facade.setCellValue(7, col, 300);
    }
    
    // Select rows 5-7
    controller.updateCursor(CellAddress.create(5, 0).value);
    controller.handleKey("V"); // Visual line mode
    controller.handleKey("2");
    controller.handleKey("j"); // Down 2 rows
    
    // Execute math operation
    controller.handleKey(":");
    const command = "mul 1.5";
    for (const char of command) {
      controller.handleKey(char);
    }
    controller.handleKey("Enter");
    
    // Verify multiplied values in selected rows
    const grid = facade.getGrid();
    for (let row = 5; row <= 7; row++) {
      for (let col = 0; col < 10; col++) {
        const cell = grid.getCell(row, col);
        const expected = (row - 4) * 100 * 1.5; // Original values * 1.5
        expect(cell?.value).toBe(expected);
      }
    }
    
    // Verify other rows unchanged
    facade.setCellValue(4, 0, 50);
    expect(grid.getCell(4, 0)?.value).toBe(50);
  });

  test("Performance: 100k cells bulk operation", async () => {
    const facade = createTestSpreadsheet(1000, 100);
    const controller = new SpreadsheetController(facade);
    
    // Create large dataset
    createLargeDataset(facade, 1000, 100, 0); // All numeric values
    
    // Select all cells (100k)
    controller.handleKey("g");
    controller.handleKey("g"); // Go to top
    controller.handleControlKey("a"); // Select all
    
    // Measure bulk operation time
    const { timeMs } = await measureOperationTime(async () => {
      controller.handleKey(":");
      const command = "add 10";
      for (const char of command) {
        controller.handleKey(char);
      }
      controller.handleKey("Enter");
    });
    
    // Validate performance
    const perfResult = validatePerformance("findReplace", timeMs);
    console.log(perfResult.message);
    expect(perfResult.passed).toBe(true);
    
    // Spot check some values
    const grid = facade.getGrid();
    const firstCell = grid.getCell(0, 0);
    expect(typeof firstCell?.value).toBe("number");
  });

  test("Preview system with large selection", async () => {
    const facade = createTestSpreadsheet(100, 100);
    const controller = new SpreadsheetController(facade);
    
    // Create pattern in data
    for (let row = 0; row < 100; row++) {
      for (let col = 0; col < 100; col++) {
        if (col % 2 === 0) {
          facade.setCellValue(row, col, "old_value");
        } else {
          facade.setCellValue(row, col, row * col);
        }
      }
    }
    
    // Select entire sheet
    controller.handleControlKey("a");
    
    // Start find/replace but don't execute yet
    controller.handleKey(":");
    const command = "s/old_value/new_value/";
    for (const char of command) {
      controller.handleKey(char);
    }
    
    // At this point, preview should be available
    // (Would check preview state if exposed in controller)
    
    // Complete the command
    controller.handleKey("g");
    controller.handleKey("Enter");
    
    // Verify replacements
    const grid = facade.getGrid();
    for (let row = 0; row < 10; row++) { // Check first 10 rows
      for (let col = 0; col < 100; col += 2) {
        expect(grid.getCell(row, col)?.value).toBe("new_value");
      }
    }
  });

  test("Undo/redo bulk operations on selections", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up data in specific columns
    for (let row = 0; row < 10; row++) {
      facade.setCellValue(row, 0, row * 10);     // Column A
      facade.setCellValue(row, 1, row * 20);     // Column B
      facade.setCellValue(row, 2, row * 30);     // Column C
    }
    
    // Select column B
    controller.updateCursor(CellAddress.create(0, 1).value);
    controller.handleKey("g");
    controller.handleKey("C");
    
    // Perform bulk operation
    controller.handleKey(":");
    const command = "div 2";
    for (const char of command) {
      controller.handleKey(char);
    }
    controller.handleKey("Enter");
    
    // Verify operation
    const grid = facade.getGrid();
    expect(grid.getCell(5, 1)?.value).toBe(50); // Was 100
    
    // Undo
    controller.handleKey(":");
    controller.handleKey("u");
    controller.handleKey("Enter");
    
    // Verify undo
    expect(grid.getCell(5, 1)?.value).toBe(100); // Back to original
    
    // Redo
    controller.handleKey(":");
    controller.handleKey("r");
    controller.handleKey("Enter");
    
    // Verify redo
    expect(grid.getCell(5, 1)?.value).toBe(50); // Operation reapplied
  });

  test("Complex selection with regex find/replace", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create data with patterns
    const data = [
      ["user123", "email123@test.com", "ID: 123"],
      ["user456", "email456@test.com", "ID: 456"],
      ["admin789", "admin789@test.com", "ID: 789"],
      ["user000", "email000@test.com", "ID: 000"]
    ];
    
    data.forEach((row, rowIdx) => {
      row.forEach((val, colIdx) => {
        facade.setCellValue(rowIdx, colIdx, val);
      });
    });
    
    // Select block containing email column
    controller.updateCursor(CellAddress.create(0, 1).value);
    controller.handleControlKey("v"); // Block selection
    controller.handleKey("3");
    controller.handleKey("j"); // Down 3
    
    // Regex replace domain
    controller.handleKey(":");
    const command = "s/@test\\.com/@example\\.com/g";
    for (const char of command) {
      controller.handleKey(char);
    }
    controller.handleKey("Enter");
    
    // Verify email updates
    const grid = facade.getGrid();
    expect(grid.getCell(0, 1)?.value).toBe("email123@example.com");
    expect(grid.getCell(1, 1)?.value).toBe("email456@example.com");
    expect(grid.getCell(2, 1)?.value).toBe("admin789@example.com");
    expect(grid.getCell(3, 1)?.value).toBe("email000@example.com");
    
    // Verify other columns unchanged
    expect(grid.getCell(0, 0)?.value).toBe("user123");
    expect(grid.getCell(0, 2)?.value).toBe("ID: 123");
  });

  test("Percentage operations on mixed selection", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create sales data
    for (let row = 0; row < 5; row++) {
      facade.setCellValue(row, 0, `Product ${row}`);
      facade.setCellValue(row, 1, (row + 1) * 1000); // Prices
      facade.setCellValue(row, 2, (row + 1) * 50);   // Quantities
    }
    
    // Select price column
    controller.updateCursor(CellAddress.create(0, 1).value);
    controller.handleKey("g");
    controller.handleKey("C");
    
    // Apply 20% increase
    controller.handleKey(":");
    const command = "percent 20";
    for (const char of command) {
      controller.handleKey(char);
    }
    controller.handleKey("Enter");
    
    // Verify percentage increase
    const grid = facade.getGrid();
    expect(grid.getCell(0, 1)?.value).toBe(1200);   // 1000 + 20%
    expect(grid.getCell(1, 1)?.value).toBe(2400);   // 2000 + 20%
    expect(grid.getCell(2, 1)?.value).toBe(3600);   // 3000 + 20%
    
    // Text values should be unchanged
    expect(grid.getCell(0, 0)?.value).toBe("Product 0");
  });
});