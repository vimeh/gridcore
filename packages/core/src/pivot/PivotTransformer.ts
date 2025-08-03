import type { Grid } from "../Grid";
import type { CellRange, CellValueType } from "../types";
import { getAggregator } from "./PivotAggregators";
import type { PivotTableConfig } from "./PivotTypes";

export class PivotTransformer {
  private grid: Grid;
  private config: PivotTableConfig;
  private sourceData: Array<Record<string, CellValueType>> = [];
  private fieldIndices: Map<string, number> = new Map();

  constructor(grid: Grid, config: PivotTableConfig) {
    this.grid = grid;
    this.config = config;
  }

  transform(): Map<string, Map<string, Map<string, CellValueType>>> {
    this.loadSourceData();
    const filteredData = this.applyFilters(this.sourceData);
    return this.aggregateData(filteredData);
  }

  private loadSourceData(): void {
    const range = this.parseRange(this.config.sourceRange);
    if (!range) throw new Error("Invalid source range");

    const headers: string[] = [];

    // Load headers from first row
    for (let col = range.start.col; col <= range.end.col; col++) {
      const cell = this.grid.getCell({ row: range.start.row, col });
      const header = String(
        cell?.computedValue ?? cell?.rawValue ?? `Column${col}`,
      );
      headers.push(header);
      this.fieldIndices.set(header, col - range.start.col);
    }

    // Load data rows
    this.sourceData = [];
    for (let row = range.start.row + 1; row <= range.end.row; row++) {
      const record: Record<string, CellValueType> = {};
      let hasData = false;

      for (let col = range.start.col; col <= range.end.col; col++) {
        const cell = this.grid.getCell({ row, col });
        const value = cell?.computedValue ?? cell?.rawValue;
        const fieldName = headers[col - range.start.col];
        record[fieldName] = value;
        if (value != null && value !== "") hasData = true;
      }

      if (hasData) {
        this.sourceData.push(record);
      }
    }
  }

  private parseRange(range: CellRange | string): CellRange | null {
    if (typeof range === "string") {
      // Parse string range format (e.g., "A1:D10")
      const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!match) return null;

      const startCol = this.columnToNumber(match[1]);
      const startRow = parseInt(match[2]) - 1;
      const endCol = this.columnToNumber(match[3]);
      const endRow = parseInt(match[4]) - 1;

      return {
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol },
      };
    }
    return range;
  }

  private columnToNumber(col: string): number {
    let result = 0;
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 65 + 1);
    }
    return result - 1;
  }

  private applyFilters(
    data: Array<Record<string, CellValueType>>,
  ): Array<Record<string, CellValueType>> {
    if (!this.config.filterFields || this.config.filterFields.length === 0) {
      return data;
    }

    return data.filter((record) => {
      for (const filter of this.config.filterFields) {
        const value = record[filter.fieldName];
        const matches = filter.values.includes(value);

        if (filter.filterType === "include" && !matches) return false;
        if (filter.filterType === "exclude" && matches) return false;
      }
      return true;
    });
  }

  private aggregateData(
    data: Array<Record<string, CellValueType>>,
  ): Map<string, Map<string, Map<string, CellValueType>>> {
    // Structure: rowKey -> columnKey -> valueField -> aggregatedValue
    const result = new Map<string, Map<string, Map<string, CellValueType>>>();

    // Group data by row and column fields
    const groupedData = new Map<string, CellValueType[]>();

    for (const record of data) {
      const rowKey =
        this.config.rowFields.length > 0
          ? this.config.rowFields
              .map((field) => String(record[field] ?? ""))
              .join("|")
          : "";
      const columnKey =
        this.config.columnFields.length > 0
          ? this.config.columnFields
              .map((field) => String(record[field] ?? ""))
              .join("|")
          : "";
      const groupKey = `${rowKey}::${columnKey}`;

      for (const valueField of this.config.valueFields) {
        const value = record[valueField.fieldName];
        const fieldKey = `${groupKey}::${valueField.fieldName}`;

        if (!groupedData.has(fieldKey)) {
          groupedData.set(fieldKey, []);
        }
        groupedData.get(fieldKey)?.push(value);
      }
    }

    // Aggregate grouped data
    for (const [key, values] of groupedData) {
      // Split by last occurrence of ::
      const lastSeparatorIndex = key.lastIndexOf("::");
      const rowColKey = key.substring(0, lastSeparatorIndex);
      const fieldName = key.substring(lastSeparatorIndex + 2);

      // Now split rowColKey by first occurrence of ::
      const firstSeparatorIndex = rowColKey.indexOf("::");
      const rowKey = rowColKey.substring(0, firstSeparatorIndex);
      const columnKey = rowColKey.substring(firstSeparatorIndex + 2);

      if (!result.has(rowKey)) {
        result.set(rowKey, new Map());
      }
      if (!result.get(rowKey)?.has(columnKey)) {
        result.get(rowKey)?.set(columnKey, new Map());
      }

      const valueField = this.config.valueFields.find(
        (vf) => vf.fieldName === fieldName,
      );
      if (valueField) {
        const aggregator = getAggregator(valueField.aggregator);
        const aggregatedValue = aggregator.fn(values);
        const fieldAlias =
          valueField.alias ||
          `${valueField.fieldName} (${valueField.aggregator})`;
        result.get(rowKey)?.get(columnKey)?.set(fieldAlias, aggregatedValue);
      }
    }

    return result;
  }

  getUniqueValues(fieldName: string): CellValueType[] {
    const values = new Set<CellValueType>();
    for (const record of this.sourceData) {
      values.add(record[fieldName]);
    }
    return Array.from(values).sort((a, b) => {
      if (a == null) return 1;
      if (b == null) return -1;
      return String(a).localeCompare(String(b));
    });
  }
}
