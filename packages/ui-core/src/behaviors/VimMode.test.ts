import { beforeEach, describe, expect, test } from "bun:test";
import type { VimCallbacks, VimModeType } from "./VimMode";
import { VimMode } from "./VimMode";

describe("VimMode", () => {
  let vimMode: VimMode;
  let modeChanges: VimModeType[] = [];
  let cursorPositions: number[] = [];
  let textChanges: Array<{ text: string; cursor: number }> = [];

  const callbacks: VimCallbacks = {
    onModeChange: (mode) => modeChanges.push(mode),
    onCursorMove: (position) => cursorPositions.push(position),
    onTextChange: (text, cursor) => textChanges.push({ text, cursor }),
  };

  beforeEach(() => {
    vimMode = new VimMode(callbacks);
    modeChanges = [];
    cursorPositions = [];
    textChanges = [];
  });

  describe("Basic operations", () => {
    test("initial state is normal mode", () => {
      expect(vimMode.getMode()).toBe("normal");
      expect(vimMode.getCursor()).toBe(0);
      expect(vimMode.getText()).toBe("");
    });

    test("setText updates text and cursor", () => {
      vimMode.setText("hello world", 5);
      expect(vimMode.getText()).toBe("hello world");
      expect(vimMode.getCursor()).toBe(5);
      expect(cursorPositions).toEqual([5]);
    });

    test("setText clamps cursor in normal mode", () => {
      vimMode.setText("hello", 10);
      expect(vimMode.getCursor()).toBe(4); // Max position is length - 1
      expect(cursorPositions).toEqual([4]);
    });
  });

  describe("Mode transitions", () => {
    test("i enters insert mode", () => {
      vimMode.setText("hello");
      const handled = vimMode.handleKey("i");
      expect(handled).toBe(true);
      expect(vimMode.getMode()).toBe("insert");
      expect(modeChanges).toEqual(["insert"]);
    });

    test("setText allows cursor at end in insert mode", () => {
      vimMode.setText("hello");
      vimMode.handleKey("i"); // Enter insert mode
      vimMode.setText("hello", 5);
      expect(vimMode.getCursor()).toBe(5); // Cursor can be at length
    });

    test("Escape exits insert mode", () => {
      vimMode.setText("hello");
      vimMode.handleKey("i");
      vimMode.handleKey("Escape");
      expect(vimMode.getMode()).toBe("normal");
      expect(modeChanges).toEqual(["insert", "normal"]);
    });
  });

  describe("Text insertion", () => {
    test("typing in insert mode adds text", () => {
      vimMode.setText("hello", 2);
      vimMode.handleKey("i");
      vimMode.handleKey("X");
      expect(vimMode.getText()).toBe("heXllo");
      expect(vimMode.getCursor()).toBe(3);
      expect(textChanges).toHaveLength(1);
      expect(textChanges[0]).toEqual({ text: "heXllo", cursor: 3 });
    });

    test("multiple characters in insert mode", () => {
      vimMode.setText("test");
      vimMode.handleKey("A"); // Insert at end
      vimMode.handleKey("1");
      vimMode.handleKey("2");
      vimMode.handleKey("3");
      expect(vimMode.getText()).toBe("test123");
      expect(vimMode.getCursor()).toBe(7);
    });
  });

  describe("Movement", () => {
    test("h moves left", () => {
      vimMode.setText("hello", 3);
      const handled = vimMode.handleKey("h");
      expect(handled).toBe(true);
      expect(vimMode.getCursor()).toBe(2);
    });

    test("l moves right", () => {
      vimMode.setText("hello", 2);
      const handled = vimMode.handleKey("l");
      expect(handled).toBe(true);
      expect(vimMode.getCursor()).toBe(3);
    });

    test("movement at boundaries", () => {
      vimMode.setText("hi", 0);
      vimMode.handleKey("h"); // Should stay at 0
      expect(vimMode.getCursor()).toBe(0);

      vimMode.setText("hi", 1);
      vimMode.handleKey("l"); // Should stay at 1 (last valid position)
      expect(vimMode.getCursor()).toBe(1);
    });
  });

  describe("Deletion", () => {
    test("x deletes character", () => {
      vimMode.setText("hello", 1);
      const handled = vimMode.handleKey("x");
      expect(handled).toBe(true);
      expect(vimMode.getText()).toBe("hllo");
      expect(vimMode.getCursor()).toBe(1);
    });

    test("dd deletes entire line", () => {
      vimMode.setText("hello world", 5);
      vimMode.handleKey("d");
      const handled = vimMode.handleKey("d");
      expect(handled).toBe(true);
      expect(vimMode.getText()).toBe("");
      expect(vimMode.getCursor()).toBe(0);
    });
  });

  describe("Visual mode", () => {
    test("v enters visual mode", () => {
      vimMode.setText("hello");
      const handled = vimMode.handleKey("v");
      expect(handled).toBe(true);
      expect(vimMode.getMode()).toBe("visual");
    });

    test("visual selection is tracked", () => {
      vimMode.setText("hello world", 2);
      vimMode.handleKey("v");
      vimMode.handleKey("l");
      vimMode.handleKey("l");

      const selection = vimMode.getSelection();
      expect(selection).toEqual({ start: 2, end: 5 });
    });
  });

  describe("Edge cases", () => {
    test("operations on empty text", () => {
      vimMode.setText("");
      vimMode.handleKey("x");
      expect(vimMode.getText()).toBe("");

      vimMode.handleKey("d");
      vimMode.handleKey("d");
      expect(vimMode.getText()).toBe("");
    });

    test("reset clears state", () => {
      vimMode.setText("hello world", 5);
      vimMode.handleKey("v");
      vimMode.handleKey("l");

      vimMode.reset();

      expect(vimMode.getText()).toBe("");
      expect(vimMode.getCursor()).toBe(0);
      expect(vimMode.getMode()).toBe("normal");
      expect(vimMode.getSelection()).toBeNull();
    });
  });
});
