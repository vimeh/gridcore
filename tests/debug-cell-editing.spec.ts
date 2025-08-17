import { test } from "@playwright/test";

test.describe("Debug Cell Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas");

    // Listen to console logs
    page.on("console", (msg) => {
      console.log(`[${msg.type()}] ${msg.text()}`);
    });
  });

  test("debug Enter key editing", async ({ page }) => {
    console.log("=== Testing Enter key ===");

    // Check initial value
    const initialValue = await page.locator(".formula-input").inputValue();
    console.log("Initial formula bar value:", initialValue);

    // Press Enter
    await page.keyboard.press("Enter");

    // Wait a bit for any state changes
    await page.waitForTimeout(500);

    // Check if editor is visible
    const editorVisible = await page
      .locator(".cell-editor-overlay")
      .isVisible()
      .catch(() => false);
    console.log("Editor visible after Enter:", editorVisible);

    // Check current mode
    const modeText = await page
      .locator(".mode-text")
      .textContent()
      .catch(() => "not found");
    console.log("Current mode:", modeText);

    // Try typing something
    await page.keyboard.type("Test");
    await page.waitForTimeout(100);

    // Check editor value if visible
    if (editorVisible) {
      const editorValue = await page
        .locator(".cell-editor-overlay textarea")
        .inputValue()
        .catch(() => "");
      console.log("Editor value after typing:", editorValue);
    }
  });

  test("debug direct typing", async ({ page }) => {
    console.log("=== Testing direct typing ===");

    // Type a character directly
    await page.keyboard.type("X");

    // Wait a bit
    await page.waitForTimeout(500);

    // Check if editor is visible
    const editorVisible = await page
      .locator(".cell-editor-overlay")
      .isVisible()
      .catch(() => false);
    console.log("Editor visible after typing 'X':", editorVisible);

    // Check current mode
    const modeText = await page
      .locator(".mode-text")
      .textContent()
      .catch(() => "not found");
    console.log("Current mode:", modeText);

    // Check editor value if visible
    if (editorVisible) {
      const editorValue = await page
        .locator(".cell-editor-overlay textarea")
        .inputValue()
        .catch(() => "");
      console.log("Editor value:", editorValue);
    }
  });

  test("debug Delete key", async ({ page }) => {
    console.log("=== Testing Delete key ===");

    // Navigate to B1 which has "World"
    await page.keyboard.press("l");
    await page.waitForTimeout(100);

    // Check formula bar before delete
    const beforeDelete = await page.locator(".formula-input").inputValue();
    console.log("Formula bar before Delete:", beforeDelete);

    // Press Delete
    await page.keyboard.press("Delete");
    await page.waitForTimeout(100);

    // Check formula bar after delete
    const afterDelete = await page.locator(".formula-input").inputValue();
    console.log("Formula bar after Delete:", afterDelete);
  });
});
