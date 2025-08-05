import { Cell, CellAddress, type CellValue, type CellRange } from "../domain/models";
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
  PatternDetectionResult,
} from "./types";
import { LinearPatternDetector } from "./patterns/LinearPatternDetector";
import { CopyPatternDetector } from "./patterns/CopyPatternDetector";
import { DatePatternDetector } from "./patterns/DatePatternDetector";
import { TextPatternDetector } from "./patterns/TextPatternDetector";
import { FibonacciPatternDetector } from "./patterns/FibonacciPatternDetector";
import { ExponentialPatternDetector } from "./patterns/ExponentialPatternDetector";
import { CustomSequencePatternDetector } from "./patterns/CustomSequencePatternDetector";

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
      new LinearPatternDetector(),           // Priority: 80
      new FibonacciPatternDetector(),        // Priority: 75
      new ExponentialPatternDetector(),      // Priority: 70
      new DatePatternDetector(),             // Priority: varies
      new CustomSequencePatternDetector(),   // Priority: 60
      new TextPatternDetector(),             // Priority: varies
      new CopyPatternDetector(),             // Copy is lowest priority (fallback)
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
          const cellResult = Cell.create(value, address);
          if (cellResult.ok) {
            await this.cellRepository.set(address, cellResult.value);
          }
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

    // Use enhanced detection for better preview with alternatives
    const detectionResult = this.detectAllPatterns(sourceValues, operation.direction);
    if (!detectionResult.bestPattern) {
      return { values: new Map() };
    }

    const filledCells = this.generateValues(
      sourceValues,
      detectionResult.bestPattern,
      operation.source,
      operation.target,
    );

    // Generate previews for alternative patterns
    const alternativePatterns = detectionResult.alternativePatterns.slice(0, 3).map(pattern => {
      try {
        const previewCells = this.generateValues(
          sourceValues,
          pattern,
          operation.source,
          operation.target,
        );
        return {
          type: pattern.type,
          confidence: pattern.confidence,
          description: pattern.description,
          preview: previewCells,
        };
      } catch {
        return {
          type: pattern.type,
          confidence: pattern.confidence,
          description: pattern.description,
        };
      }
    });

    return {
      values: filledCells,
      pattern: {
        type: detectionResult.bestPattern.type,
        confidence: detectionResult.confidence,
        description: detectionResult.bestPattern.description,
      },
      alternativePatterns,
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
    const detectionResult = this.detectAllPatterns(sourceValues, direction);
    return detectionResult.bestPattern;
  }

  /**
   * Enhanced pattern detection that finds all possible patterns and calculates ambiguity
   */
  detectAllPatterns(
    sourceValues: CellValue[],
    direction: FillDirection,
  ): PatternDetectionResult {
    const candidatePatterns: Pattern[] = [];

    // Collect all patterns with confidence > 0.5
    for (const detector of this.detectors) {
      const pattern = detector.detect(sourceValues, direction);
      if (pattern && pattern.confidence > 0.5) {
        candidatePatterns.push(pattern);
      }
    }

    if (candidatePatterns.length === 0) {
      return {
        bestPattern: null,
        alternativePatterns: [],
        confidence: 0,
        ambiguityScore: 0,
      };
    }

    // Sort patterns by confidence
    candidatePatterns.sort((a, b) => b.confidence - a.confidence);

    const bestPattern = candidatePatterns[0];
    const alternativePatterns = candidatePatterns.slice(1);

    // Calculate ambiguity score based on how close other patterns are to the best
    const ambiguityScore = this.calculateAmbiguityScore(candidatePatterns);

    // Adjust confidence based on ambiguity
    const adjustedConfidence = this.adjustConfidenceForAmbiguity(
      bestPattern.confidence,
      ambiguityScore,
    );

    return {
      bestPattern: { ...bestPattern, confidence: adjustedConfidence },
      alternativePatterns,
      confidence: adjustedConfidence,
      ambiguityScore,
    };
  }

  /**
   * Calculate ambiguity score based on competing patterns
   */
  private calculateAmbiguityScore(patterns: Pattern[]): number {
    if (patterns.length <= 1) {
      return 0; // No ambiguity with single pattern
    }

    const bestConfidence = patterns[0].confidence;
    let maxCompetitorConfidence = 0;

    // Find the highest confidence among competing patterns
    for (let i = 1; i < patterns.length; i++) {
      maxCompetitorConfidence = Math.max(maxCompetitorConfidence, patterns[i].confidence);
    }

    // Ambiguity is higher when competitor confidence is close to best confidence
    const confidenceGap = bestConfidence - maxCompetitorConfidence;
    
    // Normalize to 0-1 scale (0 = no ambiguity, 1 = very ambiguous)
    const ambiguityScore = Math.max(0, 1 - (confidenceGap / 0.5));

    return Math.min(1, ambiguityScore);
  }

  /**
   * Adjust pattern confidence based on ambiguity
   */
  private adjustConfidenceForAmbiguity(confidence: number, ambiguityScore: number): number {
    // Reduce confidence when there's high ambiguity
    const reduction = ambiguityScore * 0.2; // Max 20% reduction
    return Math.max(0.1, confidence - reduction);
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
      const cell = await this.cellRepository.get(address);
      if (cell) {
        values.push(cell.computedValue || cell.rawValue);
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