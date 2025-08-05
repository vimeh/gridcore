import type { CellValue, CellAddress, CellRange } from "../../domain/models";
import type {
  PatternDetector,
  Pattern,
  PatternGenerator,
  FillDirection,
  PatternType,
} from "../types";

/**
 * Linear pattern generator for arithmetic sequences
 */
class LinearPatternGenerator implements PatternGenerator {
  constructor(
    private startValue: number,
    private step: number,
  ) {}

  generateValue(
    _sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    const value = this.startValue + (this.step * (index + 1));
    return value as unknown as CellValue;
  }
}

/**
 * Linear pattern detector for arithmetic sequences like 1, 2, 3 or 2, 4, 6
 */
export class LinearPatternDetector implements PatternDetector {
  readonly patternType: PatternType = "linear";
  readonly priority: number = 80; // High priority for numeric patterns

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length < 2) {
      return null;
    }

    // Convert values to numbers, skip non-numeric values
    const numbers = this.extractNumbers(values);
    if (numbers.length < 2) {
      return null;
    }

    // Check if we have a consistent step
    const step = this.calculateStep(numbers);
    if (step === null) {
      return null;
    }

    // Calculate confidence based on consistency and sample size
    const confidence = this.calculateConfidence(numbers, step);
    if (confidence < 0.5) {
      return null;
    }

    const startValue = numbers[numbers.length - 1]; // Use last value as start
    const description = this.createDescription(numbers, step);

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new LinearPatternGenerator(startValue, step),
      step,
    };
  }

  /**
   * Extract numeric values from cell values
   */
  private extractNumbers(values: CellValue[]): number[] {
    const numbers: number[] = [];
    
    for (const value of values) {
      const num = this.parseNumber(value);
      if (num !== null) {
        numbers.push(num);
      }
    }

    return numbers;
  }

  /**
   * Parse a cell value as a number
   */
  private parseNumber(value: CellValue): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const str = value.toString().trim();
    if (str === "") {
      return null;
    }

    // Try to parse as number
    const num = Number(str);
    if (Number.isNaN(num)) {
      return null;
    }

    return num;
  }

  /**
   * Calculate the step size for the arithmetic sequence
   */
  private calculateStep(numbers: number[]): number | null {
    if (numbers.length < 2) {
      return null;
    }

    const steps: number[] = [];
    for (let i = 1; i < numbers.length; i++) {
      steps.push(numbers[i] - numbers[i - 1]);
    }

    // Check if all steps are the same (within tolerance)
    const firstStep = steps[0];
    const tolerance = Math.abs(firstStep) * 0.001 + 0.001; // Small tolerance for floating point

    for (const step of steps) {
      if (Math.abs(step - firstStep) > tolerance) {
        return null; // Not a consistent arithmetic sequence
      }
    }

    return firstStep;
  }

  /**
   * Calculate confidence based on consistency and sample size
   */
  private calculateConfidence(numbers: number[], step: number): number {
    if (numbers.length < 2) {
      return 0;
    }

    // Base confidence starts at 0.7 for 2 numbers
    let confidence = 0.7;

    // Increase confidence with more samples (up to 0.95)
    const sampleBonus = Math.min(0.25, (numbers.length - 2) * 0.05);
    confidence += sampleBonus;

    // Reduce confidence for very small steps (might be floating point errors)
    if (Math.abs(step) < 0.001) {
      confidence *= 0.5;
    }

    // Reduce confidence if step is not a "nice" number
    if (!this.isNiceNumber(step)) {
      confidence *= 0.9;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Check if a number is "nice" (integer or simple fraction)
   */
  private isNiceNumber(num: number): boolean {
    // Check if it's an integer
    if (Number.isInteger(num)) {
      return true;
    }

    // Check if it's a simple fraction (like 0.5, 0.25, etc.)
    const decimals = num.toString().split('.')[1];
    if (decimals && decimals.length <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Create a human-readable description of the pattern
   */
  private createDescription(numbers: number[], step: number): string {
    const start = numbers[0];
    const end = numbers[numbers.length - 1];

    if (step === 1) {
      return `Count up by 1 (${start}, ${end}, ${end + 1}, ...)`;
    } else if (step === -1) {
      return `Count down by 1 (${start}, ${end}, ${end - 1}, ...)`;
    } else if (step > 0) {
      return `Add ${step} (${start}, ${end}, ${end + step}, ...)`;
    } else {
      return `Subtract ${Math.abs(step)} (${start}, ${end}, ${end + step}, ...)`;
    }
  }
}