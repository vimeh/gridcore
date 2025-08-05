import { beforeEach, describe, expect, jest, test } from "bun:test";
import { StructuralOperationFeedback } from "./StructuralOperationFeedback";
import type { CellHighlight, StructuralUIEvent } from "./types";

// Mock DOM environment
const mockDocument = {
  createElement: jest.fn((tag: string) => ({
    id: "",
    textContent: "",
    appendChild: jest.fn(),
    remove: jest.fn(),
    style: {},
  })),
  getElementById: jest.fn(),
  head: {
    appendChild: jest.fn(),
  },
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
};

const mockContainer = {
  querySelector: jest.fn(),
  appendChild: jest.fn(),
  classList: {
    add: jest.fn(),
    remove: jest.fn(),
  },
};

// @ts-ignore
global.document = mockDocument;

describe("StructuralOperationFeedback", () => {
  let feedback: StructuralOperationFeedback;
  let container: any;

  beforeEach(() => {
    jest.clearAllMocks();
    container = mockContainer;
    feedback = new StructuralOperationFeedback(container);
  });

  describe("initialization", () => {
    test("should create with default styles", () => {
      const feedbackNoContainer = new StructuralOperationFeedback();
      expect(mockDocument.createElement).toHaveBeenCalledWith("style");
    });

    test("should create with custom styles", () => {
      const customStyles = {
        affected: { backgroundColor: "red" },
      };

      const customFeedback = new StructuralOperationFeedback(
        container,
        customStyles,
      );
      expect(mockDocument.createElement).toHaveBeenCalledWith("style");
    });
  });

  describe("event handling", () => {
    test("should handle highlightCells event", () => {
      const cells = [
        { row: 1, col: 1 },
        { row: 2, col: 2 },
      ];
      const event: StructuralUIEvent = {
        type: "highlightCells",
        cells,
        highlightType: "affected",
        duration: 1000,
      };

      // Mock cell elements
      const mockElement = {
        classList: { add: jest.fn() },
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      feedback.handleEvent(event);

      expect(container.querySelector).toHaveBeenCalledWith(
        '[data-row="1"][data-col="1"]',
      );
      expect(container.querySelector).toHaveBeenCalledWith(
        '[data-row="2"][data-col="2"]',
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith(
        "structural-highlight-affected",
      );
    });

    test("should handle clearHighlights event", () => {
      const cells = [{ row: 1, col: 1 }];

      // First highlight some cells
      const mockElement = {
        classList: { add: jest.fn() },
        className: "structural-highlight-affected other-class",
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      feedback.highlightCells(cells, "affected");

      // Then clear highlights
      feedback.handleEvent({ type: "clearHighlights" });

      expect(feedback.getActiveHighlights()).toHaveLength(0);
    });

    test("should handle structuralOperationCompleted event", () => {
      const affectedCells = [{ row: 1, col: 1 }];
      const event: StructuralUIEvent = {
        type: "structuralOperationCompleted",
        operation: {
          type: "insertRow",
          index: 1,
          count: 1,
          timestamp: Date.now(),
          id: "test",
        },
        affectedCells,
        formulaUpdates: new Map(),
        duration: 500,
      };

      const mockElement = {
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      feedback.handleEvent(event);

      // Should highlight affected cells briefly
      expect(mockElement.classList.add).toHaveBeenCalledWith(
        "structural-highlight-affected",
      );
      expect(mockElement.classList.add).toHaveBeenCalledWith(
        "structural-operation-complete",
      );
    });

    test("should handle structuralOperationFailed event", () => {
      const event: StructuralUIEvent = {
        type: "structuralOperationFailed",
        operation: {
          type: "deleteRow",
          index: 1,
          count: 1,
          timestamp: Date.now(),
          id: "test",
        },
        error: "Test error",
      };

      feedback.handleEvent(event);

      expect(container.classList.add).toHaveBeenCalledWith(
        "structural-operation-error",
      );
    });
  });

  describe("cell highlighting", () => {
    test("should highlight cells with specified type", () => {
      const cells = [
        { row: 1, col: 1 },
        { row: 2, col: 2 },
      ];

      const mockElement = {
        classList: { add: jest.fn() },
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      feedback.highlightCells(cells, "warning", 1000);

      expect(mockElement.classList.add).toHaveBeenCalledWith(
        "structural-highlight-warning",
      );
      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-bg",
        expect.any(String),
      );
      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-border",
        expect.any(String),
      );

      const highlights = feedback.getActiveHighlights();
      expect(highlights).toHaveLength(2);
      expect(highlights[0]).toEqual({
        address: { row: 1, col: 1 },
        type: "warning",
      });
    });

    test("should clear highlights by type", () => {
      const cells1 = [{ row: 1, col: 1 }];
      const cells2 = [{ row: 2, col: 2 }];

      const mockElement = {
        classList: { add: jest.fn() },
        className: "structural-highlight-affected other-class",
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      feedback.highlightCells(cells1, "affected");
      feedback.highlightCells(cells2, "warning");

      expect(feedback.getActiveHighlights()).toHaveLength(2);

      feedback.clearHighlightsByType("affected");

      const remainingHighlights = feedback.getActiveHighlights();
      expect(remainingHighlights).toHaveLength(1);
      expect(remainingHighlights[0].type).toBe("warning");
    });

    test("should clear all highlights", () => {
      const cells = [
        { row: 1, col: 1 },
        { row: 2, col: 2 },
      ];

      const mockElement = {
        classList: { add: jest.fn() },
        className: "structural-highlight-affected",
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      feedback.highlightCells(cells, "affected");
      expect(feedback.getActiveHighlights()).toHaveLength(2);

      feedback.clearAllHighlights();
      expect(feedback.getActiveHighlights()).toHaveLength(0);
    });

    test("should handle missing cell elements gracefully", () => {
      const cells = [{ row: 999, col: 999 }]; // Non-existent cell
      container.querySelector.mockReturnValue(null);

      // Should not throw
      expect(() => {
        feedback.highlightCells(cells, "affected");
      }).not.toThrow();

      // But should still track the highlight
      expect(feedback.getActiveHighlights()).toHaveLength(1);
    });
  });

  describe("style management", () => {
    test("should update highlight styles", () => {
      const newStyle = {
        backgroundColor: "blue",
        opacity: 0.5,
      };

      feedback.updateStyles("affected", newStyle);

      // Should trigger CSS update
      expect(mockDocument.getElementById).toHaveBeenCalledWith(
        "structural-operation-feedback-styles",
      );
    });

    test("should generate CSS for all highlight types", () => {
      // This tests the internal CSS generation
      const css = (feedback as any).generateCSS();
      expect(css).toContain(".structural-highlight-affected");
      expect(css).toContain(".structural-highlight-warning");
      expect(css).toContain(".structural-highlight-error");
      expect(css).toContain("@keyframes pulse");
    });
  });

  describe("completion feedback", () => {
    test("should show completion animation", () => {
      const affectedCells = [{ row: 1, col: 1 }];

      const mockElement = {
        classList: { add: jest.fn(), remove: jest.fn() },
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      (feedback as any).showCompletionFeedback(affectedCells);

      expect(mockElement.classList.add).toHaveBeenCalledWith(
        "structural-operation-complete",
      );
    });

    test("should show error feedback", () => {
      (feedback as any).showErrorFeedback();

      expect(container.classList.add).toHaveBeenCalledWith(
        "structural-operation-error",
      );
    });
  });

  describe("element interaction", () => {
    test("should apply highlight styling to cell element", () => {
      const cell = { row: 1, col: 1 };

      const mockElement = {
        classList: { add: jest.fn() },
        style: {
          setProperty: jest.fn(),
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      (feedback as any).applyCellHighlight(cell, "affected");

      expect(mockElement.classList.add).toHaveBeenCalledWith(
        "structural-highlight-affected",
      );
      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-bg",
        expect.any(String),
      );
      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-border",
        expect.any(String),
      );
      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-border-width",
        expect.any(String),
      );
      expect(mockElement.style.setProperty).toHaveBeenCalledWith(
        "--highlight-opacity",
        expect.any(String),
      );
    });

    test("should remove highlight styling from cell element", () => {
      const cell = { row: 1, col: 1 };

      const mockElement = {
        className: "structural-highlight-affected other-class",
        style: {
          removeProperty: jest.fn(),
          animation: "",
        },
      };
      container.querySelector.mockReturnValue(mockElement);

      (feedback as any).removeCellHighlight(cell);

      expect(mockElement.style.removeProperty).toHaveBeenCalledWith(
        "--highlight-bg",
      );
      expect(mockElement.style.removeProperty).toHaveBeenCalledWith(
        "--highlight-border",
      );
      expect(mockElement.style.removeProperty).toHaveBeenCalledWith(
        "--highlight-border-width",
      );
      expect(mockElement.style.removeProperty).toHaveBeenCalledWith(
        "--highlight-opacity",
      );
      expect(mockElement.style.animation).toBe("");
    });
  });
});
