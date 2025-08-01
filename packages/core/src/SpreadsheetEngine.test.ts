import { beforeEach, describe, expect, test } from "bun:test";
import {
  type SpreadsheetChangeEvent,
  SpreadsheetEngine,
} from "./SpreadsheetEngine";

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
      let changedCell: SpreadsheetChangeEvent["cells"][0] | null = null;

      engine.addEventListener((event) => {
        eventFired = true;
        changedCell = event.cells[0];
      });

      engine.setCell({ row: 0, col: 0 }, 42);

      expect(eventFired).toBe(true);
      expect(changedCell).not.toBeNull();
      expect(changedCell?.address).toEqual({ row: 0, col: 0 });
      expect(changedCell?.newValue?.computedValue).toBe(42);
    });

    test("notifies listeners on dependent cell updates", () => {
      const events: SpreadsheetChangeEvent[] = [];

      engine.addEventListener((event) => {
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
});
