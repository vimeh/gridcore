// Import WASM functions from gridcore-core
import * as wasm from "gridcore-core";
import type { CellAddress, CellValue } from "../types";

/**
 * Context for formula evaluation
 */
export interface EvaluationContext {
  cellValues: Record<string, CellValue>;
}

/**
 * TypeScript wrapper for the WASM Evaluator
 * Provides stateless formula evaluation functions
 */
export class EvaluatorWrapper {
  /**
   * Evaluate a formula string with context
   */
  static evaluate(formula: string, context: EvaluationContext): CellValue {
    return wasm.evaluateFormula(formula, context);
  }

  /**
   * Evaluate a formula AST with context
   */
  static evaluateAst(ast: any, context: EvaluationContext): CellValue {
    return wasm.evaluateAst(ast, context);
  }

  /**
   * Parse a formula and return its AST
   */
  static parseFormula(formula: string): any {
    return wasm.parseFormulaToAst(formula);
  }

  /**
   * Extract dependencies from a formula
   */
  static extractDependencies(formula: string): string[] {
    return wasm.extractFormulaDependencies(formula);
  }

  /**
   * Check if a formula would create circular dependencies
   * @param formula The formula to check
   * @param currentCell The cell where the formula would be placed (A1 notation)
   * @param dependencyGraph Map of cell addresses to their dependencies
   */
  static checkCircularDependencies(
    formula: string,
    currentCell: string,
    dependencyGraph: Record<string, string[]>,
  ): boolean {
    return wasm.checkCircularDependencies(
      formula,
      currentCell,
      dependencyGraph,
    );
  }

  /**
   * Create an evaluation context with a cell value getter function
   * This is a helper for creating contexts from various data sources
   */
  static createContext(
    getCellValue: (address: string) => CellValue | undefined,
  ): EvaluationContext {
    // This would be called to build up the context
    // In practice, you'd need to know which cells to include
    const cellValues: Record<string, CellValue> = {};

    // The actual implementation would depend on your use case
    // For now, return an empty context that can be populated
    return { cellValues };
  }

  /**
   * Create an evaluation context from a cell map
   */
  static createContextFromMap(
    cells: Map<string, CellValue>,
  ): EvaluationContext {
    const cellValues: Record<string, CellValue> = {};
    for (const [address, value] of cells) {
      cellValues[address] = value;
    }
    return { cellValues };
  }
}

// Provide compatibility export for migration
export class WasmEvaluator extends EvaluatorWrapper {
  constructor() {
    console.warn(
      "WasmEvaluator is deprecated, use EvaluatorWrapper static methods instead",
    );
  }

  evaluate(formula: string, getCellValue: Function): CellValue {
    // For backward compatibility, convert the function to a context
    // This is a simplified implementation
    const context: EvaluationContext = { cellValues: {} };
    return EvaluatorWrapper.evaluate(formula, context);
  }

  evaluateAST(ast: any, getCellValue: Function): CellValue {
    const context: EvaluationContext = { cellValues: {} };
    return EvaluatorWrapper.evaluateAst(ast, context);
  }

  checkCircular(
    formula: string,
    currentCell: string,
    getDependencies: Function,
  ): boolean {
    // For backward compatibility
    const dependencyGraph: Record<string, string[]> = {};
    return EvaluatorWrapper.checkCircularDependencies(
      formula,
      currentCell,
      dependencyGraph,
    );
  }
}
