import type { CellAddress, CellRange, CellValue } from "../../domain/models";
import type {
  FillDirection,
  Pattern,
  PatternDetector,
  PatternGenerator,
  PatternType,
} from "../types";

/**
 * Exponential pattern generator for geometric sequences
 */
class ExponentialPatternGenerator implements PatternGenerator {
  constructor(
    private baseValue: number,
    private ratio: number,
    private startIndex: number = 0,
  ) {}

  generateValue(
    sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    // For geometric progression, each next value is previous value * ratio
    const sourceLength = sourceValues.length;
    const lastValue = Number(sourceValues[sourceLength - 1]);

    // Generate the next value by multiplying the last value by ratio (index + 1) times
    const value = lastValue * this.ratio ** (index + 1);

    // Handle very large or very small numbers
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new Error("Exponential value out of safe range");
    }

    // Round to avoid floating point precision issues for nice ratios and very small results
    if (this.isNiceRatio(this.ratio) && Math.abs(value) >= 1) {
      return Math.round(value) as unknown as CellValue;
    }

    return value as unknown as CellValue;
  }

  /**
   * Check if ratio is a "nice" number that should produce integers
   */
  private isNiceRatio(ratio: number): boolean {
    return (
      Number.isInteger(ratio) ||
      ratio === 0.5 ||
      ratio === 0.25 ||
      ratio === 0.1
    );
  }
}

/**
 * Exponential pattern detector for geometric sequences like 2,4,8,16,32...
 * where each number is the previous number multiplied by a constant ratio
 */
