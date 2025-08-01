import { beforeEach, describe, expect, test } from "bun:test";
import { Grid } from "./Grid";

describe("Grid", () => {
  let grid: Grid;

  beforeEach(() => {
    grid = new Grid();
  });

  describe("basic operations", () => {
    test("initializes with default dimensions", () => {
      const dimensions = grid.getDimensions();
      expect(dimensions.rows).toBe(1000);
      expect(dimensions.cols).toBe(26);
    });

    test("initializes with custom dimensions", () => {
      const customGrid = new Grid(100, 50);
      const dimensions = customGrid.getDimensions();
      expect(dimensions.rows).toBe(100);
      expect(dimensions.cols).toBe(50);
    });

    test("sets and gets cells by address", () => {
      grid.setCell({ row: 0, col: 0 }, "Hello");
      const cell = grid.getCell({ row: 0, col: 0 });

      expect(cell).toBeDefined();
      expect(cell?.rawValue).toBe("Hello");
      expect(cell?.computedValue).toBe("Hello");
    });

    test("sets and gets cells by reference", () => {
      grid.setCellByReference("B2", 42);
      const cell = grid.getCellByReference("B2");

      expect(cell).toBeDefined();
      expect(cell?.rawValue).toBe(42);
      expect(cell?.computedValue).toBe(42);
    });

    test("stores formulas", () => {
      grid.setCellByReference("A1", 10, "=SUM(B1:B10)");
      const cell = grid.getCellByReference("A1");

      expect(cell?.formula).toBe("=SUM(B1:B10)");
      expect(cell?.rawValue).toBe(10);
    });

    test("returns undefined for empty cells", () => {
      expect(grid.getCell({ row: 0, col: 0 })).toBeUndefined();
      expect(grid.getCellByReference("A1")).toBeUndefined();
    });

    test("throws error for invalid addresses", () => {
      expect(() => {
        grid.setCell({ row: -1, col: 0 }, "value");
      }).toThrow("Invalid cell address");

      expect(() => {
        grid.setCell({ row: 1000, col: 0 }, "value");
      }).toThrow("Invalid cell address");
    });

    test("throws error for invalid references", () => {
      expect(() => {
        grid.setCellByReference("Invalid", "value");
      }).toThrow("Invalid cell reference");
    });
  });

  describe("cell operations", () => {
    test("clears cells", () => {
      grid.setCell({ row: 0, col: 0 }, "test");
      expect(grid.getCell({ row: 0, col: 0 })).toBeDefined();

      grid.clearCell({ row: 0, col: 0 });
      expect(grid.getCell({ row: 0, col: 0 })).toBeUndefined();
    });

    test("clears cells by reference", () => {
      grid.setCellByReference("C3", "test");
      expect(grid.getCellByReference("C3")).toBeDefined();

      grid.clearCellByReference("C3");
      expect(grid.getCellByReference("C3")).toBeUndefined();
    });

    test("updates cell styles", () => {
      grid.setCell({ row: 0, col: 0 }, "styled");
      grid.updateCellStyle(
        { row: 0, col: 0 },
        { bold: true, color: "#FF0000" },
      );

      const cell = grid.getCell({ row: 0, col: 0 });
      expect(cell?.style?.bold).toBe(true);
      expect(cell?.style?.color).toBe("#FF0000");
    });

    test("preserves existing styles when updating", () => {
      grid.setCell({ row: 0, col: 0 }, "styled");
      grid.updateCellStyle({ row: 0, col: 0 }, { bold: true });
      grid.updateCellStyle({ row: 0, col: 0 }, { italic: true });

      const cell = grid.getCell({ row: 0, col: 0 });
      expect(cell?.style?.bold).toBe(true);
      expect(cell?.style?.italic).toBe(true);
    });
  });

  describe("grid utilities", () => {
    test("counts cells correctly", () => {
      expect(grid.getCellCount()).toBe(0);

      grid.setCell({ row: 0, col: 0 }, "A");
      grid.setCell({ row: 1, col: 1 }, "B");
      expect(grid.getCellCount()).toBe(2);

      grid.clearCell({ row: 0, col: 0 });
      expect(grid.getCellCount()).toBe(1);
    });

    test("clears all cells", () => {
      grid.setCell({ row: 0, col: 0 }, "A");
      grid.setCell({ row: 1, col: 1 }, "B");
      grid.setCell({ row: 2, col: 2 }, "C");

      expect(grid.getCellCount()).toBe(3);
      grid.clear();
      expect(grid.getCellCount()).toBe(0);
    });

    test("gets non-empty cells sorted", () => {
      grid.setCell({ row: 2, col: 1 }, "C");
      grid.setCell({ row: 0, col: 0 }, "A");
      grid.setCell({ row: 1, col: 2 }, "B");

      const nonEmpty = grid.getNonEmptyCells();
      expect(nonEmpty).toHaveLength(3);

      expect(nonEmpty[0].address).toEqual({ row: 0, col: 0 });
      expect(nonEmpty[1].address).toEqual({ row: 1, col: 2 });
      expect(nonEmpty[2].address).toEqual({ row: 2, col: 1 });
    });

    test("calculates used range", () => {
      expect(grid.getUsedRange()).toBeNull();

      grid.setCell({ row: 1, col: 1 }, "A");
      grid.setCell({ row: 5, col: 3 }, "B");
      grid.setCell({ row: 2, col: 7 }, "C");

      const range = grid.getUsedRange();
      expect(range).toEqual({
        start: { row: 1, col: 1 },
        end: { row: 5, col: 7 },
      });
    });
  });

  describe("cloning and serialization", () => {
    test("clones grid with all data", () => {
      grid.setCell({ row: 0, col: 0 }, "A", "=B1+C1");
      grid.updateCellStyle({ row: 0, col: 0 }, { bold: true });
      grid.setCell({ row: 1, col: 1 }, 42);

      const clone = grid.clone();

      expect(clone.getCellCount()).toBe(2);
      expect(clone.getCell({ row: 0, col: 0 })).toEqual(
        grid.getCell({ row: 0, col: 0 }),
      );
      expect(clone.getCell({ row: 1, col: 1 })).toEqual(
        grid.getCell({ row: 1, col: 1 }),
      );

      // Verify deep clone
      clone.setCell({ row: 2, col: 2 }, "New");
      expect(grid.getCell({ row: 2, col: 2 })).toBeUndefined();
    });

    test("serializes to JSON", () => {
      grid.setCell({ row: 0, col: 0 }, "A");
      grid.setCell({ row: 1, col: 1 }, 42);

      const json = grid.toJSON();

      expect(json.dimensions).toEqual({ rows: 1000, cols: 26 });
      expect(json.cells).toHaveLength(2);
      expect(json.cells[0]).toEqual({
        address: { row: 0, col: 0 },
        cell: {
          rawValue: "A",
          computedValue: "A",
          formula: undefined,
          style: undefined,
          error: undefined,
        },
      });
    });

    test("deserializes from JSON", () => {
      grid.setCell({ row: 0, col: 0 }, "A", "=B1");
      grid.updateCellStyle({ row: 0, col: 0 }, { bold: true });
      grid.setCell({ row: 1, col: 1 }, 42);

      const json = grid.toJSON();
      const restored = Grid.fromJSON(json);

      expect(restored.getCellCount()).toBe(2);
      expect(restored.getCell({ row: 0, col: 0 })).toEqual(
        grid.getCell({ row: 0, col: 0 }),
      );
      expect(restored.getCell({ row: 1, col: 1 })).toEqual(
        grid.getCell({ row: 1, col: 1 }),
      );
      expect(restored.getDimensions()).toEqual(grid.getDimensions());
    });
  });

  describe("edge cases", () => {
    test("handles maximum column references", () => {
      const maxGrid = new Grid(10, 702); // ZZ = 702
      maxGrid.setCellByReference("ZZ1", "max");

      expect(maxGrid.getCellByReference("ZZ1")).toBeDefined();
      expect(maxGrid.getCellByReference("ZZ1")?.rawValue).toBe("max");
    });

    test("handles various value types", () => {
      grid.setCell({ row: 0, col: 0 }, "string");
      grid.setCell({ row: 0, col: 1 }, 42);
      grid.setCell({ row: 0, col: 2 }, true);
      grid.setCell({ row: 0, col: 3 }, null);
      grid.setCell({ row: 0, col: 4 }, undefined);

      expect(grid.getCell({ row: 0, col: 0 })?.rawValue).toBe("string");
      expect(grid.getCell({ row: 0, col: 1 })?.rawValue).toBe(42);
      expect(grid.getCell({ row: 0, col: 2 })?.rawValue).toBe(true);
      expect(grid.getCell({ row: 0, col: 3 })?.rawValue).toBe(null);
      expect(grid.getCell({ row: 0, col: 4 })?.rawValue).toBe(undefined);
    });
  });
});
