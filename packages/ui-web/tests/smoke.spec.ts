import { test, expect } from "@playwright/test"

test.describe("Smoke Tests", () => {
  test("should load the application", async ({ page }) => {
    await page.goto("http://localhost:3000")
    
    // Check that main elements are present
    await expect(page).toHaveTitle("GridCore - Web UI")
    await expect(page.locator("#app")).toBeVisible()
    await expect(page.locator(".grid-container")).toBeVisible()
    await expect(page.locator(".formula-bar-container")).toBeVisible()
  })

  test("should display mode indicator", async ({ page }) => {
    await page.goto("http://localhost:3000")
    
    // Mode indicator should be visible
    const modeIndicator = page.locator(".mode-indicator")
    await expect(modeIndicator).toBeVisible()
    await expect(modeIndicator).toContainText("NAVIGATION")
  })

  test("should have initial data loaded", async ({ page }) => {
    await page.goto("http://localhost:3000")
    
    // Check formula bar shows A1
    await expect(page.locator(".formula-bar input:first-child")).toHaveValue("A1")
    
    // Check initial cell value
    await expect(page.locator(".formula-bar input:last-child")).toHaveValue("Hello")
  })
})