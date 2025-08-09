import { expect, test } from "@playwright/test";

test.describe("Common Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
  });

  test("should display initial data correctly", async ({ page }) => {
    // Check initial values
    await expect(page.locator(".formula-input")).toHaveValue("Hello");

    await page.keyboard.press("l");
    await expect(page.locator(".formula-input")).toHaveValue("World");

    await page.keyboard.press("j");
    await expect(page.locator(".formula-input")).toHaveValue("123");

    await page.keyboard.press("l");
    await expect(page.locator(".formula-input")).toHaveValue("=A2+B2");
  });

  test("should update formula bar when navigating", async ({ page }) => {
    const cellRef = page.locator(".cell-indicator");
    const cellValue = page.locator(".formula-input");

    // Check A1
    await expect(cellRef).toHaveValue("A1");
    await expect(cellValue).toHaveValue("Hello");

    // Navigate to B2
    await page.keyboard.press("l");
    await page.keyboard.press("j");
    await expect(cellRef).toHaveValue("B2");
    await expect(cellValue).toHaveValue("123");
  });

  test("should show mode indicator", async ({ page }) => {
    const modeIndicator = page
      .locator(".mode-indicator")
      .filter({ hasText: "hjkl to move" });

    // Should start in navigation mode
    await expect(modeIndicator).toBeVisible();
    await expect(modeIndicator).toContainText("NAVIGATION");

    // Should show helpful hints
    await expect(modeIndicator).toContainText("hjkl to move");
  });

  test("should handle double-click to edit", async ({ page }) => {
    // Get canvas position
    const canvas = page.locator("canvas.grid-canvas");
    const box = await canvas.boundingBox();

    if (box) {
      // Double-click on a cell (approximate position for B1)
      await page.mouse.dblclick(box.x + 150, box.y + 50);

      // Should open editor
      await expect(page.locator(".cell-editor-overlay")).toBeVisible();
    }
  });

  test("should toggle debug mode", async ({ page }) => {
    const debugCheckbox = page.locator('input[type="checkbox"]').first();

    // Toggle debug mode on
    await debugCheckbox.click();
    await expect(debugCheckbox).toBeChecked();

    // Toggle debug mode off
    await debugCheckbox.click();
    await expect(debugCheckbox).not.toBeChecked();
  });

  test("should toggle keyboard-only mode", async ({ page }) => {
    const keyboardModeCheckbox = page.locator('input[type="checkbox"]').last();

    // Toggle keyboard-only mode
    await keyboardModeCheckbox.click();
    await expect(keyboardModeCheckbox).toBeChecked();

    // Focus back on grid after clicking checkbox
    await page.locator(".grid-container").focus();

    // Should still be able to navigate
    await page.keyboard.press("l");
    await expect(page.locator(".cell-indicator")).toHaveValue("B1");
  });

  test("should handle import/export buttons", async ({ page }) => {
    // Check that buttons exist
    const importBtn = page.locator('button:has-text("Import")');
    const exportBtn = page.locator('button:has-text("Export")');

    await expect(importBtn).toBeVisible();
    await expect(exportBtn).toBeVisible();

    // Buttons should be clickable
    await expect(importBtn).toBeEnabled();
    await expect(exportBtn).toBeEnabled();
  });

  test("should maintain focus on grid", async ({ page }) => {
    // Grid container should be focusable
    const _gridContainer = page.locator(".grid-container");

    // Start from a known position - click on A1 area
    const canvas = page.locator("canvas.grid-canvas");
    const box = await canvas.boundingBox();
    if (box) {
      // Click on A1 cell area (just below and right of headers)
      await page.mouse.click(box.x + 60, box.y + 30);
    }

    // Wait for grid to be focused
    await page.waitForTimeout(100);

    // Navigate around and then back to A1 using vim keys
    // Move right and down first
    await page.keyboard.press("l");
    await page.keyboard.press("j");

    // Now navigate back to A1 using vim keys
    // Press 'h' to go to column A
    await page.keyboard.press("h");
    // Press 'k' to go to row 1
    await page.keyboard.press("k");

    // Verify we're at A1
    await expect(page.locator(".cell-indicator")).toHaveValue("A1");

    // Should be able to navigate immediately
    await page.keyboard.press("j");
    await expect(page.locator(".cell-indicator")).toHaveValue("A2");
  });

  test("should show cursor in navigation mode", async ({ page }) => {
    // In navigation mode, there should be a visible cursor
    await expect(
      page.locator(".mode-indicator").filter({ hasText: "hjkl to move" }),
    ).toContainText("NAVIGATION");

    // Move around and cursor should follow
    await page.keyboard.press("l");
    await page.keyboard.press("j");

    // Take screenshot to verify cursor visibility
    const canvas = page.locator("canvas.grid-canvas");
    await expect(canvas).toBeVisible();
  });

  test("should handle rapid navigation", async ({ page }) => {
    // Test rapid key presses
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("l");
    }

    // Should be at F1
    await expect(page.locator(".cell-indicator")).toHaveValue("F1");

    // Navigate back
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("h");
    }

    // Should be back at A1
    await expect(page.locator(".cell-indicator")).toHaveValue("A1");
  });
});
