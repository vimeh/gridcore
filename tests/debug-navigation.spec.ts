import { test } from "@playwright/test";

test("debug navigation", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Wait for canvas to be ready
  await page.waitForSelector("canvas");

  // Get the grid wrapper and focus it
  const gridWrapper = page.locator(".canvas-grid-wrapper");
  await gridWrapper.focus();

  // Open console to see logs
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  // Check initial cell indicator
  const cellIndicator = page.locator(".cell-indicator");
  const initialText = await cellIndicator.textContent();
  console.log("Initial cell indicator:", initialText);

  // Try pressing 'l' to move right
  console.log("Pressing 'l' key...");
  await page.keyboard.press("l");

  // Wait a bit for state to update
  await page.waitForTimeout(500);

  // Check cell indicator again
  const afterLText = await cellIndicator.textContent();
  console.log("After 'l' cell indicator:", afterLText);

  // Try pressing 'j' to move down
  console.log("Pressing 'j' key...");
  await page.keyboard.press("j");

  await page.waitForTimeout(500);

  const afterJText = await cellIndicator.textContent();
  console.log("After 'j' cell indicator:", afterJText);

  // Keep browser open for debugging
  await page.pause();
});
