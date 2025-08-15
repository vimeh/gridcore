import type { Page } from "@playwright/test";
import { selectors } from "./selectors";

/**
 * Test utility functions to abstract differences between TypeScript and Leptos UI
 */

/**
 * Get the current mode from the status bar
 */
export async function getCurrentMode(page: Page): Promise<string> {
  const modeElement = await page.locator(selectors.statusBarMode);
  const text = await modeElement.textContent();
  return text?.trim() || "";
}

/**
 * Check if the cell editor is currently visible
 */
export async function isEditingCell(page: Page): Promise<boolean> {
  const editor = page.locator(selectors.cellEditor);
  return await editor.isVisible();
}

/**
 * Get the current cell address
 * Note: In Leptos UI, this is shown in the cell-indicator input element
 */
export async function getCurrentCellAddress(page: Page): Promise<string> {
  const cellIndicator = page.locator(selectors.formulaBarAddress);
  const value = await cellIndicator.inputValue();
  return value?.trim() || "";
}

/**
 * Get the current cell value from the formula bar
 */
export async function getCurrentCellValue(page: Page): Promise<string> {
  const formulaInput = page.locator(selectors.formulaBarInput);
  // Try to get value first (if it's an input), otherwise get text content
  const value = await formulaInput.inputValue().catch(() => null);
  if (value !== null) return value;

  const text = await formulaInput.textContent();
  return text?.trim() || "";
}

/**
 * Navigate to a specific cell using keyboard
 */
export async function navigateToCell(
  page: Page,
  targetCol: number,
  targetRow: number,
): Promise<void> {
  // Start from A1 (0,0)
  // Navigate right to target column
  for (let col = 0; col < targetCol; col++) {
    await page.keyboard.press("l");
  }
  // Navigate down to target row
  for (let row = 0; row < targetRow; row++) {
    await page.keyboard.press("j");
  }
}

/**
 * Start editing the current cell
 */
export async function startEditing(
  page: Page,
  mode: "i" | "a" | "Enter" = "i",
): Promise<void> {
  await page.keyboard.press(mode);
  // Wait for editor to appear
  await page.waitForSelector(selectors.cellEditor, {
    state: "visible",
    timeout: 1000,
  });
}

/**
 * Exit editing mode and save changes
 */
export async function exitEditingAndSave(page: Page): Promise<void> {
  // In vim mode, double Escape saves and exits
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  // Wait for editor to disappear
  await page.waitForSelector(selectors.cellEditor, {
    state: "hidden",
    timeout: 1000,
  });
}

/**
 * Focus the grid for keyboard navigation
 */
export async function focusGrid(page: Page): Promise<void> {
  const gridWrapper = page.locator(selectors.gridWrapper);
  await gridWrapper.focus();
}

/**
 * Check if a mode indicator contains specific text
 * This is a compatibility function for tests expecting mode details
 */
export async function modeIndicatorContains(
  page: Page,
  text: string,
): Promise<boolean> {
  const mode = await getCurrentMode(page);
  // Map expected text to actual modes
  const modeMap: Record<string, string[]> = {
    NORMAL: ["NAVIGATION", "NORMAL", "hjkl to move"],
    INSERT: ["INSERT", "EDIT", "ESC to normal", "i/a to insert"],
    VISUAL: ["VISUAL"],
    COMMAND: ["COMMAND"],
  };

  // Check if current mode matches any expected text
  for (const [actualMode, expectedTexts] of Object.entries(modeMap)) {
    if (mode === actualMode && expectedTexts.some((t) => text.includes(t))) {
      return true;
    }
  }

  return false;
}

/**
 * Wait for a specific mode
 */
export async function waitForMode(
  page: Page,
  expectedMode: string,
  timeout = 1000,
): Promise<void> {
  await page.waitForFunction(
    async (expectedMode) => {
      const modeElement = document.querySelector(
        ".status-bar span:last-child span",
      );
      const currentMode = modeElement?.textContent?.trim();
      return currentMode === expectedMode;
    },
    expectedMode,
    { timeout },
  );
}

/**
 * Wait for an error message to appear
 */
