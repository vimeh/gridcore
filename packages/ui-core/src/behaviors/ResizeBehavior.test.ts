import { beforeEach, describe, expect, test } from "bun:test";
import { createNavigationState, createResizeState } from "../state/UIState";
import { ResizeBehavior } from "./ResizeBehavior";

describe("ResizeBehavior", () => {
  let resizeBehavior: ResizeBehavior;
  const defaultViewport = { startRow: 0, startCol: 0, rows: 20, cols: 10 };
  const defaultCursor = { row: 0, col: 0 };

  beforeEach(() => {
    resizeBehavior = new ResizeBehavior();
  });

  describe("in resize mode", () => {
    describe("column resize", () => {
      const columnResizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        2,
        100,
      );

      test("should increase column width with + or >", () => {
        expect(resizeBehavior.handleKey("+", columnResizeState)).toEqual({
          type: "resize",
          delta: 5,
        });

        expect(resizeBehavior.handleKey(">", columnResizeState)).toEqual({
          type: "resize",
          delta: 5,
        });
      });

      test("should decrease column width with - or <", () => {
        expect(resizeBehavior.handleKey("-", columnResizeState)).toEqual({
          type: "resize",
          delta: -5,
        });

        expect(resizeBehavior.handleKey("<", columnResizeState)).toEqual({
          type: "resize",
          delta: -5,
        });
      });

      test("should auto-fit with =", () => {
        expect(resizeBehavior.handleKey("=", columnResizeState)).toEqual({
          type: "autoFit",
        });
      });

      test("should navigate columns with h/l", () => {
        expect(resizeBehavior.handleKey("h", columnResizeState)).toEqual({
          type: "moveTarget",
          direction: "prev",
        });

        expect(resizeBehavior.handleKey("l", columnResizeState)).toEqual({
          type: "moveTarget",
          direction: "next",
        });
      });

      test("should not navigate rows with j/k", () => {
        expect(resizeBehavior.handleKey("j", columnResizeState)).toEqual({
          type: "none",
        });

        expect(resizeBehavior.handleKey("k", columnResizeState)).toEqual({
          type: "none",
        });
      });
    });

    describe("row resize", () => {
      const rowResizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "row",
        5,
        25,
      );

      test("should increase row height with + or >", () => {
        expect(resizeBehavior.handleKey("+", rowResizeState)).toEqual({
          type: "resize",
          delta: 5,
        });

        expect(resizeBehavior.handleKey(">", rowResizeState)).toEqual({
          type: "resize",
          delta: 5,
        });
      });

      test("should decrease row height with - or <", () => {
        expect(resizeBehavior.handleKey("-", rowResizeState)).toEqual({
          type: "resize",
          delta: -5,
        });

        expect(resizeBehavior.handleKey("<", rowResizeState)).toEqual({
          type: "resize",
          delta: -5,
        });
      });

      test("should navigate rows with j/k", () => {
        expect(resizeBehavior.handleKey("j", rowResizeState)).toEqual({
          type: "moveTarget",
          direction: "next",
        });

        expect(resizeBehavior.handleKey("k", rowResizeState)).toEqual({
          type: "moveTarget",
          direction: "prev",
        });
      });

      test("should not navigate columns with h/l", () => {
        expect(resizeBehavior.handleKey("h", rowResizeState)).toEqual({
          type: "none",
        });

        expect(resizeBehavior.handleKey("l", rowResizeState)).toEqual({
          type: "none",
        });
      });
    });

    describe("number accumulation", () => {
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        0,
        100,
      );

      test("should accumulate numbers for multiplier", () => {
        expect(resizeBehavior.handleKey("3", resizeState)).toEqual({
          type: "none",
        });

        expect(resizeBehavior.handleKey("+", resizeState)).toEqual({
          type: "resize",
          delta: 15, // 3 * 5
        });
      });

      test("should handle multi-digit numbers", () => {
        expect(resizeBehavior.handleKey("1", resizeState)).toEqual({
          type: "none",
        });
        expect(resizeBehavior.handleKey("2", resizeState)).toEqual({
          type: "none",
        });

        expect(resizeBehavior.handleKey("-", resizeState)).toEqual({
          type: "resize",
          delta: -60, // 12 * -5
        });
      });

      test("should clear number buffer after action", () => {
        resizeBehavior.handleKey("5", resizeState);
        resizeBehavior.handleKey("+", resizeState);

        // Next action should not use previous multiplier
        expect(resizeBehavior.handleKey("-", resizeState)).toEqual({
          type: "resize",
          delta: -5, // Not -25
        });
      });
    });

    describe("confirm and cancel", () => {
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        0,
        100,
      );

      test("should confirm resize with Enter", () => {
        expect(resizeBehavior.handleKey("Enter", resizeState)).toEqual({
          type: "confirm",
        });
      });

      test("should cancel resize with Escape", () => {
        expect(resizeBehavior.handleKey("Escape", resizeState)).toEqual({
          type: "cancel",
        });
      });
    });

    describe("unknown keys", () => {
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        0,
        100,
      );

      test("should return none for unknown keys", () => {
        expect(resizeBehavior.handleKey("x", resizeState)).toEqual({
          type: "none",
        });

        expect(resizeBehavior.handleKey("w", resizeState)).toEqual({
          type: "none",
        });
      });
    });
  });

  describe("not in resize mode", () => {
    const navigationState = createNavigationState(
      defaultCursor,
      defaultViewport,
    );

    test("should return none for any key", () => {
      expect(resizeBehavior.handleKey("+", navigationState)).toEqual({
        type: "none",
      });

      expect(resizeBehavior.handleKey("h", navigationState)).toEqual({
        type: "none",
      });

      expect(resizeBehavior.handleKey("Enter", navigationState)).toEqual({
        type: "none",
      });
    });
  });

  describe("getResizeInfo", () => {
    test("should return resize info in resize mode", () => {
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        3,
        150,
      );

      expect(resizeBehavior.getResizeInfo(resizeState)).toEqual({
        target: "column 3",
        size: 150,
        originalSize: 150,
      });
    });

    test("should return null when not in resize mode", () => {
      const navigationState = createNavigationState(
        defaultCursor,
        defaultViewport,
      );

      expect(resizeBehavior.getResizeInfo(navigationState)).toBeNull();
    });
  });

  describe("reset", () => {
    test("should clear number buffer", () => {
      const resizeState = createResizeState(
        defaultCursor,
        defaultViewport,
        "column",
        0,
        100,
      );

      // Accumulate some numbers
      resizeBehavior.handleKey("7", resizeState);
      resizeBehavior.handleKey("5", resizeState);

      // Reset
      resizeBehavior.reset();

      // Next action should not use accumulated numbers
      expect(resizeBehavior.handleKey("+", resizeState)).toEqual({
        type: "resize",
        delta: 5, // Not 375 (75 * 5)
      });
    });
  });
});
