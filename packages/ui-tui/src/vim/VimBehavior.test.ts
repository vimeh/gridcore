import { beforeEach, describe, expect, test } from "bun:test";
import type { KeyMeta } from "../framework";
import { VimBehavior } from "./VimBehavior";

describe("VimBehavior", () => {
  let vim: VimBehavior;

  beforeEach(() => {
    vim = new VimBehavior();
  });

  const meta = (key: string, ctrl = false): KeyMeta => ({
    key,
    ctrl,
    alt: false,
    shift: false,
  });

  describe("Mode Transitions", () => {
    test("starts in normal mode", () => {
      expect(vim.getMode()).toBe("normal");
    });

    test("enters edit mode with 'i'", () => {
      const action = vim.handleKeyPress("i", meta("i"), {} as any);
      expect(action.type).toBe("changeMode");
      expect(action.mode).toBe("edit");
      expect(action.editVariant).toBe("i");
    });

    test("enters visual mode with 'v'", () => {
      const action = vim.handleKeyPress("v", meta("v"), {} as any);
      expect(action.type).toBe("setAnchor");
      expect(vim.getMode()).toBe("visual");
      expect(vim.getVimState().visualType).toBe("character");
    });

    test("enters visual line mode with 'V'", () => {
      const action = vim.handleKeyPress("V", meta("V"), {} as any);
      expect(action.type).toBe("setAnchor");
      expect(vim.getMode()).toBe("visual");
      expect(vim.getVimState().visualType).toBe("line");
    });

    test("enters visual block mode with Ctrl+v", () => {
      const action = vim.handleKeyPress(
        "v",
        { ...meta("v"), ctrl: true },
        {} as any,
      );
      expect(action.type).toBe("setAnchor");
      expect(vim.getMode()).toBe("visual");
      expect(vim.getVimState().visualType).toBe("block");
    });

    test("escape returns to normal mode from any mode", () => {
      vim.handleKeyPress("v", meta("v"), {} as any);
      expect(vim.getMode()).toBe("visual");

      const action = vim.handleKeyPress("escape", meta("escape"), {} as any);
      expect(action.type).toBe("changeMode");
      expect(action.mode).toBe("normal");
      expect(vim.getMode()).toBe("normal");
    });
  });

  describe("Normal Mode Navigation", () => {
    test("basic movements (hjkl)", () => {
      const movements = [
        { key: "h", direction: "left" },
        { key: "j", direction: "down" },
        { key: "k", direction: "up" },
        { key: "l", direction: "right" },
      ];

      for (const { key, direction } of movements) {
        const action = vim.handleKeyPress(key, meta(key), {} as any);
        expect(action.type).toBe("move");
        expect(action.direction).toBe(direction);
        expect(action.count).toBe(1);
      }
    });

    test("movements with count", () => {
      vim.handleKeyPress("3", meta("3"), {} as any);
      const action = vim.handleKeyPress("j", meta("j"), {} as any);
      expect(action.type).toBe("move");
      expect(action.direction).toBe("down");
      expect(action.count).toBe(3);
    });

    test("0 moves to first column", () => {
      const action = vim.handleKeyPress("0", meta("0"), {} as any);
      expect(action.type).toBe("moveTo");
      expect(action.target).toBe("firstColumn");
    });

    test("$ moves to last column", () => {
      const action = vim.handleKeyPress("$", meta("$"), {} as any);
      expect(action.type).toBe("moveTo");
      expect(action.target).toBe("lastColumn");
    });

    test("gg moves to first row", () => {
      vim.handleKeyPress("g", meta("g"), {} as any);
      const action = vim.handleKeyPress("g", meta("g"), {} as any);
      expect(action.type).toBe("moveTo");
      expect(action.target).toBe("firstRow");
    });

    test("G moves to last row", () => {
      const action = vim.handleKeyPress("G", meta("G"), {} as any);
      expect(action.type).toBe("moveTo");
      expect(action.target).toBe("lastRow");
    });

    test("5G moves to row 5", () => {
      vim.handleKeyPress("5", meta("5"), {} as any);
      const action = vim.handleKeyPress("G", meta("G"), {} as any);
      expect(action.type).toBe("moveTo");
      expect(action.target).toBe("lastRow");
      expect(action.count).toBe(5);
    });

    test("w moves word forward", () => {
      const action = vim.handleKeyPress("w", meta("w"), {} as any);
      expect(action.type).toBe("moveWord");
      expect(action.direction).toBe("forward");
      expect(action.count).toBe(1);
    });

    test("b moves word backward", () => {
      const action = vim.handleKeyPress("b", meta("b"), {} as any);
      expect(action.type).toBe("moveWord");
      expect(action.direction).toBe("backward");
      expect(action.count).toBe(1);
    });

    test("e moves to end of word", () => {
      const action = vim.handleKeyPress("e", meta("e"), {} as any);
      expect(action.type).toBe("moveWord");
      expect(action.direction).toBe("end");
      expect(action.count).toBe(1);
    });

    test("3w moves 3 words forward", () => {
      vim.handleKeyPress("3", meta("3"), {} as any);
      const action = vim.handleKeyPress("w", meta("w"), {} as any);
      expect(action.type).toBe("moveWord");
      expect(action.direction).toBe("forward");
      expect(action.count).toBe(3);
    });
  });

  describe("Number Buffer", () => {
    test("accumulates digits", () => {
      vim.handleKeyPress("1", meta("1"), {} as any);
      vim.handleKeyPress("2", meta("2"), {} as any);
      vim.handleKeyPress("3", meta("3"), {} as any);
      const action = vim.handleKeyPress("j", meta("j"), {} as any);
      expect(action.count).toBe(123);
    });

    test("0 is treated as command when buffer is empty", () => {
      const action = vim.handleKeyPress("0", meta("0"), {} as any);
      expect(action.type).toBe("moveTo");
      expect(action.target).toBe("firstColumn");
    });

    test("0 is treated as digit when buffer has content", () => {
      vim.handleKeyPress("1", meta("1"), {} as any);
      vim.handleKeyPress("0", meta("0"), {} as any);
      const action = vim.handleKeyPress("j", meta("j"), {} as any);
      expect(action.count).toBe(10);
    });

    test("number buffer is cleared after command", () => {
      vim.handleKeyPress("5", meta("5"), {} as any);
      vim.handleKeyPress("j", meta("j"), {} as any);
      const action = vim.handleKeyPress("k", meta("k"), {} as any);
      expect(action.count).toBe(1);
    });
  });

  describe("Edit Mode Variants", () => {
    const editVariants = [
      { key: "i", variant: "i" },
      { key: "a", variant: "a" },
      { key: "A", variant: "A" },
      { key: "I", variant: "I" },
      { key: "o", variant: "o" },
      { key: "O", variant: "O" },
    ];

    for (const { key, variant } of editVariants) {
      test(`'${key}' enters edit mode with variant '${variant}'`, () => {
        const action = vim.handleKeyPress(key, meta(key), {} as any);
        expect(action.type).toBe("changeMode");
        expect(action.mode).toBe("edit");
        expect(action.editVariant).toBe(variant);
      });
    }
  });

  describe("Delete Operations", () => {
    test("x deletes character", () => {
      const action = vim.handleKeyPress("x", meta("x"), {} as any);
      expect(action.type).toBe("delete");
      expect(action.motion).toBeUndefined();
    });

    test("dd deletes line", () => {
      vim.handleKeyPress("d", meta("d"), {} as any);
      const action = vim.handleKeyPress("d", meta("d"), {} as any);
      expect(action.type).toBe("delete");
      expect(action.motion).toBe("line");
    });

    test("d enters operator-pending mode", () => {
      vim.handleKeyPress("d", meta("d"), {} as any);
      expect(vim.getMode()).toBe("operator-pending");
    });
  });

  describe("Change Operations", () => {
    test("cc changes line", () => {
      vim.handleKeyPress("c", meta("c"), {} as any);
      const action = vim.handleKeyPress("c", meta("c"), {} as any);
      expect(action.type).toBe("change");
      expect(action.motion).toBe("line");
      expect(vim.getMode()).toBe("edit");
    });
  });

  describe("Yank Operations", () => {
    test("yy yanks line", () => {
      vim.handleKeyPress("y", meta("y"), {} as any);
      const action = vim.handleKeyPress("y", meta("y"), {} as any);
      expect(action.type).toBe("yank");
      expect(action.motion).toBe("line");
    });
  });

  describe("Paste Operations", () => {
    test("p pastes after", () => {
      const action = vim.handleKeyPress("p", meta("p"), {} as any);
      expect(action.type).toBe("paste");
      expect(action.before).toBe(false);
    });

    test("P pastes before", () => {
      const action = vim.handleKeyPress("P", meta("P"), {} as any);
      expect(action.type).toBe("paste");
      expect(action.before).toBe(true);
    });
  });

  describe("Scrolling Commands", () => {
    test("Ctrl+d scrolls half page down", () => {
      const action = vim.handleKeyPress(
        "d",
        { ...meta("d"), ctrl: true },
        {} as any,
      );
      expect(action.type).toBe("scroll");
      expect(action.direction).toBe("halfDown");
    });

    test("Ctrl+u scrolls half page up", () => {
      const action = vim.handleKeyPress(
        "u",
        { ...meta("u"), ctrl: true },
        {} as any,
      );
      expect(action.type).toBe("scroll");
      expect(action.direction).toBe("halfUp");
    });

    test("Ctrl+f scrolls page down", () => {
      const action = vim.handleKeyPress(
        "f",
        { ...meta("f"), ctrl: true },
        {} as any,
      );
      expect(action.type).toBe("scroll");
      expect(action.direction).toBe("pageDown");
    });

    test("Ctrl+b scrolls page up", () => {
      const action = vim.handleKeyPress(
        "b",
        { ...meta("b"), ctrl: true },
        {} as any,
      );
      expect(action.type).toBe("scroll");
      expect(action.direction).toBe("pageUp");
    });
  });

  describe("Center Commands", () => {
    test("zz centers current cell", () => {
      vim.handleKeyPress("z", meta("z"), {} as any);
      const action = vim.handleKeyPress("z", meta("z"), {} as any);
      expect(action.type).toBe("center");
      expect(action.position).toBe("center");
    });

    test("zt scrolls current cell to top", () => {
      vim.handleKeyPress("z", meta("z"), {} as any);
      const action = vim.handleKeyPress("t", meta("t"), {} as any);
      expect(action.type).toBe("center");
      expect(action.position).toBe("top");
    });

    test("zb scrolls current cell to bottom", () => {
      vim.handleKeyPress("z", meta("z"), {} as any);
      const action = vim.handleKeyPress("b", meta("b"), {} as any);
      expect(action.type).toBe("center");
      expect(action.position).toBe("bottom");
    });
  });

  describe("Resize Mode", () => {
    test("gr enters resize mode", () => {
      vim.handleKeyPress("g", meta("g"), {} as any);
      const action = vim.handleKeyPress("r", meta("r"), {} as any);
      expect(action.type).toBe("changeMode");
      expect(action.mode).toBe("resize");
      expect(vim.getMode()).toBe("resize");
    });

    test("resize mode commands", () => {
      vim.handleKeyPress("g", meta("g"), {} as any);
      vim.handleKeyPress("r", meta("r"), {} as any);

      const increaseAction = vim.handleKeyPress("+", meta("+"), {} as any);
      expect(increaseAction.type).toBe("resize");
      expect(increaseAction.direction).toBe("increase");

      const decreaseAction = vim.handleKeyPress("-", meta("-"), {} as any);
      expect(decreaseAction.type).toBe("resize");
      expect(decreaseAction.direction).toBe("decrease");

      const autoFitAction = vim.handleKeyPress("=", meta("="), {} as any);
      expect(autoFitAction.type).toBe("resize");
      expect(autoFitAction.direction).toBe("autoFit");
    });
  });

  describe("Visual Mode", () => {
    test("movement in visual mode", () => {
      vim.handleKeyPress("v", meta("v"), {} as any);

      const action = vim.handleKeyPress("j", meta("j"), {} as any);
      expect(action.type).toBe("move");
      expect(action.direction).toBe("down");
      expect(vim.getMode()).toBe("visual");
    });

    test("delete in visual mode", () => {
      vim.handleKeyPress("v", meta("v"), {} as any);

      const action = vim.handleKeyPress("d", meta("d"), {} as any);
      expect(action.type).toBe("delete");
      expect(vim.getMode()).toBe("normal");
    });

    test("yank in visual mode", () => {
      vim.handleKeyPress("v", meta("v"), {} as any);

      const action = vim.handleKeyPress("y", meta("y"), {} as any);
      expect(action.type).toBe("yank");
      expect(vim.getMode()).toBe("normal");
    });

    test("change in visual mode", () => {
      vim.handleKeyPress("v", meta("v"), {} as any);

      const action = vim.handleKeyPress("c", meta("c"), {} as any);
      expect(action.type).toBe("change");
      expect(vim.getMode()).toBe("edit");
    });
  });

  describe("Clipboard", () => {
    test("set and get clipboard", () => {
      vim.setClipboard("test content", "cell");
      const clipboard = vim.getClipboard();
      expect(clipboard).toEqual({ content: "test content", type: "cell" });
    });
  });

  describe("Visual Mode Selection", () => {
    test("set and get anchor", () => {
      const anchor = { row: 5, col: 10 };
      vim.setAnchor(anchor);
      expect(vim.getAnchor()).toEqual(anchor);
    });

    test("get visual type", () => {
      vim.handleKeyPress("v", meta("v"), {} as any);
      expect(vim.getVisualType()).toBe("character");

      vim.handleKeyPress("escape", meta("escape"), {} as any);
      vim.handleKeyPress("V", meta("V"), {} as any);
      expect(vim.getVisualType()).toBe("line");

      vim.handleKeyPress("escape", meta("escape"), {} as any);
      vim.handleKeyPress("v", { ...meta("v"), ctrl: true }, {} as any);
      expect(vim.getVisualType()).toBe("block");
    });

    test("escape clears anchor and visual type", () => {
      vim.setAnchor({ row: 1, col: 1 });
      vim.handleKeyPress("v", meta("v"), {} as any);

      const action = vim.handleKeyPress("escape", meta("escape"), {} as any);
      expect(action.type).toBe("changeMode");
      expect(vim.getAnchor()).toBeUndefined();
      expect(vim.getVisualType()).toBeUndefined();
    });
  });
});
