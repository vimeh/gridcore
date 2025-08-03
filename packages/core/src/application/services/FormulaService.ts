import type {
  EvaluationContext,
  IFormulaEvaluator,
} from "../../domain/interfaces/IFormulaEvaluator";
import type {
  IFormulaParser,
  ParsedFormula,
} from "../../domain/interfaces/IFormulaParser";
import type { CellValue } from "../../domain/models/CellValue";
import type { Formula } from "../../domain/models/Formula";
import { err, ok, type Result } from "../../shared/types/Result";

export interface IFormulaService {
  parseFormula(expression: string): Result<ParsedFormula>;
  evaluateFormula(
    formula: Formula,
    context: EvaluationContext,
  ): Result<CellValue>;
  getDependencies(formula: Formula): Set<string>;
}

export class FormulaService implements IFormulaService {
  constructor(
    private readonly parser: IFormulaParser,
    private readonly evaluator: IFormulaEvaluator,
  ) {}

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
}
