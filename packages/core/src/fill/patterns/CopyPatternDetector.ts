import type { CellAddress, CellRange, CellValue } from "../../domain/models";
import type {
  FillDirection,
  Pattern,
  PatternDetector,
  PatternGenerator,
  PatternType,
} from "../types";

/**
 * Copy pattern generator - simply repeats source values
 */
class CopyPatternGenerator implements PatternGenerator {
  generateValue(
    sourceValues: CellValue[],
    index: number,
    _sourceRange: CellRange,
    _targetCell: CellAddress,
  ): CellValue {
    if (sourceValues.length === 0) {
      return "" as unknown as CellValue;
    }

    // Cycle through source values
    const sourceIndex = index % sourceValues.length;
    return sourceValues[sourceIndex];
  }
}

/**
 * Copy pattern detector - fallback pattern that always matches
 * Simply copies/repeats the source values
 */
export class CopyPatternDetector implements PatternDetector {
  readonly patternType: PatternType = "copy";
  readonly priority: number = 1; // Lowest priority (fallback)

  detect(values: CellValue[], _direction: FillDirection): Pattern | null {
    if (values.length === 0) {
      return null;
    }

    // Copy pattern always matches but with low confidence
    const confidence = 0.3; // Low confidence as this is a fallback

    let description = "Copy values";
    if (values.length === 1) {
      description = `Copy "${this.valueToString(values[0])}"`;
    } else if (values.length > 1) {
      const valueStrs = values.slice(0, 3).map((v) => this.valueToString(v));
      if (values.length > 3) {
        valueStrs.push("...");
      }
      description = `Repeat pattern: ${valueStrs.join(", ")}`;
    }

    return {
      type: this.patternType,
      confidence,
      description,
      generator: new CopyPatternGenerator(),
    };
  }

  private valueToString(value: CellValue): string {
    if (value === null || value === undefined) {
      return "";
    }
    const str = value.toString();
    return str.length > 10 ? `${str.substring(0, 10)}...` : str;
  }
}
