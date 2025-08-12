import { test } from "@playwright/test";

test("Debug demo mode execution", async ({ page }) => {
  test.setTimeout(30000); // Increase timeout to 30 seconds

  // Enable console logging
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      console.error(`[Browser Error]: ${text}`);
    } else if (type === "warning") {
      console.warn(`[Browser Warning]: ${text}`);
    } else {
      console.log(`[Browser ${type}]: ${text}`);
    }
  });

  // Log any page errors
  page.on("pageerror", (error) => {
    console.error(`[Page Error]: ${error.message}`);
    console.error(error.stack);
  });

  // Step 1: Navigate to localhost:8080
  console.log("\n=== Step 1: Opening localhost:8080 ===");
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Wait for the grid to be visible
  await page.waitForSelector("canvas", { timeout: 5000 });
  console.log("Page loaded, canvas element found");

  // Step 2: Check initial console for JavaScript errors
  console.log("\n=== Step 2: Checking for initial JavaScript errors ===");
  await page.waitForTimeout(1000); // Give time for any errors to appear

  // Step 3: Click on the "Demo Mode" button
  console.log("\n=== Step 3: Clicking Demo Mode button ===");
  const demoButton = page.locator('button:has-text("Demo Mode")').first();
  if (await demoButton.isVisible()) {
    await demoButton.click();
    console.log("Demo Mode button clicked");
  } else {
    console.log(
      "Demo Mode button not found, looking for alternative selectors...",
    );
    // Try alternative selectors
    const altButton = page.locator('text="Demo Mode"').first();
    if (await altButton.isVisible()) {
      await altButton.click();
      console.log("Demo Mode button clicked (alternative selector)");
    }
  }

  await page.waitForTimeout(500);

  // Step 4: Select "Basic Operations" from dropdown
  console.log("\n=== Step 4: Selecting 'Basic Operations' from dropdown ===");
  const dropdown = page.locator("select").first();
  if (await dropdown.isVisible()) {
    await dropdown.selectOption({ label: "Basic Operations" });
    console.log("Selected 'Basic Operations' from dropdown");
  } else {
    console.log("Dropdown not found");
  }

  await page.waitForTimeout(500);

  // Step 5: Click the "Start" button
  console.log("\n=== Step 5: Clicking Start button ===");
  const startButton = page.locator('button:has-text("Start")').first();
  if (await startButton.isVisible()) {
    await startButton.click();
    console.log("Start button clicked");
  } else {
    console.log("Start button not found");
  }

  // Step 6: Check console for error messages after starting
  console.log("\n=== Step 6: Monitoring console after Start ===");
  await page.waitForTimeout(2000); // Wait for demo to potentially run

  // Step 7: Check performance overlay
  console.log("\n=== Step 7: Checking performance overlay ===");
  const perfElements = await page.locator(".performance-stat").all();
  for (const element of perfElements) {
    const text = await element.textContent();
    console.log(`Performance stat: ${text}`);
  }

  // Also check for any element that might show FPS or other metrics
  const fpsElement = page.locator("text=/FPS:/i").first();
  if (await fpsElement.isVisible()) {
    const fpsText = await fpsElement.textContent();
    console.log(`FPS display: ${fpsText}`);
  }

  // Step 8: Try clicking Step button manually
  console.log("\n=== Step 8: Clicking Step button manually ===");
  const stepButton = page.locator('button:has-text("Step")').first();
  if (await stepButton.isVisible()) {
    for (let i = 1; i <= 3; i++) {
      console.log(`Clicking Step button (attempt ${i})...`);
      await stepButton.click();
      await page.waitForTimeout(500);

      // Check for any changes in the grid or console
      const activeCell = page.locator(".cell.active, .cell.selected").first();
      if (await activeCell.isVisible()) {
        const cellInfo = await activeCell.textContent();
        console.log(`Active cell after step ${i}: ${cellInfo}`);
      }
    }
  } else {
    console.log("Step button not found");
  }

  // Step 9: Final state report
  console.log("\n=== Step 9: Final State Report ===");

  // Check demo status
  const statusElement = page.locator(".demo-status, .status").first();
  if (await statusElement.isVisible()) {
    const status = await statusElement.textContent();
    console.log(`Demo status: ${status}`);
  }

  // Check if demo is still running
  const pauseButton = page.locator('button:has-text("Pause")').first();
  const isRunning = await pauseButton.isVisible();
  console.log(`Demo appears to be running: ${isRunning}`);

  // Take a screenshot for visual inspection
  await page.screenshot({ path: "demo-debug-screenshot.png", fullPage: true });
  console.log("Screenshot saved as demo-debug-screenshot.png");

  // Keep the browser open for a bit to catch any delayed errors
  console.log("\n=== Waiting for any delayed errors... ===");
  await page.waitForTimeout(3000);

  console.log("\n=== Debug session complete ===");
});