export class ExponentialPatternDetector implements PatternDetector {
  readonly patternType: PatternType = "exponential";
  readonly priority: number = 70; // High priority for exponential patterns

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length < 2) {
      return null; // Need at least 2 values to detect ratio
    }

    // Convert values to numbers, skip non-numeric values
    const numbers = this.extractNumbers(values);
    if (numbers.length < 2) {
      return null;
    }

    // Filter out zeros as they break geometric sequences
    const nonZeroNumbers = numbers.filter((n) => n !== 0);
    if (nonZeroNumbers.length < 2) {
      return null;
    }

    // Check if this is a geometric sequence
    const geometricResult = this.checkGeometricPattern(nonZeroNumbers);
    if (!geometricResult) {
      return null;
    }

    // Calculate confidence based on consistency and properties
    const confidence = this.calculateConfidence(
      nonZeroNumbers,
      geometricResult,
    );
    if (confidence < 0.6) {
      return null;
    }

    const description = this.createDescription(nonZeroNumbers, geometricResult);

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new ExponentialPatternGenerator(
        geometricResult.baseValue,
        geometricResult.ratio,
        geometricResult.startIndex,
      ),
      ratio: geometricResult.ratio,
      metadata: {
        baseValue: geometricResult.baseValue,
        startIndex: geometricResult.startIndex,
        sequenceType: geometricResult.type,
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
   * Check if the numbers follow a geometric pattern
   */
  private checkGeometricPattern(numbers: number[]): {
    type: "standard" | "power-of-base";
    ratio: number;
    baseValue: number;
    startIndex: number;
  } | null {
    // Try standard geometric sequence (a, ar, ar², ar³, ...)
    const standardResult = this.checkStandardGeometric(numbers);
    if (standardResult) {
      return { type: "standard", ...standardResult };
    }

    // Try power-of-base sequences (2¹, 2², 2³, ... or 3¹, 3², 3³, ...)
    const powerResult = this.checkPowerOfBase(numbers);
    if (powerResult) {
      return { type: "power-of-base", ...powerResult };
    }

    return null;
  }

  /**
   * Check for standard geometric sequence
   */
  private checkStandardGeometric(numbers: number[]): {
    ratio: number;
    baseValue: number;
    startIndex: number;
  } | null {
    if (numbers.length < 2) return null;

    // Calculate ratios between consecutive terms
    const ratios: number[] = [];
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i - 1] === 0) return null; // Can't have zero in geometric sequence
      ratios.push(numbers[i] / numbers[i - 1]);
    }

    // Check if all ratios are approximately the same
    const firstRatio = ratios[0];
    const tolerance = Math.max(0.001, Math.abs(firstRatio) * 0.01);

    for (const ratio of ratios) {
      if (Math.abs(ratio - firstRatio) > tolerance) {
        return null; // Not a consistent geometric sequence
      }
    }

    // For standard geometric sequence, the base value is the first term
    // and start index is 0 (meaning first term is a*r^0 = a)
    return {
      ratio: firstRatio,
      baseValue: numbers[0],
      startIndex: 0,
    };
  }

  /**
   * Check for power-of-base sequences (b¹, b², b³, ...)
   */
  private checkPowerOfBase(numbers: number[]): {
    ratio: number;
    baseValue: number;
    startIndex: number;
  } | null {
    if (numbers.length < 2) return null;

    // Try common bases
    const commonBases = [2, 3, 4, 5, 10];

    for (const base of commonBases) {
      const result = this.checkSpecificPowerBase(numbers, base);
      if (result) {
        return result;
      }
    }

    // Try to detect base from the sequence
    // If it's b^n sequence, then numbers[1]/numbers[0] = b^(n+1)/b^n = b
    if (numbers[0] > 0) {
      const potentialBase = numbers[1] / numbers[0];
      if (potentialBase > 0 && this.isNiceNumber(potentialBase)) {
        const result = this.checkSpecificPowerBase(numbers, potentialBase);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Check if numbers match b^n pattern for specific base
   */
  private checkSpecificPowerBase(
    numbers: number[],
    base: number,
  ): {
    ratio: number;
    baseValue: number;
    startIndex: number;
  } | null {
    // Try different starting powers
    for (let startPower = 0; startPower <= 5; startPower++) {
      let isMatch = true;
      const tolerance = 0.001;

      for (let i = 0; i < numbers.length; i++) {
        const expectedValue = base ** (startPower + i);
        if (
          Math.abs(numbers[i] - expectedValue) >
          Math.max(tolerance, expectedValue * tolerance)
        ) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return {
          ratio: base,
          baseValue: base ** startPower,
          startIndex: 0, // Generator will handle the power calculation
        };
      }
    }

    return null;
  }

  /**
   * Calculate confidence based on sequence properties
   */
  private calculateConfidence(
    numbers: number[],
    geoResult: { type: string; ratio: number; baseValue: number },
  ): number {
    let confidence = 0.6; // Base confidence for detected geometric sequence

    // Boost confidence for longer sequences
    const lengthBonus = Math.min(0.25, (numbers.length - 2) * 0.05);
    confidence += lengthBonus;

    // Boost confidence for nice ratios
    if (this.isNiceNumber(geoResult.ratio)) {
      confidence += 0.1;
    }

    // Boost confidence for power-of-base sequences
    if (geoResult.type === "power-of-base") {
      confidence += 0.05;
    }

    // Boost confidence for common ratios
    const commonRatios = [2, 3, 0.5, 10, 0.1];
    if (commonRatios.includes(geoResult.ratio)) {
      confidence += 0.05;
    }

    // Reduce confidence for very large or very small ratios
    if (Math.abs(geoResult.ratio) > 10 || Math.abs(geoResult.ratio) < 0.1) {
      confidence *= 0.9;
    }

    // Reduce confidence for negative ratios (alternating signs)
    if (geoResult.ratio < 0) {
      confidence *= 0.8;
    }

    // Check for potential overflow issues
    const lastValue = numbers[numbers.length - 1];
    const nextValue = lastValue * geoResult.ratio;
    if (
      !Number.isFinite(nextValue) ||
      Math.abs(nextValue) > Number.MAX_SAFE_INTEGER
    ) {
      confidence *= 0.5; // Reduce confidence if we'll overflow soon
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

    // Check for simple fractions
    const commonFractions = [0.5, 0.25, 0.1, 0.2, 0.75];
    return commonFractions.includes(num);
  }

  /**
   * Create a human-readable description of the pattern
   */
  private createDescription(
    numbers: number[],
    geoResult: { type: string; ratio: number; baseValue: number },
  ): string {
    const start = numbers[0];
    const end = numbers[numbers.length - 1];
    const next = end * geoResult.ratio;

    if (
      geoResult.type === "power-of-base" &&
      Number.isInteger(geoResult.ratio)
    ) {
      return `Powers of ${geoResult.ratio} (${start}, ${end}, ${Math.round(next)}, ...)`;
    } else if (geoResult.ratio === 2) {
      return `Double each time (${start}, ${end}, ${Math.round(next)}, ...)`;
    } else if (geoResult.ratio === 0.5) {
      return `Half each time (${start}, ${end}, ${next}, ...)`;
    } else if (geoResult.ratio === 10) {
      return `Multiply by 10 (${start}, ${end}, ${Math.round(next)}, ...)`;
    } else if (Number.isInteger(geoResult.ratio)) {
      return `Multiply by ${geoResult.ratio} (${start}, ${end}, ${Math.round(next)}, ...)`;
    } else {
      return `Geometric sequence ×${geoResult.ratio} (${start}, ${end}, ${next.toFixed(2)}, ...)`;
    }
  }
}
