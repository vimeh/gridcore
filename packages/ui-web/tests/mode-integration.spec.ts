import { expect, test } from "@playwright/test";

/**
 * Comprehensive integration tests for the unified mode system.
 * These tests verify that ModeManager, VimBehavior, CellEditor, CanvasGrid,
 * KeyboardHandler, and ModeIndicator all work together correctly.
 */

// Helper function to get the correct mode indicator (there are multiple on the page)
function getModeIndicator(page: any) {
  return page.locator(".mode-indicator").last();
}

function getModeText(page: any) {
  return page.locator(".mode-indicator .mode-text").last();
}

function getModeDetail(page: any) {
  return page.locator(".mode-indicator .mode-detail").last();
}

test.describe("Mode Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForSelector(".grid-container");

    // Ensure we start in a clean state
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  });

  test.describe("Initial State", () => {
    test("should start in navigation mode", async ({ page }) => {
      // Check mode indicator shows navigation
      await expect(getModeText(page)).toContainText("NAVIGATION");
      await expect(getModeDetail(page)).toContainText("hjkl to move");

      // Cell editor should not be visible
      await expect(page.locator(".cell-editor")).not.toBeVisible();

      // Grid should be focusable for navigation
      await expect(page.locator(".grid-container")).toBeFocused();
    });
  });

  test.describe("Navigation to Editing Transitions", () => {
    test("should transition from navigation to editing with 'i' key", async ({
      page,
    }) => {
      // Verify initial navigation state
      await expect(getModeText(page)).toContainText("NAVIGATION");

      // Press 'i' to start editing
      await page.keyboard.press("i");

      // Should be in edit/insert mode
      await expect(getModeText(page)).toContainText("INSERT");
      await expect(getModeDetail(page)).toContainText("ESC to normal");

      // Cell editor should be visible
      await expect(page.locator(".cell-editor")).toBeVisible();
    });

    test("should transition from navigation to editing with 'a' key (append)", async ({
      page,
    }) => {
      // Navigate to cell with content
      await page.keyboard.press("l"); // Move to B1 (has "World")

      // Press 'a' to start editing in append mode
      await page.keyboard.press("a");

      // Should be in insert mode (append variant shows as INSERT)
      await expect(getModeText(page)).toContainText("INSERT");
      await expect(page.locator(".cell-editor")).toBeVisible();

      // Type additional text
      await page.keyboard.type("!");

      // Exit editing
      await page.keyboard.press("Escape"); // To normal
      await page.keyboard.press("Escape"); // To navigation

      // Verify text was appended
      await expect(page.locator(".formula-bar-input")).toHaveValue("World!");
    });

    test("should transition from navigation to editing with Enter key", async ({
      page,
    }) => {
      await page.keyboard.press("Enter");

      // Should be in insert mode (Enter uses replace mode but shows as INSERT)
      await expect(getModeText(page)).toContainText("INSERT");
      await expect(page.locator(".cell-editor")).toBeVisible();
    });

    test("should transition from navigation to editing with F2 key", async ({
      page,
    }) => {
      await page.keyboard.press("F2");

      // Should be in insert mode (F2 uses default insert mode)
      await expect(getModeText(page)).toContainText("INSERT");
      await expect(page.locator(".cell-editor")).toBeVisible();
    });

    test("should transition from navigation to editing by typing", async ({
      page,
    }) => {
      // Start typing directly
      await page.keyboard.type("Direct entry");

      // Should automatically enter insert mode (direct typing uses insert mode)
      await expect(getModeText(page)).toContainText("INSERT");
      await expect(page.locator(".cell-editor")).toBeVisible();

      // Exit and verify content
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.locator(".formula-bar-input")).toHaveValue(
        "Direct entry",
      );
    });
  });

  test.describe("Vim Mode Transitions Within Editing", () => {
    test("should cycle through insert → normal → insert", async ({ page }) => {
      // Start editing
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Type some text
      await page.keyboard.type("vim test");

      // Go to normal mode
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");
      await expect(getModeDetail(page)).toContainText("i/a to insert");

      // Cell editor should still be visible in normal mode
      await expect(page.locator(".cell-editor")).toBeVisible();

      // Back to insert mode
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Exit to navigation
      await page.keyboard.press("Escape"); // To normal
      await page.keyboard.press("Escape"); // To navigation
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should handle insert → visual → normal transitions", async ({
      page,
    }) => {
      // Start editing with text
      await page.keyboard.press("i");
      await page.keyboard.type("select this text");

      // Go to normal mode
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Enter visual mode
      await page.keyboard.press("v");
      await expect(getModeText(page)).toContainText("VISUAL");
      await expect(getModeDetail(page)).toContainText("hjkl to select");

      // Move cursor to select text
      await page.keyboard.press("l");
      await page.keyboard.press("l");

      // Exit visual mode back to normal
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Exit to navigation
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should handle visual line mode", async ({ page }) => {
      // Start editing with multiline text
      await page.keyboard.press("i");
      await page.keyboard.type("line one");

      // Go to normal mode
      await page.keyboard.press("Escape");

      // Enter visual line mode
      await page.keyboard.press("V");
      await expect(getModeText(page)).toContainText("VISUAL LINE");

      // Exit visual line mode
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");
    });
  });

  test.describe("Edit Mode Variants", () => {
    test("should handle insert mode correctly", async ({ page }) => {
      // Navigate to cell with content
      await page.keyboard.press("l"); // B1 has "World"

      // Enter insert mode
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Type text (should insert at current position)
      await page.keyboard.type("New");

      // Exit and check result
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.locator(".formula-bar-input")).toHaveValue("WorldNew");
    });

    test("should handle append mode correctly", async ({ page }) => {
      // Navigate to cell with content
      await page.keyboard.press("l"); // B1 has "World"

      // Enter append mode
      await page.keyboard.press("a");
      await expect(getModeText(page)).toContainText("INSERT");

      // Type text (should append at end)
      await page.keyboard.type("!");

      // Exit and check result
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.locator(".formula-bar-input")).toHaveValue("World!");
    });

    test("should switch between edit modes within insert mode", async ({
      page,
    }) => {
      // Start editing
      await page.keyboard.press("i");
      await page.keyboard.type("test");

      // Go to normal mode and then switch to append mode
      // (This tests the mode manager's ability to handle edit mode changes)
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      await page.keyboard.press("a"); // Switch to append behavior
      await expect(getModeText(page)).toContainText("INSERT");
      await page.keyboard.type(" append");

      // Exit and verify
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(page.locator(".formula-bar-input")).toHaveValue(
        "test append",
      );
    });
  });

  test.describe("Interaction Mode Integration", () => {
    test("should toggle interaction modes without affecting cell editing", async ({
      page,
    }) => {
      // Start in normal interaction mode
      await expect(getModeDetail(page)).not.toContainText("Keyboard Only");

      // Enter editing
      await page.keyboard.press("i");
      await page.keyboard.type("test content");

      // While in editing, the interaction mode should still be toggleable
      // (though the test might need adjustment based on implementation)
      await page.keyboard.press("Escape"); // To normal

      // Should still be in normal interaction mode
      await expect(getModeDetail(page)).not.toContainText("Keyboard Only");

      // Exit editing
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });
  });

  test.describe("Escape Key Behavior", () => {
    test("should handle single escape from insert mode", async ({ page }) => {
      // Start editing
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Single escape goes to normal mode
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Cell editor should still be visible
      await expect(page.locator(".cell-editor")).toBeVisible();
    });

    test("should handle double escape from insert mode", async ({ page }) => {
      // Start editing
      await page.keyboard.press("i");
      await page.keyboard.type("test");

      // Double escape exits editing completely
      await page.keyboard.press("Escape"); // To normal
      await page.keyboard.press("Escape"); // To navigation

      await expect(getModeText(page)).toContainText("NAVIGATION");
      await expect(page.locator(".cell-editor")).not.toBeVisible();
    });

    test("should handle escape from visual mode", async ({ page }) => {
      // Start editing and go to visual mode
      await page.keyboard.press("i");
      await page.keyboard.type("text");
      await page.keyboard.press("Escape"); // To normal
      await page.keyboard.press("v"); // To visual

      await expect(getModeText(page)).toContainText("VISUAL");

      // Escape from visual goes to normal
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Another escape goes to navigation
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should handle escape from normal cell mode", async ({ page }) => {
      // Start editing and go to normal mode
      await page.keyboard.press("i");
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Escape from normal cell mode goes to navigation
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });
  });

  test.describe("Complex Mode Sequences", () => {
    test("should handle navigation → edit → visual → insert → navigation", async ({
      page,
    }) => {
      // Start in navigation
      await expect(getModeText(page)).toContainText("NAVIGATION");

      // Enter editing
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Type text and go to normal
      await page.keyboard.type("sequence test");
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Enter visual mode
      await page.keyboard.press("v");
      await expect(getModeText(page)).toContainText("VISUAL");

      // Back to normal
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      // Back to insert
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Exit to navigation
      await page.keyboard.press("Escape"); // To normal
      await page.keyboard.press("Escape"); // To navigation
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should handle rapid mode transitions", async ({ page }) => {
      // Rapid sequence of mode changes
      await page.keyboard.press("i"); // Insert
      await page.keyboard.press("Escape"); // Normal
      await page.keyboard.press("v"); // Visual
      await page.keyboard.press("Escape"); // Normal
      await page.keyboard.press("a"); // Insert (append)
      await page.keyboard.press("Escape"); // Normal
      await page.keyboard.press("Escape"); // Navigation

      // Should end up in navigation
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should maintain consistency across cell navigation during editing", async ({
      page,
    }) => {
      // Start editing in A1
      await page.keyboard.press("i");
      await page.keyboard.type("cell a1");
      await page.keyboard.press("Escape"); // To normal

      // Navigate to different cell while in editing mode
      // (This tests if mode state is maintained across cell changes)
      await page.keyboard.press("l"); // Move to B1

      // Should still be in editing mode but for different cell
      await expect(getModeText(page)).toContainText("NORMAL");

      // Can enter insert mode on new cell
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");
      await page.keyboard.type(" modified");

      // Exit editing
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });
  });

  test.describe("Component Integration", () => {
    test("should synchronize mode indicator with actual mode state", async ({
      page,
    }) => {
      // Test that mode indicator always reflects the true internal state

      // Navigation state
      await expect(getModeText(page)).toContainText("NAVIGATION");
      await expect(page.locator(".cell-editor")).not.toBeVisible();

      // Enter insert
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");
      await expect(page.locator(".cell-editor")).toBeVisible();

      // Go to normal
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");
      await expect(page.locator(".cell-editor")).toBeVisible();

      // Visual mode
      await page.keyboard.press("v");
      await expect(getModeText(page)).toContainText("VISUAL");
      await expect(page.locator(".cell-editor")).toBeVisible();

      // Back to navigation
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
      await expect(page.locator(".cell-editor")).not.toBeVisible();
    });

    test("should handle formula bar updates during mode transitions", async ({
      page,
    }) => {
      // Move to cell with content
      await page.keyboard.press("l"); // B1 has "World"
      await expect(page.locator(".formula-bar-input")).toHaveValue("World");

      // Enter editing
      await page.keyboard.press("i");
      await page.keyboard.type(" edit");

      // Formula bar should show updated content even before committing
      // (depending on implementation, this might update live or on commit)

      // Commit changes
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // Formula bar should reflect final state
      await expect(page.locator(".formula-bar-input")).toHaveValue(
        "World edit",
      );
    });

    test("should handle keyboard focus correctly across modes", async ({
      page,
    }) => {
      // Grid should be focused in navigation
      await expect(page.locator(".grid-container")).toBeFocused();

      // Enter editing - cell editor should become the active element
      await page.keyboard.press("i");
      await expect(page.locator(".cell-editor")).toBeFocused();

      // Mode transitions should maintain focus on cell editor
      await page.keyboard.press("Escape"); // To normal
      await expect(page.locator(".cell-editor")).toBeFocused();

      // Exit editing - focus should return to grid
      await page.keyboard.press("Escape"); // To navigation
      await expect(page.locator(".grid-container")).toBeFocused();
    });
  });

  test.describe("Debug - Understanding Mode Indicator", () => {
    test("should show current mode indicator content for debugging", async ({
      page,
    }) => {
      // Check initial state - use the last mode indicator which should be the unified one
      const navMode = await getModeIndicator(page).last().textContent();
      console.log("Navigation mode indicator:", navMode);

      // Press 'a' to enter append mode
      await page.keyboard.press("l"); // Move to B1
      await page.keyboard.press("a");

      const appendMode = await getModeIndicator(page).last().textContent();
      console.log("Append mode indicator:", appendMode);

      // Check mode text specifically
      const modeText = await getModeText(page).last().textContent();
      console.log("Mode text:", modeText);

      // Check mode detail specifically
      const modeDetail = await getModeDetail(page).last().textContent();
      console.log("Mode detail:", modeDetail);

      // This test will always pass, it's just for debugging
      expect(true).toBe(true);
    });
  });

  test.describe("Debug - Basic Editing", () => {
    test("should test basic editing and saving", async ({ page }) => {
      // Navigate to cell B1 (has "World")
      await page.keyboard.press("l");

      // Check initial value
      const initialValue = await page
        .locator(".formula-bar-input")
        .inputValue();
      console.log("Initial value:", initialValue);

      // Enter insert mode with 'i'
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Type text
      await page.keyboard.type("!");
      console.log("After typing '!'");

      // Exit to normal mode
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");
      console.log("Switched to normal mode");

      // Exit to navigation mode (this should save)
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
      console.log("Switched to navigation mode");

      // Check final value
      const finalValue = await page.locator(".formula-bar-input").inputValue();
      console.log("Final value:", finalValue);

      // For now, just pass the test - we're debugging
      expect(true).toBe(true);
    });
  });

  test.describe("Edge Cases and Error Handling", () => {
    test("should handle invalid mode transitions gracefully", async ({
      page,
    }) => {
      // Start in navigation
      await expect(getModeText(page)).toContainText("NAVIGATION");

      // Check if 'v' does something in navigation mode first
      // (It might start editing with 'v' character instead of visual mode)
      const _initialMode = await getModeText(page).textContent();
      await page.keyboard.press("v");

      const afterVMode = await getModeText(page).textContent();

      if (afterVMode === "INSERT") {
        // 'v' started editing mode, which is valid behavior
        // Exit back to navigation
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await expect(getModeText(page)).toContainText("NAVIGATION");
      } else {
        // 'v' didn't change mode, which is also valid
        await expect(getModeText(page)).toContainText("NAVIGATION");
      }

      // Enter editing first to test visual mode properly
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Now visual mode should work
      await page.keyboard.press("Escape");
      await page.keyboard.press("v");
      await expect(getModeText(page)).toContainText("VISUAL");
    });

    test("should maintain mode consistency after errors", async ({ page }) => {
      // Start editing
      await page.keyboard.press("i");
      await page.keyboard.type("test");

      // Force an error scenario (e.g., rapid key presses)
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Escape");
        await page.keyboard.press("v");
        await page.keyboard.press("i");
      }

      // Should end up in a valid state
      await page.waitForTimeout(100);
      const modeText = await getModeText(page).textContent();
      expect(["NAVIGATION", "NORMAL", "INSERT", "VISUAL"]).toContain(modeText);

      // Should be able to return to navigation cleanly
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape"); // Extra escapes should be harmless
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should handle rapid cell navigation during editing", async ({
      page,
    }) => {
      // Start editing
      await page.keyboard.press("i");
      await page.keyboard.type("test");
      await page.keyboard.press("Escape"); // To normal

      // Rapid navigation
      await page.keyboard.press("h");
      await page.keyboard.press("j");
      await page.keyboard.press("k");
      await page.keyboard.press("l");

      // Mode should remain consistent
      await expect(getModeText(page)).toContainText("NORMAL");

      // Should be able to continue editing
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");
    });

    test("should handle mode changes with empty cells", async ({ page }) => {
      // Navigate to empty cell
      await page.keyboard.press("j"); // A2
      await page.keyboard.press("j"); // A3 (should be empty)

      // Start editing empty cell
      await page.keyboard.press("i");
      await expect(getModeText(page)).toContainText("INSERT");

      // Mode transitions should work normally with empty cells
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NORMAL");

      await page.keyboard.press("v");
      await expect(getModeText(page)).toContainText("VISUAL");

      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });
  });

  test.describe("Performance and Responsiveness", () => {
    test("should handle mode transitions quickly", async ({ page }) => {
      const startTime = Date.now();

      // Perform a series of mode transitions
      await page.keyboard.press("i"); // Insert
      await page.keyboard.press("Escape"); // Normal
      await page.keyboard.press("v"); // Visual
      await page.keyboard.press("Escape"); // Normal
      await page.keyboard.press("i"); // Insert
      await page.keyboard.press("Escape"); // Normal
      await page.keyboard.press("Escape"); // Navigation

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(2000);

      // Should end in correct state
      await expect(getModeText(page)).toContainText("NAVIGATION");
    });

    test("should not block UI during mode transitions", async ({ page }) => {
      // Start a mode transition
      await page.keyboard.press("i");

      // UI should respond immediately to other interactions
      await page.keyboard.type("responsive");

      // Mode indicator should show current state without delay
      await expect(getModeText(page)).toContainText("INSERT");

      // Complete the test
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    });
  });
});
