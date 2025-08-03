import type { CellAddress, CellRange, CellValueType } from "../types";

export type AggregatorType =
  | "SUM"
  | "AVERAGE"
  | "COUNT"
  | "MIN"
  | "MAX"
  | "COUNTA"
  | "PRODUCT";

export interface PivotField {
  fieldName: string;
  sourceColumn: number;
}

export interface PivotValueField extends PivotField {
  aggregator: AggregatorType;
  alias?: string;
}

export interface PivotFilterField extends PivotField {
  filterType: "include" | "exclude";
  values: CellValueType[];
}

export interface PivotSortConfig {
  field: string;
  direction: "asc" | "desc";
  sortBy?: "label" | "value";
}

export interface PivotTableConfig {
  sourceRange: CellRange | string;
  rowFields: string[];
  columnFields: string[];
  valueFields: PivotValueField[];
  filterFields?: PivotFilterField[];
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  showGrandTotals?: boolean;
  sortConfig?: PivotSortConfig[];
}

export interface PivotTableOutput {
  cells: Map<string, CellValueType>;
  dimensions: {
    rows: number;
    cols: number;
  };
  topLeft: CellAddress;
}

export interface PivotDataPoint {
  rowKeys: string[];
  columnKeys: string[];
  values: Map<string, CellValueType>;
}

export interface PivotTableMetadata {
  rowHeaders: string[][];
  columnHeaders: string[][];
  dataStartRow: number;
  dataStartCol: number;
}

export type AggregatorFunction = (values: CellValueType[]) => CellValueType;

export interface AggregatorDefinition {
  name: AggregatorType;
  fn: AggregatorFunction;
  requiresNumeric: boolean;
}
