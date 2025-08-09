import { expect, test } from "@playwright/test";
import { selectors, waitForApp } from "./helpers/selectors";
import { focusGrid, getCurrentCellAddress } from "./helpers/test-utils";

test.describe("Grid Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    await focusGrid(page);
    // Make sure grid is focused
    await page.waitForTimeout(100);
  });

  test("should navigate with hjkl keys", async ({ page }) => {
    // Start at A1
    expect(await getCurrentCellAddress(page)).toBe("A1");

    // Focus the grid wrapper, not the canvas to avoid mouse position issues
    const gridWrapper = page.locator(selectors.gridWrapper);
    await gridWrapper.focus();
    await page.waitForTimeout(100);

    // Move right with 'l'
    await page.keyboard.press("l");
    await page.waitForTimeout(200); // Wait for state update

    const addressAfterL = await getCurrentCellAddress(page);
    expect(addressAfterL).toBe("B1");

    // Move down with 'j'
    await page.keyboard.press("j");
    expect(await getCurrentCellAddress(page)).toBe("B2");

    // Move left with 'h'
    await page.keyboard.press("h");
    expect(await getCurrentCellAddress(page)).toBe("A2");

    // Move up with 'k'
    await page.keyboard.press("k");
    expect(await getCurrentCellAddress(page)).toBe("A1");
  });

  test("should navigate with arrow keys", async ({ page }) => {
    // Start at A1
    expect(await getCurrentCellAddress(page)).toBe("A1");

    // Test arrow navigation
    await page.keyboard.press("ArrowRight");
    expect(await getCurrentCellAddress(page)).toBe("B1");

    await page.keyboard.press("ArrowDown");
    expect(await getCurrentCellAddress(page)).toBe("B2");

    await page.keyboard.press("ArrowLeft");
    expect(await getCurrentCellAddress(page)).toBe("A2");

    await page.keyboard.press("ArrowUp");
    expect(await getCurrentCellAddress(page)).toBe("A1");
  });

  test("should show navigation cursor", async ({ page }) => {
    // The canvas should be visible
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Move and verify cursor moves
    await page.keyboard.press("l");
    await page.keyboard.press("j");

    // Formula bar should update
    expect(await getCurrentCellAddress(page)).toBe("B2");
  });

  test("should handle Tab navigation", async ({ page }) => {
    // Tab should move right
    await page.keyboard.press("Tab");
    expect(await getCurrentCellAddress(page)).toBe("B1");

    // Shift+Tab should move left
    await page.keyboard.press("Shift+Tab");
    expect(await getCurrentCellAddress(page)).toBe("A1");
  });

  test("should not navigate when editing", async ({ page }) => {
    // Enter edit mode
    await page.keyboard.press("i");

    // hjkl should not navigate
    await page.keyboard.press("h");
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await page.keyboard.press("l");

    // Should still be at A1
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    expect(await getCurrentCellAddress(page)).toBe("A1");
  });

  test("should handle boundary navigation", async ({ page }) => {
    // Try to move beyond grid boundaries
    await page.keyboard.press("h"); // Can't go left from A1
    expect(await getCurrentCellAddress(page)).toBe("A1");

    await page.keyboard.press("k"); // Can't go up from A1
    expect(await getCurrentCellAddress(page)).toBe("A1");
  });
});
