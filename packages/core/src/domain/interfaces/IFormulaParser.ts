import type { Result } from "../../shared/types/Result";
import type { CellAddress } from "../models/CellAddress";
import type { CellRange } from "../models/CellRange";

export interface FormulaToken {
  type:
    | "literal"
    | "cellRef"
    | "rangeRef"
    | "function"
    | "operator"
    | "parenthesis";
  value: string;
  position: number;
}

export interface FormulaAST {
  type:
    | "literal"
    | "cellRef"
    | "rangeRef"
    | "function"
    | "binaryOp"
    | "unaryOp";
  value?: unknown;
  operator?: string;
  name?: string;
  arguments?: FormulaAST[];
  left?: FormulaAST;
  right?: FormulaAST;
  operand?: FormulaAST;
  address?: CellAddress;
  range?: CellRange;
}

export interface ParsedFormula {
  ast: FormulaAST;
  tokens: FormulaToken[];
  dependencies: Set<string>;
}

export interface IFormulaParser {
  parse(expression: string): Result<ParsedFormula>;
  tokenize(expression: string): Result<FormulaToken[]>;
  buildAST(tokens: FormulaToken[]): Result<FormulaAST>;
}
