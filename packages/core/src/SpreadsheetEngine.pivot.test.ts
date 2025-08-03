import { describe, expect, test } from "bun:test";
import type { PivotTableConfig } from "./pivot/PivotTypes";
import { SpreadsheetEngine } from "./SpreadsheetEngine";

describe("SpreadsheetEngine Pivot Table Integration", () => {
  const createEngineWithData = () => {
    const engine = new SpreadsheetEngine(100, 26);

    // Add headers
    engine.setCellByReference("A1", "Category");
    engine.setCellByReference("B1", "Product");
    engine.setCellByReference("C1", "Sales");

    // Add data
    engine.setCellByReference("A2", "Electronics");
    engine.setCellByReference("B2", "Laptop");
    engine.setCellByReference("C2", 1000);

    engine.setCellByReference("A3", "Electronics");
    engine.setCellByReference("B3", "Phone");
    engine.setCellByReference("C3", 500);

    engine.setCellByReference("A4", "Furniture");
    engine.setCellByReference("B4", "Chair");
    engine.setCellByReference("C4", 200);

    return engine;
  };

  test("adds and retrieves pivot table", () => {
    const engine = createEngineWithData();
    const config: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const pivot = engine.addPivotTable("test-pivot", config, {
      row: 6,
      col: 0,
    });
    expect(pivot).toBeDefined();

    const retrieved = engine.getPivotTable("test-pivot");
    expect(retrieved).toBe(pivot);
  });

  test("refreshes pivot table when data changes", () => {
    const engine = createEngineWithData();
    const config: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    engine.addPivotTable("test-pivot", config, { row: 6, col: 0 });

    // Check initial Electronics total (1000 + 500 = 1500)
    const initialElectronics = engine.getCell({ row: 7, col: 1 });
    expect(initialElectronics?.computedValue).toBe(1500);

    // Update a value
    engine.setCellByReference("C2", 1200);

    // Manually refresh pivot table
    engine.refreshPivotTable("test-pivot");

    // Check updated Electronics total (1200 + 500 = 1700)
    const updatedElectronics = engine.getCell({ row: 7, col: 1 });
    expect(updatedElectronics?.computedValue).toBe(1700);
  });

  test("removes pivot table and clears output", () => {
    const engine = createEngineWithData();
    const config: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    engine.addPivotTable("test-pivot", config, { row: 6, col: 0 });

    // Verify pivot output exists
    const cellBeforeRemoval = engine.getCell({ row: 7, col: 0 });
    expect(cellBeforeRemoval?.computedValue).toBe("Electronics");

    // Remove pivot table
    const removed = engine.removePivotTable("test-pivot");
    expect(removed).toBe(true);

    // Verify pivot table is gone
    expect(engine.getPivotTable("test-pivot")).toBeUndefined();

    // Verify output is cleared
    const cellAfterRemoval = engine.getCell({ row: 7, col: 0 });
    expect(cellAfterRemoval).toBeUndefined();
  });

  test("handles multiple pivot tables", () => {
    const engine = createEngineWithData();

    const config1: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const config2: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Product"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "AVERAGE" }],
    };

    engine.addPivotTable("pivot1", config1, { row: 6, col: 0 });
    engine.addPivotTable("pivot2", config2, { row: 6, col: 5 });

    const allPivots = engine.getAllPivotTables();
    expect(allPivots.size).toBe(2);
    expect(allPivots.has("pivot1")).toBe(true);
    expect(allPivots.has("pivot2")).toBe(true);
  });

  test("refreshes all pivot tables", () => {
    const engine = createEngineWithData();

    const config1: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const config2: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Product"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    engine.addPivotTable("pivot1", config1, { row: 6, col: 0 });
    engine.addPivotTable("pivot2", config2, { row: 6, col: 5 });

    // Update source data
    engine.setCellByReference("C2", 2000);

    // Refresh all
    engine.refreshAllPivotTables();

    // Check both pivots are updated
    const pivot1Electronics = engine.getCell({ row: 7, col: 1 });
    expect(pivot1Electronics?.computedValue).toBe(2500); // 2000 + 500

    // For pivot2, Laptop appears in row 7, and it's value after update is 2000
    // But we also have Chair (200) and Phone (500)
    // So we need to find the correct row for Laptop
    let laptopValue = null;
    for (let row = 7; row <= 10; row++) {
      const product = engine.getCell({ row, col: 5 });
      if (product?.computedValue === "Laptop") {
        laptopValue = engine.getCell({ row, col: 6 })?.computedValue;
        break;
      }
    }
    expect(laptopValue).toBe(2000);
  });

  test("handles invalid pivot table ID", () => {
    const engine = createEngineWithData();

    expect(engine.getPivotTable("non-existent")).toBeUndefined();
    expect(engine.removePivotTable("non-existent")).toBe(false);
    expect(engine.refreshPivotTable("non-existent")).toBeNull();
  });

  test("pivot table with change events", () => {
    const engine = createEngineWithData();
    const changes: any[] = [];

    engine.addEventListener((event) => {
      changes.push(event);
    });

    const config: PivotTableConfig = {
      sourceRange: "A1:C4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    engine.addPivotTable("test-pivot", config, { row: 6, col: 0 });

    // Should have triggered batch change event for pivot output
    const lastEvent = changes[changes.length - 1];
    expect(lastEvent.type).toBe("batch-change");
    expect(lastEvent.cells.length).toBeGreaterThan(0);
  });
});
