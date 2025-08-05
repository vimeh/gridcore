import type { CellValue, CellAddress, CellRange } from "../../domain/models";
import type {
  PatternDetector,
  Pattern,
  PatternGenerator,
  FillDirection,
  PatternType,
} from "../types";

/**
 * Text pattern generator for text sequences
 */
class TextPatternGenerator implements PatternGenerator {
  constructor(
    private pattern: string[],
    private startIndex: number,
  ) {}

  generateValue(
    _sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    const patternIndex = (this.startIndex + index + 1) % this.pattern.length;
    return this.pattern[patternIndex] as unknown as CellValue;
  }
}

/**
 * Text pattern detector for text sequences like weekdays, months, etc.
 */
export class TextPatternDetector implements PatternDetector {
  readonly patternType: PatternType = "text";
  readonly priority: number = 60; // Medium priority

  private readonly knownPatterns = new Map<string, string[]>([
    // Weekdays
    ["weekdays_full", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]],
    ["weekdays_short", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
    ["weekdays_min", ["M", "T", "W", "T", "F", "S", "S"]],
    
    // Months
    ["months_full", ["January", "February", "March", "April", "May", "June", 
                     "July", "August", "September", "October", "November", "December"]],
    ["months_short", ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]],
    
    // Quarters
    ["quarters", ["Q1", "Q2", "Q3", "Q4"]],
    
    // Simple sequences
    ["letters_upper", ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
                       "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]],
    ["letters_lower", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
                       "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]],
    
    // Roman numerals
    ["roman_upper", ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]],
    ["roman_lower", ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]],
  ]);

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length < 2) {
      return null;
    }

    // Extract text values
    const textValues = this.extractTextValues(values);
    if (textValues.length < 2) {
      return null;
    }

    // Try to match against known patterns
    const patternMatch = this.findPatternMatch(textValues);
    if (!patternMatch) {
      return null;
    }

    const confidence = this.calculateConfidence(textValues, patternMatch.pattern);
    if (confidence < 0.7) {
      return null;
    }

    const description = this.createDescription(patternMatch.name, textValues);

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new TextPatternGenerator(patternMatch.pattern, patternMatch.lastIndex),
    };
  }

  /**
   * Extract text values from cell values
   */
  private extractTextValues(values: CellValue[]): string[] {
    const textValues: string[] = [];
    
    for (const value of values) {
      const text = this.extractText(value);
      if (text !== null) {
        textValues.push(text);
      }
    }

    return textValues;
  }

  /**
   * Extract text from a cell value
   */
  private extractText(value: CellValue): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const str = value.toString().trim();
    if (str === "") {
      return null;
    }

    // Only consider non-numeric text
    if (!isNaN(Number(str))) {
      return null;
    }

    return str;
  }

  /**
   * Find a matching pattern for the text values
   */
  private findPatternMatch(textValues: string[]): {
    name: string;
    pattern: string[];
    lastIndex: number;
  } | null {
    for (const [name, pattern] of this.knownPatterns) {
      const match = this.matchesPattern(textValues, pattern);
      if (match !== null) {
        return {
          name,
          pattern,
          lastIndex: match,
        };
      }
    }

    return null;
  }

  /**
   * Check if text values match a pattern
   */
  private matchesPattern(textValues: string[], pattern: string[]): number | null {
    if (textValues.length === 0) {
      return null;
    }

    // Find the first value in the pattern
    const firstIndex = this.findInPattern(textValues[0], pattern);
    if (firstIndex === -1) {
      return null;
    }

    // Check if subsequent values follow the pattern
    for (let i = 1; i < textValues.length; i++) {
      const expectedIndex = (firstIndex + i) % pattern.length;
      const expectedValue = pattern[expectedIndex];
      
      if (!this.valuesMatch(textValues[i], expectedValue)) {
        return null;
      }
    }

    // Return the index of the last value in the pattern
    return (firstIndex + textValues.length - 1) % pattern.length;
  }

  /**
   * Find a value in a pattern (case-insensitive)
   */
  private findInPattern(value: string, pattern: string[]): number {
    for (let i = 0; i < pattern.length; i++) {
      if (this.valuesMatch(value, pattern[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Check if two values match (case-insensitive)
   */
  private valuesMatch(value1: string, value2: string): boolean {
    return value1.toLowerCase() === value2.toLowerCase();
  }

  /**
   * Calculate confidence based on pattern match quality
   */
  private calculateConfidence(textValues: string[], pattern: string[]): number {
    if (textValues.length < 2) {
      return 0;
    }

    // Base confidence for pattern match
    let confidence = 0.8;

    // Increase confidence with more samples
    const sampleBonus = Math.min(0.15, (textValues.length - 2) * 0.03);
    confidence += sampleBonus;

    // Higher confidence for common patterns
    if (pattern === this.knownPatterns.get("weekdays_full") ||
        pattern === this.knownPatterns.get("weekdays_short") ||
        pattern === this.knownPatterns.get("months_full") ||
        pattern === this.knownPatterns.get("months_short")) {
      confidence += 0.1;
    }

    // Slightly lower confidence for very short patterns
    if (pattern.length <= 4) {
      confidence -= 0.05;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Create a human-readable description
   */
  private createDescription(patternName: string, textValues: string[]): string {
    const example = textValues.length > 1 
      ? `${textValues[0]}, ${textValues[textValues.length - 1]}, ...`
      : `${textValues[0]}, ...`;

    switch (patternName) {
      case "weekdays_full":
      case "weekdays_short":
      case "weekdays_min":
        return `Weekday sequence (${example})`;
      case "months_full":
      case "months_short":
        return `Month sequence (${example})`;
      case "quarters":
        return `Quarter sequence (${example})`;
      case "letters_upper":
        return `Uppercase letters (${example})`;
      case "letters_lower":
        return `Lowercase letters (${example})`;
      case "roman_upper":
      case "roman_lower":
        return `Roman numerals (${example})`;
      default:
        return `Text pattern (${example})`;
    }
  }
}