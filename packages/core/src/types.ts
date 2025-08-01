export type CellValueType = string | number | boolean | null | undefined;

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  numberFormat?: string;
}

export interface Cell {
  rawValue: CellValueType;
  computedValue: CellValueType;
  formula?: string;
  style?: CellStyle;
  error?: string;
}

export interface CellAddress {
  row: number;
  col: number;
}

export interface CellRange {
  start: CellAddress;
  end: CellAddress;
}

export type CellReference = string;

export interface GridDimensions {
  rows: number;
  cols: number;
}
