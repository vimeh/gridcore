import type { CellValue, CellAddress, CellRange } from "../../domain/models";
import type {
  PatternDetector,
  Pattern,
  PatternGenerator,
  FillDirection,
  PatternType,
} from "../types";

/**
 * Known sequence types that can be detected
 */
type SequenceType = 
  | 'squares'      // 1, 4, 9, 16, 25, ...
  | 'cubes'        // 1, 8, 27, 64, 125, ...
  | 'triangular'   // 1, 3, 6, 10, 15, ... (n*(n+1)/2)
  | 'primes'       // 2, 3, 5, 7, 11, 13, ...
  | 'factorials'   // 1, 2, 6, 24, 120, ...
  | 'powers_of_2'  // 1, 2, 4, 8, 16, 32, ...
  | 'powers_of_3'  // 1, 3, 9, 27, 81, ...
  | 'pentagonal'   // 1, 5, 12, 22, 35, ... (n*(3n-1)/2)
  | 'hexagonal'    // 1, 6, 15, 28, 45, ... (n*(2n-1))
  | 'catalan'      // 1, 1, 2, 5, 14, 42, ... (Catalan numbers)
  | 'lucas';       // 2, 1, 3, 4, 7, 11, ... (Lucas numbers)

/**
 * Custom sequence pattern generator
 */
class CustomSequencePatternGenerator implements PatternGenerator {
  constructor(
    private sequenceType: SequenceType,
    private startIndex: number,
    private offset: number = 0,
  ) {}

  generateValue(
    _sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    const sequenceIndex = this.startIndex + this.offset + index;
    const value = this.calculateSequenceValue(this.sequenceType, sequenceIndex);
    return value as unknown as CellValue;
  }

  /**
   * Calculate the value of a sequence at given index
   */
  private calculateSequenceValue(type: SequenceType, index: number): number {
    switch (type) {
      case 'squares':
        return Math.pow(index, 2);
      
      case 'cubes':
        return Math.pow(index, 3);
      
      case 'triangular':
        return (index * (index + 1)) / 2;
      
      case 'primes':
        return this.getNthPrime(index);
      
      case 'factorials':
        return this.factorial(index);
      
      case 'powers_of_2':
        return Math.pow(2, index);
      
      case 'powers_of_3':
        return Math.pow(3, index);
      
      case 'pentagonal':
        return (index * (3 * index - 1)) / 2;
      
      case 'hexagonal':
        return index * (2 * index - 1);
      
      case 'catalan':
        return this.catalanNumber(index);
      
      case 'lucas':
        return this.lucasNumber(index);
      
      default:
        throw new Error(`Unknown sequence type: ${type}`);
    }
  }

  /**
   * Calculate nth prime number (1-indexed: 1st prime = 2, 2nd prime = 3, etc.)
   */
  private getNthPrime(n: number): number {
    if (n <= 0) return 2;
    
    const primes = [2];
    let candidate = 3;
    
    while (primes.length < n) {
      if (this.isPrime(candidate)) {
        primes.push(candidate);
      }
      candidate += 2; // Only check odd numbers after 2
    }
    
    return primes[n - 1];
  }

  /**
   * Check if a number is prime
   */
  private isPrime(num: number): boolean {
    if (num < 2) return false;
    if (num === 2) return true;
    if (num % 2 === 0) return false;
    
    for (let i = 3; i <= Math.sqrt(num); i += 2) {
      if (num % i === 0) return false;
    }
    
    return true;
  }

  /**
   * Calculate factorial
   */
  private factorial(n: number): number {
    if (n <= 0) return 1;
    if (n > 20) throw new Error("Factorial too large"); // Prevent overflow
    
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    
    return result;
  }

  /**
   * Calculate nth Catalan number
   */
  private catalanNumber(n: number): number {
    if (n <= 0) return 1;
    if (n > 30) throw new Error("Catalan number too large"); // Prevent overflow
    
    // Using dynamic programming to avoid overflow
    const catalan = [1]; // C(0) = 1
    
    for (let i = 1; i <= n; i++) {
      catalan[i] = 0;
      for (let j = 0; j < i; j++) {
        catalan[i] += catalan[j] * catalan[i - 1 - j];
      }
    }
    
    return catalan[n];
  }

  /**
   * Calculate nth Lucas number
   */
  private lucasNumber(n: number): number {
    if (n === 0) return 2;
    if (n === 1) return 1;
    
    let a = 2, b = 1;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    
    return b;
  }
}

/**
 * Custom sequence pattern detector for mathematical sequences like squares, cubes, primes, etc.
 */
