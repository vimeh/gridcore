import type { CellAddress, CellRange } from "../types";

export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | CellReferenceNode
  | RangeReference
  | SheetCellReference
  | SheetRangeReference
  | FunctionCall
  | BinaryOperation
  | UnaryOperation
  | ArrayLiteral;

export interface NumberLiteral {
  type: "number";
  value: number;
}

export interface StringLiteral {
  type: "string";
  value: string;
}

export interface BooleanLiteral {
  type: "boolean";
  value: boolean;
}

export interface CellReferenceNode {
  type: "cell";
  address: CellAddress;
  reference: string;
  absolute?: {
    row: boolean;
    col: boolean;
  };
}

export interface RangeReference {
  type: "range";
  range: CellRange;
  reference: string;
}

export interface SheetCellReference {
  type: "sheet_cell";
  sheetName: string;
  address: CellAddress;
  reference: string;
  absolute?: {
    row: boolean;
    col: boolean;
  };
}

export interface SheetRangeReference {
  type: "sheet_range";
  sheetName: string;
  range: CellRange;
  reference: string;
}

export interface FunctionCall {
  type: "function";
  name: string;
  args: ASTNode[];
}

export type BinaryOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "&";

export interface BinaryOperation {
  type: "binary";
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

export type UnaryOperator = "-" | "+";

export interface UnaryOperation {
  type: "unary";
  operator: UnaryOperator;
  operand: ASTNode;
}

export interface ArrayLiteral {
  type: "array";
  elements: ASTNode[][];
}

export interface ParseError {
  message: string;
  position: number;
  line: number;
  column: number;
}

export interface ParseResult {
  ast?: ASTNode;
  error?: ParseError;
}
