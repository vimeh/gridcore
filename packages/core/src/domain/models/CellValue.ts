export type CellValue = string | number | boolean | null | undefined;

export function isNumericValue(value: CellValue): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isStringValue(value: CellValue): value is string {
  return typeof value === "string";
}

export function isBooleanValue(value: CellValue): value is boolean {
  return typeof value === "boolean";
}

export function isEmptyValue(value: CellValue): value is null | undefined {
  return value === null || value === undefined;
}

export function parseNumericValue(value: CellValue): number | null {
  if (isNumericValue(value)) return value;
  if (isStringValue(value)) {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
