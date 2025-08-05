import { CellAddress } from "@gridcore/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { UIState, ViewportInfo } from "../../state/UIState";
import type { KeyMeta } from "../VimBehavior";
import { ReferenceToggleExtension } from "./ReferenceToggleExtension";

describe("ReferenceToggleExtension", () => {
  let extension: ReferenceToggleExtension;
  let mockState: UIState;

  beforeEach(() => {
    extension = new ReferenceToggleExtension();
    const cursor = new CellAddress(0, 0); // A1
    const viewport: ViewportInfo = { startRow: 0, startCol: 0, rows: 10, cols: 10 };
    
    mockState = {
      spreadsheetMode: "editing",
      cursor,
      viewport,
      cellMode: "normal",
      editingValue: "=SUM(A1:B2)",
      cursorPosition: 7, // Position on 'A1'
      visualStart: undefined,
    } as UIState;
  });

  describe("F4 key handling", () => {
    it("should handle F4 key correctly", () => {
      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("replaceFormula");
    });

    it("should handle lowercase f4 key", () => {
      const keyMeta: KeyMeta = {
        key: "f4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("f4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("replaceFormula");
    });

    it("should return null for non-F4 keys", () => {
      const keyMeta: KeyMeta = {
        key: "a",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("a", keyMeta, mockState);
      expect(result).toBeNull();
    });

    it("should return null when not in editing mode", () => {
      const nonEditingState = {
        ...mockState,
        mode: "navigation",
      } as UIState;

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, nonEditingState);
      expect(result).toBeNull();
    });
  });

  describe("findReferenceAtCursor", () => {
    it("should find reference at cursor position", () => {
      // This tests the private method indirectly through F4 handling
      mockState.editingValue = "=SUM(A1:B2)";
      mockState.cursorPosition = 7; // On 'A1'

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("replaceFormula");
    });

    it("should find no reference when cursor is not on a reference", () => {
      mockState.editingValue = "=SUM(A1:B2)";
      mockState.cursorPosition = 1; // On 'S' in SUM

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("none");
    });
  });

  describe("findNextReference", () => {
    it("should find next reference after cursor", () => {
      const text = "=SUM(A1, B2, C3)";
      const cursorPos = 5; // After A1

      const result = extension.findNextReference(text, cursorPos);
      expect(result).not.toBeNull();
      expect(result?.startPos).toBeGreaterThan(cursorPos);
    });

    it("should return null when no next reference exists", () => {
      const text = "=SUM(A1)";
      const cursorPos = 10; // After the reference

      const result = extension.findNextReference(text, cursorPos);
      expect(result).toBeNull();
    });
  });

  describe("findPreviousReference", () => {
    it("should find previous reference before cursor", () => {
      const text = "=SUM(A1, B2, C3)";
      const cursorPos = 15; // After B2

      const result = extension.findPreviousReference(text, cursorPos);
      expect(result).not.toBeNull();
      expect(result?.startPos).toBeLessThan(cursorPos);
    });

    it("should return null when no previous reference exists", () => {
      const text = "=SUM(A1)";
      const cursorPos = 5; // Before the reference

      const result = extension.findPreviousReference(text, cursorPos);
      expect(result).toBeNull();
    });
  });

  describe("getReferenceTextObject", () => {
    it("should get inner reference boundaries", () => {
      const text = "=SUM(A1:B2)";
      const cursorPos = 7; // On 'A1'

      const result = extension.getReferenceTextObject(text, cursorPos, false);
      expect(result).not.toBeNull();
      expect(result?.start).toBeGreaterThanOrEqual(0);
      expect(result?.end).toBeGreaterThan(result?.start);
    });

    it("should get around reference boundaries with spaces", () => {
      const text = "=SUM( A1:B2 )";
      const cursorPos = 8; // On 'A1'

      const result = extension.getReferenceTextObject(text, cursorPos, true);
      expect(result).not.toBeNull();
      expect(result?.start).toBeGreaterThanOrEqual(0);
      expect(result?.end).toBeGreaterThan(result?.start);
    });

    it("should return null when cursor is not on a reference", () => {
      const text = "=SUM(A1:B2)";
      const cursorPos = 1; // On 'S' in SUM

      const result = extension.getReferenceTextObject(text, cursorPos, false);
      expect(result).toBeNull();
    });
  });

  describe("complex formulas", () => {
    it("should handle multiple references in complex formulas", () => {
      mockState.editingValue = "=IF(A1>0, SUM(B1:B10), AVERAGE(C1:C10))";
      mockState.cursorPosition = 6; // On 'A1'

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("replaceFormula");
    });

    it("should handle sheet references", () => {
      mockState.editingValue = "=Sheet1!A1 + Sheet2!B2";
      mockState.cursorPosition = 8; // On 'Sheet1!A1'

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("replaceFormula");
    });

    it("should handle quoted sheet names", () => {
      mockState.editingValue = "='Sheet Name'!A1";
      mockState.cursorPosition = 15; // On the reference

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("replaceFormula");
    });
  });

  describe("edge cases", () => {
    it("should handle empty formula", () => {
      mockState.editingValue = "";
      mockState.cursorPosition = 0;

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("none");
    });

    it("should handle formula with no references", () => {
      mockState.editingValue = "=1+2+3";
      mockState.cursorPosition = 3;

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("none");
    });

    it("should handle cursor at end of text", () => {
      mockState.editingValue = "=SUM(A1)";
      mockState.cursorPosition = mockState.editingValue.length;

      const keyMeta: KeyMeta = {
        key: "F4",
        ctrl: false,
        shift: false,
        alt: false,
      };

      const result = extension.handleKeyPress("F4", keyMeta, mockState);
      expect(result).not.toBeNull();
      // Should find the previous reference (A1)
      expect(result?.type).toBe("replaceFormula");
    });
  });
});
