import { test, expect } from "@playwright/test"

test.describe("Vim Mode - Text Saving Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector(".grid-container")
  })

  test("should save text when pressing Escape twice", async ({ page }) => {
    // Navigate to a cell and enter edit mode
    await page.keyboard.press("F2") // Edit cell without clearing
    
    // Clear existing content and type new text
    await page.keyboard.press("Control+a")
    await page.keyboard.type("Test content")
    
    // Press Escape twice to save
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    // Verify we're back in navigation mode
    await expect(page.locator(".mode-text")).toContainText("NAVIGATION")
    
    // Navigate away and back to verify text was saved
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowUp")
    
    // The formula bar should show the saved text
    await expect(page.locator(".formula-bar-input")).toHaveValue("Test content")
  })

  test("should continue inserting when pressing Enter multiple times", async ({ page }) => {
    // Navigate to a cell and start editing with Enter (replace mode)
    await page.keyboard.press("Enter")
    
    // Type some text with multiple enters
    await page.keyboard.type("Line 1")
    await page.keyboard.press("Enter")
    await page.keyboard.type("Line 2") 
    await page.keyboard.press("Enter")
    await page.keyboard.type("Line 3")
    
    // Press Escape twice to save
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    // Verify we're back in navigation mode
    await expect(page.locator(".mode-text")).toContainText("NAVIGATION")
    
    // The formula bar should show the multi-line text
    const formulaBarValue = await page.locator(".formula-bar-input").inputValue()
    expect(formulaBarValue).toContain("Line 1")
  })
})

test.describe("Vim Mode - Cursor Positioning Fixes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await page.waitForSelector(".grid-container")
    
    // Put some text in a cell
    await page.keyboard.press("Enter")
    await page.keyboard.type("Hello World")
    await page.keyboard.press("Enter")
    await page.keyboard.press("Enter")
  })

  test("should position cursor at end when pressing 'i' on existing text", async ({ page }) => {
    // Enter the cell using F2 to preserve existing text
    await page.keyboard.press("F2")
    
    // The cursor should be at the end of existing text
    // Type additional text - it should appear at the end
    await page.keyboard.type(" Extra")
    
    // Save and check - first Escape to normal mode, second to save
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    await expect(page.locator(".formula-bar-input")).toHaveValue("Hello World Extra")
  })

  test("should position cursor correctly for different vim insert commands", async ({ page }) => {
    // Test 'I' - insert at beginning
    await page.keyboard.press("F2")
    await page.keyboard.press("I")
    await page.keyboard.type("start_")
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    // Test 'A' - append at end
    await page.keyboard.press("F2")
    await page.keyboard.press("A")
    await page.keyboard.type("_end")
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    // Final text should be: "start_Hello World_end"
    await expect(page.locator(".formula-bar-input")).toHaveValue("start_Hello World_end")
  })

  test("should handle cursor position when entering existing text", async ({ page }) => {
    // Navigate to a cell with existing text using F2
    await page.keyboard.press("F2")
    
    // The cursor should be at the end of existing text
    // Type something to verify position
    await page.keyboard.type("123")
    
    // Save
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
    
    // Text should be appended at the end
    await expect(page.locator(".formula-bar-input")).toHaveValue("Hello World123")
  })
})