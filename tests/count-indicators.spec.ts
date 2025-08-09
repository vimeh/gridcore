import { test } from "@playwright/test";

test("count mode indicators", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("canvas");
  
  const indicators = await page.locator(".mode-indicator").all();
  console.log("Number of .mode-indicator elements:", indicators.length);
  
  for (let i = 0; i < indicators.length; i++) {
    const text = await indicators[i].textContent();
    const isVisible = await indicators[i].isVisible();
    console.log(`Indicator ${i}: visible=${isVisible}, text="${text}"`);
  }
  
  // Check for .mode-text elements
  const texts = await page.locator(".mode-text").all();
  console.log("\nNumber of .mode-text elements:", texts.length);
  for (let i = 0; i < texts.length; i++) {
    const text = await texts[i].textContent();
    console.log(`Mode text ${i}: "${text}"`);
  }
  
  // Check for .mode-detail elements  
  const details = await page.locator(".mode-detail").all();
  console.log("\nNumber of .mode-detail elements:", details.length);
  for (let i = 0; i < details.length; i++) {
    const text = await details[i].textContent();
    console.log(`Mode detail ${i}: "${text}"`);
  }
});