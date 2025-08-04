import { beforeEach, describe, expect, test } from "bun:test";
import { CellAddress } from "@gridcore/core";
import {
  createEditingState,
  createNavigationState,
  createResizeState,
  createSpreadsheetVisualState,
  type Selection,
} from "../state/UIState";
import { type KeyMeta, VimBehavior } from "./VimBehavior";

describe("VimBehavior", () => {
  let vimBehavior: VimBehavior;
  const defaultViewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };
  const defaultCursor = { row: 0, col: 0 };

  beforeEach(() => {
    vimBehavior = new VimBehavior();
  });

  const createKeyMeta = (
    key: string,
    ctrl = false,
    shift = false,
    alt = false,
  ): KeyMeta => ({
    key,
    ctrl,
    shift,
    alt,
  });

  describe("navigation mode", () => {
    const navigationState = createNavigationState(
      defaultCursor,
      defaultViewport,
    );

    describe("movement commands", () => {
      test("should handle h/j/k/l movement", () => {
        expect(
          vimBehavior.handleKeyPress("h", createKeyMeta("h"), navigationState),
        ).toEqual({
          type: "move",
          direction: "left",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("j", createKeyMeta("j"), navigationState),
        ).toEqual({
          type: "move",
          direction: "down",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("k", createKeyMeta("k"), navigationState),
        ).toEqual({
          type: "move",
          direction: "up",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("l", createKeyMeta("l"), navigationState),
        ).toEqual({
          type: "move",
          direction: "right",
          count: 1,
        });
      });

      test("should handle count prefixes", () => {
        vimBehavior.handleKeyPress("3", createKeyMeta("3"), navigationState);
        expect(
          vimBehavior.handleKeyPress("j", createKeyMeta("j"), navigationState),
        ).toEqual({
          type: "move",
          direction: "down",
          count: 3,
        });
      });

      test("should handle 0 as first column", () => {
        expect(
          vimBehavior.handleKeyPress("0", createKeyMeta("0"), navigationState),
        ).toEqual({
          type: "moveTo",
          target: "firstColumn",
        });
      });

      test("should handle $ as last column", () => {
        expect(
          vimBehavior.handleKeyPress("$", createKeyMeta("$"), navigationState),
        ).toEqual({
          type: "moveTo",
          target: "lastColumn",
        });
      });

      test("should handle G for last row", () => {
        expect(
          vimBehavior.handleKeyPress("G", createKeyMeta("G"), navigationState),
        ).toEqual({
          type: "moveTo",
          target: "lastRow",
          count: 1,
        });
      });

      test("should handle gg for first row", () => {
        vimBehavior.handleKeyPress("g", createKeyMeta("g"), navigationState);
        expect(
          vimBehavior.handleKeyPress("g", createKeyMeta("g"), navigationState),
        ).toEqual({
          type: "moveTo",
          target: "firstRow",
          count: 1,
        });
      });
    });

    describe("word movement", () => {
      test("should handle w/b/e movement", () => {
        expect(
          vimBehavior.handleKeyPress("w", createKeyMeta("w"), navigationState),
        ).toEqual({
          type: "moveWord",
          direction: "forward",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("b", createKeyMeta("b"), navigationState),
        ).toEqual({
          type: "moveWord",
          direction: "backward",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("e", createKeyMeta("e"), navigationState),
        ).toEqual({
          type: "moveWord",
          direction: "end",
          count: 1,
        });
      });
    });

    describe("edit mode transitions", () => {
      test("should handle i/a/A/I/o/O", () => {
        expect(
          vimBehavior.handleKeyPress("i", createKeyMeta("i"), navigationState),
        ).toEqual({
          type: "startEditing",
          editVariant: "i",
        });

        expect(
          vimBehavior.handleKeyPress("a", createKeyMeta("a"), navigationState),
        ).toEqual({
          type: "startEditing",
          editVariant: "a",
        });

        expect(
          vimBehavior.handleKeyPress("A", createKeyMeta("A"), navigationState),
        ).toEqual({
          type: "startEditing",
          editVariant: "A",
        });

        expect(
          vimBehavior.handleKeyPress("I", createKeyMeta("I"), navigationState),
        ).toEqual({
          type: "startEditing",
          editVariant: "I",
        });

        expect(
          vimBehavior.handleKeyPress("o", createKeyMeta("o"), navigationState),
        ).toEqual({
          type: "startEditing",
          editVariant: "o",
        });

        expect(
          vimBehavior.handleKeyPress("O", createKeyMeta("O"), navigationState),
        ).toEqual({
          type: "startEditing",
          editVariant: "O",
        });
      });
    });

    describe("visual mode", () => {
      test("should enter character visual mode with v", () => {
        expect(
          vimBehavior.handleKeyPress("v", createKeyMeta("v"), navigationState),
        ).toEqual({
          type: "enterVisual",
          visualType: "character",
        });
      });

      test("should enter line visual mode with V", () => {
        expect(
          vimBehavior.handleKeyPress("V", createKeyMeta("V"), navigationState),
        ).toEqual({
          type: "enterVisual",
          visualType: "line",
        });
      });

      test("should enter block visual mode with Ctrl+v", () => {
        expect(
          vimBehavior.handleKeyPress(
            "v",
            createKeyMeta("v", true),
            navigationState,
          ),
        ).toEqual({
          type: "enterVisual",
          visualType: "block",
        });
      });
    });

    describe("operators", () => {
      test("should handle delete operator", () => {
        vimBehavior.handleKeyPress("d", createKeyMeta("d"), navigationState);
        expect(
          vimBehavior.handleKeyPress("d", createKeyMeta("d"), navigationState),
        ).toEqual({
          type: "delete",
          motion: "line",
        });
      });

      test("should handle change operator", () => {
        vimBehavior.handleKeyPress("c", createKeyMeta("c"), navigationState);
        expect(
          vimBehavior.handleKeyPress("c", createKeyMeta("c"), navigationState),
        ).toEqual({
          type: "change",
          motion: "line",
        });
      });

      test("should handle yank operator", () => {
        vimBehavior.handleKeyPress("y", createKeyMeta("y"), navigationState);
        expect(
          vimBehavior.handleKeyPress("y", createKeyMeta("y"), navigationState),
        ).toEqual({
          type: "yank",
          motion: "line",
        });
      });

      test("should handle operator with motion", () => {
        vimBehavior.handleKeyPress("d", createKeyMeta("d"), navigationState);
        expect(
          vimBehavior.handleKeyPress("w", createKeyMeta("w"), navigationState),
        ).toEqual({
          type: "delete",
          motion: "w",
        });
      });
    });

    describe("other commands", () => {
      test("should handle x for delete", () => {
        expect(
          vimBehavior.handleKeyPress("x", createKeyMeta("x"), navigationState),
        ).toEqual({
          type: "delete",
        });
      });

      test("should handle p/P for paste", () => {
        expect(
          vimBehavior.handleKeyPress("p", createKeyMeta("p"), navigationState),
        ).toEqual({
          type: "paste",
          before: false,
        });

        expect(
          vimBehavior.handleKeyPress("P", createKeyMeta("P"), navigationState),
        ).toEqual({
          type: "paste",
          before: true,
        });
      });

      test("should enter command mode with :", () => {
        expect(
          vimBehavior.handleKeyPress(":", createKeyMeta(":"), navigationState),
        ).toEqual({
          type: "enterCommand",
        });
      });
    });

    describe("scrolling", () => {
      test("should handle Ctrl+d/u for half page scroll", () => {
        expect(
          vimBehavior.handleKeyPress(
            "d",
            createKeyMeta("d", true),
            navigationState,
          ),
        ).toEqual({
          type: "scroll",
          direction: "halfDown",
        });

        expect(
          vimBehavior.handleKeyPress(
            "u",
            createKeyMeta("u", true),
            navigationState,
          ),
        ).toEqual({
          type: "scroll",
          direction: "halfUp",
        });
      });

      test("should handle Ctrl+f/b for full page scroll", () => {
        expect(
          vimBehavior.handleKeyPress(
            "f",
            createKeyMeta("f", true),
            navigationState,
          ),
        ).toEqual({
          type: "scroll",
          direction: "pageDown",
        });

        expect(
          vimBehavior.handleKeyPress(
            "b",
            createKeyMeta("b", true),
            navigationState,
          ),
        ).toEqual({
          type: "scroll",
          direction: "pageUp",
        });
      });

      test("should handle Ctrl+e/y for line scroll", () => {
        expect(
          vimBehavior.handleKeyPress(
            "e",
            createKeyMeta("e", true),
            navigationState,
          ),
        ).toEqual({
          type: "scroll",
          direction: "down",
        });

        expect(
          vimBehavior.handleKeyPress(
            "y",
            createKeyMeta("y", true),
            navigationState,
          ),
        ).toEqual({
          type: "scroll",
          direction: "up",
        });
      });
    });

    describe("centering", () => {
      test("should handle zz/zt/zb", () => {
        vimBehavior.handleKeyPress("z", createKeyMeta("z"), navigationState);
        expect(
          vimBehavior.handleKeyPress("z", createKeyMeta("z"), navigationState),
        ).toEqual({
          type: "center",
          position: "center",
        });

        vimBehavior.handleKeyPress("z", createKeyMeta("z"), navigationState);
        expect(
          vimBehavior.handleKeyPress("t", createKeyMeta("t"), navigationState),
        ).toEqual({
          type: "center",
          position: "top",
        });

        vimBehavior.handleKeyPress("z", createKeyMeta("z"), navigationState);
        expect(
          vimBehavior.handleKeyPress("b", createKeyMeta("b"), navigationState),
        ).toEqual({
          type: "center",
          position: "bottom",
        });
      });
    });

    describe("resize mode", () => {
      test("should enter resize mode with gr", () => {
        vimBehavior.handleKeyPress("g", createKeyMeta("g"), navigationState);
        expect(
          vimBehavior.handleKeyPress("r", createKeyMeta("r"), navigationState),
        ).toEqual({
          type: "enterResize",
          target: "column",
          index: 0,
        });
      });
    });
  });

  describe("editing mode", () => {
    const editingState = createEditingState(defaultCursor, defaultViewport);

    test("should exit editing on escape", () => {
      expect(
        vimBehavior.handleKeyPress(
          "escape",
          createKeyMeta("escape"),
          editingState,
        ),
      ).toEqual({
        type: "exitEditing",
      });
    });

    test("should exit editing on any key in editing mode", () => {
      // VimBehavior delegates cell-level handling to CellVimBehavior
      expect(
        vimBehavior.handleKeyPress("j", createKeyMeta("j"), editingState),
      ).toEqual({
        type: "exitEditing",
      });
    });
  });

  describe("resize mode", () => {
    const resizeState = createResizeState(
      defaultCursor,
      defaultViewport,
      "column",
      0,
      100,
    );

    test("should handle increase/decrease size", () => {
      expect(
        vimBehavior.handleKeyPress("+", createKeyMeta("+"), resizeState),
      ).toEqual({
        type: "resize",
        delta: 5,
      });

      expect(
        vimBehavior.handleKeyPress("-", createKeyMeta("-"), resizeState),
      ).toEqual({
        type: "resize",
        delta: -5,
      });

      expect(
        vimBehavior.handleKeyPress(">", createKeyMeta(">"), resizeState),
      ).toEqual({
        type: "resize",
        delta: 5,
      });

      expect(
        vimBehavior.handleKeyPress("<", createKeyMeta("<"), resizeState),
      ).toEqual({
        type: "resize",
        delta: -5,
      });
    });

    test("should handle auto-fit", () => {
      expect(
        vimBehavior.handleKeyPress("=", createKeyMeta("="), resizeState),
      ).toEqual({
        type: "resizeAutoFit",
      });
    });

    test("should handle navigation in resize mode", () => {
      expect(
        vimBehavior.handleKeyPress("h", createKeyMeta("h"), resizeState),
      ).toEqual({
        type: "move",
        direction: "left",
      });

      expect(
        vimBehavior.handleKeyPress("l", createKeyMeta("l"), resizeState),
      ).toEqual({
        type: "move",
        direction: "right",
      });
    });

    test("should handle number prefix for resize", () => {
      vimBehavior.handleKeyPress("3", createKeyMeta("3"), resizeState);
      expect(
        vimBehavior.handleKeyPress("+", createKeyMeta("+"), resizeState),
      ).toEqual({
        type: "resize",
        delta: 15, // 3 * 5
      });
    });

    test("should exit resize mode on escape", () => {
      expect(
        vimBehavior.handleKeyPress(
          "escape",
          createKeyMeta("escape"),
          resizeState,
        ),
      ).toEqual({
        type: "exitMode",
      });
    });
  });

  describe("clipboard", () => {
    test("should set and get clipboard", () => {
      expect(vimBehavior.getClipboard()).toBeUndefined();

      vimBehavior.setClipboard("test content", "cell");

      const clipboard = vimBehavior.getClipboard();
      expect(clipboard).toEqual({
        content: "test content",
        type: "cell",
      });
    });
  });

  describe("reset", () => {
    test("should clear internal state", () => {
      const navigationState = createNavigationState(
        defaultCursor,
        defaultViewport,
      );

      // Set up some state
      vimBehavior.handleKeyPress("3", createKeyMeta("3"), navigationState);
      vimBehavior.handleKeyPress("g", createKeyMeta("g"), navigationState);

      // Reset
      vimBehavior.reset();

      // Should behave as if no state was set
      expect(
        vimBehavior.handleKeyPress("j", createKeyMeta("j"), navigationState),
      ).toEqual({
        type: "move",
        direction: "down",
        count: 1, // Not 3
      });
    });
  });

  describe("spreadsheet visual mode", () => {
    const cursor = CellAddress.create(1, 1).value;
    const anchor = CellAddress.create(0, 0).value;
    const selection: Selection = {
      type: { type: "row", rows: [0, 1] },
      anchor,
    };
    const visualState = createSpreadsheetVisualState(
      cursor,
      defaultViewport,
      "row",
      anchor,
      selection,
    );

    describe("entering visual modes from navigation", () => {
      const navigationState = createNavigationState(
        defaultCursor,
        defaultViewport,
      );

      test("should enter character visual mode with 'v'", () => {
        expect(
          vimBehavior.handleKeyPress("v", createKeyMeta("v"), navigationState),
        ).toEqual({
          type: "enterSpreadsheetVisual",
          visualMode: "char",
        });
      });

      test("should enter row visual mode with 'V'", () => {
        expect(
          vimBehavior.handleKeyPress("V", createKeyMeta("V"), navigationState),
        ).toEqual({
          type: "enterSpreadsheetVisual",
          visualMode: "row",
        });
      });

      test("should enter block visual mode with 'Ctrl+v'", () => {
        expect(
          vimBehavior.handleKeyPress("v", createKeyMeta("v", true), navigationState),
        ).toEqual({
          type: "enterSpreadsheetVisual",
          visualMode: "block",
        });
      });

      test("should enter column visual mode with 'gC'", () => {
        vimBehavior.handleKeyPress("g", createKeyMeta("g"), navigationState);
        expect(
          vimBehavior.handleKeyPress("C", createKeyMeta("C"), navigationState),
        ).toEqual({
          type: "enterSpreadsheetVisual",
          visualMode: "column",
        });
      });
    });

    describe("visual mode navigation", () => {
      test("should extend selection with h/j/k/l", () => {
        expect(
          vimBehavior.handleKeyPress("h", createKeyMeta("h"), visualState),
        ).toEqual({
          type: "extendSelection",
          direction: "left",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("j", createKeyMeta("j"), visualState),
        ).toEqual({
          type: "extendSelection",
          direction: "down",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("k", createKeyMeta("k"), visualState),
        ).toEqual({
          type: "extendSelection",
          direction: "up",
          count: 1,
        });

        expect(
          vimBehavior.handleKeyPress("l", createKeyMeta("l"), visualState),
        ).toEqual({
          type: "extendSelection",
          direction: "right",
          count: 1,
        });
      });

      test("should handle number prefixes for extending selection", () => {
        vimBehavior.handleKeyPress("3", createKeyMeta("3"), visualState);
        expect(
          vimBehavior.handleKeyPress("j", createKeyMeta("j"), visualState),
        ).toEqual({
          type: "extendSelection",
          direction: "down",
          count: 3,
        });
      });

      test("should extend selection with arrow keys", () => {
        expect(
          vimBehavior.handleKeyPress(
            "ArrowDown",
            createKeyMeta("ArrowDown"),
            visualState,
          ),
        ).toEqual({
          type: "extendSelection",
          direction: "down",
          count: 1,
        });
      });
    });

    describe("visual mode operations", () => {
      test("should handle delete operation", () => {
        expect(
          vimBehavior.handleKeyPress("d", createKeyMeta("d"), visualState),
        ).toEqual({
          type: "delete",
        });
      });

      test("should handle change operation", () => {
        expect(
          vimBehavior.handleKeyPress("c", createKeyMeta("c"), visualState),
        ).toEqual({
          type: "change",
        });
      });

      test("should handle yank operation", () => {
        expect(
          vimBehavior.handleKeyPress("y", createKeyMeta("y"), visualState),
        ).toEqual({
          type: "yank",
        });
      });
    });

    describe("exiting visual mode", () => {
      test("should exit visual mode with 'v'", () => {
        expect(
          vimBehavior.handleKeyPress("v", createKeyMeta("v"), visualState),
        ).toEqual({
          type: "exitVisual",
        });
      });

      test("should exit visual mode with escape", () => {
        expect(
          vimBehavior.handleKeyPress(
            "escape",
            createKeyMeta("escape"),
            visualState,
          ),
        ).toEqual({
          type: "exitVisual",
        });
      });
    });

    describe("visual mode with ctrl keys", () => {
      test("should handle ctrl scrolling in visual mode", () => {
        expect(
          vimBehavior.handleKeyPress("d", createKeyMeta("d", true), visualState),
        ).toEqual({
          type: "scroll",
          direction: "halfDown",
        });

        expect(
          vimBehavior.handleKeyPress("u", createKeyMeta("u", true), visualState),
        ).toEqual({
          type: "scroll",
          direction: "halfUp",
        });
      });
    });
  });
});
