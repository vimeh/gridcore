import { test } from "@playwright/test";

test("debug single Enter key", async ({ page }) => {
  // Listen to all console messages
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.includes("ERROR") ||
      text.includes("Failed") ||
      text.includes("Controller handle_keyboard_event returned")
    ) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });

  await page.goto("/");
  await page.waitForSelector("canvas");

  console.log("=== About to press Enter ===");
  await page.keyboard.press("Enter");

  // Wait for any async operations
  await page.waitForTimeout(1000);

  console.log("=== Test complete ===");
});
