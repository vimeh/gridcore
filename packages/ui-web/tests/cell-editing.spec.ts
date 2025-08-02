import { test, expect } from "@playwright/test"

test.describe("Cell Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
  })

  test("should edit cell with Enter key", async ({ page }) => {
    await page.keyboard.press("Enter")
    await expect(page.locator(".cell-editor")).toBeVisible()
    
    // Type new content
    await page.keyboard.type("New Value")
    
    // Commit with Enter
    await page.keyboard.press("Enter")
    
    // Check value was saved
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("New Value")
  })

  test("should edit cell with F2 key", async ({ page }) => {
    await page.keyboard.press("F2")
    await expect(page.locator(".cell-editor")).toBeVisible()
    
    // Should be in insert mode
    await expect(page.locator(".mode-indicator")).toContainText("INSERT")
  })

  test("should edit cell by typing", async ({ page }) => {
    // Start typing directly
    await page.keyboard.type("Quick entry")
    
    // Should open editor
    await expect(page.locator(".cell-editor")).toBeVisible()
    
    // Commit with Enter
    await page.keyboard.press("Enter")
    
    // Check value
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("Quick entry")
  })

  test("should cancel edit with Escape", async ({ page }) => {
    // Navigate to cell with content
    await page.keyboard.press("l") // B1 has "World"
    
    // Start editing
    await page.keyboard.press("i")
    
    // Type new content
    await page.keyboard.type("Changed")
    
    // Cancel with Escape (goes to normal mode)
    await page.keyboard.press("Escape")
    // Another Escape to exit editor
    await page.keyboard.press("Escape")
    
    // Original value should remain
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("World")
  })

  test("should handle formula entry", async ({ page }) => {
    // Move to empty cell
    await page.keyboard.press("j")
    await page.keyboard.press("j")
    await page.keyboard.press("l") // B3
    
    // Enter formula
    await page.keyboard.press("i")
    await page.keyboard.type("=A2+B2")
    await page.keyboard.press("Enter")
    
    // Formula should be in formula bar
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("=A2+B2")
  })

  test("should delete cell content with Delete key", async ({ page }) => {
    // Navigate to cell with content
    await page.keyboard.press("l") // B1 has "World"
    
    // Delete content
    await page.keyboard.press("Delete")
    
    // Cell should be empty
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("")
  })

  test("should delete cell content with Backspace key", async ({ page }) => {
    // Navigate to A1 (has "Hello")
    
    // Delete content
    await page.keyboard.press("Backspace")
    
    // Cell should be empty
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("")
  })

  test("should handle multi-line edit with proper cursor", async ({ page }) => {
    // Enter edit mode
    await page.keyboard.press("i")
    
    // Type text
    await page.keyboard.type("Line one")
    
    // Should show cursor/caret
    await expect(page.locator(".cell-editor")).toBeVisible()
    
    // Exit to normal mode
    await page.keyboard.press("Escape")
    
    // Should show block cursor in normal mode
    await expect(page.locator(".block-cursor")).toBeVisible()
  })
})