export class CustomSequencePatternDetector implements PatternDetector {
  readonly patternType: PatternType = "custom";
  readonly priority: number = 60; // Medium priority - try after basic patterns

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length < 3) {
      return null; // Need at least 3 values to detect custom sequences
    }

    // Convert values to numbers, skip non-numeric values
    const numbers = this.extractNumbers(values);
    if (numbers.length < 3) {
      return null;
    }

    // Try to detect known sequences
    const sequenceResult = this.detectKnownSequence(numbers);
    if (!sequenceResult) {
      return null;
    }

    // Calculate confidence based on sequence properties
    const confidence = this.calculateConfidence(numbers, sequenceResult);
    if (confidence < 0.6) {
      return null;
    }

    const description = this.createDescription(sequenceResult);

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new CustomSequencePatternGenerator(
        sequenceResult.type,
        sequenceResult.startIndex,
        numbers.length, // offset for next values
      ),
      sequence: numbers,
      metadata: {
        sequenceType: sequenceResult.type,
        startIndex: sequenceResult.startIndex,
        matchedLength: sequenceResult.matchedLength,
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
      if (num !== null && Number.isInteger(num) && num >= 0) {
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
   * Try to detect known mathematical sequences
   */
  private detectKnownSequence(numbers: number[]): {
    type: SequenceType;
    startIndex: number;
    matchedLength: number;
  } | null {
    const sequences: SequenceType[] = [
      'squares', 'cubes', 'triangular', 'primes', 'factorials',
      'powers_of_2', 'powers_of_3', 'pentagonal', 'hexagonal', 'catalan', 'lucas'
    ];

    for (const seqType of sequences) {
      const result = this.checkSequenceType(numbers, seqType);
      if (result) {
        return { type: seqType, ...result };
      }
    }

    return null;
  }

  /**
   * Check if numbers match a specific sequence type
   */
  private checkSequenceType(numbers: number[], type: SequenceType): {
    startIndex: number;
    matchedLength: number;
  } | null {
    // Try different starting indices (including 0 for some sequences)
    for (let startIndex = 0; startIndex <= 20; startIndex++) {
      let matchCount = 0;
      
      for (let i = 0; i < numbers.length; i++) {
        try {
          const expectedValue = this.calculateSequenceValue(type, startIndex + i);
          if (numbers[i] === expectedValue) {
            matchCount++;
          } else {
            break; // Sequence broken
          }
        } catch {
          break; // Error calculating value (overflow, etc.)
        }
      }

      // Require at least 3 matches and all values to match
      if (matchCount >= 3 && matchCount === numbers.length) {
        return { startIndex, matchedLength: matchCount };
      }
    }

    return null;
  }

  /**
   * Calculate the value of a sequence at given index
   */
  private calculateSequenceValue(type: SequenceType, index: number): number {
    const generator = new CustomSequencePatternGenerator(type, 0);
    return generator['calculateSequenceValue'](type, index);
  }

  /**
   * Calculate confidence based on sequence properties
   */
  private calculateConfidence(
    numbers: number[],
    seqResult: { type: SequenceType; startIndex: number; matchedLength: number },
  ): number {
    let confidence = 0.6; // Base confidence for detected sequence

    // Boost confidence for longer sequences
    const lengthBonus = Math.min(0.25, (seqResult.matchedLength - 3) * 0.05);
    confidence += lengthBonus;

    // Boost confidence for well-known sequences
    const wellKnownSequences: SequenceType[] = ['squares', 'cubes', 'primes', 'factorials'];
    if (wellKnownSequences.includes(seqResult.type)) {
      confidence += 0.1;
    }

    // Boost confidence for sequences starting at natural indices
    if (seqResult.startIndex <= 5) {
      confidence += 0.05;
    }

    // Reduce confidence for very large numbers (potential for errors)
    const maxValue = Math.max(...numbers);
    if (maxValue > 1000000) {
      confidence *= 0.8;
    }

    // Boost confidence if the sequence is complete (no gaps)
    if (seqResult.matchedLength === numbers.length) {
      confidence += 0.05;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Create a human-readable description of the pattern
   */
  private createDescription(seqResult: { type: SequenceType; startIndex: number }): string {
    const descriptions: Record<SequenceType, string> = {
      squares: 'Perfect squares (1², 2², 3², ...)',
      cubes: 'Perfect cubes (1³, 2³, 3³, ...)',
      triangular: 'Triangular numbers (1, 3, 6, 10, ...)',
      primes: 'Prime numbers (2, 3, 5, 7, 11, ...)',
      factorials: 'Factorials (1!, 2!, 3!, 4!, ...)',
      powers_of_2: 'Powers of 2 (2⁰, 2¹, 2², ...)',
      powers_of_3: 'Powers of 3 (3⁰, 3¹, 3², ...)',
      pentagonal: 'Pentagonal numbers',
      hexagonal: 'Hexagonal numbers',
      catalan: 'Catalan numbers',
      lucas: 'Lucas numbers',
    };

    const baseDescription = descriptions[seqResult.type] || `${seqResult.type} sequence`;
    
    if (seqResult.startIndex > 1) {
      return `${baseDescription} starting from index ${seqResult.startIndex}`;
    }
    
    return baseDescription;
  }
}