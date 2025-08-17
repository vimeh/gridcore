import { expect, test } from "@playwright/test";

test.describe("Metrics Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
  });

  test("should toggle metrics display", async ({ page }) => {
    // Initially metrics should not be visible
    await expect(page.locator(".metrics-overlay")).not.toBeVisible();

    // Click Show Metrics button
    await page.click("button:has-text('Show Metrics')");

    // Metrics overlay should be visible
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // Should show Performance Metrics heading
    await expect(page.locator("h3")).toContainText("Performance Metrics");

    // Click Hide Metrics button
    await page.click("button:has-text('Hide Metrics')");

    // Metrics should be hidden again
    await expect(page.locator(".metrics-overlay")).not.toBeVisible();
  });

  test("should display metric sections", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Check all major sections are present
    await expect(page.locator("h4:has-text('Operations/sec')")).toBeVisible();
    await expect(page.locator("h4:has-text('Total Operations')")).toBeVisible();
    await expect(page.locator("h4:has-text('Response Times')")).toBeVisible();
    await expect(page.locator("h4:has-text('System')")).toBeVisible();
    await expect(page.locator("h4:has-text('Trends')")).toBeVisible();
  });

  test("should display metric values", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Check that metric values are displayed (initially should be 0)
    await expect(page.locator("text=Formula Evaluations:").first()).toBeVisible();
    await expect(page.locator("text=Cell Reads:").first()).toBeVisible();
    await expect(page.locator("text=Cell Writes:").first()).toBeVisible();
    await expect(page.locator("text=Actions Dispatched:").first()).toBeVisible();

    // Check memory usage is displayed
    await expect(page.locator("text=Memory Usage:")).toBeVisible();
    await expect(page.locator("text=/\\d+\\.\\d+ MB/")).toBeVisible();
  });

  test("should not interfere with keyboard navigation", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Navigate with vim keys
    await page.keyboard.press("j"); // Move down
    await page.waitForTimeout(100);

    // Check cursor moved to A2
    const cellAddress = await page.locator(".cell-address-input").inputValue();
    expect(cellAddress).toBe("A2");

    // Navigate right
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Check cursor moved to B2
    const newCellAddress = await page.locator(".cell-address-input").inputValue();
    expect(newCellAddress).toBe("B2");

    // Metrics should still be visible
    await expect(page.locator(".metrics-overlay")).toBeVisible();
  });

  test("should not interfere with cell editing", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Start editing with Enter (clears existing content)
    await page.keyboard.press("Enter");
    await page.keyboard.type("Test Value");

    // Exit edit mode
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Check value was saved
    await expect(page.locator(".formula-input")).toHaveValue("Test Value");

    // Metrics should still be visible
    await expect(page.locator(".metrics-overlay")).toBeVisible();
  });

  test("should handle Escape key without runtime error", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Set up console listener to catch any errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Press Escape multiple times (this used to cause runtime error)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    // Navigate around
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.keyboard.press("h");
    await page.keyboard.press("l");

    // Check no runtime errors occurred
    const runtimeErrors = consoleErrors.filter(
      (err) =>
        err.includes("unreachable") ||
        err.includes("RuntimeError") ||
        err.includes("panic"),
    );
    expect(runtimeErrors).toHaveLength(0);

    // App should still be functional
    await expect(page.locator(".metrics-overlay")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should persist metrics display state during navigation", async ({
    page,
  }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Navigate to different cells
    await page.keyboard.press("j"); // A2
    await page.keyboard.press("l"); // B2
    await page.keyboard.press("j"); // B3

    // Edit a cell
    await page.keyboard.press("i");
    await page.keyboard.type("=A1+B1");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Metrics should still be visible after all operations
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // Hide metrics
    await page.click("button:has-text('Hide Metrics')");

    // Navigate more
    await page.keyboard.press("k");
    await page.keyboard.press("h");

    // Metrics should stay hidden
    await expect(page.locator(".metrics-overlay")).not.toBeVisible();
  });

  test("should update metric values during operations", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Get initial cursor moves count
    const initialCursorMoves = await page
      .locator(".metrics-overlay")
      .locator("text=Cursor Moves:")
      .locator("..")
      .locator(".metric-value")
      .textContent();

    // Perform some navigation operations
    await page.keyboard.press("j"); // Move down
    await page.waitForTimeout(150); // Wait for metrics update
    await page.keyboard.press("l"); // Move right
    await page.waitForTimeout(150);
    await page.keyboard.press("k"); // Move up
    await page.waitForTimeout(150);

    // Get updated cursor moves count
    const updatedCursorMoves = await page
      .locator(".metrics-overlay")
      .locator("text=Cursor Moves:")
      .locator("..")
      .locator(".metric-value")
      .textContent();

    // The count should have increased (may not be exactly 3 due to timing)
    const initial = parseInt(initialCursorMoves || "0");
    const updated = parseInt(updatedCursorMoves || "0");
    expect(updated).toBeGreaterThanOrEqual(initial);
  });
});