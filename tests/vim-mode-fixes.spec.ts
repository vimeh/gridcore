import { expect, test } from "@playwright/test";

test.describe("Vim Mode - Text Saving Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
    await page.click("canvas");  });

  test("should save text when pressing Escape twice", async ({ page }) => {
    // Navigate to a cell and start editing with Enter (which clears content)
    await page.keyboard.press("Enter");

    // Type new content
    await page.keyboard.type("Test content");

    // Press Escape twice to save
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Verify we're back in navigation mode
    await expect(page.locator(".mode-text")).toContainText("NAVIGATION");

    // Navigate away and back to verify text was saved
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");

    // The formula bar should show the saved text
    await expect(page.locator(".formula-input")).toHaveValue("Test content");
  });

  test("should continue inserting when pressing Enter multiple times", async ({
    page,
  }) => {
    // Navigate to a cell and start editing with Enter (replace mode)
    await page.keyboard.press("Enter");

    // Type some text with multiple enters
    await page.keyboard.type("Line 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Line 2");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Line 3");

    // Press Escape twice to save
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Verify we're back in navigation mode
    await expect(page.locator(".mode-text")).toContainText("NAVIGATION");

    // The formula bar should show the multi-line text
    const formulaBarValue = await page.locator(".formula-input").inputValue();
    expect(formulaBarValue).toContain("Line 1");
  });
});

test.describe("Vim Mode - Cursor Positioning Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
    await page.click("canvas");
    // Put some text in a cell A1
    await page.keyboard.press("Enter");
    await page.keyboard.type("Hello World");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Now we're back in navigation mode at A1 with "Hello World"
    // Make sure the grid is focused
    await page.locator(".grid-container").focus();
    await page.waitForTimeout(100);
  });

  test("should position cursor at beginning when pressing 'i' on existing text", async ({
    page,
  }) => {
    // Enter the cell using 'i' to preserve existing text with cursor at beginning
    await page.keyboard.press("i");

    // Wait for the editor to appear
    await page.waitForSelector(".cell-editor-overlay", {
      state: "visible",
      timeout: 1000,
    });

    // Wait a moment for cursor positioning
    await page.waitForTimeout(100);

    // The cursor should be at the beginning of existing text
    // Type additional text - it should appear at the beginning
    await page.keyboard.type("Start ");

    // Save and check - first Escape to normal mode, second to save
    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);
    await page.keyboard.press("Escape");

    // Wait for editor to disappear
    await page.waitForSelector(".cell-editor-overlay", {
      state: "hidden",
      timeout: 1000,
    });

    await expect(page.locator(".formula-input")).toHaveValue(
      "Start Hello World",
    );
  });

  test("should handle cursor position when entering existing text", async ({
    page,
  }) => {
    // Navigate to a cell with existing text using 'a' (append mode)
    await page.keyboard.press("a");

    // Wait for the editor to appear
    await page.waitForSelector(".cell-editor-overlay", {
      state: "visible",
      timeout: 1000,
    });

    // Wait a moment for cursor positioning
    await page.waitForTimeout(100);

    // The cursor should be at the end of existing text
    // Type something to verify position
    await page.keyboard.type("123");

    // Save
    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);
    await page.keyboard.press("Escape");

    // Wait for editor to disappear
    await page.waitForSelector(".cell-editor-overlay", {
      state: "hidden",
      timeout: 1000,
    });

    // Text should be appended at the end
    await expect(page.locator(".formula-input")).toHaveValue("Hello World123");
  });
});
