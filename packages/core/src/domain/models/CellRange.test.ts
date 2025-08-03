import { describe, expect, test } from "bun:test";
import { CellAddress } from "./CellAddress";
import { CellRange } from "./CellRange";

describe("CellRange", () => {
  describe("create", () => {
    test("creates valid range", () => {
      const start = CellAddress.create(0, 0);
      const end = CellAddress.create(5, 5);
      expect(start.ok && end.ok).toBe(true);
      if (start.ok && end.ok) {
        const result = CellRange.create(start.value, end.value);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.start).toBe(start.value);
          expect(result.value.end).toBe(end.value);
        }
      }
    });

    test("rejects invalid range where start > end", () => {
      const start = CellAddress.create(5, 5);
      const end = CellAddress.create(0, 0);
      expect(start.ok && end.ok).toBe(true);
      if (start.ok && end.ok) {
        const result = CellRange.create(start.value, end.value);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain(
            "start must be before or equal to end",
          );
        }
      }
    });

    test("allows single cell range", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);
      if (cell.ok) {
        const result = CellRange.create(cell.value, cell.value);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("fromString", () => {
    test("parses A1:B2 notation", () => {
      const result = CellRange.fromString("A1:B2");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.start.row).toBe(0);
        expect(result.value.start.col).toBe(0);
        expect(result.value.end.row).toBe(1);
        expect(result.value.end.col).toBe(1);
      }
    });

    test("parses single cell range A1:A1", () => {
      const result = CellRange.fromString("A1:A1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.start.row).toBe(0);
        expect(result.value.start.col).toBe(0);
        expect(result.value.end.row).toBe(0);
        expect(result.value.end.col).toBe(0);
      }
    });

    test("rejects invalid format", () => {
      const result = CellRange.fromString("A1-B2");
      expect(result.ok).toBe(false);
    });

    test("rejects invalid start address", () => {
      const result = CellRange.fromString("1A:B2");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid start address");
      }
    });

    test("rejects invalid end address", () => {
      const result = CellRange.fromString("A1:2B");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid end address");
      }
    });
  });

  describe("toString", () => {
    test("converts to range notation", () => {
      const result = CellRange.fromString("A1:B2");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.toString()).toBe("A1:B2");
      }
    });
  });

  describe("contains", () => {
    test("contains cell within range", () => {
      const range = CellRange.fromString("A1:C3");
      const cell = CellAddress.fromString("B2");
      expect(range.ok && cell.ok).toBe(true);
      if (range.ok && cell.ok) {
        expect(range.value.contains(cell.value)).toBe(true);
      }
    });

    test("does not contain cell outside range", () => {
      const range = CellRange.fromString("A1:C3");
      const cell = CellAddress.fromString("D4");
      expect(range.ok && cell.ok).toBe(true);
      if (range.ok && cell.ok) {
        expect(range.value.contains(cell.value)).toBe(false);
      }
    });

    test("contains corner cells", () => {
      const range = CellRange.fromString("A1:C3");
      const corners = ["A1", "A3", "C1", "C3"];
      expect(range.ok).toBe(true);
      if (range.ok) {
        for (const corner of corners) {
          const cell = CellAddress.fromString(corner);
          expect(cell.ok).toBe(true);
          if (cell.ok) {
            expect(range.value.contains(cell.value)).toBe(true);
          }
        }
      }
    });
  });

  describe("cells iterator", () => {
    test("iterates over all cells in range", () => {
      const range = CellRange.fromString("A1:B2");
      expect(range.ok).toBe(true);
      if (range.ok) {
        const cells = Array.from(range.value.cells());
        expect(cells.length).toBe(4);

        const cellStrings = cells.map((c) => c.toString());
        expect(cellStrings).toEqual(["A1", "B1", "A2", "B2"]);
      }
    });

    test("single cell range yields one cell", () => {
      const range = CellRange.fromString("B2:B2");
      expect(range.ok).toBe(true);
      if (range.ok) {
        const cells = Array.from(range.value.cells());
        expect(cells.length).toBe(1);
        expect(cells[0].toString()).toBe("B2");
      }
    });
  });

  describe("dimensions", () => {
    test("calculates row and column count", () => {
      const range = CellRange.fromString("A1:C4");
      expect(range.ok).toBe(true);
      if (range.ok) {
        expect(range.value.rowCount).toBe(4);
        expect(range.value.colCount).toBe(3);
        expect(range.value.cellCount).toBe(12);
      }
    });

    test("single cell has dimensions 1x1", () => {
      const range = CellRange.fromString("B2:B2");
      expect(range.ok).toBe(true);
      if (range.ok) {
        expect(range.value.rowCount).toBe(1);
        expect(range.value.colCount).toBe(1);
        expect(range.value.cellCount).toBe(1);
      }
    });
  });

  describe("intersects", () => {
    test("overlapping ranges intersect", () => {
      const range1 = CellRange.fromString("A1:C3");
      const range2 = CellRange.fromString("B2:D4");
      expect(range1.ok && range2.ok).toBe(true);
      if (range1.ok && range2.ok) {
        expect(range1.value.intersects(range2.value)).toBe(true);
        expect(range2.value.intersects(range1.value)).toBe(true);
      }
    });

    test("non-overlapping ranges do not intersect", () => {
      const range1 = CellRange.fromString("A1:B2");
      const range2 = CellRange.fromString("C3:D4");
      expect(range1.ok && range2.ok).toBe(true);
      if (range1.ok && range2.ok) {
        expect(range1.value.intersects(range2.value)).toBe(false);
        expect(range2.value.intersects(range1.value)).toBe(false);
      }
    });

    test("touching ranges intersect", () => {
      const range1 = CellRange.fromString("A1:B2");
      const range2 = CellRange.fromString("B2:C3");
      expect(range1.ok && range2.ok).toBe(true);
      if (range1.ok && range2.ok) {
        expect(range1.value.intersects(range2.value)).toBe(true);
      }
    });
  });

  describe("intersection", () => {
    test("calculates intersection of overlapping ranges", () => {
      const range1 = CellRange.fromString("A1:C3");
      const range2 = CellRange.fromString("B2:D4");
      expect(range1.ok && range2.ok).toBe(true);
      if (range1.ok && range2.ok) {
        const result = range1.value.intersection(range2.value);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.toString()).toBe("B2:C3");
        }
      }
    });

    test("returns error for non-intersecting ranges", () => {
      const range1 = CellRange.fromString("A1:B2");
      const range2 = CellRange.fromString("C3:D4");
      expect(range1.ok && range2.ok).toBe(true);
      if (range1.ok && range2.ok) {
        const result = range1.value.intersection(range2.value);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toContain("do not intersect");
        }
      }
    });

    test("single cell intersection", () => {
      const range1 = CellRange.fromString("A1:B2");
      const range2 = CellRange.fromString("B2:C3");
      expect(range1.ok && range2.ok).toBe(true);
      if (range1.ok && range2.ok) {
        const result = range1.value.intersection(range2.value);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.toString()).toBe("B2:B2");
        }
      }
    });
  });
});