export async function waitForError(
  page: Page,
  expectedMessage?: string,
  timeout = 5000,
): Promise<void> {
  await page.waitForSelector(selectors.errorMessage, {
    state: "visible",
    timeout,
  });

  if (expectedMessage) {
    await page.waitForFunction(
      (expectedMsg) => {
        const errorTexts = Array.from(document.querySelectorAll(".error-text"));
        return errorTexts.some((el) => el.textContent?.includes(expectedMsg));
      },
      expectedMessage,
      { timeout },
    );
  }
}

/**
 * Check if an error is currently displayed
 */
export async function hasError(
  page: Page,
  severity?: "error" | "warning" | "info",
): Promise<boolean> {
  const selector = severity
    ? `.error-message.${severity}`
    : selectors.errorMessage;

  const errorElement = page.locator(selector);
  return await errorElement.isVisible().catch(() => false);
}

/**
 * Get all current error messages
 */
export async function getErrorMessages(page: Page): Promise<string[]> {
  const errorTexts = await page.locator(selectors.errorText).all();
  const messages: string[] = [];

  for (const element of errorTexts) {
    const text = await element.textContent();
    if (text) messages.push(text.trim());
  }

  return messages;
}

/**
 * Dismiss a specific error or all errors
 */
export async function dismissError(
  page: Page,
  messageText?: string,
): Promise<void> {
  if (messageText) {
    // Find the specific error message and dismiss it
    const errorMessages = await page.locator(selectors.errorMessage).all();
    for (const msg of errorMessages) {
      const text = await msg.locator(selectors.errorText).textContent();
      if (text?.includes(messageText)) {
        await msg.locator(selectors.errorDismissButton).click();
        break;
      }
    }
  } else {
    // Dismiss all errors
    const dismissButtons = await page
      .locator(selectors.errorDismissButton)
      .all();
    for (const button of dismissButtons) {
      await button.click();
    }
  }
}

/**
 * Enter a formula and wait for processing
 */
export async function enterFormula(page: Page, formula: string): Promise<void> {
  // Start editing mode with Enter to clear content
  await page.keyboard.press("Enter");
  await page.waitForSelector(selectors.cellEditor, {
    state: "visible",
    timeout: 1000,
  });

  // Type the formula
  await page.keyboard.type(formula);

  // Exit Insert mode to Normal mode, then save and exit
  await page.keyboard.press("Escape"); // Exit Insert mode to Normal mode
  await page.keyboard.press("Escape"); // Save and exit from Normal mode

  // Wait for editor to disappear
  await page.waitForSelector(selectors.cellEditor, {
    state: "hidden",
    timeout: 1000,
  });

  // Give formula time to process
  await page.waitForTimeout(100);
}

/**
 * Check if a cell displays an error value
 */
export async function cellHasErrorValue(
  page: Page,
  expectedError: string,
): Promise<boolean> {
  const formulaValue = await getCurrentCellValue(page);
  return formulaValue.includes(expectedError);
}

/**
 * Wait for the grid to be fully loaded and ready
 */
export async function waitForGrid(page: Page, timeout = 5000): Promise<void> {
  // Wait for the grid wrapper to be visible
  await page.waitForSelector(selectors.gridWrapper, {
    state: "visible",
    timeout,
  });
  
  // Wait for canvas to be ready
  await page.waitForSelector('canvas', {
    state: "visible",
    timeout,
  });
  
  // Give a bit more time for initial render
  await page.waitForTimeout(200);
}

/**
 * Get a selector for a specific cell (used for testing cell content)
 * Note: This is for canvas-based grid, so we can't directly select cells
 */
export function getCellSelector(col: number, row: number): string {
  // For canvas-based grid, we don't have individual cell selectors
  // This is kept for API compatibility
  return `cell-${col}-${row}`;
}

/**
 * Press a key with optional modifiers
 */
export async function pressKey(
  page: Page,
  key: string,
  modifiers?: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    meta?: boolean;
  }
): Promise<void> {
  const keys: string[] = [];
  
  if (modifiers?.shift) keys.push('Shift');
  if (modifiers?.ctrl) keys.push('Control');
  if (modifiers?.alt) keys.push('Alt');
  if (modifiers?.meta) keys.push('Meta');
  
  keys.push(key);
  
  if (keys.length > 1) {
    await page.keyboard.press(keys.join('+'));
  } else {
    await page.keyboard.press(key);
  }
}
