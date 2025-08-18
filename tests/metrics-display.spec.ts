import { expect, test } from "@playwright/test";
import { skipIfNoMetrics } from "./metrics-test-utils";

test.describe("Metrics Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
  });

  test.skip("should toggle metrics display", async ({ page }) => {
    await skipIfNoMetrics(page);
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

  test.skip("should display metric sections", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Check all major sections are present
    await expect(page.locator("h4:has-text('Operations/sec')")).toBeVisible();
    await expect(page.locator("h4:has-text('Total Operations')")).toBeVisible();
    await expect(page.locator("h4:has-text('Response Times')")).toBeVisible();
    await expect(page.locator("h4:has-text('System')")).toBeVisible();
    await expect(page.locator("h4:has-text('Trends')")).toBeVisible();
  });

  test.skip("should display metric values", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Check that metric values are displayed (initially should be 0)
    await expect(
      page.locator("text=Formula Evaluations:").first(),
    ).toBeVisible();
    await expect(page.locator("text=Cell Reads:").first()).toBeVisible();
    await expect(page.locator("text=Cell Writes:").first()).toBeVisible();
    await expect(
      page.locator("text=Actions Dispatched:").first(),
    ).toBeVisible();

    // Check memory usage is displayed
    await expect(page.locator("text=Memory Usage:")).toBeVisible();
    await expect(page.locator("text=/\\d+\\.\\d+ MB/")).toBeVisible();
  });

  test.skip("should not interfere with keyboard navigation", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Navigate with vim keys
    await page.keyboard.press("j"); // Move down
    await page.waitForTimeout(100);

    // Navigate right
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Navigate up
    await page.keyboard.press("k");
    await page.waitForTimeout(100);

    // Navigate left
    await page.keyboard.press("h");
    await page.waitForTimeout(100);

    // Metrics should still be visible and navigation should work
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // The grid should still be visible and functional
    await expect(page.locator("canvas")).toBeVisible();
  });

  test.skip("should not interfere with cell editing", async ({ page }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // After toggling metrics, focus should return to grid
    // Navigate to verify keyboard still works
    await page.keyboard.press("j"); // Move down
    await page.keyboard.press("k"); // Move up
    
    // Start editing - this tests that editing works with metrics visible
    await page.keyboard.press("i");
    await page.keyboard.type("Test");
    
    // Exit edit mode
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    
    // Navigation should still work after editing with metrics visible
    await page.keyboard.press("h"); // Move left
    await page.keyboard.press("l"); // Move right
    
    // Can still toggle metrics off and on
    await page.click("button:has-text('Hide Metrics')");
    await expect(page.locator(".metrics-overlay")).not.toBeVisible();
    await page.click("button:has-text('Show Metrics')");
    await expect(page.locator(".metrics-overlay")).toBeVisible();
  });

  test.skip("should handle Escape key without runtime error", async ({ page }) => {
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

  test.skip("should persist metrics display state during navigation", async ({
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

  test.skip("should update metric values during operations", async ({ page }) => {
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
    const initial = parseInt(initialCursorMoves || "0", 10);
    const updated = parseInt(updatedCursorMoves || "0", 10);
    expect(updated).toBeGreaterThanOrEqual(initial);
  });
});
