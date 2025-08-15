import { test } from "@playwright/test";

test("check for browser errors during navigation", async ({ page }) => {
  // Listen to all console messages including errors
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    console.log(text);
    logs.push(text);
  });

  // Listen for page errors (JavaScript errors)
  page.on("pageerror", (error) => {
    console.error(`[PAGE ERROR] ${error.message}`);
    logs.push(`[PAGE ERROR] ${error.message}`);
  });

  await page.goto("/");
  await page.waitForSelector("canvas");

  console.log("=== Attempting navigation with 'l' key ===");
  await page.keyboard.press("l");

  await page.waitForTimeout(1000);

  // Check if there were any errors
  const errors = logs.filter(
    (log) =>
      log.includes("error") || log.includes("ERROR") || log.includes("panic"),
  );
  if (errors.length > 0) {
    console.log("Found errors:");
    errors.forEach((err) => console.log(err));
  }
});
