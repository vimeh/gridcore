import { expect, test } from "@playwright/test";
import { selectors, waitForApp } from "./helpers/selectors";
import {
  dismissError,
  enterFormula,
  getErrorMessages,
  hasError,
  navigateToCell,
  waitForError,
} from "./helpers/test-utils";

test.describe("Error UI Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test.describe("Error Toast Notifications", () => {
    test("should display error toast in top-right corner", async ({ page }) => {
      // Trigger an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Check error container exists and is positioned correctly
      const errorContainer = page.locator(selectors.errorDisplay);
      await expect(errorContainer).toBeVisible();

      // Verify positioning
      const box = await errorContainer.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        const viewport = page.viewportSize();
        if (viewport) {
          // Should be in top-right corner
          expect(box.y).toBeLessThan(100); // Near top
          expect(box.x + box.width).toBeGreaterThan(viewport.width - 100); // Near right edge
        }
      }
    });

    test("should display multiple errors stacked vertically", async ({
      page,
    }) => {
      // Create multiple errors
      await enterFormula(page, "=1/0");
      await waitForError(page);

      await navigateToCell(page, 1, 0); // B1
      await enterFormula(page, "=UNKNOWN()");
      await waitForError(page);

      await navigateToCell(page, 2, 0); // C1
      await enterFormula(page, "=INVALID()");
      await waitForError(page);

      // Check that multiple error messages are visible
      const errorMessages = page.locator(selectors.errorMessage);
      const count = await errorMessages.count();
      expect(count).toBeGreaterThanOrEqual(3);

      // Verify they are stacked (each one below the previous)
      const boxes = [];
      for (let i = 0; i < count; i++) {
        const box = await errorMessages.nth(i).boundingBox();
        if (box) boxes.push(box);
      }

      // Check vertical stacking
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
      }
    });

    test("should show dismiss button on each error", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Check dismiss button is visible
      const dismissButton = page.locator(selectors.errorDismissButton).first();
      await expect(dismissButton).toBeVisible();

      // Check it has the × character
      const buttonText = await dismissButton.textContent();
      expect(buttonText).toBe("×");
    });

    test("should dismiss individual errors when X is clicked", async ({
      page,
    }) => {
      // Create two different errors
      await enterFormula(page, "=1/0");
      await waitForError(page);

      await navigateToCell(page, 1, 0);
      await enterFormula(page, "=UNKNOWN()");
      await waitForError(page);

      // Count initial errors
      const initialCount = await page.locator(selectors.errorMessage).count();
      expect(initialCount).toBe(2);

      // Dismiss the first error
      await page.locator(selectors.errorDismissButton).first().click();

      // Should have one less error
      await page.waitForTimeout(300); // Wait for animation
      const afterDismissCount = await page
        .locator(selectors.errorMessage)
        .count();
      expect(afterDismissCount).toBe(initialCount - 1);

      // The remaining error should be the second one
      const remainingErrors = await getErrorMessages(page);
      expect(remainingErrors.some((e) => e.includes("#NAME?") || e.includes("Unknown"))).toBeTruthy();
    });
  });

  test.describe("Error Severity Levels", () => {
    test("should display errors with red styling", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Check error has correct class and styling
      const errorElement = page.locator(selectors.errorMessageError).first();
      await expect(errorElement).toBeVisible();

      // Verify red background color
      const backgroundColor = await errorElement.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor,
      );

      // Should be red (#ff4444 = rgb(255, 68, 68))
      expect(backgroundColor).toMatch(/rgb.*255.*68.*68|#ff4444/i);
    });

    test("should display warnings with orange styling", async ({ page }) => {
      // This test requires a way to trigger warnings
      // For now, we'll check the CSS class exists
      const _warningSelector = selectors.errorMessageWarning;

      // If we had a warning, it would have orange background
      // This is a placeholder test for when warnings are implemented
      test.skip();
    });

    test("should display info messages with blue styling", async ({ page }) => {
      // This test requires a way to trigger info messages
      // For now, we'll check the CSS class exists
      const _infoSelector = selectors.errorMessageInfo;

      // If we had an info message, it would have blue background
      // This is a placeholder test for when info messages are implemented
      test.skip();
    });
  });

  test.describe("Error Animation", () => {
    test("should animate error messages sliding in from right", async ({
      page,
    }) => {
      // Clear any existing errors first
      await dismissError(page);

      // Trigger a new error and watch for animation
      await enterFormula(page, "=1/0");

      // The error should slide in (check CSS animation)
      const errorElement = page.locator(selectors.errorMessage).first();
      await expect(errorElement).toBeVisible();

      // Check that slideIn animation is applied
      const animation = await errorElement.evaluate(
        (el) => window.getComputedStyle(el).animationName,
      );
      expect(animation).toBe("slideIn");
    });

    test("should have smooth opacity transition on hover", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Check dismiss button opacity changes on hover
      const dismissButton = page.locator(selectors.errorDismissButton).first();

      // Initial opacity
      const initialOpacity = await dismissButton.evaluate(
        (el) => window.getComputedStyle(el).opacity,
      );
      expect(initialOpacity).toBe("0.8");

      // Hover over button
      await dismissButton.hover();
      await page.waitForTimeout(300); // Wait for transition

      // Opacity should increase
      const hoverOpacity = await dismissButton.evaluate(
        (el) => window.getComputedStyle(el).opacity,
      );
      expect(hoverOpacity).toBe("1");
    });
  });

  test.describe("Error Accessibility", () => {
    test("should be keyboard accessible", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Tab to the dismiss button
      const dismissButton = page.locator(selectors.errorDismissButton).first();

      // Focus should be able to reach the dismiss button
      await dismissButton.focus();
      const isFocused = await dismissButton.evaluate(
        (el) => document.activeElement === el,
      );
      expect(isFocused).toBeTruthy();

      // Should be able to dismiss with Enter key
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      // Error should be dismissed
      await expect(page.locator(selectors.errorMessage)).not.toBeVisible();
    });

    test("should have appropriate ARIA attributes", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      const errorElement = page.locator(selectors.errorMessage).first();

      // Check for role attribute (should be alert or status)
      const role = await errorElement.getAttribute("role");
      if (role) {
        expect(["alert", "status", "log"].includes(role)).toBeTruthy();
      }

      // Dismiss button should have aria-label
      const dismissButton = page.locator(selectors.errorDismissButton).first();
      const ariaLabel = await dismissButton.getAttribute("aria-label");
      if (ariaLabel) {
        expect(ariaLabel.toLowerCase()).toContain("dismiss");
      }
    });
  });

  test.describe("Error Persistence", () => {
    test("errors should persist across cell navigation", async ({ page }) => {
      // Create an error
      await enterFormula(page, "=1/0");
      await waitForError(page);

      // Navigate to different cells
      await navigateToCell(page, 2, 2); // C3
      await navigateToCell(page, 5, 5); // F6
      await navigateToCell(page, 0, 0); // Back to A1

      // Error should still be visible
      await expect(page.locator(selectors.errorMessage)).toBeVisible();
      const errors = await getErrorMessages(page);
      expect(errors.some((e) => e.includes("DIV/0"))).toBeTruthy();
    });

    test("should handle rapid error generation", async ({ page }) => {
      // Quickly create multiple errors
      for (let i = 0; i < 5; i++) {
        await navigateToCell(page, i, 0);
        await page.keyboard.press("i");
        await page.keyboard.type(`=1/0`);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
      }

      // Wait a bit for all errors to appear
      await page.waitForTimeout(500);

      // Should have multiple error messages
      const errorCount = await page.locator(selectors.errorMessage).count();
      expect(errorCount).toBeGreaterThan(0);

      // All should be dismissible
      while (await hasError(page)) {
        await page.locator(selectors.errorDismissButton).first().click();
        await page.waitForTimeout(100);
      }

      // All errors should be gone
      await expect(page.locator(selectors.errorMessage)).not.toBeVisible();
    });
  });

  test.describe("Error Message Content", () => {
    test("should display user-friendly error messages", async ({ page }) => {
      // Test division by zero
      await enterFormula(page, "=1/0");
      await waitForError(page);
      let errors = await getErrorMessages(page);
      expect(
        errors.some(
          (e) => e.includes("#DIV/0!") || e.includes("Division by zero"),
        ),
      ).toBeTruthy();

      // Clear errors
      await dismissError(page);

      // Test unknown function
      await navigateToCell(page, 1, 0);
      await enterFormula(page, "=NOTREAL()");
      await waitForError(page);
      errors = await getErrorMessages(page);
      expect(
        errors.some(
          (e) => e.includes("#NAME?") || e.includes("Unknown name or function") || e.includes("NOTREAL"),
        ),
      ).toBeTruthy();
    });

    test("should truncate very long error messages", async ({ page }) => {
      // Create a formula with a very long invalid function name
      const longName = "VERYLONGFUNCTIONNAME".repeat(10);
      await enterFormula(page, `=${longName}()`);
      await waitForError(page);

      // Check that error message container has reasonable width
      const errorElement = page.locator(selectors.errorMessage).first();
      const box = await errorElement.boundingBox();

      if (box) {
        // Error message shouldn't be wider than 400px (as defined in CSS)
        expect(box.width).toBeLessThanOrEqual(450); // Some padding
      }

      // Text should wrap or be truncated
      const errorText = page.locator(selectors.errorText).first();
      const textBox = await errorText.boundingBox();
      if (textBox && box) {
        expect(textBox.width).toBeLessThan(box.width);
      }
    });
  });
});
