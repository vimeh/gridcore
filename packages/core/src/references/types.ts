/**
 * Core types for cell and range references in gridcore.
 * Supports absolute ($A$1), relative (A1), and mixed ($A1, A$1) references.
 */

/**
 * Represents a cell reference with support for absolute/relative column and row components.
 */
export interface CellReference {
  /** Zero-based column index */
  column: number;
  /** Zero-based row index */
  row: number;
  /** Whether the column should be treated as absolute (prefixed with $) */
  columnAbsolute: boolean;
  /** Whether the row should be treated as absolute (prefixed with $) */
  rowAbsolute: boolean;
  /** Sheet name if this is a cross-sheet reference */
  sheet?: string;
  /** Whether the sheet reference is absolute (enclosed in quotes if needed) */
  sheetAbsolute?: boolean;
}

/**
 * Represents a range reference with start and end cell references.
 */
export interface RangeReference {
  /** Starting cell of the range */
  start: CellReference;
  /** Ending cell of the range */
  end: CellReference;
}

/**
 * Union type for all reference types.
 */
export type Reference = CellReference | RangeReference;

/**
 * Reference type classification for UI and behavior purposes.
 */
export type ReferenceType =
  | "relative"
  | "absolute"
  | "mixed-column"
  | "mixed-row";

/**
 * Information about a reference found in a formula.
 */
export interface ReferenceInfo {
  /** The original text of the reference */
  text: string;
  /** Position in the formula string */
  position: number;
  /** Length of the reference text */
  length: number;
  /** Classified type of the reference */
  type: ReferenceType;
  /** Parsed reference object */
  reference: CellReference;
}

/**
 * Analysis result containing all references found in a formula.
 */
export interface ReferenceAnalysis {
  /** All references found in the formula */
  references: ReferenceInfo[];
}

/**
 * Options for reference adjustment operations.
 */
export interface AdjustmentOptions {
  /** Whether to adjust absolute references (normally false) */
  adjustAbsolute?: boolean;
  /** Whether to clamp results to valid sheet bounds */
  clampToBounds?: boolean;
  /** Maximum column index (XFD = 16383) */
  maxColumn?: number;
  /** Maximum row index (1048576 = 1048575 zero-based) */
  maxRow?: number;
}

/**
 * Direction for fill operations.
 */
export type FillDirection = "up" | "down" | "left" | "right";

/**
 * Error types for reference operations.
 */
export enum RefError {
  INVALID_FORMAT = "INVALID_FORMAT",
  OUT_OF_BOUNDS = "OUT_OF_BOUNDS",
  INVALID_SHEET = "INVALID_SHEET",
  CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
}

/**
 * Result of a reference adjustment operation.
 */
export interface AdjustmentResult {
  /** The adjusted reference */
  reference: CellReference;
  /** Whether the reference was actually changed */
  changed: boolean;
  /** Whether the reference went out of bounds and was clamped */
  clamped: boolean;
}
