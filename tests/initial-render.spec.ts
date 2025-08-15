import { expect, test } from "@playwright/test";

test.describe("Initial Render Tests", () => {
  test("grid should render immediately without user interaction", async ({
    page,
  }) => {
    // Navigate to the application
    await page.goto("/");

    // Wait for the canvas to be visible
    const canvas = page.locator("canvas.grid-canvas");
    await expect(canvas).toBeVisible();

    // Take a screenshot to capture the initial state
    const screenshot = await page.screenshot();

    // Get canvas context to check if it has been drawn
    const canvasHasContent = await page.evaluate(() => {
      const canvas = document.querySelector(
        "canvas.grid-canvas",
      ) as HTMLCanvasElement;
      if (!canvas) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Get image data to check if anything has been drawn
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check if any pixel is not white (255,255,255)
      // Grid lines, headers, or cell content would make some pixels non-white
      for (let i = 0; i < data.length; i += 4) {
        // Check RGB values (ignore alpha)
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
          return true; // Found non-white pixel, grid has been rendered
        }
      }

      return false;
    });

    // Assert that the canvas has content (grid has been rendered)
    expect(canvasHasContent).toBe(true);
  });

  test("column headers should be visible on initial load", async ({ page }) => {
    await page.goto("/");

    // Wait for canvas to be visible
    await expect(page.locator("canvas.grid-canvas")).toBeVisible();

    // Check that column headers are rendered by looking for column labels
    const hasColumnHeaders = await page.evaluate(() => {
      const canvas = document.querySelector(
        "canvas.grid-canvas",
      ) as HTMLCanvasElement;
      if (!canvas) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Check top area of canvas for header background color
      const imageData = ctx.getImageData(50, 5, 10, 10);
      const data = imageData.data;

      // Headers have a light gray background (#f5f5f5)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 245 && data[i + 1] === 245 && data[i + 2] === 245) {
          return true;
        }
      }

      return false;
    });

    expect(hasColumnHeaders).toBe(true);
  });

  test("row headers should be visible on initial load", async ({ page }) => {
    await page.goto("/");

    // Wait for canvas to be visible
    await expect(page.locator("canvas.grid-canvas")).toBeVisible();

    // Check that row headers are rendered
    const hasRowHeaders = await page.evaluate(() => {
      const canvas = document.querySelector(
        "canvas.grid-canvas",
      ) as HTMLCanvasElement;
      if (!canvas) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Check left area of canvas for header background color
      const imageData = ctx.getImageData(5, 50, 10, 10);
      const data = imageData.data;

      // Headers have a light gray background (#f5f5f5)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 245 && data[i + 1] === 245 && data[i + 2] === 245) {
          return true;
        }
      }

      return false;
    });

    expect(hasRowHeaders).toBe(true);
  });

  test("initial cell data should be rendered", async ({ page }) => {
    await page.goto("/");

    // Wait for canvas to be visible
    await expect(page.locator("canvas.grid-canvas")).toBeVisible();

    // Wait a bit for data to render
    await page.waitForTimeout(500);

    // Check that cell data has been rendered (looking for text/non-background pixels)
    const hasCellData = await page.evaluate(() => {
      const canvas = document.querySelector(
        "canvas.grid-canvas",
      ) as HTMLCanvasElement;
      if (!canvas) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Sample the area where cells would be (avoiding headers)
      const imageData = ctx.getImageData(100, 50, 200, 200);
      const data = imageData.data;

      // Look for black or dark pixels that would indicate text
      for (let i = 0; i < data.length; i += 4) {
        // Check for dark pixels (text is usually black or dark gray)
        if (data[i] < 100 && data[i + 1] < 100 && data[i + 2] < 100) {
          return true;
        }
      }

      return false;
    });

    expect(hasCellData).toBe(true);
  });

  test("active cell border should be visible on initial load", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for canvas to be visible
    await expect(page.locator("canvas.grid-canvas")).toBeVisible();

    // Check for active cell border (blue border #007bff)
    const hasActiveCellBorder = await page.evaluate(() => {
      const canvas = document.querySelector(
        "canvas.grid-canvas",
      ) as HTMLCanvasElement;
      if (!canvas) return false;

      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Sample the canvas for blue pixels from active cell border
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Look for blue pixels (#007bff = 0,123,255)
      for (let i = 0; i < data.length; i += 4) {
        // Allow some tolerance for anti-aliasing
        if (
          data[i] < 50 &&
          data[i + 1] > 100 &&
          data[i + 1] < 150 &&
          data[i + 2] > 200
        ) {
          return true;
        }
      }

      return false;
    });

    expect(hasActiveCellBorder).toBe(true);
  });
});
