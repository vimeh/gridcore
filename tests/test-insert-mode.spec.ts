import { expect, test } from "@playwright/test";

test("debug insert mode", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  
  // Navigate to B1
  await page.keyboard.press("l");
  await page.waitForTimeout(100);
  
  // Enter insert mode
  await page.keyboard.press("i");
  await page.waitForTimeout(100);
  
  // Wait for textarea to be visible and focused
  const textarea = page.locator("textarea");
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeFocused();
  
  // Check initial value
  const initialValue = await textarea.inputValue();
  console.log("Initial textarea value:", initialValue);
  
  // Use page.keyboard.type like the original test
  await page.keyboard.type("New");
  await page.waitForTimeout(100);
  
  // Check value after typing
  const afterTypingValue = await textarea.inputValue();
  console.log("After typing 'New':", afterTypingValue);
  
  // Exit editing
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  
  // Check final value
  const finalValue = await page.locator(".formula-input").inputValue();
  console.log("Final formula bar value:", finalValue);
  
  expect(finalValue).toBe("NewWorld");
});