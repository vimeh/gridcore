import { beforeEach, describe, expect, test } from "bun:test";
import {
  type SpreadsheetChangeEvent,
  type SpreadsheetChangeListener,
  SpreadsheetEngine,
} from "./SpreadsheetEngine";
import type { Cell, CellAddress } from "./types";

describe("SpreadsheetEngine", () => {
  let engine: SpreadsheetEngine;

  beforeEach(() => {
    engine = new SpreadsheetEngine(100, 26);
  });

  describe("basic operations", () => {
    test("sets and gets cell values", () => {
      engine.setCell({ row: 0, col: 0 }, 42);
      const cell = engine.getCell({ row: 0, col: 0 });
      expect(cell?.rawValue).toBe(42);
      expect(cell?.computedValue).toBe(42);
    });

    test("evaluates simple formulas", () => {
      engine.setCell({ row: 0, col: 0 }, "=1+2", "=1+2");
      const cell = engine.getCell({ row: 0, col: 0 });
      expect(cell?.rawValue).toBe("=1+2");
      expect(cell?.computedValue).toBe(3);
    });

    test("evaluates cell references", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 20);
      engine.setCell({ row: 0, col: 2 }, "=A1+B1", "=A1+B1");

      const cell = engine.getCell({ row: 0, col: 2 });
      expect(cell?.computedValue).toBe(30);
    });

    test("evaluates unary plus operator", () => {
      engine.setCell({ row: 0, col: 0 }, "=+5", "=+5");
      const cell = engine.getCell({ row: 0, col: 0 });
      expect(cell?.computedValue).toBe(5);
    });

    test("evaluates unary minus operator", () => {
      engine.setCell({ row: 0, col: 0 }, "=-10", "=-10");
      const cell = engine.getCell({ row: 0, col: 0 });
      expect(cell?.computedValue).toBe(-10);
    });

    test("evaluates unary operators with cell references", () => {
      engine.setCell({ row: 0, col: 0 }, 42);
      engine.setCell({ row: 0, col: 1 }, "=-A1", "=-A1");

      const cell = engine.getCell({ row: 0, col: 1 });
      expect(cell?.computedValue).toBe(-42);
    });

    test("evaluates complex expressions with unary operators", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "=5+-A1", "=5+-A1");

      const cell = engine.getCell({ row: 0, col: 1 });
      expect(cell?.computedValue).toBe(-5);
    });
  });

  describe("dependency tracking", () => {
    test("updates dependent cells", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "=A1*2", "=A1*2");

      expect(engine.getCell({ row: 0, col: 1 })?.computedValue).toBe(20);

      // Update A1
      engine.setCell({ row: 0, col: 0 }, 5);

      // B1 should be recalculated
      expect(engine.getCell({ row: 0, col: 1 })?.computedValue).toBe(10);
    });

    test("handles chain dependencies", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "=A1*2", "=A1*2");
      engine.setCell({ row: 0, col: 2 }, "=B1+5", "=B1+5");

      expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(25);

      // Update A1
      engine.setCell({ row: 0, col: 0 }, 5);

      // Both B1 and C1 should be recalculated
      expect(engine.getCell({ row: 0, col: 1 })?.computedValue).toBe(10);
      expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(15);
    });

    test("detects circular references", () => {
      engine.setCell({ row: 0, col: 0 }, "=B1", "=B1");
      engine.setCell({ row: 0, col: 1 }, "=A1", "=A1");

      const cellA = engine.getCell({ row: 0, col: 0 });
      const cellB = engine.getCell({ row: 0, col: 1 });

      expect(cellA?.error).toBe("#CIRCULAR!");
      expect(cellB?.error).toBe("#CIRCULAR!");
    });
  });

  describe("functions", () => {
    test("evaluates SUM function", () => {
      engine.setCell({ row: 0, col: 0 }, 1);
      engine.setCell({ row: 0, col: 1 }, 2);
      engine.setCell({ row: 0, col: 2 }, 3);
      engine.setCell({ row: 1, col: 0 }, "=SUM(A1:C1)", "=SUM(A1:C1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(6);
    });

    test("evaluates AVERAGE function", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 20);
      engine.setCell({ row: 0, col: 2 }, 30);
      engine.setCell({ row: 1, col: 0 }, "=AVERAGE(A1:C1)", "=AVERAGE(A1:C1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(20);
    });

    test("evaluates IF function", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 5);
      engine.setCell(
        { row: 0, col: 2 },
        '=IF(A1>B1,"Yes","No")',
        '=IF(A1>B1,"Yes","No")',
      );

      expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe("Yes");
    });

    test("evaluates COUNT function", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "text");
      engine.setCell({ row: 0, col: 2 }, 30);
      engine.setCell({ row: 0, col: 3 }, "");
      engine.setCell({ row: 1, col: 0 }, "=COUNT(A1:D1)", "=COUNT(A1:D1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(2);
    });

    test("evaluates COUNT with individual arguments", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "text");
      engine.setCell({ row: 1, col: 0 }, "=COUNT(A1,B1,5)", "=COUNT(A1,B1,5)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(2);
    });

    test("evaluates MAX function", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 25);
      engine.setCell({ row: 0, col: 2 }, 15);
      engine.setCell({ row: 1, col: 0 }, "=MAX(A1:C1)", "=MAX(A1:C1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(25);
    });

    test("evaluates MAX with individual arguments", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 1, col: 0 }, "=MAX(A1,30,20)", "=MAX(A1,30,20)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(30);
    });

    test("evaluates MAX with no numeric values", () => {
      engine.setCell({ row: 0, col: 0 }, "text");
      engine.setCell({ row: 0, col: 1 }, "more text");
      engine.setCell({ row: 1, col: 0 }, "=MAX(A1:B1)", "=MAX(A1:B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(0);
    });

    test("evaluates MIN function", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 25);
      engine.setCell({ row: 0, col: 2 }, 15);
      engine.setCell({ row: 1, col: 0 }, "=MIN(A1:C1)", "=MIN(A1:C1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(10);
    });

    test("evaluates MIN with individual arguments", () => {
      engine.setCell({ row: 0, col: 0 }, 50);
      engine.setCell({ row: 1, col: 0 }, "=MIN(A1,30,20)", "=MIN(A1,30,20)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(20);
    });

    test("evaluates MIN with no numeric values", () => {
      engine.setCell({ row: 0, col: 0 }, "text");
      engine.setCell({ row: 0, col: 1 }, "more text");
      engine.setCell({ row: 1, col: 0 }, "=MIN(A1:B1)", "=MIN(A1:B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(0);
    });

    test("evaluates LEN function", () => {
      engine.setCell({ row: 0, col: 0 }, "Hello World");
      engine.setCell({ row: 1, col: 0 }, "=LEN(A1)", "=LEN(A1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(11);
    });

    test("evaluates LEN with number", () => {
      engine.setCell({ row: 0, col: 0 }, 12345);
      engine.setCell({ row: 1, col: 0 }, "=LEN(A1)", "=LEN(A1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(5);
    });

    test("evaluates AND function", () => {
      engine.setCell({ row: 0, col: 0 }, true);
      engine.setCell({ row: 0, col: 1 }, true);
      engine.setCell({ row: 1, col: 0 }, "=AND(A1,B1)", "=AND(A1,B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(true);
    });

    test("evaluates AND with false values", () => {
      engine.setCell({ row: 0, col: 0 }, true);
      engine.setCell({ row: 0, col: 1 }, false);
      engine.setCell({ row: 1, col: 0 }, "=AND(A1,B1)", "=AND(A1,B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(false);
    });

    test("evaluates OR function", () => {
      engine.setCell({ row: 0, col: 0 }, false);
      engine.setCell({ row: 0, col: 1 }, true);
      engine.setCell({ row: 1, col: 0 }, "=OR(A1,B1)", "=OR(A1,B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(true);
    });

    test("evaluates OR with all false values", () => {
      engine.setCell({ row: 0, col: 0 }, false);
      engine.setCell({ row: 0, col: 1 }, false);
      engine.setCell({ row: 1, col: 0 }, "=OR(A1,B1)", "=OR(A1,B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(false);
    });

    test("evaluates NOT function", () => {
      engine.setCell({ row: 0, col: 0 }, true);
      engine.setCell({ row: 1, col: 0 }, "=NOT(A1)", "=NOT(A1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(false);
    });

    test("evaluates NOT with false value", () => {
      engine.setCell({ row: 0, col: 0 }, false);
      engine.setCell({ row: 1, col: 0 }, "=NOT(A1)", "=NOT(A1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(true);
    });

    test("evaluates CONCATENATE function", () => {
      engine.setCell({ row: 0, col: 0 }, "Hello");
      engine.setCell({ row: 0, col: 1 }, " ");
      engine.setCell({ row: 0, col: 2 }, "World");
      engine.setCell(
        { row: 1, col: 0 },
        "=CONCATENATE(A1,B1,C1)",
        "=CONCATENATE(A1,B1,C1)",
      );

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(
        "Hello World",
      );
    });

    test("evaluates UPPER function", () => {
      engine.setCell({ row: 0, col: 0 }, "hello world");
      engine.setCell({ row: 1, col: 0 }, "=UPPER(A1)", "=UPPER(A1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(
        "HELLO WORLD",
      );
    });

    test("evaluates LOWER function", () => {
      engine.setCell({ row: 0, col: 0 }, "HELLO WORLD");
      engine.setCell({ row: 1, col: 0 }, "=LOWER(A1)", "=LOWER(A1)");

      expect(engine.getCell({ row: 1, col: 0 })?.computedValue).toBe(
        "hello world",
      );
    });

    test("UPPER throws error with wrong number of arguments", () => {
      engine.setCell({ row: 0, col: 0 }, "hello");
      engine.setCell({ row: 0, col: 1 }, "world");
      engine.setCell({ row: 1, col: 0 }, "=UPPER(A1,B1)", "=UPPER(A1,B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.error).toBe(
        "UPPER requires exactly 1 argument",
      );
    });

    test("LOWER throws error with wrong number of arguments", () => {
      engine.setCell({ row: 0, col: 0 }, "HELLO");
      engine.setCell({ row: 0, col: 1 }, "WORLD");
      engine.setCell({ row: 1, col: 0 }, "=LOWER(A1,B1)", "=LOWER(A1,B1)");

      expect(engine.getCell({ row: 1, col: 0 })?.error).toBe(
        "LOWER requires exactly 1 argument",
      );
    });
  });

  describe("batch operations", () => {
    test("sets multiple cells efficiently", () => {
      const updates = [
        { address: { row: 0, col: 0 }, value: 10 },
        { address: { row: 0, col: 1 }, value: 20 },
        { address: { row: 0, col: 2 }, value: "=A1+B1", formula: "=A1+B1" },
      ];

      engine.setCells(updates);

      expect(engine.getCell({ row: 0, col: 0 })?.computedValue).toBe(10);
      expect(engine.getCell({ row: 0, col: 1 })?.computedValue).toBe(20);
      expect(engine.getCell({ row: 0, col: 2 })?.computedValue).toBe(30);
    });
  });

  describe("event handling", () => {
    test("notifies listeners on cell change", () => {
      let eventFired = false;
      let changedCell: {
        address: CellAddress;
        oldValue?: Cell;
        newValue?: Cell;
      } | null = null;

      engine.addEventListener((event) => {
        eventFired = true;
        changedCell = event.cells[0];
      });

      engine.setCell({ row: 0, col: 0 }, 42);

      expect(eventFired).toBe(true);
      expect(changedCell).not.toBeNull();
      if (changedCell) {
        expect(changedCell.address).toEqual({ row: 0, col: 0 });
        expect(changedCell.newValue?.computedValue).toBe(42);
      }
    });

    test("notifies listeners on dependent cell updates", () => {
      const events: SpreadsheetChangeEvent[] = [];

      engine.addEventListener((event: SpreadsheetChangeEvent) => {
        events.push(event);
      });

      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "=A1*2", "=A1*2");

      events.length = 0; // Clear initial events

      engine.setCell({ row: 0, col: 0 }, 20);

      // Should have two events: one for A1 change, one batch for B1 recalculation
      expect(events.length).toBe(2);
      expect(events[0].type).toBe("batch-change"); // B1 recalculation happens first
      expect(events[0].cells.length).toBe(1);
      expect(events[1].type).toBe("cell-change"); // Then A1 change notification
    });
  });

  describe("serialization", () => {
    test("serializes and deserializes engine state", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, "=A1*2", "=A1*2");

      const json = engine.toJSON();
      const restored = SpreadsheetEngine.fromJSON(json);

      expect(restored.getCell({ row: 0, col: 0 })?.computedValue).toBe(10);
      expect(restored.getCell({ row: 0, col: 1 })?.computedValue).toBe(20);

      // Test that dependencies still work
      restored.setCell({ row: 0, col: 0 }, 5);
      expect(restored.getCell({ row: 0, col: 1 })?.computedValue).toBe(10);
    });
  });

  describe("event listener management", () => {
    test("removes event listeners", () => {
      let eventCount = 0;
      const listener: SpreadsheetChangeListener = () => {
        eventCount++;
      };

      engine.addEventListener(listener);
      engine.setCell({ row: 0, col: 0 }, 42);
      expect(eventCount).toBe(1);

      engine.removeEventListener(listener);
      engine.setCell({ row: 0, col: 0 }, 43);
      expect(eventCount).toBe(1); // Should not increase
    });
  });

  describe("cell reference operations", () => {
    test("gets cell by reference", () => {
      engine.setCell({ row: 0, col: 0 }, 42);
      const cell = engine.getCellByReference("A1");
      expect(cell?.computedValue).toBe(42);
    });

    test("returns undefined for non-existent cell reference", () => {
      const cell = engine.getCellByReference("Z99");
      expect(cell).toBeUndefined();
    });

    test("sets cell by reference", () => {
      engine.setCellByReference("B2", 100);
      const cell = engine.getCell({ row: 1, col: 1 });
      expect(cell?.computedValue).toBe(100);
    });

    test("sets formula by reference", () => {
      engine.setCellByReference("A1", 10);
      engine.setCellByReference("B1", "=A1*3", "=A1*3");
      const cell = engine.getCell({ row: 0, col: 1 });
      expect(cell?.computedValue).toBe(30);
    });

    test("throws error for invalid cell reference", () => {
      expect(() => {
        engine.setCellByReference("INVALID", 42);
      }).toThrow("Invalid cell reference: INVALID");
    });
  });

  describe("cell clearing operations", () => {
    test("clears individual cell", () => {
      engine.setCell({ row: 0, col: 0 }, 42);
      engine.setCell({ row: 0, col: 1 }, "=A1*2", "=A1*2");

      engine.clearCell({ row: 0, col: 0 });

      expect(engine.getCell({ row: 0, col: 0 })).toBeUndefined();
      // Dependent cell should be recalculated
      expect(engine.getCell({ row: 0, col: 1 })?.computedValue).toBe(0);
    });

    test("clears cell and notifies listeners", () => {
      let eventFired = false;
      let clearedCell: {
        address: CellAddress;
        oldValue?: Cell;
        newValue?: Cell;
      } | null = null;

      engine.addEventListener((event) => {
        eventFired = true;
        clearedCell = event.cells[0];
      });

      engine.setCell({ row: 0, col: 0 }, 42);
      engine.clearCell({ row: 0, col: 0 });

      expect(eventFired).toBe(true);
      expect(clearedCell?.oldValue?.computedValue).toBe(42);
      expect(clearedCell?.newValue).toBeUndefined();
    });

    test("clears entire grid", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 20);
      engine.setCell({ row: 0, col: 2 }, "=A1+B1", "=A1+B1");

      engine.clear();

      expect(engine.getCell({ row: 0, col: 0 })).toBeUndefined();
      expect(engine.getCell({ row: 0, col: 1 })).toBeUndefined();
      expect(engine.getCell({ row: 0, col: 2 })).toBeUndefined();
      expect(engine.getCellCount()).toBe(0);
    });

    test("clear notifies listeners with all cleared cells", () => {
      let eventFired = false;
      let clearedCells: Array<{
        address: CellAddress;
        oldValue?: Cell;
        newValue?: Cell;
      }> = [];

      engine.addEventListener((event) => {
        eventFired = true;
        clearedCells = event.cells;
      });

      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 20);

      engine.clear();

      expect(eventFired).toBe(true);
      expect(clearedCells.length).toBe(2);
      expect(clearedCells.every((cell) => cell.newValue === undefined)).toBe(
        true,
      );
    });
  });

  describe("grid information methods", () => {
    test("gets grid dimensions", () => {
      const dimensions = engine.getDimensions();
      expect(dimensions.rows).toBe(100);
      expect(dimensions.cols).toBe(26);
    });

    test("gets non-empty cells", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 1, col: 1 }, 20);
      engine.setCell({ row: 2, col: 2 }, 30);

      const nonEmptyCells = engine.getNonEmptyCells();
      expect(nonEmptyCells.length).toBe(3);
      expect(nonEmptyCells[0].cell.computedValue).toBe(10);
      expect(nonEmptyCells[1].cell.computedValue).toBe(20);
      expect(nonEmptyCells[2].cell.computedValue).toBe(30);
    });

    test("gets used range", () => {
      engine.setCell({ row: 1, col: 1 }, 10);
      engine.setCell({ row: 5, col: 3 }, 20);

      const range = engine.getUsedRange();
      expect(range).not.toBeNull();
      expect(range?.start).toEqual({ row: 1, col: 1 });
      expect(range?.end).toEqual({ row: 5, col: 3 });
    });

    test("returns null for empty grid used range", () => {
      const range = engine.getUsedRange();
      expect(range).toBeNull();
    });

    test("gets all cells", () => {
      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 20);

      const allCells = engine.getAllCells();
      expect(allCells.size).toBe(2);
      expect(allCells.get("0,0")?.computedValue).toBe(10);
      expect(allCells.get("0,1")?.computedValue).toBe(20);
    });

    test("gets cell count", () => {
      expect(engine.getCellCount()).toBe(0);

      engine.setCell({ row: 0, col: 0 }, 10);
      engine.setCell({ row: 0, col: 1 }, 20);

      expect(engine.getCellCount()).toBe(2);
    });
  });

  describe("utility methods", () => {
    test("parses cell key", () => {
      const address = engine.parseCellKey("0,0");
      expect(address).toEqual({ row: 0, col: 0 });
    });

    test("updates cell style", () => {
      engine.setCell({ row: 0, col: 0 }, 42);
      engine.updateCellStyle(
        { row: 0, col: 0 },
        {
          backgroundColor: "#ff0000",
          bold: true,
        },
      );

      const cell = engine.getCell({ row: 0, col: 0 });
      expect(cell?.style?.backgroundColor).toBe("#ff0000");
      expect(cell?.style?.bold).toBe(true);
    });

    test("updates cell style preserves existing styles", () => {
      engine.setCell({ row: 0, col: 0 }, 42);
      engine.updateCellStyle(
        { row: 0, col: 0 },
        {
          backgroundColor: "#ff0000",
        },
      );
      engine.updateCellStyle(
        { row: 0, col: 0 },
        {
          bold: true,
        },
      );

      const cell = engine.getCell({ row: 0, col: 0 });
      expect(cell?.style?.backgroundColor).toBe("#ff0000");
      expect(cell?.style?.bold).toBe(true);
    });
  });
});
