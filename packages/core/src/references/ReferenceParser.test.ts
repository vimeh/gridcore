import { describe, expect, test } from "bun:test";
import { ReferenceParser } from "./ReferenceParser";
import type { CellReference } from "./types";

describe("ReferenceParser", () => {
  describe("parseCellReference", () => {
    test("should parse simple relative reference A1", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("A1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          column: 0,
          row: 0,
          columnAbsolute: false,
          rowAbsolute: false,
        });
      }
    });

    test("should parse multi-letter columns like AB123", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("AB123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          column: 27, // AB = 26*1 + 2 - 1 = 27 (zero-based)
          row: 122, // 123 - 1 = 122 (zero-based)
          columnAbsolute: false,
          rowAbsolute: false,
        });
      }
    });

    test("should parse fully absolute reference $A$1", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("$A$1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          column: 0,
          row: 0,
          columnAbsolute: true,
          rowAbsolute: true,
        });
      }
    });

    test("should parse mixed references", () => {
      const parser = new ReferenceParser();

      const result1 = parser.parseCellReference("$A1");
      expect(result1.ok).toBe(true);
      if (result1.ok) {
        expect(result1.value.columnAbsolute).toBe(true);
        expect(result1.value.rowAbsolute).toBe(false);
      }

      const result2 = parser.parseCellReference("A$1");
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.value.columnAbsolute).toBe(false);
        expect(result2.value.rowAbsolute).toBe(true);
      }
    });

    test("should parse sheet references", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("Sheet1!A1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          column: 0,
          row: 0,
          columnAbsolute: false,
          rowAbsolute: false,
          sheet: "Sheet1",
          sheetAbsolute: false,
        });
      }
    });

    test("should parse quoted sheet references", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("'My Sheet'!$A$1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          column: 0,
          row: 0,
          columnAbsolute: true,
          rowAbsolute: true,
          sheet: "My Sheet",
          sheetAbsolute: true,
        });
      }
    });

    test("should handle Excel maximum column XFD", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("XFD1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.column).toBe(16383); // XFD in zero-based
      }
    });

    test("should reject invalid formats", () => {
      const parser = new ReferenceParser();
      const invalid = ["", "1A", "A", "123", "$$$A1"];
      invalid.forEach((input) => {
        const result = parser.parseCellReference(input);
        expect(result.ok).toBe(false);
      });
    });

    test("should reject out of bounds references", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("A1048577"); // Row too high
      expect(result.ok).toBe(false);
      expect(result.error).toBe("OUT_OF_BOUNDS");
    });

    test("should handle case insensitivity", () => {
      const parser = new ReferenceParser();
      const result = parser.parseCellReference("a1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.column).toBe(0);
        expect(result.value.row).toBe(0);
      }
    });
  });

  describe("parseRangeReference", () => {
    test("should parse simple range A1:B2", () => {
      const parser = new ReferenceParser();
      const result = parser.parseRangeReference("A1:B2");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.start.column).toBe(0);
        expect(result.value.start.row).toBe(0);
        expect(result.value.end.column).toBe(1);
        expect(result.value.end.row).toBe(1);
      }
    });

    test("should normalize range order", () => {
      const parser = new ReferenceParser();
      const result = parser.parseRangeReference("B2:A1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.start.column).toBe(0); // A
        expect(result.value.start.row).toBe(0); // 1
        expect(result.value.end.column).toBe(1); // B
        expect(result.value.end.row).toBe(1); // 2
      }
    });

    test("should reject invalid range formats", () => {
      const parser = new ReferenceParser();
      const invalid = ["A1", "A1:", ":B2"];
      invalid.forEach((input) => {
        const result = parser.parseRangeReference(input);
        expect(result.ok).toBe(false);
      });
    });
  });

  describe("stringifyCellReference", () => {
    test("should convert references back to string", () => {
      const parser = new ReferenceParser();

      const relative: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: false,
        rowAbsolute: false,
      };
      expect(parser.stringifyCellReference(relative)).toBe("A1");

      const absolute: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: true,
      };
      expect(parser.stringifyCellReference(absolute)).toBe("$A$1");

      const mixed: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: false,
      };
      expect(parser.stringifyCellReference(mixed)).toBe("$A1");
    });

    test("should handle sheet references", () => {
      const parser = new ReferenceParser();
      const ref: CellReference = {
        column: 0,
        row: 0,
        columnAbsolute: true,
        rowAbsolute: true,
        sheet: "Sheet1",
        sheetAbsolute: false,
      };
      expect(parser.stringifyCellReference(ref)).toBe("Sheet1!$A$1");
    });
  });

  describe("validation methods", () => {
    test("should validate cell reference patterns", () => {
      const parser = new ReferenceParser();
      expect(parser.isValidCellReferencePattern("A1")).toBe(true);
      expect(parser.isValidCellReferencePattern("$A$1")).toBe(true);
      expect(parser.isValidCellReferencePattern("Sheet1!A1")).toBe(true);
      expect(parser.isValidCellReferencePattern("invalid")).toBe(false);
    });

    test("should validate range reference patterns", () => {
      const parser = new ReferenceParser();
      expect(parser.isValidRangeReferencePattern("A1:B2")).toBe(true);
      expect(parser.isValidRangeReferencePattern("$A$1:$B$2")).toBe(true);
      expect(parser.isValidRangeReferencePattern("A1")).toBe(false);
    });
  });

  describe("round-trip consistency", () => {
    test("should maintain consistency for parse->stringify->parse", () => {
      const parser = new ReferenceParser();
      const testCases = ["A1", "$A$1", "$A1", "A$1", "Sheet1!A1"];

      testCases.forEach((original) => {
        const parsed = parser.parseCellReference(original);
        expect(parsed.ok).toBe(true);

        if (parsed.ok) {
          const stringified = parser.stringifyCellReference(parsed.value);
          const reparsed = parser.parseCellReference(stringified);

          expect(reparsed.ok).toBe(true);
          if (reparsed.ok) {
            expect(reparsed.value).toEqual(parsed.value);
          }
        }
      });
    });
  });
});
