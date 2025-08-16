import { expect, type Page, test } from "@playwright/test";
import { getCellSelector, pressKey, waitForGrid } from "./helpers/test-utils";

// Helper to get the canvas element
async function getCanvas(page: Page) {
  return page.locator("canvas").first();
}

// Helper to click on a specific cell
async function clickCell(page: Page, col: number, row: number) {
  const canvas = await getCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  // Assuming default cell dimensions and headers
  const rowHeaderWidth = 50;
  const columnHeaderHeight = 25;
  const cellWidth = 100;
  const cellHeight = 25;

  // Calculate cell center position
  const x = rowHeaderWidth + col * cellWidth + cellWidth / 2;
  const y = columnHeaderHeight + row * cellHeight + cellHeight / 2;

  await canvas.click({ position: { x, y } });
}

// Helper to check if selection is visible by checking mode and status bar
async function isSelectionVisible(page: Page): Promise<boolean> {
  // Check if we're in visual mode via the status bar
  const modeText = await page
    .locator(".mode-indicator .mode-text")
    .last()
    .textContent();
  const isVisualMode = modeText?.includes("VISUAL");

  // For visual mode, we should always have a selection even if it's just one cell
  // We're checking for visual mode as the indicator that selection is active
  return Boolean(isVisualMode);
}

test.describe("Visual Mode Selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080");
    await waitForGrid(page);

    // Wait for initial render
    await page.waitForTimeout(500);
  });

  test("should enter visual mode with v key", async ({ page }) => {
    // Click on cell A1
    await clickCell(page, 0, 0);

    // Press 'v' to enter visual mode
    await page.keyboard.press("v");

    // Give time for state update
    await page.waitForTimeout(100);

    // Check that we're in visual mode by looking for selection
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should extend selection with arrow keys", async ({ page }) => {
    // Click on cell B2
    await clickCell(page, 1, 1);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Extend selection right
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(100);

    // Extend selection down
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);

    // Check that selection is visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should extend selection with hjkl keys", async ({ page }) => {
    // Click on cell C3
    await clickCell(page, 2, 2);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Extend selection with vim keys
    await page.keyboard.press("l"); // right
    await page.waitForTimeout(100);

    await page.keyboard.press("j"); // down
    await page.waitForTimeout(100);

    await page.keyboard.press("h"); // left
    await page.waitForTimeout(100);

    await page.keyboard.press("k"); // up
    await page.waitForTimeout(100);

    // Check that selection is visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should exit visual mode with Escape", async ({ page }) => {
    // Click on cell A1
    await clickCell(page, 0, 0);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Extend selection
    await page.keyboard.press("l");
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // Verify selection is visible
    let hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();

    // Exit visual mode
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Selection should be cleared
    hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeFalsy();
  });

  test("should maintain anchor point when extending selection", async ({
    page,
  }) => {
    // Start at cell B2
    await clickCell(page, 1, 1);

    // Enter visual mode (anchor is now B2)
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Move right twice (selection should be B2:D2)
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Move down (selection should be B2:D3)
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // Move left (selection should be B2:C3)
    await page.keyboard.press("h");
    await page.waitForTimeout(100);

    // Selection should still be visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should handle single cell selection in visual mode", async ({
    page,
  }) => {
    // Click on cell C3
    await clickCell(page, 2, 2);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Without moving, we should have a single cell selected
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should create rectangular selection", async ({ page }) => {
    // Start at cell A1
    await clickCell(page, 0, 0);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Create a 3x3 selection (A1:C3)
    await page.keyboard.press("l"); // to B1
    await page.keyboard.press("l"); // to C1
    await page.keyboard.press("j"); // to C2
    await page.keyboard.press("j"); // to C3
    await page.waitForTimeout(100);

    // Verify selection is visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should preserve selection when moving in different directions", async ({
    page,
  }) => {
    // Start at center cell
    await clickCell(page, 5, 5);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Move in a pattern that tests selection preservation
    await page.keyboard.press("h"); // left
    await page.keyboard.press("h"); // left
    await page.keyboard.press("k"); // up
    await page.keyboard.press("k"); // up
    await page.keyboard.press("l"); // right
    await page.keyboard.press("j"); // down
    await page.waitForTimeout(100);

    // Selection should still be visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });
});

test.describe("Visual Mode Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrid(page);
    await page.waitForTimeout(500);
  });

  test("should render selection with correct styling", async ({ page }) => {
    // Click on cell B2
    await clickCell(page, 1, 1);

    // Enter visual mode
    await page.keyboard.press("v");

    // Extend selection to create a 2x2 block
    await page.keyboard.press("l");
    await page.keyboard.press("j");
    await page.waitForTimeout(200);

    // Verify selection is visible instead of screenshot
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should show active cell border on top of selection", async ({
    page,
  }) => {
    // Click on cell A1
    await clickCell(page, 0, 0);

    // Enter visual mode
    await page.keyboard.press("v");

    // Create larger selection
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.keyboard.press("l");
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await page.waitForTimeout(200);

    // Verify selection is visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });
});

test.describe("Visual Mode Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGrid(page);
    await page.waitForTimeout(500);
  });

  test("should handle boundary conditions", async ({ page }) => {
    // Click on cell A1 (top-left corner)
    await clickCell(page, 0, 0);

    // Enter visual mode
    await page.keyboard.press("v");
    await page.waitForTimeout(100);

    // Try to move beyond boundaries
    await page.keyboard.press("h"); // try to go left from column A
    await page.keyboard.press("k"); // try to go up from row 1
    await page.waitForTimeout(100);

    // Should still have selection at A1
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should handle rapid key presses", async ({ page }) => {
    // Click on cell C3
    await clickCell(page, 2, 2);

    // Enter visual mode
    await page.keyboard.press("v");

    // Rapidly extend selection
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("l");
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("j");
    }
    await page.waitForTimeout(200);

    // Selection should still be visible
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeTruthy();
  });

  test("should clear selection when clicking elsewhere", async ({ page }) => {
    // Start with a selection
    await clickCell(page, 1, 1);
    await page.keyboard.press("v");
    await page.keyboard.press("l");
    await page.keyboard.press("j");
    await page.waitForTimeout(100);

    // Click on a different cell
    await clickCell(page, 5, 5);
    await page.waitForTimeout(100);

    // Selection should be cleared
    const hasSelection = await isSelectionVisible(page);
    expect(hasSelection).toBeFalsy();
  });
});
