import { describe, expect, test } from "bun:test";
import type { CellAddress } from "@gridcore/core";
import { createNavigationState, type UIState } from "@gridcore/ui-core";
import { StateAdapter } from "./StateAdapter";

describe("StateAdapter", () => {
  const mockCursor = { row: 5, col: 2 } as CellAddress;
  const mockViewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };

  test("should convert navigation state", () => {
    const state = createNavigationState(mockCursor, mockViewport);
    const display = StateAdapter.toDisplayState(state);

    expect(display.modeString).toBe("NORMAL");
    expect(display.vimMode).toBe("NORMAL");
    expect(display.cursorDisplay).toBe("C6"); // col 2 = C, row 5 = 6 (1-indexed)
    expect(display.formulaBarContent).toBe("");
    expect(display.showFormulaCursor).toBe(false);
  });

  test("should convert editing state with insert mode", () => {
    const state: UIState = {
      spreadsheetMode: "editing",
      cursor: mockCursor,
      viewport: mockViewport,
      cellMode: "insert",
      editingValue: "Hello World",
      cursorPosition: 5,
      editVariant: "i",
    };
    const display = StateAdapter.toDisplayState(state);

    expect(display.modeString).toBe("INSERT");
    expect(display.vimMode).toBe("CELL-INSERT (i)");
    expect(display.formulaBarContent).toBe("Hello World");
    expect(display.showFormulaCursor).toBe(true);
    expect(display.formulaCursorPosition).toBe(5);
  });

  test("should convert editing state with visual mode", () => {
    const state: UIState = {
      spreadsheetMode: "editing",
      cursor: mockCursor,
      viewport: mockViewport,
      cellMode: "visual",
      editingValue: "Test",
      cursorPosition: 3,
      visualStart: 1,
      visualType: "character",
    };
    const display = StateAdapter.toDisplayState(state);

    expect(display.modeString).toBe("VISUAL");
    expect(display.vimMode).toBe("CELL-VISUAL CHARACTER");
    expect(display.visualType).toBe("character");
  });

  test("should convert command mode", () => {
    const state: UIState = {
      spreadsheetMode: "command",
      cursor: mockCursor,
      viewport: mockViewport,
      commandValue: "wq",
    };
    const display = StateAdapter.toDisplayState(state);

    expect(display.modeString).toBe("COMMAND");
    expect(display.vimMode).toBe("COMMAND");
    expect(display.formulaBarContent).toBe(":wq");
    expect(display.commandBuffer).toBe("wq");
  });

  test("should convert resize mode", () => {
    const state: UIState = {
      spreadsheetMode: "resize",
      cursor: mockCursor,
      viewport: mockViewport,
      resizeTarget: "column",
      resizeIndex: 3,
      originalSize: 10,
      currentSize: 15,
    };
    const display = StateAdapter.toDisplayState(state);

    expect(display.modeString).toBe("RESIZE");
    expect(display.vimMode).toBe("RESIZE");
    expect(display.resizeInfo).toEqual({
      target: "COLUMN",
      index: 3,
      currentSize: 15,
      originalSize: 10,
    });
  });

  test("should convert column indices to letters", () => {
    const state0 = createNavigationState(
      { row: 0, col: 0 } as CellAddress,
      mockViewport,
    );
    const state25 = createNavigationState(
      { row: 0, col: 25 } as CellAddress,
      mockViewport,
    );
    const state26 = createNavigationState(
      { row: 0, col: 26 } as CellAddress,
      mockViewport,
    );
    const state52 = createNavigationState(
      { row: 0, col: 52 } as CellAddress,
      mockViewport,
    );

    expect(StateAdapter.toDisplayState(state0).cursorDisplay).toBe("A1");
    expect(StateAdapter.toDisplayState(state25).cursorDisplay).toBe("Z1");
    expect(StateAdapter.toDisplayState(state26).cursorDisplay).toBe("AA1");
    expect(StateAdapter.toDisplayState(state52).cursorDisplay).toBe("BA1");
  });

  test("should format resize mode display", () => {
    const increaseInfo = {
      target: "COLUMN",
      index: 5,
      currentSize: 20,
      originalSize: 10,
    };
    expect(StateAdapter.getResizeModeDisplay(increaseInfo)).toBe(
      "COLUMN 5: 20 (+10)",
    );

    const decreaseInfo = {
      target: "ROW",
      index: 3,
      currentSize: 5,
      originalSize: 8,
    };
    expect(StateAdapter.getResizeModeDisplay(decreaseInfo)).toBe(
      "ROW 3: 5 (-3)",
    );
  });

  test("should get visual selection range", () => {
    const state: UIState = {
      spreadsheetMode: "editing",
      cursor: mockCursor,
      viewport: mockViewport,
      cellMode: "visual",
      editingValue: "Test",
      cursorPosition: 3,
      visualStart: 1,
    };

    const range = StateAdapter.getVisualSelectionRange(state);
    expect(range).toEqual({ start: 1, end: 3 });

    // Test reversed selection
    const reversedState: UIState = {
      ...state,
      cursorPosition: 1,
      visualStart: 3,
    };
    const reversedRange = StateAdapter.getVisualSelectionRange(reversedState);
    expect(reversedRange).toEqual({ start: 1, end: 3 });
  });

  test("should handle vim command display", () => {
    expect(StateAdapter.getVimCommandDisplay("5", "d")).toBe("5d");
    expect(StateAdapter.getVimCommandDisplay("", "yy")).toBe("yy");
    expect(StateAdapter.getVimCommandDisplay("10", "")).toBe("10");
    expect(StateAdapter.getVimCommandDisplay("", "")).toBe("");
  });
});
