import { test, expect } from "@playwright/test"

test.describe("Vim Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000")
    // Wait for the app to load
    await page.waitForSelector(".grid-container")
  })

  test("should transition from navigation to edit mode with 'i' key", async ({ page }) => {
    // Initially in navigation mode
    await expect(page.locator(".mode-indicator")).toContainText("NAVIGATION")
    
    // Press 'i' to enter edit mode
    await page.keyboard.press("i")
    
    // Should be in insert mode
    await expect(page.locator(".mode-indicator")).toContainText("INSERT")
    
    // Should show cell editor
    await expect(page.locator(".cell-editor")).toBeVisible()
  })

  test("should allow text input in insert mode", async ({ page }) => {
    // Navigate to an empty cell
    await page.keyboard.press("j") // Move down to A2
    await page.keyboard.press("j") // Move down to A3
    
    // Enter edit mode
    await page.keyboard.press("i")
    
    // Type some text
    await page.keyboard.type("Hello Vim")
    
    // Commit with Enter
    await page.keyboard.press("Enter")
    
    // Check that text was saved
    await expect(page.locator(".formula-bar input")).toHaveValue("Hello Vim")
  })

  test("should transition between vim modes correctly", async ({ page }) => {
    // Start editing
    await page.keyboard.press("i")
    await expect(page.locator(".mode-indicator")).toContainText("INSERT")
    
    // Switch to normal mode
    await page.keyboard.press("Escape")
    await expect(page.locator(".mode-indicator")).toContainText("NORMAL")
    
    // Back to insert mode
    await page.keyboard.press("i")
    await expect(page.locator(".mode-indicator")).toContainText("INSERT")
    
    // Exit to navigation
    await page.keyboard.press("Escape") // To normal
    await page.keyboard.press("Escape") // To navigation
    await expect(page.locator(".mode-indicator")).toContainText("NAVIGATION")
  })

  test("should position cursor correctly with vim commands", async ({ page }) => {
    // Enter edit mode with some text
    await page.keyboard.press("i")
    await page.keyboard.type("vim test")
    
    // Go to normal mode
    await page.keyboard.press("Escape")
    
    // Test movement commands
    await page.keyboard.press("0") // Beginning of line
    await page.keyboard.press("$") // End of line
    await page.keyboard.press("w") // Next word
    await page.keyboard.press("b") // Previous word
    
    // Should still be in normal mode
    await expect(page.locator(".mode-indicator")).toContainText("NORMAL")
  })

  test("should handle 'a' to append", async ({ page }) => {
    // Navigate to cell with content
    await page.keyboard.press("l") // Move to B1 (has "World")
    
    // Press 'a' to append
    await page.keyboard.press("a")
    
    // Should be in insert mode
    await expect(page.locator(".mode-indicator")).toContainText("INSERT")
    
    // Type additional text
    await page.keyboard.type("!")
    
    // Commit
    await page.keyboard.press("Enter")
    
    // Check the result
    await expect(page.locator(".formula-bar input")).toHaveValue("World!")
  })

  test("should show visual mode", async ({ page }) => {
    // Enter edit mode
    await page.keyboard.press("i")
    await page.keyboard.type("Select me")
    
    // Go to normal mode
    await page.keyboard.press("Escape")
    
    // Enter visual mode
    await page.keyboard.press("v")
    await expect(page.locator(".mode-indicator")).toContainText("VISUAL")
    
    // Move to select text
    await page.keyboard.press("l")
    await page.keyboard.press("l")
    
    // Exit visual mode
    await page.keyboard.press("Escape")
    await expect(page.locator(".mode-indicator")).toContainText("NORMAL")
  })
})