import { describe, expect, test } from "bun:test";
import { Grid } from "../Grid";
import { PivotTransformer } from "./PivotTransformer";
import type { PivotTableConfig } from "./PivotTypes";

describe("PivotTransformer", () => {
  const createTestGrid = () => {
    const grid = new Grid(100, 26);

    // Add headers
    grid.setCell({ row: 0, col: 0 }, "Category");
    grid.setCell({ row: 0, col: 1 }, "Product");
    grid.setCell({ row: 0, col: 2 }, "Month");
    grid.setCell({ row: 0, col: 3 }, "Sales");
    grid.setCell({ row: 0, col: 4 }, "Quantity");

    // Add data with some edge cases
    const data = [
      ["Electronics", "Laptop", "January", 1200, 2],
      ["Electronics", "Phone", "January", 800, 3],
      ["Electronics", "Laptop", "February", 1500, 3],
      ["Furniture", "Chair", "January", 200, 5],
      ["Furniture", "Desk", "January", 500, 2],
      ["Furniture", "Chair", "February", 250, 6],
      ["Electronics", "Phone", "February", 900, 4],
      ["Electronics", "Tablet", "March", null, 1], // null value
      ["", "Unknown", "January", 100, 0], // empty category
      ["Furniture", "", "February", 300, 2], // empty product
    ];

    data.forEach((row, i) => {
      row.forEach((value, j) => {
        grid.setCell({ row: i + 1, col: j }, value);
      });
    });

    return grid;
  };

  test("transforms data with multiple row fields", () => {
    const grid = createTestGrid();
    const config: PivotTableConfig = {
      sourceRange: "A1:E11",
      rowFields: ["Category", "Product"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const transformer = new PivotTransformer(grid, config);
    const result = transformer.transform();

    // Should have entries for each category-product combination
    expect(result.size).toBeGreaterThan(0);
    expect(result.has("Electronics|Laptop")).toBe(true);
    expect(result.has("Furniture|Chair")).toBe(true);
  });

  test("handles null and empty values correctly", () => {
    const grid = createTestGrid();
    const config: PivotTableConfig = {
      sourceRange: "A1:E11",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const transformer = new PivotTransformer(grid, config);
    const result = transformer.transform();

    // Should handle empty category
    expect(result.has("")).toBe(true);

    // Electronics should include the null value (treated as 0)
    const electronics = result.get("Electronics");
    expect(electronics).toBeDefined();
  });

  test("getUniqueValues returns sorted unique values", () => {
    const grid = createTestGrid();
    const config: PivotTableConfig = {
      sourceRange: "A1:E11",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const transformer = new PivotTransformer(grid, config);
    transformer.transform(); // Load data

    const categories = transformer.getUniqueValues("Category");
    expect(categories).toContain("Electronics");
    expect(categories).toContain("Furniture");
    expect(categories).toContain(""); // Empty value

    // Should be sorted
    const sortedCategories = [...categories].sort((a, b) => {
      if (a == null) return 1;
      if (b == null) return -1;
      return String(a).localeCompare(String(b));
    });
    expect(categories).toEqual(sortedCategories);
  });

  test("applies exclude filters", () => {
    const grid = createTestGrid();
    const config: PivotTableConfig = {
      sourceRange: "A1:E11",
      rowFields: ["Product"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
      filterFields: [
        {
          fieldName: "Category",
          filterType: "exclude",
          values: ["Furniture"],
        },
      ],
    };

    const transformer = new PivotTransformer(grid, config);
    const result = transformer.transform();

    // Should not have Furniture products
    expect(result.has("Chair")).toBe(false);
    expect(result.has("Desk")).toBe(false);

    // Should have Electronics products
    expect(result.has("Laptop")).toBe(true);
    expect(result.has("Phone")).toBe(true);
  });

  test("handles string range format", () => {
    const grid = createTestGrid();
    const config: PivotTableConfig = {
      sourceRange: "A1:E8", // String format
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const transformer = new PivotTransformer(grid, config);
    const result = transformer.transform();

    expect(result.size).toBeGreaterThan(0);
  });

  test("handles multiple column fields", () => {
    const grid = createTestGrid();
    const config: PivotTableConfig = {
      sourceRange: { start: { row: 0, col: 0 }, end: { row: 10, col: 4 } },
      rowFields: ["Category"],
      columnFields: ["Month", "Product"],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
    };

    const transformer = new PivotTransformer(grid, config);
    const result = transformer.transform();

    // Check for composite column keys
    const electronics = result.get("Electronics");
    expect(electronics).toBeDefined();

    // Should have entries like "January|Laptop"
    let hasCompositeKey = false;
    for (const key of electronics?.keys()) {
      if (key.includes("|")) {
        hasCompositeKey = true;
        break;
      }
    }
    expect(hasCompositeKey).toBe(true);
  });
});
