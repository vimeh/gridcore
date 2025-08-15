import { expect, test } from "@playwright/test";

test("debug navigation and cell indicator", async ({ page }) => {
  // Listen to all console messages
  page.on("console", (msg) => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto("/");
  await page.waitForSelector("canvas");

  // Get initial cell indicator value
  const initialValue = await page.locator(".cell-indicator").inputValue();
  console.log(`Initial cell indicator: ${initialValue}`);
  expect(initialValue).toBe("A1");

  console.log("=== Pressing 'l' key ===");
  await page.keyboard.press("l");

  await page.waitForTimeout(500);

  // Get updated cell indicator value
  const afterL = await page.locator(".cell-indicator").inputValue();
  console.log(`Cell indicator after 'l': ${afterL}`);

  console.log("=== Pressing 'j' key ===");
  await page.keyboard.press("j");

  await page.waitForTimeout(500);

  const afterJ = await page.locator(".cell-indicator").inputValue();
  console.log(`Cell indicator after 'j': ${afterJ}`);

  // Check expected values
  expect(afterL).toBe("B1");
  expect(afterJ).toBe("B2");
});
