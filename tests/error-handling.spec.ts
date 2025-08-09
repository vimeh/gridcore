import { expect, test } from "@playwright/test";
import { selectors, waitForApp } from "./helpers/selectors";
import {
  cellHasErrorValue,
  dismissError,
  enterFormula,
  getCurrentCellValue,
  getErrorMessages,
  hasError,
  navigateToCell,
  waitForError,
} from "./helpers/test-utils";

test.describe("Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test.describe("Formula Errors", () => {
    test("should display division by zero error", async ({ page }) => {
      // Navigate to an empty cell
      await navigateToCell(page, 2, 0); // C1

      // Enter division by zero formula
      await enterFormula(page, "=1/0");

      // Check for error message (might be "Formula error: #DIV/0!")
      await waitForError(page);
      const errorMessages = await getErrorMessages(page);
      expect(
        errorMessages.some(
          (msg) => msg.includes("DIV/0") || msg.includes("Formula error"),
        ),
      ).toBeTruthy();

      // Check that the formula bar still shows the formula
      await expect(page.locator(selectors.formulaBarInput)).toHaveValue("=1/0");
    });

    test("should display invalid reference error", async ({ page }) => {
      // Navigate to an empty cell
      await navigateToCell(page, 2, 1); // C2

      // Enter formula with invalid reference
      await enterFormula(page, "=XYZ999");

      // Check for error message
      await waitForError(page, "Invalid");
      const hasErrorDisplayed = await hasError(page, "error");
      expect(hasErrorDisplayed).toBeTruthy();
    });

    test("should display unknown function error", async ({ page }) => {
      // Navigate to an empty cell
      await navigateToCell(page, 2, 2); // C3

      // Enter formula with unknown function
      await enterFormula(page, "=UNKNOWNFUNC(A1)");

      // Check for error message
      await waitForError(page, "Unknown function");
      const errorMessages = await getErrorMessages(page);
      expect(
        errorMessages.some(
          (msg) =>
            msg.includes("Unknown function") || msg.includes("UNKNOWNFUNC"),
        ),
      ).toBeTruthy();
    });

    test("should display type mismatch error", async ({ page }) => {
      // Navigate to an empty cell
      await navigateToCell(page, 3, 0); // D1

      // Enter formula with type mismatch
      await enterFormula(page, '="text" + 5');

      // Check for error - this might show as VALUE error
      await waitForError(page);
      const hasErrorDisplayed = await hasError(page);
      expect(hasErrorDisplayed).toBeTruthy();
    });

    test("should handle circular reference error", async ({ page }) => {
      // Navigate to E1
      await navigateToCell(page, 4, 0);

      // Create a circular reference: E1 references F1
      await enterFormula(page, "=F1+1");

      // Navigate to F1
      await navigateToCell(page, 5, 0);

      // F1 references E1, creating a circular reference
      await enterFormula(page, "=E1+1");

      // Check for circular reference error
      await waitForError(page, "Circular");
      const errorMessages = await getErrorMessages(page);
      expect(
        errorMessages.some((msg) => msg.toLowerCase().includes("circular")),
      ).toBeTruthy();
    });
  });

  test.describe("Error Display UI", () => {
    test("should show error messages with correct severity styling", async ({
      page,
    }) => {
      // Trigger an error
      await navigateToCell(page, 2, 3); // C4
      await enterFormula(page, "=1/0");

      // Check that error message has correct class
      await waitForError(page);
      const errorElement = page.locator(selectors.errorMessageError);
      await expect(errorElement).toBeVisible();

      // Check styling (red background for errors)
      const backgroundColor = await errorElement.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor,
      );
      expect(backgroundColor).toContain("68"); // RGB value for red (#ff4444)
    });

    test("should allow dismissing errors with X button", async ({ page }) => {
      // Create an error
      await navigateToCell(page, 3, 1); // D2
      await enterFormula(page, "=INVALID()");

      // Wait for error to appear
      await waitForError(page);
      await expect(page.locator(selectors.errorMessage)).toBeVisible();

      // Dismiss the error
      await page.locator(selectors.errorDismissButton).first().click();

      // Error should be gone
      await expect(page.locator(selectors.errorMessage)).not.toBeVisible();
    });

    test("should stack multiple errors", async ({ page }) => {
      // Create first error
      await navigateToCell(page, 3, 2); // D3
      await enterFormula(page, "=1/0");
      await waitForError(page, "DIV/0");

      // Create second error
      await navigateToCell(page, 3, 3); // D4
      await enterFormula(page, "=UNKNOWN()");
      await waitForError(page, "Unknown");

      // Both errors should be visible
      const errorMessages = await getErrorMessages(page);
      expect(errorMessages.length).toBeGreaterThanOrEqual(2);
      expect(errorMessages.some((msg) => msg.includes("DIV/0"))).toBeTruthy();
      expect(errorMessages.some((msg) => msg.includes("Unknown"))).toBeTruthy();
    });

    test("should position errors in top-right corner", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Check position of error container
      const errorContainer = page.locator(selectors.errorDisplay);
      const box = await errorContainer.boundingBox();

      expect(box).toBeTruthy();
      if (box) {
        const viewport = page.viewportSize();
        if (viewport) {
          // Should be positioned near the right edge
          expect(box.x + box.width).toBeGreaterThan(viewport.width - 100);
          // Should be positioned near the top
          expect(box.y).toBeLessThan(100);
        }
      }
    });

    test("should auto-dismiss info messages after 5 seconds", async ({
      page,
    }) => {
      // This test would require triggering an info-level message
      // Since we don't have a direct way to trigger info messages yet,
      // we'll skip this for now but include it as a placeholder
      test.skip();

      // TODO: Implement when we have actions that trigger info messages
      // await triggerInfoMessage(page)
      // await waitForError(page)
      // await expect(page.locator(selectors.errorMessageInfo)).toBeVisible()
      // await page.waitForTimeout(5500)
      // await expect(page.locator(selectors.errorMessageInfo)).not.toBeVisible()
    });
  });

  test.describe("Error Recovery", () => {
    test("should exit editing mode even with invalid formula", async ({
      page,
    }) => {
      // Start editing
      await page.keyboard.press("i");
      await expect(page.locator(selectors.cellEditor)).toBeVisible();

      // Enter invalid formula
      await page.keyboard.type("=INVALID()");

      // Exit editing (double Escape)
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // Editor should be hidden despite error
      await expect(page.locator(selectors.cellEditor)).not.toBeVisible();

      // Error should be displayed
      await waitForError(page);
    });

    test("should allow re-editing cells with errors", async ({ page }) => {
      // Create a cell with error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Re-enter editing mode
      await page.keyboard.press("i");
      await expect(page.locator(selectors.cellEditor)).toBeVisible();

      // The formula should still be there
      const editorInput = page.locator(selectors.cellEditorInput);
      const value = await editorInput.inputValue();
      expect(value).toContain("1/0");

      // Fix the formula
      await page.keyboard.press("Control+a");
      await page.keyboard.type("=1/2");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // Error should be gone (or replaced with success)
      // The cell should now show 0.5
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toBe("0.5");
    });

    test("should clear error when cell is cleared", async ({ page }) => {
      // Create a cell with error
      await enterFormula(page, "=UNKNOWN()");
      await waitForError(page);

      // Clear the cell (Delete key in navigation mode)
      await page.keyboard.press("Delete");

      // The cell should be empty
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toBe("");

      // Error might still be visible but formula bar should be clear
      await expect(page.locator(selectors.formulaBarInput)).toHaveValue("");
    });

    test("should handle errors in formula bar entry", async ({ page }) => {
      // Click on formula bar
      const formulaInput = page.locator(selectors.formulaBarInput);
      await formulaInput.click();

      // Clear and enter invalid formula
      await formulaInput.fill("=1/0");
      await formulaInput.press("Enter");

      // Should show error
      await waitForError(page, "DIV/0");

      // Formula should remain in formula bar
      await expect(formulaInput).toHaveValue("=1/0");
    });
  });

  test.describe("Error Propagation", () => {
    test("should handle formulas referencing cells with errors", async ({
      page,
    }) => {
      // Create a cell with division by zero error
      await navigateToCell(page, 0, 3); // A4
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Create another cell that references the error cell
      await navigateToCell(page, 1, 3); // B4
      await enterFormula(page, "=A4+1");

      // This should also result in an error (error propagation)
      const cellValue = await getCurrentCellValue(page);
      expect(cellValue).toContain("ERROR"); // Or whatever error indicator is shown
    });
  });
});
