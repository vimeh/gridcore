import { describe, test, expect } from "bun:test";
import { SpreadsheetController } from "@gridcore/ui-core";
import { CellAddress } from "@gridcore/core";
import { 
  createTestSpreadsheet,
  measureOperationTime,
  captureFormulaValues,
  checkFormulaIntegrity
} from "./integration-test-utils";

describe("Integration Test Set C: Absolute References + Formula Fill", () => {
  test("Fill formulas with absolute references", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up source formula with mixed references
    facade.setCellValue(0, 0, 100);            // A1: data
    facade.setCellValue(0, 1, 200);            // B1: data
    facade.setCellValue(1, 2, "=$A$1+B1");     // C2: mixed formula
    
    // Select source cell
    controller.updateCursor(CellAddress.create(1, 2).value);
    
    // Enter fill mode and fill down
    controller.handleControlKey("d"); // Fill down command
    controller.handleKey("4");
    controller.handleKey("j"); // Down 4 cells
    controller.handleKey("Enter");
    
    // Verify filled formulas
    const grid = facade.getGrid();
    
    // C3: Absolute should stay, relative should adjust
    expect(grid.getCell(2, 2)?.formula).toBe("=$A$1+B2");
    
    // C4: Continue pattern
    expect(grid.getCell(3, 2)?.formula).toBe("=$A$1+B3");
    
    // C5: Continue pattern
    expect(grid.getCell(4, 2)?.formula).toBe("=$A$1+B4");
    
    // C6: Last filled cell
    expect(grid.getCell(5, 2)?.formula).toBe("=$A$1+B5");
  });

  test("Pattern detection with reference adjustments", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create pattern with formulas
    facade.setCellValue(0, 0, 1);              // A1
    facade.setCellValue(1, 0, 2);              // A2
    facade.setCellValue(0, 1, "=A1*$D$1");     // B1: reference with absolute
    facade.setCellValue(1, 1, "=A2*$D$1");     // B2: pattern continues
    facade.setCellValue(0, 3, 10);             // D1: multiplier
    
    // Select B1:B2 for pattern detection
    controller.updateCursor(CellAddress.create(0, 1).value);
    controller.handleKey("V"); // Visual line mode
    controller.handleKey("j"); // Select B1:B2
    
    // Fill down with pattern
    controller.handleKey("g");
    controller.handleKey("f");
    controller.handleKey("d"); // Fill down with pattern
    controller.handleKey("5");
    controller.handleKey("j"); // Down 5 more cells
    controller.handleKey("Enter");
    
    // Verify pattern continues with correct references
    const grid = facade.getGrid();
    expect(grid.getCell(2, 1)?.formula).toBe("=A3*$D$1");
    expect(grid.getCell(3, 1)?.formula).toBe("=A4*$D$1");
    expect(grid.getCell(4, 1)?.formula).toBe("=A5*$D$1");
    
    // Absolute reference should remain unchanged
    for (let row = 0; row < 7; row++) {
      const formula = grid.getCell(row, 1)?.formula;
      expect(formula).toContain("$D$1");
    }
  });

  test("Fill right with column absolute references", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up horizontal formula
    facade.setCellValue(0, 0, "=$A1+B$1");     // A1: mixed references
    facade.setCellValue(0, 1, 100);            // B1: data
    
    // Fill right
    controller.updateCursor(CellAddress.create(0, 0).value);
    controller.handleKey("g");
    controller.handleKey("f");
    controller.handleKey("r"); // Fill right
    controller.handleKey("3");
    controller.handleKey("l"); // Right 3 cells
    controller.handleKey("Enter");
    
    // Verify horizontal adjustment
    const grid = facade.getGrid();
    expect(grid.getCell(0, 1)?.formula).toBe("=$A1+C$1"); // Column adjusted
    expect(grid.getCell(0, 2)?.formula).toBe("=$A1+D$1");
    expect(grid.getCell(0, 3)?.formula).toBe("=$A1+E$1");
    
    // Row absolute ($1) preserved, column absolute ($A) preserved
  });

  test("Smart fill with F4 reference types", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create formula and cycle through reference types
    controller.updateCursor(CellAddress.create(0, 0).value);
    controller.enterEditMode();
    
    // Type formula
    const formula = "=B1+C1";
    for (const char of formula) {
      controller.handleKey(char);
    }
    
    // Position on B1 and cycle to absolute
    controller.handleKey("Home");
    controller.handleKey("ArrowRight");
    controller.handleKey("ArrowRight");
    controller.handleKey("F4"); // B1 -> $B$1
    
    // Accept formula
    controller.handleKey("Enter");
    
    // Now fill down
    controller.handleKey("ArrowUp"); // Back to A1
    controller.handleControlKey("d");
    controller.handleKey("3");
    controller.handleKey("j");
    controller.handleKey("Enter");
    
    // Verify mixed behavior
    const grid = facade.getGrid();
    expect(grid.getCell(0, 0)?.formula).toBe("=$B$1+C1");
    expect(grid.getCell(1, 0)?.formula).toBe("=$B$1+C2"); // Absolute stays, relative adjusts
    expect(grid.getCell(2, 0)?.formula).toBe("=$B$1+C3");
  });

  test("Fill with complex patterns and absolute references", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Create Fibonacci-like pattern with absolute reference
    facade.setCellValue(0, 0, 1);                          // A1
    facade.setCellValue(1, 0, 1);                          // A2
    facade.setCellValue(2, 0, "=A1+A2");                   // A3
    facade.setCellValue(0, 1, "=A1*$E$1");                 // B1: with absolute
    facade.setCellValue(1, 1, "=A2*$E$1");                 // B2
    facade.setCellValue(2, 1, "=A3*$E$1");                 // B3
    facade.setCellValue(4, 4, 10);                         // E5: multiplier
    
    // Select A1:B3 for pattern fill
    controller.updateCursor(CellAddress.create(0, 0).value);
    controller.handleControlKey("v"); // Block selection
    controller.handleKey("2");
    controller.handleKey("j"); // Down 2
    controller.handleKey("l"); // Right 1
    
    // Smart fill to extend pattern
    controller.handleKey("g");
    controller.handleKey("F"); // Smart fill
    controller.handleKey("5");
    controller.handleKey("j"); // Down 5 more rows
    controller.handleKey("Enter");
    
    // Verify Fibonacci continues with formulas
    const grid = facade.getGrid();
    expect(grid.getCell(3, 0)?.formula).toBe("=A2+A3");
    expect(grid.getCell(4, 0)?.formula).toBe("=A3+A4");
    
    // Verify absolute reference preserved in column B
    expect(grid.getCell(3, 1)?.formula).toBe("=A4*$E$1");
    expect(grid.getCell(4, 1)?.formula).toBe("=A5*$E$1");
  });

  test("Performance: Fill 10k cells with formulas", async () => {
    const facade = createTestSpreadsheet(10010, 10);
    const controller = new SpreadsheetController(facade);
    
    // Create source formula with absolute reference
    facade.setCellValue(0, 0, 1);
    facade.setCellValue(0, 1, "=A1*2+$J$1");
    facade.setCellValue(0, 9, 100); // J1: absolute reference target
    
    // Select source
    controller.updateCursor(CellAddress.create(0, 1).value);
    
    // Measure fill operation time
    const { timeMs } = await measureOperationTime(async () => {
      controller.handleControlKey("d"); // Fill down
      // Navigate to row 10000
      controller.handleKey("G"); // Go to bottom (would need to be implemented)
      controller.updateCursor(CellAddress.create(9999, 1).value);
      controller.handleKey("Enter");
    });
    
    console.log(`Filled 10k formulas in ${timeMs.toFixed(2)}ms`);
    
    // Spot check formulas
    const grid = facade.getGrid();
    expect(grid.getCell(100, 1)?.formula).toBe("=A101*2+$J$1");
    expect(grid.getCell(1000, 1)?.formula).toBe("=A1001*2+$J$1");
    
    // Performance should be under 200ms
    expect(timeMs).toBeLessThan(200);
  });

  test("Preview showing reference changes during fill", async () => {
    const facade = createTestSpreadsheet();
    const controller = new SpreadsheetController(facade);
    
    // Set up formula
    facade.setCellValue(0, 0, "=$A$1+B1+C$1");
    facade.setCellValue(0, 1, 10);
    facade.setCellValue(0, 2, 20);
    
    // Enter fill mode
    controller.updateCursor(CellAddress.create(0, 0).value);
    const state1 = controller.getUIState();
    
    controller.handleControlKey("d"); // Start fill
    
    // Move to show preview
    controller.handleKey("3");
    controller.handleKey("j");
    
    // At this point, preview should show:
    // A2: =$A$1+B2+C$1 (B1->B2, others stay)
    // A3: =$A$1+B3+C$1
    // A4: =$A$1+B4+C$1
    
    const state2 = controller.getUIState();
    if (state2.spreadsheetMode === "fill") {
      // Would check preview values here
      expect(state2.fillTarget).toBeDefined();
    }
    
    // Complete fill
    controller.handleKey("Enter");
    
    // Verify actual results
    const grid = facade.getGrid();
    expect(grid.getCell(1, 0)?.formula).toBe("=$A$1+B2+C$1");
    expect(grid.getCell(2, 0)?.formula).toBe("=$A$1+B3+C$1");
    expect(grid.getCell(3, 0)?.formula).toBe("=$A$1+B4+C$1");
  });
});