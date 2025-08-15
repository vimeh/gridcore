import { test } from "@playwright/test";

test("debug Enter key with all logs", async ({ page }) => {
  // Capture ALL console messages
  const logs: string[] = [];
  page.on("console", (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  page.on("pageerror", (error) => {
    console.error(`[PAGE ERROR] ${error.message}`);
    logs.push(`[PAGE ERROR] ${error.message}`);
  });

  await page.goto("/");
  await page.waitForSelector("canvas");

  console.log("=== About to press Enter ===");
  await page.keyboard.press("Enter");

  // Wait for processing
  await page.waitForTimeout(500);

  console.log("\n=== Looking for issues in logs ===");
  const relevantLogs = logs.filter(
    (log) =>
      log.includes("ERROR") ||
      log.includes("Failed") ||
      log.includes("panic") ||
      log.includes("unreachable") ||
      log.includes("Controller handle_keyboard_event returned") ||
      log.includes("Controller state after") ||
      log.includes("Error handling keyboard"),
  );

  if (relevantLogs.length > 0) {
    console.log("Found relevant logs:");
    relevantLogs.forEach((log) => console.log(log));
  } else {
    console.log("No error or result logs found");
  }

  // Check the last few logs
  console.log("\n=== Last 5 logs ===");
  logs.slice(-5).forEach((log) => console.log(log));
});
