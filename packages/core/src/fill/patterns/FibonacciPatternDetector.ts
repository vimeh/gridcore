import type { CellAddress, CellRange, CellValue } from "../../domain/models";
import type {
  FillDirection,
  Pattern,
  PatternDetector,
  PatternGenerator,
  PatternType,
} from "../types";

/**
 * Fibonacci pattern generator for Fibonacci sequences
 */
class FibonacciPatternGenerator implements PatternGenerator {
  constructor(private sequence: number[]) {}

  generateValue(
    _sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    // Generate the next value in the sequence after the source values
    const nextIndex = this.sequence.length + index;
    const value = this.getFibonacciValue(nextIndex);
    return value as unknown as CellValue;
  }

  /**
   * Calculate Fibonacci value at given index
   */
  private getFibonacciValue(index: number): number {
    // Extend the sequence as needed
    const extendedSequence = [...this.sequence];

    while (extendedSequence.length <= index) {
      const len = extendedSequence.length;
      if (len < 2) {
        // Handle edge case where sequence is too short
        extendedSequence.push(len === 0 ? 1 : 1);
      } else {
        const nextValue = extendedSequence[len - 1] + extendedSequence[len - 2];
        extendedSequence.push(nextValue);
      }
    }

    return extendedSequence[index];
  }
}

/**
 * Fibonacci pattern detector for sequences like 1,1,2,3,5,8,13,21...
 * where each number is the sum of the two preceding ones
 */
