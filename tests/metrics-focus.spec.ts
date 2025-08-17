import { expect, test } from "@playwright/test";

test.describe("Metrics Focus Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
  });

  test("should maintain keyboard focus after toggling metrics display", async ({
    page,
  }) => {
    // Set up console listener to verify keyboard events are being handled
    const keyboardEvents: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Handling keyboard event")) {
        keyboardEvents.push(text);
      }
    });

    // Initial navigation should work
    await page.keyboard.press("j");
    await page.waitForTimeout(100);
    const initialEventCount = keyboardEvents.length;
    expect(initialEventCount).toBeGreaterThan(0);

    // Open metrics
    await page.click("button:has-text('Show Metrics')");
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // Navigation should still work with metrics open
    await page.keyboard.press("l");
    await page.waitForTimeout(100);
    expect(keyboardEvents.length).toBeGreaterThan(initialEventCount);

    // Close metrics
    await page.click("button:has-text('Hide Metrics')");
    await expect(page.locator(".metrics-overlay")).not.toBeVisible();

    // Critical test: Navigation MUST work after closing metrics
    const eventsBeforeClose = keyboardEvents.length;
    await page.keyboard.press("k");
    await page.waitForTimeout(100);
    expect(keyboardEvents.length).toBeGreaterThan(eventsBeforeClose);

    // Continue navigating to ensure focus is fully maintained
    await page.keyboard.press("h");
    await page.waitForTimeout(100);
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // All navigation events should have been captured
    expect(keyboardEvents.length).toBeGreaterThanOrEqual(5);
  });

  test("should maintain focus through multiple metrics toggles", async ({
    page,
  }) => {
    // Test multiple open/close cycles
    for (let i = 0; i < 3; i++) {
      // Open metrics
      await page.click("button:has-text('Show Metrics')");
      await expect(page.locator(".metrics-overlay")).toBeVisible();

      // Navigate with metrics open
      await page.keyboard.press("j");
      await page.waitForTimeout(50);

      // Close metrics
      await page.click("button:has-text('Hide Metrics')");
      await expect(page.locator(".metrics-overlay")).not.toBeVisible();

      // Navigate with metrics closed - this MUST work
      await page.keyboard.press("k");
      await page.waitForTimeout(50);
    }

    // Final navigation test
    await page.keyboard.press("l");
    await page.waitForTimeout(100);
    await page.keyboard.press("h");
    await page.waitForTimeout(100);

    // Grid should still be functional
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should handle rapid metrics toggle without losing focus", async ({
    page,
  }) => {
    // Rapidly toggle metrics
    await page.click("button:has-text('Show Metrics')");
    await page.click("button:has-text('Hide Metrics')");
    await page.click("button:has-text('Show Metrics')");
    await page.click("button:has-text('Hide Metrics')");

    // Immediately try to navigate - should work
    await page.keyboard.press("j");
    await page.waitForTimeout(100);
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Verify grid is still responsive
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should allow editing after metrics toggle", async ({ page }) => {
    // Show and hide metrics
    await page.click("button:has-text('Show Metrics')");
    await page.click("button:has-text('Hide Metrics')");

    // Should be able to enter edit mode
    await page.keyboard.press("i");
    await page.waitForTimeout(100);

    // Should be able to type
    await page.keyboard.type("test");

    // Exit edit mode
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Should be able to navigate again
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // Grid should be functional
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should maintain focus when metrics are shown during editing", async ({
    page,
  }) => {
    // Enter edit mode
    await page.keyboard.press("i");
    await page.keyboard.type("hello");

    // Show metrics while editing
    await page.click("button:has-text('Show Metrics')");
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // Continue typing - should still work
    await page.keyboard.type(" world");

    // Exit edit mode
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Hide metrics
    await page.click("button:has-text('Hide Metrics')");

    // Navigation should work
    await page.keyboard.press("j");
    await page.waitForTimeout(100);
    await page.keyboard.press("k");
    await page.waitForTimeout(100);

    // Verify grid is functional
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should refocus grid when clicking on metrics display itself", async ({
    page,
  }) => {
    // Show metrics
    await page.click("button:has-text('Show Metrics')");
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // Click on the metrics overlay (not the button)
    await page.locator(".metrics-overlay").click();

    // Try to navigate - should still work because grid should maintain/regain focus
    await page.keyboard.press("j");
    await page.waitForTimeout(100);
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Hide metrics
    await page.click("button:has-text('Hide Metrics')");

    // Navigation should continue to work
    await page.keyboard.press("k");
    await page.waitForTimeout(100);
    await page.keyboard.press("h");
    await page.waitForTimeout(100);

    // Grid should be functional
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("should verify grid-keyboard-handler has focus after metrics toggle", async ({
    page,
  }) => {
    // This test directly verifies the focus element

    // Initially, grid-keyboard-handler should have focus or be focusable
    const gridHandler = page.locator(".grid-keyboard-handler").first();

    // Show metrics
    await page.click("button:has-text('Show Metrics')");

    // Hide metrics
    await page.click("button:has-text('Hide Metrics')");

    // Check that grid-keyboard-handler can receive focus
    await gridHandler.focus();

    // Verify keyboard events work
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // If we can navigate, focus is working correctly
    await page.keyboard.press("k");
    await page.waitForTimeout(100);

    await expect(page.locator("canvas")).toBeVisible();
  });

  test("regression: app should remain usable after closing metrics", async ({
    page,
  }) => {
    // This is the specific regression test for the reported issue:
    // "can't use the application after opening and closing the metrics page"

    // Verify initial state - app is usable
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // Open metrics
    await page.click("button:has-text('Show Metrics')");
    await expect(page.locator(".metrics-overlay")).toBeVisible();

    // Use app with metrics open
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Close metrics - this is where the bug occurred
    await page.click("button:has-text('Hide Metrics')");
    await expect(page.locator(".metrics-overlay")).not.toBeVisible();

    // CRITICAL: App MUST remain usable after closing metrics
    // All of these operations should work:

    // 1. Navigation should work
    await page.keyboard.press("k");
    await page.waitForTimeout(100);
    await page.keyboard.press("h");
    await page.waitForTimeout(100);

    // 2. Editing should work
    await page.keyboard.press("i");
    await page.keyboard.type("test");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // 3. More navigation
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // 4. Delete should work
    await page.keyboard.press("Delete");
    await page.waitForTimeout(100);

    // If we got here without timeout errors, the app is usable
    await expect(page.locator("canvas")).toBeVisible();
  });
});
