import type {
  EvaluationContext,
  IFormulaEvaluator,
} from "../../domain/interfaces/IFormulaEvaluator";
import type {
  IFormulaParser,
  ParsedFormula,
} from "../../domain/interfaces/IFormulaParser";
import type { CellAddress } from "../../domain/models/CellAddress";
import type { CellValue } from "../../domain/models/CellValue";
import type { Formula } from "../../domain/models/Formula";
import {
  FormulaTransformer,
  type FormulaTransformResult,
} from "../../formula/FormulaTransformer";
import type { AdjustmentOptions } from "../../references/types";
import { err, ok, type Result } from "../../shared/types/Result";

export interface IFormulaService {
  parseFormula(expression: string): Result<ParsedFormula>;
  evaluateFormula(
    formula: Formula,
    context: EvaluationContext,
  ): Result<CellValue>;
  getDependencies(formula: Formula): Set<string>;

  // Formula transformation methods for copy/paste and fill operations
  transformFormulaForCopy(
    formula: string,
    source: CellAddress,
    target: CellAddress,
    options?: AdjustmentOptions,
  ): Result<FormulaTransformResult>;

  transformFormulaForFill(
    formula: string,
    fillStart: CellAddress,
    fillTarget: CellAddress,
    direction: "up" | "down" | "left" | "right",
    options?: AdjustmentOptions,
  ): Result<FormulaTransformResult>;

  previewFormulaTransformation(
    formula: string,
    source: CellAddress,
    target: CellAddress,
    options?: AdjustmentOptions,
  ): Result<{
    original: string;
    transformed: string;
    changes: Array<{ from: string; to: string }>;
  }>;
}

export class FormulaService implements IFormulaService {
  private readonly transformer: FormulaTransformer;

  constructor(
    private readonly parser: IFormulaParser,
    private readonly evaluator: IFormulaEvaluator,
  ) {
    this.transformer = new FormulaTransformer();
  }

  parseFormula(expression: string): Result<ParsedFormula> {
    return this.parser.parse(expression);
  }

  evaluateFormula(
    formula: Formula,
    context: EvaluationContext,
  ): Result<CellValue> {
    // Parse the formula
    const parseResult = this.parser.parse(formula.expression);
    if (!parseResult.ok) {
      return err(`Parse error: ${parseResult.error}`);
    }

    // Evaluate the parsed AST
    const evalResult = this.evaluator.evaluate(parseResult.value.ast, context);
    if (!evalResult.ok) {
      return err(`Evaluation error: ${evalResult.error}`);
    }

    return ok(evalResult.value);
  }

  getDependencies(formula: Formula): Set<string> {
    const parseResult = this.parser.parse(formula.expression);
    if (!parseResult.ok) {
      return new Set();
    }

    return parseResult.value.dependencies;
  }

  transformFormulaForCopy(
    formula: string,
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<FormulaTransformResult> {
    return this.transformer.transformForCopy(formula, source, target, options);
  }

  transformFormulaForFill(
    formula: string,
    fillStart: CellAddress,
    fillTarget: CellAddress,
    direction: "up" | "down" | "left" | "right",
    options: AdjustmentOptions = {},
  ): Result<FormulaTransformResult> {
    return this.transformer.transformForFill(
      formula,
      fillStart,
      fillTarget,
      direction,
      options,
    );
  }

  previewFormulaTransformation(
    formula: string,
    source: CellAddress,
    target: CellAddress,
    options: AdjustmentOptions = {},
  ): Result<{
    original: string;
    transformed: string;
    changes: Array<{ from: string; to: string }>;
  }> {
    return this.transformer.previewTransformation(
      formula,
      source,
      target,
      options,
    );
  }
}
