# GridCore Pivot Tables

## Overview

The GridCore pivot table module provides powerful data aggregation and analysis capabilities for spreadsheet data. It allows you to transform rows of data into a summarized table by grouping, aggregating, and reorganizing the information.

## Features

- **Row and Column Grouping**: Group data by one or more fields
- **Multiple Aggregations**: SUM, AVERAGE, COUNT, MIN, MAX, COUNTA, PRODUCT
- **Filtering**: Include or exclude specific values
- **Custom Aliases**: Rename aggregated fields
- **Totals**: Optional row, column, and grand totals
- **Dynamic Updates**: Automatically refresh when source data changes

## Usage

### Basic Example

```typescript
import { SpreadsheetEngine } from "@gridcore/core";

const engine = new SpreadsheetEngine();

// Add source data
engine.setCellByReference("A1", "Category");
engine.setCellByReference("B1", "Sales");
// ... more data ...

// Create pivot table
engine.addPivotTable("sales-pivot", {
  sourceRange: "A1:B10",
  rowFields: ["Category"],
  columnFields: [],
  valueFields: [{ fieldName: "Sales", aggregator: "SUM" }]
}, { row: 12, col: 0 });
```

### Advanced Configuration

```typescript
const pivotConfig = {
  sourceRange: "A1:E100",
  rowFields: ["Category", "Subcategory"],
  columnFields: ["Month", "Year"],
  valueFields: [
    { fieldName: "Sales", aggregator: "SUM", alias: "Total Sales" },
    { fieldName: "Quantity", aggregator: "COUNT" },
    { fieldName: "Price", aggregator: "AVERAGE", alias: "Avg Price" }
  ],
  filterFields: [
    { fieldName: "Region", filterType: "include", values: ["North", "South"] },
    { fieldName: "Status", filterType: "exclude", values: ["Cancelled"] }
  ],
  showRowTotals: true,
  showColumnTotals: true,
  showGrandTotals: true
};

engine.addPivotTable("complex-pivot", pivotConfig, { row: 20, col: 0 });
```

## API Reference

### PivotTableConfig

| Property | Type | Description |
|----------|------|-------------|
| sourceRange | `CellRange \| string` | The data range to analyze (e.g., "A1:E100") |
| rowFields | `string[]` | Fields to group by rows |
| columnFields | `string[]` | Fields to group by columns |
| valueFields | `PivotValueField[]` | Fields to aggregate with their functions |
| filterFields | `PivotFilterField[]` | Optional filters to apply |
| showRowTotals | `boolean` | Show row totals |
| showColumnTotals | `boolean` | Show column totals |
| showGrandTotals | `boolean` | Show grand total |

### Aggregator Types

- `SUM`: Sum of numeric values
- `AVERAGE`: Average of numeric values
- `COUNT`: Count of numeric values
- `COUNTA`: Count of non-empty values
- `MIN`: Minimum value
- `MAX`: Maximum value
- `PRODUCT`: Product of values

### Methods

```typescript
// Add a pivot table
engine.addPivotTable(id: string, config: PivotTableConfig, outputCell: CellAddress): PivotTable

// Get existing pivot table
engine.getPivotTable(id: string): PivotTable | undefined

// Refresh pivot table
engine.refreshPivotTable(id: string): PivotTableOutput | null

// Remove pivot table
engine.removePivotTable(id: string): boolean

// Refresh all pivot tables
engine.refreshAllPivotTables(): void
```