/**
 * Core reference system for gridcore.
 *
 * This module provides comprehensive support for Excel-compatible cell and range references,
 * including absolute ($A$1), relative (A1), and mixed ($A1, A$1) reference types.
 */

export { ReferenceAdjuster } from "./ReferenceAdjuster";
export { ReferenceDetector } from "./ReferenceDetector";

// Core classes
export { ReferenceParser } from "./ReferenceParser";
// Type definitions
export type {
  AdjustmentOptions,
  AdjustmentResult,
  CellReference,
  FillDirection,
  RangeReference,
  Reference,
  ReferenceAnalysis,
  ReferenceInfo,
  ReferenceType,
} from "./types";
export { RefError } from "./types";

// Utility functions and constants
export const EXCEL_LIMITS = {
  MAX_COLUMN: 16383, // XFD (zero-based)
  MAX_ROW: 1048575, // 1048576 - 1 (zero-based)
  MAX_COLUMN_LETTERS: "XFD",
  MAX_ROW_NUMBER: 1048576,
} as const;
