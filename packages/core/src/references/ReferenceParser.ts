import { err, ok, type Result } from "../shared/types/Result";
import type { CellReference, RangeReference, RefError } from "./types";

/**
 * Parser for cell and range references with support for absolute/relative notation.
 *
 * Supported formats:
 * - A1 (relative)
 * - $A$1 (absolute)
 * - $A1 (mixed - absolute column, relative row)
 * - A$1 (mixed - relative column, absolute row)
 * - Sheet1!A1 (cross-sheet reference)
 * - 'Sheet Name'!$A$1 (quoted sheet name with absolute reference)
 * - A1:B2, $A$1:$B$2 (range references)
 */
export class ReferenceParser {
  // Excel limits: XFD (column 16384) and row 1048576
  private static readonly MAX_COLUMN = 16383; // XFD = 16383 (zero-based)
  private static readonly MAX_ROW = 1048575; // 1048576 - 1 (zero-based)

  /**
   * Parse a cell reference string into a CellReference object.
   */
  parseCellReference(reference: string): Result<CellReference, RefError> {
    const trimmed = reference.trim();
    if (!trimmed) {
      return err("INVALID_FORMAT" as RefError);
    }

    try {
      // Check for sheet reference (Sheet!A1 or 'Sheet Name'!A1)
      const { sheetName, cellPart, sheetAbsolute } =
        this.extractSheetReference(trimmed);

      // Parse the cell part (e.g., A1, $A$1, $A1, A$1)
      const cellMatch = cellPart.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/i);

      if (!cellMatch) {
        return err("INVALID_FORMAT" as RefError);
      }

      const [, colAbsolute, columnLetters, rowAbsolute, rowNumber] = cellMatch;

      // Convert column letters to number
      const column = this.columnLettersToNumber(columnLetters.toUpperCase());
      const row = parseInt(rowNumber, 10) - 1; // Convert to zero-based

      // Validate bounds
      if (
        column > ReferenceParser.MAX_COLUMN ||
        row > ReferenceParser.MAX_ROW
      ) {
        return err("OUT_OF_BOUNDS" as RefError);
      }

      if (column < 0 || row < 0) {
        return err("OUT_OF_BOUNDS" as RefError);
      }

      const cellRef: CellReference = {
        column,
        row,
        columnAbsolute: colAbsolute === "$",
        rowAbsolute: rowAbsolute === "$",
        ...(sheetName && { sheet: sheetName }),
        ...(sheetName && { sheetAbsolute }),
      };

      return ok(cellRef);
    } catch (error) {
      return err("INVALID_FORMAT" as RefError);
    }
  }

  /**
   * Parse a range reference string into a RangeReference object.
   */
  parseRangeReference(
    reference: string,
  ): Result<RangeReference, RefError> {
    const trimmed = reference.trim();
    if (!trimmed.includes(":")) {
      return err("INVALID_FORMAT" as RefError);
    }

    const [startPart, endPart] = trimmed.split(":", 2);
    if (!startPart || !endPart) {
      return err("INVALID_FORMAT" as RefError);
    }

    const startResult = this.parseCellReference(startPart);
    if (!startResult.ok) {
      return err(startResult.error);
    }

    const endResult = this.parseCellReference(endPart);
    if (!endResult.ok) {
      return err(endResult.error);
    }

    // Ensure start is before end
    const start = startResult.value;
    const end = endResult.value;

    const rangeRef: RangeReference = {
      start: {
        ...start,
        column: Math.min(start.column, end.column),
        row: Math.min(start.row, end.row),
      },
      end: {
        ...end,
        column: Math.max(start.column, end.column),
        row: Math.max(start.row, end.row),
      },
    };

    return ok(rangeRef);
  }

  /**
   * Convert a CellReference back to string format.
   */
  stringifyCellReference(ref: CellReference): string {
    const columnLetters = this.numberToColumnLetters(ref.column);
    const rowNumber = ref.row + 1; // Convert from zero-based

    const colPrefix = ref.columnAbsolute ? "$" : "";
    const rowPrefix = ref.rowAbsolute ? "$" : "";

    let result = `${colPrefix}${columnLetters}${rowPrefix}${rowNumber}`;

    if (ref.sheet) {
      const sheetPrefix = this.needsQuotes(ref.sheet)
        ? `'${ref.sheet}'!`
        : `${ref.sheet}!`;
      result = sheetPrefix + result;
    }

    return result;
  }

  /**
   * Convert a RangeReference back to string format.
   */
  stringifyRangeReference(ref: RangeReference): string {
    const startStr = this.stringifyCellReference(ref.start);
    const endStr = this.stringifyCellReference(ref.end);
    return `${startStr}:${endStr}`;
  }

  /**
   * Convert column letters (A, B, ..., Z, AA, AB, ...) to zero-based number.
   */
  private columnLettersToNumber(letters: string): number {
    let result = 0;
    for (let i = 0; i < letters.length; i++) {
      result = result * 26 + (letters.charCodeAt(i) - 64); // A=1, B=2, etc.
    }
    return result - 1; // Convert to zero-based
  }

  /**
   * Convert zero-based column number to letters (0=A, 1=B, ..., 25=Z, 26=AA, ...).
   */
  private numberToColumnLetters(num: number): string {
    let result = "";
    let n = num + 1; // Convert to one-based for calculation

    while (n > 0) {
      n--; // Adjust for zero-based alphabet
      result = String.fromCharCode((n % 26) + 65) + result; // A=65
      n = Math.floor(n / 26);
    }

    return result;
  }

  /**
   * Extract sheet reference from a full reference string.
   */
  private extractSheetReference(reference: string): {
    sheetName?: string;
    cellPart: string;
    sheetAbsolute: boolean;
  } {
    // Check for quoted sheet name: 'Sheet Name'!A1
    const quotedMatch = reference.match(/^'([^']+)'!(.+)$/);
    if (quotedMatch) {
      return {
        sheetName: quotedMatch[1],
        cellPart: quotedMatch[2],
        sheetAbsolute: true,
      };
    }

    // Check for unquoted sheet name: Sheet1!A1
    const unquotedMatch = reference.match(/^([^!]+)!(.+)$/);
    if (unquotedMatch) {
      return {
        sheetName: unquotedMatch[1],
        cellPart: unquotedMatch[2],
        sheetAbsolute: false,
      };
    }

    // No sheet reference
    return {
      cellPart: reference,
      sheetAbsolute: false,
    };
  }

  /**
   * Check if a sheet name needs to be quoted.
   */
  private needsQuotes(sheetName: string): boolean {
    // Sheet names need quotes if they contain spaces, special characters, or start with numbers
    return !/^[A-Za-z_][A-Za-z0-9_]*$/.test(sheetName);
  }

  /**
   * Check if a string represents a valid cell reference pattern.
   */
  isValidCellReferencePattern(reference: string): boolean {
    const result = this.parseCellReference(reference);
    return result.ok;
  }

  /**
   * Check if a string represents a valid range reference pattern.
   */
  isValidRangeReferencePattern(reference: string): boolean {
    const result = this.parseRangeReference(reference);
    return result.ok;
  }
}