export class FibonacciPatternDetector implements PatternDetector {
  readonly patternType: PatternType = "fibonacci";
  readonly priority: number = 75; // High priority for mathematical sequences

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length < 3) {
      return null; // Need at least 3 values to detect Fibonacci
    }

    // Convert values to numbers, skip non-numeric values
    const numbers = this.extractNumbers(values);
    if (numbers.length < 3) {
      return null;
    }

    // Check if this is a Fibonacci sequence or variant
    const fibonacciResult = this.checkFibonacciPattern(numbers);
    if (!fibonacciResult) {
      return null;
    }

    // Calculate confidence based on sequence length and accuracy
    const confidence = this.calculateConfidence(numbers, fibonacciResult);
    if (confidence < 0.6) {
      return null;
    }

    const description = this.createDescription(numbers, fibonacciResult);

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new FibonacciPatternGenerator(
        numbers,
        fibonacciResult.startIndex,
      ),
      sequence: numbers,
      metadata: {
        fibonacciType: fibonacciResult.type,
        startIndex: fibonacciResult.startIndex,
        multiplier: fibonacciResult.multiplier,
      },
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

    const num = Number(str);
    if (Number.isNaN(num)) {
      return null;
    }

    return num;
  }

  /**
   * Check if the numbers follow a Fibonacci pattern or variant
   */
  private checkFibonacciPattern(numbers: number[]): {
    type: "classic" | "scaled" | "shifted";
    startIndex: number;
    multiplier: number;
  } | null {
    // Try classic Fibonacci first with multiplier = 1
    const classicResult = this.checkClassicFibonacci(numbers);
    if (classicResult && classicResult.multiplier === 1) {
      return { type: "classic", ...classicResult };
    }

    // Try shifted Fibonacci (starting from different index) with multiplier = 1
    const shiftedResult = this.checkShiftedFibonacci(numbers);
    if (shiftedResult && shiftedResult.multiplier === 1) {
      return { type: "shifted", ...shiftedResult };
    }

    // Try scaled Fibonacci (2,2,4,6,10,16,... = 2*Fibonacci)
    const scaledResult = this.checkScaledFibonacci(numbers);
    if (scaledResult) {
      return { type: "scaled", ...scaledResult };
    }

    // Return classic or shifted even if multiplier is not exactly 1
    if (classicResult) {
      return { type: "classic", ...classicResult };
    }

    if (shiftedResult) {
      return { type: "shifted", ...shiftedResult };
    }

    return null;
  }

  /**
   * Check for classic Fibonacci sequence
   */
  private checkClassicFibonacci(
    numbers: number[],
  ): { startIndex: number; multiplier: number } | null {
    // Try different starting indices for classic Fibonacci
    for (let startIndex = 1; startIndex <= 5; startIndex++) {
      const result = this.checkFibonacciWithParams(numbers, 1, startIndex);
      if (result) {
        return result;
      }
    }
    return null;
  }

  /**
   * Check for scaled Fibonacci sequence (multiplied by a constant)
   */
  private checkScaledFibonacci(
    numbers: number[],
  ): { startIndex: number; multiplier: number } | null {
    // Try different multipliers
    const possibleMultipliers = [2, 3, 5, 10, 0.5, 0.1];

    for (const multiplier of possibleMultipliers) {
      const result = this.checkFibonacciWithParams(numbers, multiplier, 0);
      if (result) {
        return result;
      }
    }

    // Try to detect multiplier from the sequence
    if (numbers.length >= 3) {
      // If it's scaled Fibonacci, the ratio should be consistent
      // F(n) = k * fib(n), so numbers[0] / fib(startIndex) = k
      for (let startIndex = 0; startIndex < 10; startIndex++) {
        const fibValue = this.getStandardFibonacci(startIndex);
        if (fibValue > 0) {
          const possibleMultiplier = numbers[0] / fibValue;
          const result = this.checkFibonacciWithParams(
            numbers,
            possibleMultiplier,
            startIndex,
          );
          if (result) {
            return result;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check for shifted Fibonacci sequence (starting from different index)
   */
  private checkShiftedFibonacci(
    numbers: number[],
  ): { startIndex: number; multiplier: number } | null {
    // Try different starting indices
    for (let startIndex = 0; startIndex < 20; startIndex++) {
      const result = this.checkFibonacciWithParams(numbers, 1, startIndex);
      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * Check if numbers match Fibonacci pattern with given multiplier and start index
   */
  private checkFibonacciWithParams(
    numbers: number[],
    multiplier: number,
    startIndex: number,
  ): { startIndex: number; multiplier: number } | null {
    const tolerance = 0.001;

    for (let i = 0; i < numbers.length; i++) {
      const expectedFib = this.getStandardFibonacci(startIndex + i);
      const expected = expectedFib * multiplier;

      if (
        Math.abs(numbers[i] - expected) >
        Math.max(tolerance, Math.abs(expected) * tolerance)
      ) {
        return null;
      }
    }

    return { startIndex, multiplier };
  }

  /**
   * Get standard Fibonacci number at given index (1: 1, 2: 1, 3: 2, 4: 3, 5: 5, 6: 8, ...)
   */
  private getStandardFibonacci(index: number): number {
    if (index <= 0) return 0;
    if (index === 1 || index === 2) return 1;

    let a = 1,
      b = 1; // F(1) = 1, F(2) = 1
    for (let i = 3; i <= index; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }

    return b;
  }

  /**
   * Calculate confidence based on sequence properties
   */
  private calculateConfidence(
    numbers: number[],
    fibResult: { type: string; startIndex: number; multiplier: number },
  ): number {
    let confidence = 0.6; // Base confidence for detected Fibonacci

    // Boost confidence for longer sequences
    const lengthBonus = Math.min(0.25, (numbers.length - 3) * 0.05);
    confidence += lengthBonus;

    // Boost confidence for classic Fibonacci
    if (fibResult.type === "classic") {
      confidence += 0.1;
    }

    // Boost confidence for nice multipliers
    if (this.isNiceNumber(fibResult.multiplier)) {
      confidence += 0.05;
    }

    // Boost confidence for starting at standard indices
    if (fibResult.startIndex <= 5) {
      confidence += 0.05;
    }

    // Reduce confidence for very large multipliers (less likely to be intentional)
    if (Math.abs(fibResult.multiplier) > 100) {
      confidence *= 0.8;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Check if a number is "nice" (integer or simple fraction)
   */
  private isNiceNumber(num: number): boolean {
    if (Number.isInteger(num)) {
      return true;
    }

    // Check if it's a simple fraction
    const decimals = num.toString().split(".")[1];
    if (decimals && decimals.length <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Create a human-readable description of the pattern
   */
  private createDescription(
    numbers: number[],
    fibResult: { type: string; startIndex: number; multiplier: number },
  ): string {
    const start = numbers[0];
    const end = numbers[numbers.length - 1];

    if (fibResult.type === "classic") {
      return `Fibonacci sequence (${start}, ${end}, ${end + numbers[numbers.length - 2]}, ...)`;
    } else if (fibResult.type === "scaled") {
      return `Fibonacci × ${fibResult.multiplier} (${start}, ${end}, ...)`;
    } else {
      return `Fibonacci pattern starting at F(${fibResult.startIndex}) (${start}, ${end}, ...)`;
    }
  }
}
