import type { CellValue } from "../../../domain/models";
import type { MathOperationType } from "./BulkMathOperation";

/**
 * Convert a cell value to number if possible
 */
export function toNumber(value: CellValue): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    // Remove common formatting characters
    const cleaned = value.replace(/[\s,$%€£¥]/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  return null;
}

/**
 * Check if a value can be converted to a number
 */
export function isNumeric(value: CellValue): boolean {
  return toNumber(value) !== null;
}

/**
 * Check if a value is a valid percentage (between 0 and 100)
 */
export function isValidPercent(value: number): boolean {
  return value >= 0 && value <= 100;
}

/**
 * Perform a math operation on two numbers
 */
export function performOperation(
  operation: MathOperationType,
  value1: number,
  value2: number,
  decimalPlaces = 2,
): number {
  switch (operation) {
    case "add":
      return value1 + value2;
    case "subtract":
      return value1 - value2;
    case "multiply":
      return value1 * value2;
    case "divide":
      if (value2 === 0) {
        return NaN;
      }
      return value1 / value2;
    case "modulo":
      if (value2 === 0) {
        return NaN;
      }
      return value1 % value2;
    case "percent":
      return value1 + (value1 * value2) / 100;
    case "percentDecrease":
      return value1 - (value1 * value2) / 100;
    case "round":
      return Math.round(value1 * 10 ** decimalPlaces) / 10 ** decimalPlaces;
    case "floor":
      return Math.floor(value1);
    case "ceil":
      return Math.ceil(value1);
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }
}

/**
 * Apply rounding to a number
 */
export function applyRounding(
  value: number,
  decimalPlaces: number,
  roundingType: "round" | "floor" | "ceil" = "round",
): number {
  const multiplier = 10 ** decimalPlaces;
  switch (roundingType) {
    case "floor":
      return Math.floor(value * multiplier) / multiplier;
    case "ceil":
      return Math.ceil(value * multiplier) / multiplier;
    default:
      return Math.round(value * multiplier) / multiplier;
  }
}

/**
 * Format a number to a specific decimal places
 */
export function formatToDecimalPlaces(
  value: number,
  decimalPlaces: number,
): string {
  return value.toFixed(decimalPlaces);
}

/**
 * Format a number back to the appropriate type
 */
export function formatResult(
  result: number,
  originalValue: CellValue,
  preserveType: boolean = true,
): CellValue {
  // Handle special cases
  if (!Number.isFinite(result)) {
    return result; // NaN, Infinity, -Infinity
  }

  // If preserving type and original was a string that looked numeric, return as string
  if (
    preserveType &&
    typeof originalValue === "string" &&
    isNumeric(originalValue)
  ) {
    // Try to preserve the original string format style
    if (originalValue.includes("%")) {
      return `${result}%`;
    }
    if (originalValue.includes("$")) {
      return `$${result}`;
    }
    // For clean integers, return as integer string
    if (Number.isInteger(result) && !originalValue.includes(".")) {
      return result.toString();
    }
  }

  return result;
}

/**
 * Preserve the original data type when possible
 */
export function preserveType(original: CellValue, result: number): CellValue {
  if (typeof original === "boolean") {
    return result !== 0;
  }

  if (typeof original === "string") {
    // Check if original was an integer string
    if (/^-?\d+$/.test(original)) {
      return Math.floor(result).toString();
    }
    // Otherwise return as decimal string
    return result.toString();
  }

  // For numbers, check if original was integer
  if (typeof original === "number" && Number.isInteger(original)) {
    return Math.round(result);
  }

  return result;
}
