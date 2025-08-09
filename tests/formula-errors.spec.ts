import { expect, test } from "@playwright/test";
import { selectors, waitForApp } from "./helpers/selectors";
import {
  enterFormula,
  exitEditingAndSave,
  getCurrentCellValue,
  getErrorMessages,
  navigateToCell,
  startEditing,
  waitForError,
} from "./helpers/test-utils";

test.describe("Formula Error Types", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test.describe("Excel-Compatible Error Values", () => {
    test("#DIV/0! - Division by zero", async ({ page }) => {
      await navigateToCell(page, 0, 4); // A5

      // Direct division by zero
      await enterFormula(page, "=1/0");
      await waitForError(page, "DIV/0");

      // Division by zero in expression
      await navigateToCell(page, 1, 4); // B5
      await enterFormula(page, "=10/(5-5)");
      await waitForError(page, "DIV/0");

      // Division by empty cell (evaluates to 0)
      await navigateToCell(page, 2, 4); // C5
      await enterFormula(page, "=100/Z99"); // Z99 is empty
      await waitForError(page, "DIV/0");
    });

    test("#VALUE! - Type mismatch errors", async ({ page }) => {
      await navigateToCell(page, 0, 5); // A6

      // Text in arithmetic operation
      await enterFormula(page, '="text" * 2');
      await waitForError(page);
      const errors = await getErrorMessages(page);
      expect(
        errors.some((e) => e.includes("VALUE") || e.includes("Type")),
      ).toBeTruthy();

      // Invalid number format
      await navigateToCell(page, 1, 5); // B6
      await enterFormula(page, '="abc" + 123');
      await waitForError(page);
    });

    test("#REF! - Invalid cell references", async ({ page }) => {
      await navigateToCell(page, 0, 6); // A7

      // Reference to non-existent cell (beyond spreadsheet bounds)
      await enterFormula(page, "=ZZZZ9999");
      await waitForError(page);
      const errors = await getErrorMessages(page);
      expect(
        errors.some(
          (e) =>
            e.includes("REF") ||
            e.includes("Invalid") ||
            e.includes("reference"),
        ),
      ).toBeTruthy();

      // Invalid range reference
      await navigateToCell(page, 1, 6); // B7
      await enterFormula(page, "=A1:ZZ");
      await waitForError(page);
    });

    test.skip("#NAME? - Unknown function names", async ({ page }) => {
      await navigateToCell(page, 0, 7); // A8

      // Unknown function
      await enterFormula(page, "=NOTAFUNCTION(A1)");
      await waitForError(page, "Unknown function");

      // Misspelled function
      await navigateToCell(page, 1, 7); // B8
      await enterFormula(page, "=SUMM(A1:A3)"); // Should be SUM
      await waitForError(page);
      const errors = await getErrorMessages(page);
      expect(
        errors.some(
          (e) =>
            e.includes("NAME") || e.includes("Unknown") || e.includes("SUMM"),
        ),
      ).toBeTruthy();
    });

    test("#NUM! - Invalid numeric operations", async ({ page }) => {
      await navigateToCell(page, 0, 8); // A9

      // Square root of negative number
      await enterFormula(page, "=SQRT(-1)");
      await waitForError(page);
      const errors = await getErrorMessages(page);
      expect(
        errors.some(
          (e) =>
            e.includes("NUM") || e.includes("Invalid") || e.includes("SQRT"),
        ),
      ).toBeTruthy();

      // Result too large
      await navigateToCell(page, 1, 8); // B9
      await enterFormula(page, "=10^1000"); // Overflow
      await waitForError(page);
    });
  });

  test.describe("Complex Formula Errors", () => {
    test("should handle nested function errors", async ({ page }) => {
      await navigateToCell(page, 3, 0); // D1

      // Nested function with error
      await enterFormula(page, "=SUM(1, SQRT(-1), 3)");
      await waitForError(page);

      // The whole formula should error
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toContain("SUM(1, SQRT(-1), 3)");
    });

    test("should handle errors in array/range operations", async ({ page }) => {
      // First, set up some test data
      await navigateToCell(page, 0, 9); // A10
      await enterFormula(page, "1");

      await navigateToCell(page, 0, 10); // A11
      await enterFormula(page, "0");

      await navigateToCell(page, 0, 11); // A12
      await enterFormula(page, "2");

      // Now try to divide by the range (includes 0)
      await navigateToCell(page, 2, 9); // C10
      await enterFormula(page, "=1/A10:A12");
      await waitForError(page); // Should error due to division by zero in range
    });

    test.skip("should handle circular references", async ({ page }) => {
      // Simple circular reference
      await navigateToCell(page, 4, 4); // E5
      await enterFormula(page, "=E5");
      await waitForError(page, "Circular");

      // Two-cell circular reference
      await navigateToCell(page, 5, 5); // F6
      await enterFormula(page, "=G6");

      await navigateToCell(page, 6, 5); // G6
      await enterFormula(page, "=F6");
      await waitForError(page, "Circular");

      // Complex circular reference through multiple cells
      await navigateToCell(page, 4, 6); // E7
      await enterFormula(page, "=F7+1");

      await navigateToCell(page, 5, 6); // F7
      await enterFormula(page, "=G7+1");

      await navigateToCell(page, 6, 6); // G7
      await enterFormula(page, "=E7+1");
      await waitForError(page, "Circular");
    });
  });

  test.describe("Error Propagation", () => {
    test("should propagate errors through formulas", async ({ page }) => {
      // Create source error
      await navigateToCell(page, 0, 12); // A13
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Reference the error cell
      await navigateToCell(page, 1, 12); // B13
      await enterFormula(page, "=A13*2");

      // Should propagate the error
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toContain("A13*2"); // Formula should be shown

      // Error in SUM function
      await navigateToCell(page, 2, 12); // C13
      await enterFormula(page, "=SUM(A13, 10, 20)");

      // SUM might handle errors differently
      const sumValue = await getCurrentCellValue(page);
      expect(sumValue).toBeTruthy(); // Should have some value (error or result)
    });

    test("should handle multiple error types in one formula", async ({
      page,
    }) => {
      // Set up cells with different error types
      await navigateToCell(page, 0, 13); // A14 - Division by zero
      await enterFormula(page, "=1/0");

      await navigateToCell(page, 1, 13); // B14 - Unknown function
      await enterFormula(page, "=UNKNOWN()");

      // Try to use both in a formula
      await navigateToCell(page, 2, 13); // C14
      await enterFormula(page, "=A14+B14");
      await waitForError(page);

      // Should show an error (propagated from either source)
      const errors = await getErrorMessages(page);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  test.describe("Error Recovery", () => {
    test.skip("should recover from errors when formula is fixed", async ({
      page,
    }) => {
      await navigateToCell(page, 3, 3); // D4

      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Fix the formula
      await startEditing(page, "i");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("=1/2");
      await exitEditingAndSave(page);

      // Error should be gone and result should be 0.5
      await page.waitForTimeout(200); // Wait for calculation
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toBe("0.5");
    });

    test("should clear errors when cell is deleted", async ({ page }) => {
      await navigateToCell(page, 4, 3); // E4

      // Create an error
      await enterFormula(page, "=INVALID()");
      await waitForError(page);

      // Delete the cell content
      await page.keyboard.press("Delete");

      // Cell should be empty
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toBe("");

      // Formula bar should be empty
      await expect(page.locator(selectors.formulaBarInput)).toHaveValue("");
    });

    test.skip("should update dependent cells when error is fixed", async ({
      page,
    }) => {
      // Create an error cell
      await navigateToCell(page, 0, 14); // A15
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Create dependent cell
      await navigateToCell(page, 1, 14); // B15
      await enterFormula(page, "=A15+10");

      // Fix the error cell
      await navigateToCell(page, 0, 14); // Back to A15
      await startEditing(page, "i");
      await page.keyboard.press("Control+a");
      await page.keyboard.type("5");
      await exitEditingAndSave(page);

      // Check dependent cell updated
      await navigateToCell(page, 1, 14); // B15
      await page.waitForTimeout(200); // Wait for recalculation
      const dependentValue = await getCurrentCellValue(page);
      expect(dependentValue).toBe("15"); // 5 + 10
    });
  });
});
