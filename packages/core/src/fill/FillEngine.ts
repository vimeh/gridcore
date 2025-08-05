import type { CellValue, CellAddress, CellRange } from "../domain/models";
import type { ICellRepository } from "../domain/interfaces";
import type {
  FillOperation,
  FillResult,
  FillPreview,
  Pattern,
  PatternDetector,
  FormulaAdjuster,
  FillDirection,
  PatternType,
} from "./types";
import { LinearPatternDetector } from "./patterns/LinearPatternDetector";
import { CopyPatternDetector } from "./patterns/CopyPatternDetector";
import { DatePatternDetector } from "./patterns/DatePatternDetector";
import { TextPatternDetector } from "./patterns/TextPatternDetector";

/**
 * Core fill engine that orchestrates pattern detection and value generation
 */
export class FillEngine {
  private detectors: PatternDetector[] = [];
  private formulaAdjuster?: FormulaAdjuster;

  constructor(
    private cellRepository: ICellRepository,
    formulaAdjuster?: FormulaAdjuster,
  ) {
    this.formulaAdjuster = formulaAdjuster;
    this.initializeDetectors();
  }

  /**
   * Initialize pattern detectors in priority order
   */
  private initializeDetectors(): void {
    this.detectors = [
      new LinearPatternDetector(),
      new DatePatternDetector(), 
      new TextPatternDetector(),
      new CopyPatternDetector(), // Copy is lowest priority (fallback)
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Perform a fill operation
   */
  async fill(operation: FillOperation): Promise<FillResult> {
    try {
      // Get source values
      const sourceValues = await this.getSourceValues(operation.source);
      if (sourceValues.length === 0) {
        return {
          success: false,
          filledCells: new Map(),
          error: "No source values found",
        };
      }

      // Detect pattern based on fill options
      const pattern = this.detectPattern(sourceValues, operation);
      if (!pattern) {
        return {
          success: false,
          filledCells: new Map(),
          error: "No valid pattern detected",
        };
      }

      // Generate target values
      const filledCells = this.generateValues(
        sourceValues,
        pattern,
        operation.source,
        operation.target,
      );

      // Apply values to repository
      for (const [addressStr, value] of filledCells) {
        const address = this.parseAddressString(addressStr);
        if (address) {
          await this.cellRepository.setCell(address, value);
        }
      }

      return {
        success: true,
        filledCells,
        pattern,
      };
    } catch (error) {
      return {
        success: false,
        filledCells: new Map(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate a preview of fill operation without applying changes
   */
  async preview(operation: FillOperation): Promise<FillPreview> {
    const sourceValues = await this.getSourceValues(operation.source);
    if (sourceValues.length === 0) {
      return { values: new Map() };
    }

    const pattern = this.detectPattern(sourceValues, operation);
    if (!pattern) {
      return { values: new Map() };
    }

    const filledCells = this.generateValues(
      sourceValues,
      pattern,
      operation.source,
      operation.target,
    );

    return {
      values: filledCells,
      pattern: {
        type: pattern.type,
        confidence: pattern.confidence,
        description: pattern.description,
      },
    };
  }

  /**
   * Detect the best pattern for the given values and operation
   */
  private detectPattern(
    sourceValues: CellValue[],
    operation: FillOperation,
  ): Pattern | null {
    // If options specify series, only try pattern detectors
    if (operation.options.type === "series") {
      return this.detectSeriesPattern(sourceValues, operation.direction);
    }

    // If options specify copy, use copy pattern
    if (operation.options.type === "copy") {
      return this.detectPatternByType(sourceValues, operation.direction, "copy");
    }

    // Auto-detect best pattern
    return this.detectBestPattern(sourceValues, operation.direction);
  }

  /**
   * Detect series patterns (non-copy patterns)
   */
  private detectSeriesPattern(
    sourceValues: CellValue[],
    direction: FillDirection,
  ): Pattern | null {
    const seriesDetectors = this.detectors.filter(d => d.patternType !== "copy");
    
    for (const detector of seriesDetectors) {
      const pattern = detector.detect(sourceValues, direction);
      if (pattern && pattern.confidence > 0.5) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Detect pattern by specific type
   */
  private detectPatternByType(
    sourceValues: CellValue[],
    direction: FillDirection,
    type: PatternType,
  ): Pattern | null {
    const detector = this.detectors.find(d => d.patternType === type);
    return detector?.detect(sourceValues, direction) || null;
  }

  /**
   * Auto-detect the best pattern from all available detectors
   */
  private detectBestPattern(
    sourceValues: CellValue[],
    direction: FillDirection,
  ): Pattern | null {
    let bestPattern: Pattern | null = null;
    let bestConfidence = 0;

    for (const detector of this.detectors) {
      const pattern = detector.detect(sourceValues, direction);
      if (pattern && pattern.confidence > bestConfidence) {
        bestPattern = pattern;
        bestConfidence = pattern.confidence;
      }
    }

    return bestPattern;
  }

  /**
   * Generate values using the detected pattern
   */
  private generateValues(
    sourceValues: CellValue[],
    pattern: Pattern,
    sourceRange: CellRange,
    targetRange: CellRange,
  ): Map<string, CellValue> {
    const filledCells = new Map<string, CellValue>();
    const targetCells = this.getTargetCells(targetRange);

    for (let i = 0; i < targetCells.length; i++) {
      const targetCell = targetCells[i];
      try {
        const value = pattern.generator.generateValue(
          sourceValues,
          i,
          sourceRange,
          targetCell,
        );
        
        // Adjust formula references if this is a formula value
        const adjustedValue = this.adjustFormulaIfNeeded(value, sourceRange, targetCell);
        
        filledCells.set(targetCell.toString(), adjustedValue);
      } catch (error) {
        // Skip cells that fail to generate
        console.warn(`Failed to generate value for cell ${targetCell.toString()}:`, error);
      }
    }

    return filledCells;
  }

  /**
   * Adjust formula references if the value contains a formula
   */
  private adjustFormulaIfNeeded(
    value: CellValue,
    sourceRange: CellRange,
    targetCell: CellAddress,
  ): CellValue {
    if (!this.formulaAdjuster || !this.isFormulaValue(value)) {
      return value;
    }

    try {
      const formulaText = this.extractFormulaText(value);
      if (!formulaText) return value;

      // Use the first cell of source range as the source for adjustment
      const sourceCell = sourceRange.start;
      const adjustedFormula = this.formulaAdjuster.adjustReferences(
        formulaText,
        sourceCell,
        targetCell,
      );

      // Create new value with adjusted formula
      return this.createFormulaValue(adjustedFormula);
    } catch (error) {
      console.warn("Failed to adjust formula references:", error);
      return value;
    }
  }

  /**
   * Get source values from the cell repository
   */
  private async getSourceValues(sourceRange: CellRange): Promise<CellValue[]> {
    const values: CellValue[] = [];
    const cells = this.getRangeCells(sourceRange);

    for (const address of cells) {
      const cell = await this.cellRepository.getCell(address);
      if (cell) {
        values.push(cell.getValue());
      } else {
        // Use empty value for missing cells
        values.push(this.createEmptyValue());
      }
    }

    return values;
  }

  /**
   * Get all cell addresses in a range
   */
  private getRangeCells(range: CellRange): CellAddress[] {
    const cells: CellAddress[] = [];
    
    for (let row = range.start.row; row <= range.end.row; row++) {
      for (let col = range.start.col; col <= range.end.col; col++) {
        const result = CellAddress.create(row, col);
        if (result.ok) {
          cells.push(result.value);
        }
      }
    }

    return cells;
  }

  /**
   * Get target cell addresses from target range
   */
  private getTargetCells(targetRange: CellRange): CellAddress[] {
    return this.getRangeCells(targetRange);
  }

  /**
   * Parse address string back to CellAddress
   */
  private parseAddressString(addressStr: string): CellAddress | null {
    // This would parse "A1", "B2", etc. back to CellAddress
    // Implementation depends on CellAddress.toString() format
    try {
      const match = addressStr.match(/^([A-Z]+)(\d+)$/);
      if (!match) return null;

      const col = this.columnNameToNumber(match[1]);
      const row = parseInt(match[2], 10) - 1; // Convert to 0-based

      const result = CellAddress.create(row, col);
      return result.ok ? result.value : null;
    } catch {
      return null;
    }
  }

  /**
   * Convert column name (A, B, ..., AA, AB) to number
   */
  private columnNameToNumber(name: string): number {
    let result = 0;
    for (let i = 0; i < name.length; i++) {
      result = result * 26 + (name.charCodeAt(i) - 65 + 1);
    }
    return result - 1; // Convert to 0-based
  }

  /**
   * Check if a value contains a formula
   */
  private isFormulaValue(value: CellValue): boolean {
    // Implementation depends on CellValue structure
    // This is a placeholder - will need to check actual CellValue interface
    return value?.toString()?.startsWith("=") || false;
  }

  /**
   * Extract formula text from a value
   */
  private extractFormulaText(value: CellValue): string | null {
    // Implementation depends on CellValue structure
    const str = value?.toString();
    return str?.startsWith("=") ? str : null;
  }

  /**
   * Create a formula value
   */
  private createFormulaValue(formula: string): CellValue {
    // Implementation depends on CellValue structure
    // This is a placeholder that returns the formula as-is
    return formula as unknown as CellValue;
  }

  /**
   * Create an empty cell value
   */
  private createEmptyValue(): CellValue {
    // Implementation depends on CellValue structure
    return "" as unknown as CellValue;
  }

  /**
   * Add a custom pattern detector
   */
  addDetector(detector: PatternDetector): void {
    this.detectors.push(detector);
    this.detectors.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Set the formula adjuster
   */
  setFormulaAdjuster(adjuster: FormulaAdjuster): void {
    this.formulaAdjuster = adjuster;
  }
}