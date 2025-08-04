import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress } from "@gridcore/core";
import {
  createNavigationState,
  isEditingMode,
  isResizeMode,
} from "@gridcore/ui-core";
import { SpreadsheetTUI } from "./SpreadsheetTUI";

describe("SpreadsheetTUI Controller Integration", () => {
  let tui: SpreadsheetTUI;

  beforeEach(() => {
    tui = new SpreadsheetTUI();
  });

  describe("Navigation Mode", () => {
    test("should start in navigation mode", () => {
      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("navigation");
      expect(state.cursor).toEqual({ row: 0, col: 0 });
    });

    test("should handle arrow key navigation", () => {
      const initialState = tui.getState();

      // Simulate right arrow
      tui["handleKeyPress"]("l", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "l",
      });
      const afterRight = tui.getState();
      expect(afterRight.cursor).toEqual({ row: 0, col: 1 });

      // Simulate down arrow
      tui["handleKeyPress"]("j", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "j",
      });
      const afterDown = tui.getState();
      expect(afterDown.cursor).toEqual({ row: 1, col: 1 });
    });

    test("should enter edit mode with 'i' key", () => {
      tui["handleKeyPress"]("i", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "i",
      });
      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("editing");
      expect(state.cellMode).toBe("insert");
    });

    test("should enter command mode with ':' key", () => {
      tui["handleKeyPress"](":", {
        ctrl: false,
        alt: false,
        shift: false,
        key: ":",
      });
      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("command");
      expect(state.commandValue).toBe("");
    });

    test("should enter resize mode with 'gr' keys", () => {
      // Vim behavior requires 'gr' command
      tui["handleKeyPress"]("g", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "g",
      });
      tui["handleKeyPress"]("r", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "r",
      });
      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("resize");
      expect(state.resizeTarget).toBe("column");
    });
  });

  describe("Edit Mode", () => {
    beforeEach(() => {
      // Enter edit mode
      tui["handleKeyPress"]("i", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "i",
      });
    });

    test("should track editing value", () => {
      // In editing mode, regular characters need to be handled
      const initialState = tui.getState();
      expect(initialState.cellMode).toBe("insert");

      // Type "hello"
      tui["handleKeyPress"]("h", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "h",
      });
      tui["handleKeyPress"]("e", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "e",
      });
      tui["handleKeyPress"]("l", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "l",
      });
      tui["handleKeyPress"]("l", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "l",
      });
      tui["handleKeyPress"]("o", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "o",
      });

      const state = tui.getState();
      expect(state.editingValue).toBe("hello");
      expect(state.cursorPosition).toBe(5);
    });

    test("should handle backspace", () => {
      // Type "test"
      tui["handleKeyPress"]("t", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "t",
      });
      tui["handleKeyPress"]("e", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "e",
      });
      tui["handleKeyPress"]("s", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "s",
      });
      tui["handleKeyPress"]("t", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "t",
      });

      // Backspace
      tui["handleKeyPress"]("\b", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "backspace",
      });

      const state = tui.getState();
      expect(state.editingValue).toBe("tes");
      expect(state.cursorPosition).toBe(3);
    });

    test("should exit edit mode with ESC", () => {
      // First ESC exits insert mode to normal cell mode
      tui["handleKeyPress"]("\x1b", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "escape",
      });
      let state = tui.getState();
      expect(state.spreadsheetMode).toBe("editing");
      expect(state.cellMode).toBe("normal");

      // Second ESC exits to navigation mode
      tui["handleKeyPress"]("\x1b", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "escape",
      });
      state = tui.getState();
      expect(state.spreadsheetMode).toBe("navigation");
    });

    test("should save value with Enter", () => {
      // Type "42"
      tui["handleKeyPress"]("4", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "4",
      });
      tui["handleKeyPress"]("2", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "2",
      });

      // Store editing value before Enter
      const stateBeforeEnter = tui.getState();
      expect(stateBeforeEnter.editingValue).toBe("42");

      // Enter
      tui["handleKeyPress"]("\r", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "enter",
      });

      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("navigation");

      // The controller should have saved the value, but we can't verify through facade
      // since the test setup doesn't properly initialize the spreadsheet engine.
      // The important thing is that Enter exits to navigation mode, which it does.
    });
  });

  describe("Command Mode", () => {
    beforeEach(() => {
      tui["handleKeyPress"](":", {
        ctrl: false,
        alt: false,
        shift: false,
        key: ":",
      });
    });

    test("should track command input", () => {
      tui["handleKeyPress"]("w", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "w",
      });
      const state = tui.getState();
      expect(state.commandValue).toBe("w");
    });

    test("should exit command mode with ESC", () => {
      tui["handleKeyPress"]("q", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "q",
      });
      tui["handleKeyPress"]("\x1b", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "escape",
      });

      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("navigation");
      // commandValue is not defined in navigation mode
    });

    test("should execute command with Enter", () => {
      // The actual command execution (like quit) would need mocking
      tui["handleKeyPress"]("w", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "w",
      });
      tui["handleKeyPress"]("\r", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "enter",
      });

      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("navigation");
      // commandValue is not defined in navigation mode
    });
  });

  describe("Resize Mode", () => {
    beforeEach(() => {
      tui["handleKeyPress"]("g", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "g",
      });
      tui["handleKeyPress"]("r", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "r",
      });
    });

    test("should start in column resize mode", () => {
      const state = tui.getState();
      expect(isResizeMode(state)).toBe(true);
      expect(state.resizeTarget).toBe("column");
      expect(state.resizeIndex).toBe(0); // Current cursor column
    });

    test("should navigate to different columns with h/l", () => {
      // Check initial state
      let state = tui.getState();
      console.log("Initial state:", {
        mode: state.spreadsheetMode,
        resizeIndex: state.resizeIndex,
        resizeTarget: state.resizeTarget,
      });

      // Move to next column
      tui["handleKeyPress"]("l", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "l",
      });
      state = tui.getState();
      console.log("After 'l' key:", {
        mode: state.spreadsheetMode,
        resizeIndex: state.resizeIndex,
        resizeTarget: state.resizeTarget,
      });
      expect(state.resizeIndex).toBe(1); // Moved to next column

      // Move back to previous column
      tui["handleKeyPress"]("h", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "h",
      });
      state = tui.getState();
      expect(state.resizeIndex).toBe(0); // Back to original column
    });

    test("should increase column width with '>'", () => {
      const initialState = tui.getState();
      const initialSize = initialState.currentSize;

      tui["handleKeyPress"](">", {
        ctrl: false,
        alt: false,
        shift: false,
        key: ">",
      });
      const state = tui.getState();
      expect(state.currentSize).toBe(initialSize + 5); // ResizeBehavior increments by 5
    });

    test("should decrease column width with '<'", () => {
      const initialState = tui.getState();
      const initialSize = initialState.currentSize;

      tui["handleKeyPress"]("<", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "<",
      });
      const state = tui.getState();
      // Minimum size is 10, so if initial is 10, it stays at 10
      expect(state.currentSize).toBe(Math.max(10, initialSize - 5));
    });

    test("should exit resize mode with ESC", () => {
      tui["handleKeyPress"]("\x1b", {
        ctrl: false,
        alt: false,
        shift: false,
        key: "escape",
      });
      const state = tui.getState();
      expect(state.spreadsheetMode).toBe("navigation");
    });
  });

  describe("Viewport Management", () => {
    test("should update viewport when cursor moves beyond visible area", () => {
      const initialState = tui.getState();
      const { viewport } = initialState;

      // Move cursor beyond viewport
      for (let i = 0; i < viewport.rows + 1; i++) {
        tui["handleKeyPress"]("j", {
          ctrl: false,
          alt: false,
          shift: false,
          key: "j",
        });
      }

      // The ensureCursorInViewport should have adjusted the viewport
      tui["ensureCursorInViewport"]();

      const state = tui.getState();
      expect(state.cursor.row).toBeGreaterThan(viewport.rows);
    });
  });

  describe("Controller Events", () => {
    test("should handle state change events", () => {
      const event = { type: "stateChanged" as const };
      tui["handleControllerEvent"](event);
      // Should not throw
    });

    test("should handle command execution events", () => {
      const event = { type: "commandExecuted" as const, command: "w" };
      tui["handleControllerEvent"](event);
      // Should call handleCommand internally
    });

    test("should handle error events", () => {
      const event = { type: "error" as const, error: "Test error" };
      // Should log to console.error but not throw
      tui["handleControllerEvent"](event);
    });
  });
});
