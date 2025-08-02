import { test, expect } from "@playwright/test"

test.describe("Grid Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000")
    await page.waitForSelector(".grid-container")
  })

  test("should navigate with hjkl keys", async ({ page }) => {
    // Start at A1
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
    
    // Move right with 'l'
    await page.keyboard.press("l")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("B1")
    
    // Move down with 'j'
    await page.keyboard.press("j")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("B2")
    
    // Move left with 'h'
    await page.keyboard.press("h")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A2")
    
    // Move up with 'k'
    await page.keyboard.press("k")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
  })

  test("should navigate with arrow keys", async ({ page }) => {
    // Start at A1
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
    
    // Test arrow navigation
    await page.keyboard.press("ArrowRight")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("B1")
    
    await page.keyboard.press("ArrowDown")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("B2")
    
    await page.keyboard.press("ArrowLeft")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A2")
    
    await page.keyboard.press("ArrowUp")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
  })

  test("should show navigation cursor", async ({ page }) => {
    // The active cell should have a visible cursor
    const activeCell = page.locator("canvas.grid-canvas")
    
    // Take screenshot to verify cursor is visible
    await expect(activeCell).toBeVisible()
    
    // Move and verify cursor moves
    await page.keyboard.press("l")
    await page.keyboard.press("j")
    
    // Formula bar should update
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("B2")
  })

  test("should handle Tab navigation", async ({ page }) => {
    // Tab should move right
    await page.keyboard.press("Tab")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("B1")
    
    // Shift+Tab should move left
    await page.keyboard.press("Shift+Tab")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
  })

  test("should not navigate when editing", async ({ page }) => {
    // Enter edit mode
    await page.keyboard.press("i")
    
    // hjkl should not navigate
    await page.keyboard.press("h")
    await page.keyboard.press("j")
    await page.keyboard.press("k")
    await page.keyboard.press("l")
    
    // Should still be at A1
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
  })

  test("should handle boundary navigation", async ({ page }) => {
    // Try to move beyond grid boundaries
    await page.keyboard.press("h") // Can't go left from A1
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
    
    await page.keyboard.press("k") // Can't go up from A1
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
  })
})