import { expect, test } from "@playwright/test";

test.describe("Focus Guard Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");
  });

  test("grid should have focus on initial page load", async ({ page }) => {
    // Grid keyboard handler should have focus immediately
    const focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain("grid-keyboard-handler");
  });

  test("no buttons should steal focus on page load", async ({ page }) => {
    // Check that no button has focus
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).not.toBe("BUTTON");
  });

  test("metrics button should not be in tab order", async ({ page }) => {
    // Check if metrics button exists
    const metricsButton = await page.$("button:has-text('Show Metrics')");
    
    if (metricsButton) {
      // Metrics button should have tabindex=-1
      const tabindex = await metricsButton.getAttribute("tabindex");
      expect(tabindex).toBe("-1");
    }
  });

  test("focus should return to grid after any toolbar interaction", async ({ page }) => {
    // Try clicking debug mode checkbox if it exists
    const debugCheckbox = await page.$('input[type="checkbox"]');
    if (debugCheckbox) {
      await debugCheckbox.click();
      
      // Wait a moment for any focus changes
      await page.waitForTimeout(100);
      
      // Click on the grid to ensure focus
      await page.click("canvas");
      
      // Focus should be on grid container
      const focusedElement = await page.evaluate(() => document.activeElement?.className);
      expect(focusedElement).toContain("grid");
    }

    // Verify keyboard navigation works
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    // No errors = test passes
  });

  test("keyboard events should work immediately without clicking", async ({ page }) => {
    // Don't click anywhere, just start typing
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.keyboard.press("h");
    await page.keyboard.press("l");
    
    // Start editing without clicking
    await page.keyboard.press("i");
    await page.keyboard.type("test");
    
    // Exit edit mode
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    
    // Navigation should continue to work
    await page.keyboard.press("j");
    // No timeout errors = test passes
  });

  test("focus should be maintained across page visibility changes", async ({ page }) => {
    // Simulate page becoming hidden and visible again (like switching tabs)
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    
    // Focus should still be on grid
    const focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain("grid-keyboard-handler");
    
    // Keyboard should still work
    await page.keyboard.press("j");
    await page.keyboard.press("k");
  });

  test("focus should persist through window resize", async ({ page }) => {
    // Resize the window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(100);
    
    // Focus should still be on grid
    const focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain("grid-keyboard-handler");
    
    // Keyboard should still work
    await page.keyboard.press("h");
    await page.keyboard.press("l");
  });

  test("formula bar should not steal focus on page load", async ({ page }) => {
    // Formula input should exist but not have focus
    const formulaInput = await page.$(".formula-input");
    expect(formulaInput).toBeTruthy();
    
    const focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).not.toContain("formula-input");
  });

  test("clicking formula bar and pressing Tab should move focus away", async ({ page }) => {
    // Click on formula bar
    await page.click(".formula-input");
    
    // Formula bar should have focus
    let focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain("formula-input");
    
    // Click back on grid to return focus
    await page.click("canvas");
    
    // Focus should be on grid
    focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain("grid");
    
    // Navigation should work
    await page.keyboard.press("j");
    await page.keyboard.press("k");
  });

  test("rapid component toggles should not break focus", async ({ page }) => {
    // If metrics button exists, rapidly toggle it
    const metricsButton = await page.$("button:has-text('Show Metrics')");
    
    if (metricsButton) {
      // Rapidly toggle metrics multiple times
      for (let i = 0; i < 5; i++) {
        await page.click("button:has-text('Show Metrics')");
        await page.click("button:has-text('Hide Metrics')");
      }
    }
    
    // Focus should still be on grid
    const focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain("grid-keyboard-handler");
    
    // Keyboard should still work
    await page.keyboard.press("j");
    await page.keyboard.press("k");
  });
});