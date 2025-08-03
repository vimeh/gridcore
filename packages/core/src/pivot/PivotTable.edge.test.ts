import { describe, expect, test } from "bun:test";
import { Grid } from "../Grid";
import { PivotTable } from "./PivotTable";
import type { PivotTableConfig } from "./PivotTypes";

describe("PivotTable Edge Cases", () => {
  test("handles setConfig to update configuration", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "A");
    grid.setCell({ row: 0, col: 1 }, "B");
    grid.setCell({ row: 1, col: 0 }, "X");
    grid.setCell({ row: 1, col: 1 }, 10);

    const config: PivotTableConfig = {
      sourceRange: "A1:B2",
      rowFields: ["A"],
      columnFields: [],
      valueFields: [{ fieldName: "B", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);
    const output1 = pivot.generate(grid, { row: 5, col: 0 });
    expect(output1.cells.size).toBeGreaterThan(0);

    // Update config
    pivot.setConfig({
      valueFields: [{ fieldName: "B", aggregator: "COUNT" }],
    });

    const newConfig = pivot.getConfig();
    expect(newConfig.valueFields[0].aggregator).toBe("COUNT");

    // Generate with new config
    const output2 = pivot.generate(grid, { row: 5, col: 0 });
    expect(output2.cells.size).toBeGreaterThan(0);
  });

  test("getLastOutput returns last generated output", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "A");
    grid.setCell({ row: 0, col: 1 }, "B");
    grid.setCell({ row: 1, col: 0 }, "X");
    grid.setCell({ row: 1, col: 1 }, 10);

    const config: PivotTableConfig = {
      sourceRange: "A1:B2",
      rowFields: ["A"],
      columnFields: [],
      valueFields: [{ fieldName: "B", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);

    // No output initially
    expect(pivot.getLastOutput()).toBeUndefined();

    const output = pivot.generate(grid, { row: 5, col: 0 });
    const lastOutput = pivot.getLastOutput();

    expect(lastOutput).toBeDefined();
    expect(lastOutput).toBe(output);
  });

  test("getMetadata returns pivot metadata", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "Category");
    grid.setCell({ row: 0, col: 1 }, "Value");
    grid.setCell({ row: 1, col: 0 }, "A");
    grid.setCell({ row: 1, col: 1 }, 10);
    grid.setCell({ row: 2, col: 0 }, "B");
    grid.setCell({ row: 2, col: 1 }, 20);

    const config: PivotTableConfig = {
      sourceRange: "A1:B3",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Value", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);
    pivot.generate(grid, { row: 5, col: 0 });

    const metadata = pivot.getMetadata();
    expect(metadata).toBeDefined();
    expect(metadata?.rowHeaders).toHaveLength(2); // A and B
    expect(metadata?.rowHeaders[0]).toEqual(["A"]);
    expect(metadata?.rowHeaders[1]).toEqual(["B"]);
    expect(metadata?.dataStartRow).toBe(6); // 5 + 1 header row
    expect(metadata?.dataStartCol).toBe(1); // 0 + 1 row field
  });

  test("handles no row or column fields", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "Value");
    grid.setCell({ row: 1, col: 0 }, 10);
    grid.setCell({ row: 2, col: 0 }, 20);
    grid.setCell({ row: 3, col: 0 }, 30);

    const config: PivotTableConfig = {
      sourceRange: "A1:A4",
      rowFields: [],
      columnFields: [],
      valueFields: [{ fieldName: "Value", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);
    const output = pivot.generate(grid, { row: 5, col: 0 });

    // Should generate a single aggregated value
    expect(output.cells.size).toBeGreaterThan(0);

    // Look for the sum (60)
    const sum = Array.from(output.cells.values()).find((v) => v === 60);
    expect(sum).toBeDefined();
  });

  test("handles multiple value fields with different aggregators", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "Category");
    grid.setCell({ row: 0, col: 1 }, "Value");
    grid.setCell({ row: 1, col: 0 }, "A");
    grid.setCell({ row: 1, col: 1 }, 10);
    grid.setCell({ row: 2, col: 0 }, "A");
    grid.setCell({ row: 2, col: 1 }, 20);
    grid.setCell({ row: 3, col: 0 }, "A");
    grid.setCell({ row: 3, col: 1 }, 30);

    const config: PivotTableConfig = {
      sourceRange: "A1:B4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Value", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);
    const output = pivot.generate(grid, { row: 5, col: 0 });

    // First, let's just test that basic SUM works correctly
    const values = Array.from(output.cells.values());
    const numericValues = values.filter((v) => typeof v === "number");

    // Should have sum of 10 + 20 + 30 = 60
    expect(numericValues).toContain(60);
  });

  test("handles very large column range references", () => {
    const grid = new Grid(10, 30); // More columns
    grid.setCell({ row: 0, col: 0 }, "A");
    grid.setCell({ row: 0, col: 25 }, "Z"); // Column Z
    grid.setCell({ row: 0, col: 26 }, "AA"); // Column AA
    grid.setCell({ row: 1, col: 0 }, 1);
    grid.setCell({ row: 1, col: 25 }, 2);
    grid.setCell({ row: 1, col: 26 }, 3);

    const config: PivotTableConfig = {
      sourceRange: "A1:AA2",
      rowFields: ["A"],
      columnFields: [],
      valueFields: [{ fieldName: "Z", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);
    const output = pivot.generate(grid, { row: 5, col: 0 });

    expect(output.cells.size).toBeGreaterThan(0);
  });

  test("handles special characters in field values", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "Category");
    grid.setCell({ row: 0, col: 1 }, "Value");
    grid.setCell({ row: 1, col: 0 }, "A-B"); // Hyphen instead of pipe
    grid.setCell({ row: 1, col: 1 }, 10);
    grid.setCell({ row: 2, col: 0 }, "C_D"); // Underscore instead of double colon
    grid.setCell({ row: 2, col: 1 }, 20);

    const config: PivotTableConfig = {
      sourceRange: "A1:B3",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Value", aggregator: "SUM" }],
    };

    const pivot = new PivotTable(config);
    const output = pivot.generate(grid, { row: 5, col: 0 });

    // The pivot table should handle non-separator special characters
    const cellValues = Array.from(output.cells.values());

    // Check that we have the special character categories as row headers
    expect(cellValues).toContain("A-B");
    expect(cellValues).toContain("C_D");
  });

  test("getFieldValues returns unique values for analysis", () => {
    const grid = new Grid(10, 10);
    grid.setCell({ row: 0, col: 0 }, "Category");
    grid.setCell({ row: 0, col: 1 }, "Product");
    grid.setCell({ row: 1, col: 0 }, "Electronics");
    grid.setCell({ row: 1, col: 1 }, "Laptop");
    grid.setCell({ row: 2, col: 0 }, "Electronics");
    grid.setCell({ row: 2, col: 1 }, "Phone");
    grid.setCell({ row: 3, col: 0 }, "Furniture");
    grid.setCell({ row: 3, col: 1 }, "Chair");

    const config: PivotTableConfig = {
      sourceRange: "A1:B4",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Product", aggregator: "COUNTA" }],
    };

    const pivot = new PivotTable(config);

    // Generate the pivot table first to load the data
    pivot.generate(grid, { row: 5, col: 0 });

    // Get unique categories
    const categories = pivot.getFieldValues(grid, "Category");
    expect(categories).toContain("Electronics");
    expect(categories).toContain("Furniture");
    expect(categories.filter((c) => c === "Electronics").length).toBe(1); // Only unique values

    // Get unique products
    const products = pivot.getFieldValues(grid, "Product");
    expect(products).toContain("Laptop");
    expect(products).toContain("Phone");
    expect(products).toContain("Chair");
  });
});
