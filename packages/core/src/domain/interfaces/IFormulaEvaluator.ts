import type { Result } from "../../shared/types/Result";
import type { Cell } from "../models/Cell";
import type { CellAddress } from "../models/CellAddress";
import type { CellRange } from "../models/CellRange";
import type { CellValue } from "../models/CellValue";
import type { FormulaAST } from "./IFormulaParser";

export interface EvaluationContext {
  getCellValue(address: CellAddress): CellValue;
  getRangeValues(range: CellRange): CellValue[];
  getCell(address: CellAddress): Cell | undefined;
  formulaAddress: CellAddress;
}

export interface FormulaFunction {
  name: string;
  minArgs?: number;
  maxArgs?: number;
  evaluate(args: CellValue[], context: EvaluationContext): Result<CellValue>;
}

export interface IFormulaEvaluator {
  evaluate(ast: FormulaAST, context: EvaluationContext): Result<CellValue>;
  registerFunction(func: FormulaFunction): void;
  unregisterFunction(name: string): void;
  hasFunction(name: string): boolean;
}
