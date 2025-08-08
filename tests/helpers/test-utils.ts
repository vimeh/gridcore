import { Page } from "@playwright/test"
import { selectors } from "./selectors"

/**
 * Test utility functions to abstract differences between TypeScript and Leptos UI
 */

/**
 * Get the current mode from the status bar
 */
export async function getCurrentMode(page: Page): Promise<string> {
  const modeElement = await page.locator(selectors.statusBarMode)
  const text = await modeElement.textContent()
  return text?.trim() || ""
}

/**
 * Check if the cell editor is currently visible
 */
export async function isEditingCell(page: Page): Promise<boolean> {
  const editor = page.locator(selectors.cellEditor)
  return await editor.isVisible()
}

/**
 * Get the current cell address
 * Note: In Leptos UI, this is shown in the cell-indicator, not as an input value
 */
export async function getCurrentCellAddress(page: Page): Promise<string> {
  const cellIndicator = page.locator(selectors.formulaBarAddress)
  const text = await cellIndicator.textContent()
  return text?.trim() || ""
}

/**
 * Get the current cell value from the formula bar
 */
export async function getCurrentCellValue(page: Page): Promise<string> {
  const formulaInput = page.locator(selectors.formulaBarInput)
  // Try to get value first (if it's an input), otherwise get text content
  const value = await formulaInput.inputValue().catch(() => null)
  if (value !== null) return value
  
  const text = await formulaInput.textContent()
  return text?.trim() || ""
}

/**
 * Navigate to a specific cell using keyboard
 */
export async function navigateToCell(
  page: Page,
  targetCol: number,
  targetRow: number
): Promise<void> {
  // Start from A1 (0,0)
  // Navigate right to target column
  for (let col = 0; col < targetCol; col++) {
    await page.keyboard.press("l")
  }
  // Navigate down to target row
  for (let row = 0; row < targetRow; row++) {
    await page.keyboard.press("j")
  }
}

/**
 * Start editing the current cell
 */
export async function startEditing(page: Page, mode: "i" | "a" | "Enter" = "i"): Promise<void> {
  await page.keyboard.press(mode)
  // Wait for editor to appear
  await page.waitForSelector(selectors.cellEditor, { state: "visible", timeout: 1000 })
}

/**
 * Exit editing mode and save changes
 */
export async function exitEditingAndSave(page: Page): Promise<void> {
  // In vim mode, double Escape saves and exits
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  // Wait for editor to disappear
  await page.waitForSelector(selectors.cellEditor, { state: "hidden", timeout: 1000 })
}

/**
 * Focus the grid for keyboard navigation
 */
export async function focusGrid(page: Page): Promise<void> {
  const gridWrapper = page.locator(selectors.gridWrapper)
  await gridWrapper.focus()
}

/**
 * Check if a mode indicator contains specific text
 * This is a compatibility function for tests expecting mode details
 */
export async function modeIndicatorContains(page: Page, text: string): Promise<boolean> {
  const mode = await getCurrentMode(page)
  // Map expected text to actual modes
  const modeMap: Record<string, string[]> = {
    "NORMAL": ["NAVIGATION", "NORMAL", "hjkl to move"],
    "INSERT": ["INSERT", "EDIT", "ESC to normal", "i/a to insert"],
    "VISUAL": ["VISUAL"],
    "COMMAND": ["COMMAND"],
  }
  
  // Check if current mode matches any expected text
  for (const [actualMode, expectedTexts] of Object.entries(modeMap)) {
    if (mode === actualMode && expectedTexts.some(t => text.includes(t))) {
      return true
    }
  }
  
  return false
}

/**
 * Wait for a specific mode
 */
export async function waitForMode(page: Page, expectedMode: string, timeout = 1000): Promise<void> {
  await page.waitForFunction(
    async (expectedMode) => {
      const modeElement = document.querySelector(".status-bar span:last-child span")
      const currentMode = modeElement?.textContent?.trim()
      return currentMode === expectedMode
    },
    expectedMode,
    { timeout }
  )
}