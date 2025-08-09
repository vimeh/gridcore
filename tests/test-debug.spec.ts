import { test } from "@playwright/test";

test("debug navigation", async ({ page }) => {
  // Listen to all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });
  
  await page.goto("http://localhost:8081");
  await page.waitForSelector("canvas");
  
  console.log("=== Pressing 'l' key ===");
  await page.keyboard.press("l");
  
  await page.waitForTimeout(1000);
  
  console.log("=== Pressing 'j' key ===");
  await page.keyboard.press("j");
  
  await page.waitForTimeout(1000);
});