import type { CellValue, CellAddress, CellRange } from "../../domain/models";
import type {
  PatternDetector,
  Pattern,
  PatternGenerator,
  FillDirection,
  PatternType,
} from "../types";

/**
 * Date pattern generator for date sequences
 */
class DatePatternGenerator implements PatternGenerator {
  constructor(
    private lastDate: Date,
    private dayStep: number,
  ) {}

  generateValue(
    _sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    const newDate = new Date(this.lastDate);
    newDate.setDate(newDate.getDate() + this.dayStep * (index + 1));
    
    // Return as ISO date string for now
    return newDate.toISOString().split('T')[0] as unknown as CellValue;
  }
}

/**
 * Date pattern detector for date sequences
 */
export class DatePatternDetector implements PatternDetector {
  readonly patternType: PatternType = "date";
  readonly priority: number = 70; // High priority for date patterns

  private readonly dateFormats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
  ];

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length < 2) {
      return null;
    }

    // Extract dates from values
    const dates = this.extractDates(values);
    if (dates.length < 2) {
      return null;
    }

    // Calculate day step
    const dayStep = this.calculateDayStep(dates);
    if (dayStep === null) {
      return null;
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(dates, dayStep);
    if (confidence < 0.6) {
      return null;
    }

    const lastDate = dates[dates.length - 1];
    const description = this.createDescription(dates, dayStep);

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new DatePatternGenerator(lastDate, dayStep),
      step: dayStep,
    };
  }

  /**
   * Extract Date objects from cell values
   */
  private extractDates(values: CellValue[]): Date[] {
    const dates: Date[] = [];
    
    for (const value of values) {
      const date = this.parseDate(value);
      if (date && !isNaN(date.getTime())) {
        dates.push(date);
      }
    }

    return dates;
  }

  /**
   * Parse a cell value as a date
   */
  private parseDate(value: CellValue): Date | null {
    if (value === null || value === undefined) {
      return null;
    }

    const str = value.toString().trim();
    if (str === "") {
      return null;
    }

    // Check if it matches known date formats
    const matchesFormat = this.dateFormats.some(format => format.test(str));
    if (!matchesFormat) {
      return null;
    }

    // Try to parse as date
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  /**
   * Calculate the day step between dates
   */
  private calculateDayStep(dates: Date[]): number | null {
    if (dates.length < 2) {
      return null;
    }

    const steps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const dayDiff = Math.round(
        (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
      );
      steps.push(dayDiff);
    }

    // Check if all steps are the same
    const firstStep = steps[0];
    for (const step of steps) {
      if (step !== firstStep) {
        return null; // Not a consistent date sequence
      }
    }

    return firstStep;
  }

  /**
   * Calculate confidence based on consistency and pattern type
   */
  private calculateConfidence(dates: Date[], dayStep: number): number {
    if (dates.length < 2) {
      return 0;
    }

    // Base confidence
    let confidence = 0.8;

    // Increase confidence with more samples
    const sampleBonus = Math.min(0.15, (dates.length - 2) * 0.03);
    confidence += sampleBonus;

    // Higher confidence for common patterns
    if (dayStep === 1) {
      confidence += 0.1; // Daily
    } else if (dayStep === 7) {
      confidence += 0.1; // Weekly
    } else if (Math.abs(dayStep) >= 28 && Math.abs(dayStep) <= 31) {
      confidence += 0.05; // Monthly (approximately)
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Create a human-readable description of the pattern
   */
  private createDescription(dates: Date[], dayStep: number): string {
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    if (dayStep === 1) {
      return `Daily sequence (${formatDate(dates[0])}, ${formatDate(dates[dates.length - 1])}, ...)`;
    } else if (dayStep === 7) {
      return `Weekly sequence (${formatDate(dates[0])}, ${formatDate(dates[dates.length - 1])}, ...)`;
    } else if (dayStep === -1) {
      return `Daily countdown (${formatDate(dates[0])}, ${formatDate(dates[dates.length - 1])}, ...)`;
    } else if (dayStep === -7) {
      return `Weekly countdown (${formatDate(dates[0])}, ${formatDate(dates[dates.length - 1])}, ...)`;
    } else if (dayStep > 0) {
      return `Every ${dayStep} days (${formatDate(dates[0])}, ${formatDate(dates[dates.length - 1])}, ...)`;
    } else {
      return `Every ${Math.abs(dayStep)} days back (${formatDate(dates[0])}, ${formatDate(dates[dates.length - 1])}, ...)`;
    }
  }
}