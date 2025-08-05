import type { CellValue } from "../../../domain/models";

/**
 * Convert cell value to string safely
 */
export function cellValueToString(value: CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

/**
 * Apply text transformation
 */
export function applyTransform(
  text: string,
  transformType: "upper" | "lower" | "trim" | "clean",
  cleanOptions?: {
    normalizeSpaces?: boolean;
    removeLineBreaks?: boolean;
    removeTabs?: boolean;
    removeOtherWhitespace?: boolean;
  },
): string {
  switch (transformType) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "trim":
      return text.trim();
    case "clean": {
      let cleaned = text;
      const opts = cleanOptions || {};

      if (opts.removeLineBreaks !== false) {
        cleaned = cleaned.replace(/[\r\n]+/g, " ");
      }
      if (opts.removeTabs !== false) {
        cleaned = cleaned.replace(/\t+/g, " ");
      }
      if (opts.removeOtherWhitespace !== false) {
        cleaned = cleaned.replace(/[\v\f]+/g, " ");
      }
      if (opts.normalizeSpaces !== false) {
        cleaned = cleaned.replace(/\s+/g, " ");
      }

      return cleaned.trim();
    }
    default:
      throw new Error(`Unsupported transform type: ${transformType}`);
  }
}

/**
 * Check if a value can be converted to string
 */
export function isText(value: CellValue): boolean {
  return value !== null && value !== undefined;
}
