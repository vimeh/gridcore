import { expect, test } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("should load the application", async ({ page }) => {
    await page.goto("/");

    // Check that main elements are present for Leptos app
    await expect(page).toHaveTitle("GridCore - Spreadsheet");
    await expect(page.locator("#app")).toBeVisible();
    // Canvas and formula bar should be visible
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator(".formula-bar")).toBeVisible();
  });

  test("should have status bar visible", async ({ page }) => {
    await page.goto("/");

    // Status bar should be visible
    const statusBar = page.locator(".status-bar");
    await expect(statusBar).toBeVisible();
    // Check for mode indicator
    await expect(statusBar).toContainText("NAVIGATION");
  });

  test("should have grid canvas visible", async ({ page }) => {
    await page.goto("/");

    // Check that the canvas element is present
    await expect(page.locator("canvas")).toBeVisible();

    // Check formula bar input is present
    await expect(
      page.locator(".formula-bar input.formula-input"),
    ).toBeVisible();
  });
});
