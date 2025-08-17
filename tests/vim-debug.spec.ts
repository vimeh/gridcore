import { test } from "@playwright/test";

test("debug visual mode transition", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");

  // Enter edit mode
  await page.keyboard.press("i");
  await page.keyboard.type("Select me");

  // Go to normal mode
  await page.keyboard.press("Escape");

  // Enter visual mode
  await page.keyboard.press("v");

  // Check visual mode
  const visualIndicator = page.locator(".mode-indicator");
  const visualText = await visualIndicator.textContent();
  console.log("After pressing 'v', mode indicator text:", visualText);

  // Exit visual mode
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);

  // Check what mode we're in now
  const normalIndicator = page.locator(".mode-indicator");
  const normalText = await normalIndicator.textContent();
  console.log("After escaping from visual, mode indicator text:", normalText);

  // Check if we can find any mode indicator
  const allIndicators = await page.locator(".mode-indicator").all();
  console.log("Number of mode indicators:", allIndicators.length);
  for (let i = 0; i < allIndicators.length; i++) {
    const text = await allIndicators[i].textContent();
    console.log(`Indicator ${i}: "${text}"`);
  }
});
