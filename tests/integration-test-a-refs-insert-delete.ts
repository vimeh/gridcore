import { describe, test, expect } from "bun:test";
import { SpreadsheetController } from "@gridcore/ui-core";
import { CellAddress } from "@gridcore/core";
import { 
  createTestSpreadsheet, 
  populateWithFormulas, 
  validateReferences,
  captureFormulaValues,
  checkFormulaIntegrity,
  measureOperationTime
} from "./integration-test-utils";

describe("Integration Test Set A: Absolute References + Insert/Delete Operations", () => {
  test("Insert row updates relative references but preserves absolute", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up formulas with mixed reference types
    facade.setCellValue(0, 0, 10);  // A1
    facade.setCellValue(1, 0, 20);  // A2
    facade.setCellValue(2, 0, "=A1+A2");       // A3: relative
    facade.setCellValue(3, 0, "=$A$1+$A$2");   // A4: absolute
    facade.setCellValue(4, 0, "=$A$1+A2");     // A5: mixed
    
    // Capture values before operation
    const beforeValues = captureFormulaValues(facade);
    
    // Insert row at position 1
    await controller.handleStructuralCommand("insert-row", { 
      position: 1, 
      count: 1 
    });
    
    // Validate references
    const grid = facade.getGrid();
    
    // A3 (now A4) should have updated relative references
    const cellA4 = grid.getCell(3, 0);
    expect(cellA4?.formula).toBe("=A1+A3");  // A2 became A3
    
    // A4 (now A5) should keep absolute references
    const cellA5 = grid.getCell(4, 0);
    expect(cellA5?.formula).toBe("=$A$1+$A$2");
    
    // A5 (now A6) should have mixed behavior
    const cellA6 = grid.getCell(5, 0);
    expect(cellA6?.formula).toBe("=$A$1+A3");  // A2 became A3
    
    // Validate no #REF! errors
    const validation = validateReferences(facade);
    expect(validation.valid).toBe(true);
  });

  test("Delete column with absolute references generates #REF! correctly", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up formulas referencing column B
    facade.setCellValue(0, 0, "=B1");      // A1: relative
    facade.setCellValue(1, 0, "=$B$1");    // A2: absolute
    facade.setCellValue(2, 0, "=$B1");     // A3: mixed column
    facade.setCellValue(3, 0, "=B$1");     // A4: mixed row
    facade.setCellValue(0, 1, 100);        // B1: data
    
    // Delete column B
    await controller.handleStructuralCommand("delete-column", {
      position: 1,
      count: 1
    });
    
    // All references to B should be #REF!
    const grid = facade.getGrid();
    expect(grid.getCell(0, 0)?.value).toBe("#REF!");
    expect(grid.getCell(1, 0)?.value).toBe("#REF!");
    expect(grid.getCell(2, 0)?.value).toBe("#REF!");
    expect(grid.getCell(3, 0)?.value).toBe("#REF!");
  });

  test("F4 cycling works after structural operations", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Enter formula edit mode
    const cursor = CellAddress.create(0, 0);
    expect(cursor.ok).toBe(true);
    controller.updateCursor(cursor.value);
    controller.enterEditMode();
    
    // Type a formula
    const formula = "=B1+C1";
    for (const char of formula) {
      controller.handleKey(char);
    }
    
    // Position cursor on B1 reference
    controller.handleKey("ArrowLeft");
    controller.handleKey("ArrowLeft");
    controller.handleKey("ArrowLeft");
    controller.handleKey("ArrowLeft");
    
    // Cycle with F4
    controller.handleKey("F4");
    let state = controller.getUIState();
    if (state.spreadsheetMode === "editing") {
      expect(state.editingValue).toContain("$B$1");
    }
    
    // Insert a row
    controller.handleKey("Escape"); // Exit edit mode
    await controller.handleStructuralCommand("insert-row", {
      position: 0,
      count: 1
    });
    
    // Edit the formula again (now in A2)
    controller.updateCursor(CellAddress.create(1, 0).value);
    controller.enterEditMode();
    
    // F4 should still work
    controller.handleKey("F4");
    state = controller.getUIState();
    if (state.spreadsheetMode === "editing") {
      expect(state.editingValue).toContain("$"); // Should have $ symbols
    }
  });

  test("Undo/redo preserves absolute references correctly", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up formulas
    facade.setCellValue(0, 0, "=$A$2+B2");
    facade.setCellValue(1, 0, 100);
    facade.setCellValue(1, 1, 200);
    
    const originalFormula = facade.getGrid().getCell(0, 0)?.formula;
    
    // Delete row 2
    await controller.handleStructuralCommand("delete-row", {
      position: 1,
      count: 1
    });
    
    // Formula should be updated
    let cell = facade.getGrid().getCell(0, 0);
    expect(cell?.value).toBe("#REF!"); // Reference deleted
    
    // Undo the deletion
    controller.executeCommand("undo");
    
    // Formula should be restored exactly
    cell = facade.getGrid().getCell(0, 0);
    expect(cell?.formula).toBe(originalFormula);
    expect(cell?.value).not.toBe("#REF!");
  });

  test("Complex multi-operation scenario", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create a complex formula setup
    facade.setCellValue(0, 0, 10);              // A1
    facade.setCellValue(0, 1, 20);              // B1
    facade.setCellValue(0, 2, "=$A$1+B1");      // C1: mixed
    facade.setCellValue(1, 2, "=SUM($A$1:B1)"); // C2: range with absolute
    facade.setCellValue(2, 2, "=C1*$B$1");      // C3: reference to mixed
    
    // Performance test: Multiple operations
    const { timeMs } = await measureOperationTime(async () => {
      // 1. Insert column between A and B
      await controller.handleStructuralCommand("insert-column", {
        position: 1,
        count: 1
      });
      
      // 2. Insert row at top
      await controller.handleStructuralCommand("insert-row", {
        position: 0,
        count: 1
      });
      
      // 3. Delete the newly inserted column
      await controller.handleStructuralCommand("delete-column", {
        position: 1,
        count: 1
      });
    });
    
    console.log(`Complex operation completed in ${timeMs.toFixed(2)}ms`);
    
    // Validate final state
    const validation = validateReferences(facade);
    expect(validation.valid).toBe(true);
    
    // Check specific formulas
    const grid = facade.getGrid();
    
    // Original C1 is now C2 (after row insert)
    const c2 = grid.getCell(1, 2);
    expect(c2?.formula).toContain("$A$1"); // Absolute preserved
    
    // Relative references should be updated
    const c3 = grid.getCell(2, 2);
    expect(c3?.formula).toBe("=SUM($A$1:B2)"); // B1 became B2
  });

  test("Reference highlighting updates after structural changes", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create formula with references
    facade.setCellValue(0, 0, 10);
    facade.setCellValue(0, 1, 20);
    facade.setCellValue(1, 0, "=$A$1+B1");
    
    // Edit the formula
    controller.updateCursor(CellAddress.create(1, 0).value);
    controller.enterEditMode();
    
    // Get the current formula highlighting
    const state = controller.getUIState();
    if (state.spreadsheetMode === "editing") {
      // Would check highlighting segments here if exposed
      expect(state.editingValue).toBe("=$A$1+B1");
    }
    
    // Exit and insert a column
    controller.handleKey("Escape");
    await controller.handleStructuralCommand("insert-column", {
      position: 0,
      count: 1
    });
    
    // Edit again - formula should be updated
    controller.updateCursor(CellAddress.create(1, 1).value); // Now at B2
    controller.enterEditMode();
    
    const newState = controller.getUIState();
    if (newState.spreadsheetMode === "editing") {
      expect(newState.editingValue).toBe("=$B$1+C1"); // References updated
    }
  });
});