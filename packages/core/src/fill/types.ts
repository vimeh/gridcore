import type { CellAddress, CellRange, CellValue } from "../domain/models";

export type FillDirection = "down" | "up" | "left" | "right" | "auto";

export type PatternType = "linear" | "growth" | "date" | "text" | "formula" | "copy";

export type SeriesType = "linear" | "growth" | "date" | "weekdays" | "months" | "auto";

export interface FillOptions {
  type: "copy" | "series" | "format" | "values";
  seriesType?: SeriesType;
  step?: number;
  stopValue?: number;
  weekdaysOnly?: boolean;
  trend?: boolean;
}

export interface FillOperation {
  source: CellRange;
  target: CellRange;
  direction: FillDirection;
  options: FillOptions;
}

export interface Pattern {
  type: PatternType;
  confidence: number;
  description: string;
  generator: PatternGenerator;
  step?: number;
  growth?: number;
}

export interface PatternGenerator {
  /**
   * Generate the next value in the pattern
   * @param sourceValues The source values used to detect the pattern
   * @param index The 0-based index of the value to generate
   * @param sourceRange The source cell range
   * @param targetCell The target cell address for this value
   * @returns The generated cell value
   */
  generateValue(
    sourceValues: CellValue[],
    index: number,
    sourceRange: CellRange,
    targetCell: CellAddress,
  ): CellValue;
}

export interface PatternDetector {
  /**
   * Detect a pattern in the given source values
   * @param values The source values to analyze
   * @param direction The fill direction
   * @returns A pattern if detected, null otherwise
   */
  detect(values: CellValue[], direction: FillDirection): Pattern | null;

  /**
   * The pattern type this detector handles
   */
  readonly patternType: PatternType;

  /**
   * Priority for this detector (higher = checked first)
   */
  readonly priority: number;
}

export interface FillResult {
  success: boolean;
  filledCells: Map<string, CellValue>; // cellAddress.toString() -> value
  pattern?: Pattern;
  error?: string;
}

export interface FillPreview {
  values: Map<string, CellValue>; // cellAddress.toString() -> value
  pattern?: {
    type: string;
    confidence: number;
    description: string;
  };
}

/**
 * Interface for formula reference adjustment
 * This will integrate with Agent-1's ReferenceAdjuster when available
 */
export interface FormulaAdjuster {
  /**
   * Adjust formula references when copying from source to target
   * @param formula The original formula text
   * @param sourceCell The source cell address
   * @param targetCell The target cell address
   * @returns The adjusted formula
   */
  adjustReferences(
    formula: string,
    sourceCell: CellAddress,
    targetCell: CellAddress,
  ): string;
}