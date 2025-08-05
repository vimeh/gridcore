import { beforeEach, describe, expect, it } from "bun:test";
import { CellAddress, CellRange } from "../../../domain/models";
import { CellSelection } from "./CellSelection";

describe("CellSelection", () => {
  let selection: CellSelection;

  beforeEach(() => {
    selection = new CellSelection();
  });

  describe("constructor", () => {
    it("should create empty selection by default", () => {
      expect(selection.isEmpty()).toBe(true);
      expect(selection.count()).toBe(0);
    });

    it("should create selection from cell addresses", () => {
      const cell1 = CellAddress.create(0, 0);
      const cell2 = CellAddress.create(1, 1);

      expect(cell1.ok).toBe(true);
      expect(cell2.ok).toBe(true);

      if (cell1.ok && cell2.ok) {
        const sel = new CellSelection([cell1.value, cell2.value]);
        expect(sel.count()).toBe(2);
        expect(sel.contains(cell1.value)).toBe(true);
        expect(sel.contains(cell2.value)).toBe(true);
      }
    });

    it("should create selection from CellRange", () => {
      const start = CellAddress.create(0, 0);
      const end = CellAddress.create(2, 2);

      expect(start.ok).toBe(true);
      expect(end.ok).toBe(true);

      if (start.ok && end.ok) {
        const range = CellRange.create(start.value, end.value);
        expect(range.ok).toBe(true);

        if (range.ok) {
          const sel = new CellSelection(range.value);
          expect(sel.count()).toBe(9); // 3x3 grid
        }
      }
    });

    it("should create selection from string keys", () => {
      const keys = new Set(["0,0", "1,1", "2,2"]);
      const sel = new CellSelection(keys);
      expect(sel.count()).toBe(3);
    });
  });

  describe("addCell", () => {
    it("should add single cell", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        selection.addCell(cell.value);
        expect(selection.count()).toBe(1);
        expect(selection.contains(cell.value)).toBe(true);
      }
    });

    it("should not add duplicate cells", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        selection.addCell(cell.value);
        selection.addCell(cell.value);
        expect(selection.count()).toBe(1);
      }
    });
  });

  describe("removeCell", () => {
    it("should remove existing cell", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        selection.addCell(cell.value);
        expect(selection.count()).toBe(1);

        selection.removeCell(cell.value);
        expect(selection.count()).toBe(0);
        expect(selection.contains(cell.value)).toBe(false);
      }
    });

    it("should handle removing non-existent cell", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        selection.removeCell(cell.value);
        expect(selection.count()).toBe(0);
      }
    });
  });

  describe("getCells", () => {
    it("should iterate over all cells", () => {
      const cells = [
        CellAddress.create(0, 0),
        CellAddress.create(1, 1),
        CellAddress.create(2, 2),
      ];

      for (const cell of cells) {
        expect(cell.ok).toBe(true);
        if (cell.ok) {
          selection.addCell(cell.value);
        }
      }

      const iteratedCells = Array.from(selection.getCells());
      expect(iteratedCells.length).toBe(3);

      // Check that all original cells are found
      for (const cell of cells) {
        if (cell.ok) {
          const found = iteratedCells.some(
            (c) => c.row === cell.value.row && c.col === cell.value.col,
          );
          expect(found).toBe(true);
        }
      }
    });
  });

  describe("contains", () => {
    it("should return true for contained cells", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        selection.addCell(cell.value);
        expect(selection.contains(cell.value)).toBe(true);
      }
    });

    it("should return false for non-contained cells", () => {
      const cell = CellAddress.create(5, 5);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        expect(selection.contains(cell.value)).toBe(false);
      }
    });
  });

  describe("clear", () => {
    it("should clear all cells", () => {
      const cell1 = CellAddress.create(0, 0);
      const cell2 = CellAddress.create(1, 1);

      expect(cell1.ok).toBe(true);
      expect(cell2.ok).toBe(true);

      if (cell1.ok && cell2.ok) {
        selection.addCell(cell1.value);
        selection.addCell(cell2.value);
        expect(selection.count()).toBe(2);

        selection.clear();
        expect(selection.count()).toBe(0);
        expect(selection.isEmpty()).toBe(true);
      }
    });
  });

  describe("getBounds", () => {
    it("should return null for empty selection", () => {
      expect(selection.getBounds()).toBeNull();
    });

    it("should return correct bounds for single cell", () => {
      const cell = CellAddress.create(5, 7);
      expect(cell.ok).toBe(true);

      if (cell.ok) {
        selection.addCell(cell.value);
        const bounds = selection.getBounds();
        expect(bounds).toEqual({
          minRow: 5,
          maxRow: 5,
          minCol: 7,
          maxCol: 7,
        });
      }
    });

    it("should return correct bounds for multiple cells", () => {
      const cells = [
        CellAddress.create(1, 1),
        CellAddress.create(5, 3),
        CellAddress.create(2, 8),
      ];

      for (const cell of cells) {
        expect(cell.ok).toBe(true);
        if (cell.ok) {
          selection.addCell(cell.value);
        }
      }

      const bounds = selection.getBounds();
      expect(bounds).toEqual({
        minRow: 1,
        maxRow: 5,
        minCol: 1,
        maxCol: 8,
      });
    });
  });

  describe("intersects", () => {
    it("should detect intersection", () => {
      const cell1 = CellAddress.create(1, 1);
      const cell2 = CellAddress.create(2, 2);
      const cell3 = CellAddress.create(2, 2); // Same as cell2

      expect(cell1.ok && cell2.ok && cell3.ok).toBe(true);

      if (cell1.ok && cell2.ok && cell3.ok) {
        selection.addCell(cell1.value);
        selection.addCell(cell2.value);

        const other = new CellSelection();
        other.addCell(cell3.value);

        expect(selection.intersects(other)).toBe(true);
      }
    });

    it("should detect no intersection", () => {
      const cell1 = CellAddress.create(1, 1);
      const cell2 = CellAddress.create(5, 5);

      expect(cell1.ok && cell2.ok).toBe(true);

      if (cell1.ok && cell2.ok) {
        selection.addCell(cell1.value);

        const other = new CellSelection();
        other.addCell(cell2.value);

        expect(selection.intersects(other)).toBe(false);
      }
    });
  });

  describe("union", () => {
    it("should create union of selections", () => {
      const cell1 = CellAddress.create(1, 1);
      const cell2 = CellAddress.create(2, 2);
      const cell3 = CellAddress.create(3, 3);

      expect(cell1.ok && cell2.ok && cell3.ok).toBe(true);

      if (cell1.ok && cell2.ok && cell3.ok) {
        selection.addCell(cell1.value);
        selection.addCell(cell2.value);

        const other = new CellSelection();
        other.addCell(cell2.value); // Overlap
        other.addCell(cell3.value);

        const union = selection.union(other);
        expect(union.count()).toBe(3);
        expect(union.contains(cell1.value)).toBe(true);
        expect(union.contains(cell2.value)).toBe(true);
        expect(union.contains(cell3.value)).toBe(true);
      }
    });
  });

  describe("intersection", () => {
    it("should create intersection of selections", () => {
      const cell1 = CellAddress.create(1, 1);
      const cell2 = CellAddress.create(2, 2);
      const cell3 = CellAddress.create(3, 3);

      expect(cell1.ok && cell2.ok && cell3.ok).toBe(true);

      if (cell1.ok && cell2.ok && cell3.ok) {
        selection.addCell(cell1.value);
        selection.addCell(cell2.value);

        const other = new CellSelection();
        other.addCell(cell2.value); // Overlap
        other.addCell(cell3.value);

        const intersection = selection.intersection(other);
        expect(intersection.count()).toBe(1);
        expect(intersection.contains(cell2.value)).toBe(true);
        expect(intersection.contains(cell1.value)).toBe(false);
        expect(intersection.contains(cell3.value)).toBe(false);
      }
    });
  });

  describe("static factory methods", () => {
    it("should create from coordinates", () => {
      const coords = [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 2 },
      ];

      const sel = CellSelection.fromCoordinates(coords);
      expect(sel.count()).toBe(3);
    });

    it("should create from keys", () => {
      const keys = new Set(["0,0", "1,1", "2,2"]);
      const sel = CellSelection.fromKeys(keys);
      expect(sel.count()).toBe(3);
    });
  });

  describe("toKeys", () => {
    it("should convert selection to string keys", () => {
      const cell1 = CellAddress.create(1, 2);
      const cell2 = CellAddress.create(3, 4);

      expect(cell1.ok && cell2.ok).toBe(true);

      if (cell1.ok && cell2.ok) {
        selection.addCell(cell1.value);
        selection.addCell(cell2.value);

        const keys = selection.toKeys();
        expect(keys.size).toBe(2);
        expect(keys.has("1,2")).toBe(true);
        expect(keys.has("3,4")).toBe(true);
      }
    });
  });
});
