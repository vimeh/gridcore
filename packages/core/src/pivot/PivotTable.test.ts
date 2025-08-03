import { describe, expect, test } from "bun:test"
import { Grid } from "../Grid"
import { PivotTable } from "./PivotTable"
import type { PivotTableConfig } from "./PivotTypes"

describe("PivotTable", () => {
  const createTestGrid = () => {
    const grid = new Grid(100, 26)
    
    // Add headers
    grid.setCell({ row: 0, col: 0 }, "Category")
    grid.setCell({ row: 0, col: 1 }, "Product")
    grid.setCell({ row: 0, col: 2 }, "Month")
    grid.setCell({ row: 0, col: 3 }, "Sales")
    grid.setCell({ row: 0, col: 4 }, "Quantity")
    
    // Add data
    const data = [
      ["Electronics", "Laptop", "January", 1200, 2],
      ["Electronics", "Phone", "January", 800, 3],
      ["Electronics", "Laptop", "February", 1500, 3],
      ["Furniture", "Chair", "January", 200, 5],
      ["Furniture", "Desk", "January", 500, 2],
      ["Furniture", "Chair", "February", 250, 6],
      ["Electronics", "Phone", "February", 900, 4],
    ]
    
    data.forEach((row, i) => {
      row.forEach((value, j) => {
        grid.setCell({ row: i + 1, col: j }, value)
      })
    })
    
    return grid
  }

  test("creates a basic pivot table with row and value fields", () => {
    const grid = createTestGrid()
    const config: PivotTableConfig = {
      sourceRange: "A1:E8",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }]
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 10, col: 0 })
    
    expect(output).toBeDefined()
    expect(output.cells.size).toBeGreaterThan(0)
    
    // Check for Electronics total
    const electronicsRow = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Electronics"
    )
    expect(electronicsRow).toBeDefined()
    
    // Check for sum of Electronics sales (1200 + 800 + 1500 + 900 = 4400)
    const electronicsSum = Array.from(output.cells.entries()).find(
      ([key, value]) => value === 4400
    )
    expect(electronicsSum).toBeDefined()
  })

  test("creates a pivot table with row and column fields", () => {
    const grid = createTestGrid()
    const config: PivotTableConfig = {
      sourceRange: "A1:E8",
      rowFields: ["Category"],
      columnFields: ["Month"],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }]
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 10, col: 0 })
    
    // Check for month headers
    const januaryHeader = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "January"
    )
    expect(januaryHeader).toBeDefined()
    
    const februaryHeader = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "February"
    )
    expect(februaryHeader).toBeDefined()
  })

  test("supports multiple aggregations", () => {
    const grid = createTestGrid()
    const config: PivotTableConfig = {
      sourceRange: "A1:E8",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [
        { fieldName: "Sales", aggregator: "SUM" },
        { fieldName: "Sales", aggregator: "AVERAGE" },
        { fieldName: "Quantity", aggregator: "COUNT" }
      ]
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 10, col: 0 })
    
    // Should have headers for each aggregation
    const sumHeader = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Sales (SUM)"
    )
    expect(sumHeader).toBeDefined()
    
    const avgHeader = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Sales (AVERAGE)"
    )
    expect(avgHeader).toBeDefined()
  })

  test("applies filters correctly", () => {
    const grid = createTestGrid()
    const config: PivotTableConfig = {
      sourceRange: "A1:E8",
      rowFields: ["Product"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
      filterFields: [{
        fieldName: "Category",
        filterType: "include",
        values: ["Electronics"]
      }]
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 10, col: 0 })
    
    // Should only have Electronics products
    const laptop = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Laptop"
    )
    expect(laptop).toBeDefined()
    
    const chair = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Chair"
    )
    expect(chair).toBeUndefined()
  })

  test("calculates totals when enabled", () => {
    const grid = createTestGrid()
    const config: PivotTableConfig = {
      sourceRange: "A1:E8",
      rowFields: ["Category"],
      columnFields: ["Month"],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }],
      showRowTotals: true,
      showColumnTotals: true,
      showGrandTotals: true
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 10, col: 0 })
    
    // Should have "Total" labels
    const totalLabel = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Total"
    )
    expect(totalLabel).toBeDefined()
    
    // Grand total should be sum of all sales (5350)
    const grandTotal = Array.from(output.cells.entries()).find(
      ([key, value]) => value === 5350
    )
    expect(grandTotal).toBeDefined()
  })

  test("handles empty data gracefully", () => {
    const grid = new Grid(10, 10)
    // Only headers, no data
    grid.setCell({ row: 0, col: 0 }, "Category")
    grid.setCell({ row: 0, col: 1 }, "Sales")
    
    const config: PivotTableConfig = {
      sourceRange: "A1:B2", // Include one empty row
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ fieldName: "Sales", aggregator: "SUM" }]
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 5, col: 0 })
    
    // Should have header but no data rows
    expect(output.cells.size).toBe(1) // Just the header
  })

  test("supports custom aliases for value fields", () => {
    const grid = createTestGrid()
    const config: PivotTableConfig = {
      sourceRange: "A1:E8",
      rowFields: ["Category"],
      columnFields: [],
      valueFields: [{ 
        fieldName: "Sales", 
        aggregator: "SUM",
        alias: "Total Revenue"
      }]
    }
    
    const pivot = new PivotTable(config)
    const output = pivot.generate(grid, { row: 10, col: 0 })
    
    // Should use custom alias
    const customHeader = Array.from(output.cells.entries()).find(
      ([key, value]) => value === "Total Revenue"
    )
    expect(customHeader).toBeDefined()
  })
})