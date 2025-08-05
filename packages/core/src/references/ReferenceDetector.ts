import { ReferenceParser } from "./ReferenceParser";
import type {
  CellReference,
  ReferenceAnalysis,
  ReferenceInfo,
  ReferenceType,
} from "./types";

/**
 * Detects and analyzes cell references within formula strings.
 */
export class ReferenceDetector {
  private parser: ReferenceParser;

  constructor() {
    this.parser = new ReferenceParser();
  }

  /**
   * Analyze a formula string to find all cell references and their types.
   */
  analyzeFormula(formula: string): ReferenceAnalysis {
    const references: ReferenceInfo[] = [];

    // Remove leading '=' if present
    const cleanFormula = formula.startsWith("=") ? formula.slice(1) : formula;

    // Pattern to match cell references with optional absolute markers and sheet names
    // Matches: A1, $A$1, $A1, A$1, Sheet1!A1, 'Sheet Name'!$A$1
    const cellPattern = /(?:(?:'([^']+)'|([^!]+))!)?\$?([A-Z]+)\$?(\d+)/gi;

    let match: RegExpExecArray | null;

    while (true) {
      match = cellPattern.exec(cleanFormula);
      if (match === null) break;
      const fullMatch = match[0];
      const position = match.index;

      // Adjust position if original formula had '='
      const adjustedPosition = formula.startsWith("=")
        ? position + 1
        : position;

      // Parse the reference to get detailed information
      const parseResult = this.parser.parseCellReference(fullMatch);

      if (parseResult.ok) {
        const reference = parseResult.value;
        const referenceType = this.classifyReferenceType(reference);

        references.push({
          text: fullMatch,
          position: adjustedPosition,
          length: fullMatch.length,
          type: referenceType,
          reference,
        });
      }
    }

    // Sort references by position for consistent ordering
    references.sort((a, b) => a.position - b.position);

    return { references };
  }

  /**
   * Find all references within a specific text range.
   */
  findReferencesInRange(
    formula: string,
    startPos: number,
    endPos: number,
  ): ReferenceInfo[] {
    const analysis = this.analyzeFormula(formula);
    return analysis.references.filter(
      (ref) => ref.position >= startPos && ref.position + ref.length <= endPos,
    );
  }

  /**
   * Find the reference at a specific cursor position.
   */
  findReferenceAtPosition(
    formula: string,
    position: number,
  ): ReferenceInfo | null {
    const analysis = this.analyzeFormula(formula);
    return (
      analysis.references.find(
        (ref) =>
          position >= ref.position && position < ref.position + ref.length,
      ) || null
    );
  }

  /**
   * Find the next reference after a given position.
   */
  findNextReference(formula: string, position: number): ReferenceInfo | null {
    const analysis = this.analyzeFormula(formula);
    return analysis.references.find((ref) => ref.position > position) || null;
  }

  /**
   * Find the previous reference before a given position.
   */
  findPreviousReference(
    formula: string,
    position: number,
  ): ReferenceInfo | null {
    const analysis = this.analyzeFormula(formula);
    const refs = analysis.references.filter((ref) => ref.position < position);
    return refs.length > 0 ? refs[refs.length - 1] : null;
  }

  /**
   * Count the total number of references in a formula.
   */
  countReferences(formula: string): number {
    return this.analyzeFormula(formula).references.length;
  }

  /**
   * Check if a formula contains any absolute references.
   */
  hasAbsoluteReferences(formula: string): boolean {
    const analysis = this.analyzeFormula(formula);
    return analysis.references.some(
      (ref) =>
        ref.type === "absolute" ||
        ref.type === "mixed-column" ||
        ref.type === "mixed-row",
    );
  }

  /**
   * Check if a formula contains only relative references.
   */
  hasOnlyRelativeReferences(formula: string): boolean {
    const analysis = this.analyzeFormula(formula);
    return (
      analysis.references.length > 0 &&
      analysis.references.every((ref) => ref.type === "relative")
    );
  }

  /**
   * Get all unique sheet names referenced in a formula.
   */
  getReferencedSheets(formula: string): string[] {
    const analysis = this.analyzeFormula(formula);
    const sheets = new Set<string>();

    analysis.references.forEach((ref) => {
      if (ref.reference.sheet) {
        sheets.add(ref.reference.sheet);
      }
    });

    return Array.from(sheets);
  }

  /**
   * Replace a reference at a specific position with new text.
   */
  replaceReferenceAtPosition(
    formula: string,
    position: number,
    newReference: string,
  ): { formula: string; newPosition: number } | null {
    const ref = this.findReferenceAtPosition(formula, position);
    if (!ref) {
      return null;
    }

    const before = formula.substring(0, ref.position);
    const after = formula.substring(ref.position + ref.length);
    const newFormula = before + newReference + after;

    // Calculate new cursor position
    const lengthDiff = newReference.length - ref.length;
    const newPosition =
      position <= ref.position + ref.length / 2
        ? ref.position + newReference.length // Cursor was at start, move to end
        : position + lengthDiff; // Cursor was in middle/end, adjust

    return {
      formula: newFormula,
      newPosition,
    };
  }

  /**
   * Classify a cell reference into one of the reference types.
   */
  private classifyReferenceType(ref: CellReference): ReferenceType {
    if (ref.columnAbsolute && ref.rowAbsolute) {
      return "absolute";
    }

    if (!ref.columnAbsolute && !ref.rowAbsolute) {
      return "relative";
    }

    if (ref.columnAbsolute && !ref.rowAbsolute) {
      return "mixed-column";
    }

    // !ref.columnAbsolute && ref.rowAbsolute
    return "mixed-row";
  }

  /**
   * Check if a position is within any reference in the formula.
   */
  isPositionInReference(formula: string, position: number): boolean {
    return this.findReferenceAtPosition(formula, position) !== null;
  }

  /**
   * Get statistics about reference types in a formula.
   */
  getReferenceStats(formula: string): {
    total: number;
    relative: number;
    absolute: number;
    mixedColumn: number;
    mixedRow: number;
    crossSheet: number;
  } {
    const analysis = this.analyzeFormula(formula);
    const stats = {
      total: analysis.references.length,
      relative: 0,
      absolute: 0,
      mixedColumn: 0,
      mixedRow: 0,
      crossSheet: 0,
    };

    analysis.references.forEach((ref) => {
      switch (ref.type) {
        case "relative":
          stats.relative++;
          break;
        case "absolute":
          stats.absolute++;
          break;
        case "mixed-column":
          stats.mixedColumn++;
          break;
        case "mixed-row":
          stats.mixedRow++;
          break;
      }

      if (ref.reference.sheet) {
        stats.crossSheet++;
      }
    });

    return stats;
  }
}
